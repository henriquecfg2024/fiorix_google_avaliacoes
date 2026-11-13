import { generateSecret, generateURI, verifySync } from 'otplib';
import QRCode from 'qrcode';
import { prisma } from '@/lib/prisma';
import {
  decryptFieldSecret,
  encryptFieldSecret,
  isEncryptedFieldSecret,
} from '@/lib/security/field-crypto';

export function encryptTotpSecret(secret: string): string {
  return encryptFieldSecret(secret, 'totp-secret');
}

export function decryptTotpSecret(storedSecret: string | null | undefined): string {
  return decryptFieldSecret(storedSecret, 'totp-secret');
}

export function isEncryptedTotpSecret(storedSecret: string | null | undefined): boolean {
  return isEncryptedFieldSecret(storedSecret);
}

const ISSUER = 'FIORIX';
const TOTP_REPLAY_TTL_MS = 120_000; // 120s cobre o step atual + adjacente
const usedTotpCodes = new Map<string, number>();
let totpReplayTableEnsured = false;

function pruneUsedTotpCodes(now: number): void {
  if (usedTotpCodes.size <= 500) return;
  for (const [k, exp] of usedTotpCodes.entries()) {
    if (exp <= now) usedTotpCodes.delete(k);
  }
}

/**
 * Gera um novo segredo TOTP para o usuário
 */
export function generateTotpSecret(): string {
  return generateSecret();
}

/**
 * Gera a URI otpauth:// para o QR Code
 */
export function generateTotpUri(email: string, secret: string): string {
  return generateURI({
    issuer: ISSUER,
    label: email,
    secret,
    algorithm: 'sha1',
    digits: 6,
    period: 30,
  });
}

/**
 * Gera o QR Code como data URL (base64 PNG)
 */
export async function generateQRCodeDataUrl(otpauthUrl: string): Promise<string> {
  return QRCode.toDataURL(otpauthUrl, {
    width: 256,
    margin: 2,
    color: {
      dark: '#ffffff',
      light: '#0a0a0f',
    },
  });
}

/**
 * Valida um código TOTP de 6 dígitos (síncrono, com proteção anti-replay em memória quando replayScope informado)
 */
export function verifyTotpToken(token: string, secret: string, replayScope?: string): boolean {
  try {
    const cleanToken = String(token || '').replace(/\s+/g, '');
    if (!/^\d{6}$/.test(cleanToken) || !secret) return false;

    const now = Date.now();
    pruneUsedTotpCodes(now);

    const replayKey = replayScope ? `${replayScope}:${cleanToken}` : null;
    if (replayKey) {
      const exp = usedTotpCodes.get(replayKey);
      if (exp && exp > now) {
        return false; // Código de 6 dígitos já utilizado recentemente (anti-replay)
      }
    }

    const plainSecret = decryptTotpSecret(secret);
    if (!plainSecret) return false;

    const result = verifySync({ token: cleanToken, secret: plainSecret });
    if (result.valid !== true) return false;

    if (replayKey) {
      usedTotpCodes.set(replayKey, now + TOTP_REPLAY_TTL_MS);
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Valida código TOTP com proteção anti-replay persistida no PostgreSQL (multi-instância Vercel)
 */
export async function verifyTotpTokenAsync(
  token: string,
  secret: string,
  replayScope: string
): Promise<boolean> {
  const cleanToken = String(token || '').replace(/\s+/g, '');
  if (!verifyTotpToken(cleanToken, secret, replayScope)) {
    return false;
  }

  const isTestEnv = Boolean(process.env.VITEST || process.env.NODE_ENV === 'test');
  if (isTestEnv || !replayScope) {
    return true;
  }

  try {
    if (!totpReplayTableEnsured) {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS public.fiorix_totp_replay_guard (
          replay_key TEXT PRIMARY KEY,
          expires_at TIMESTAMPTZ NOT NULL
        )
      `);
      await prisma.$executeRawUnsafe(
        `ALTER TABLE public.fiorix_totp_replay_guard ENABLE ROW LEVEL SECURITY`
      );
      totpReplayTableEnsured = true;
    }

    await prisma.$executeRawUnsafe(
      `DELETE FROM public.fiorix_totp_replay_guard WHERE expires_at <= NOW()`
    );

    const replayKey = `${replayScope}:${cleanToken}`;
    const inserted = await prisma.$queryRawUnsafe<Array<{ replay_key: string }>>(
      `INSERT INTO public.fiorix_totp_replay_guard (replay_key, expires_at)
       VALUES ($1, NOW() + interval '120 seconds')
       ON CONFLICT (replay_key) DO NOTHING
       RETURNING replay_key`,
      replayKey
    );

    if (inserted.length === 0) {
      return false; // Já consumido em outra instância serverless dentro da janela de 120s
    }
  } catch {
    // Em caso de indisponibilidade pontual de DDL, mantém anti-replay em memória já validado acima
  }

  return true;
}

/**
 * Verifica se o role sugere 2FA por padrão
 */
export function roleRequires2FA(role: string): boolean {
  return role === 'ADMIN' || role === 'MASTER';
}

/**
 * Verifica se um usuário específico deve autenticar com 2FA (TOTP).
 * - MASTER sempre exige 2FA por política de segurança da plataforma.
 * - Demais funções (ADMIN, SUBSTITUTO, RH, USER, COLABORADOR, VISITANTE)
 *   respeitam a configuração individual no cadastro (`totpRequired` / `totpEnabled`).
 */
export function userRequires2FA(user: {
  role?: string | null;
  totpRequired?: boolean | null;
  totpEnabled?: boolean | null;
}): boolean {
  if (user.role === 'MASTER') return true;
  return Boolean(user.totpRequired || user.totpEnabled);
}
