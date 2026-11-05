import { generateSecret, generateURI, verifySync, generateSync } from 'otplib';
import QRCode from 'qrcode';

const ISSUER = 'FIORIX';

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
 * Valida um código TOTP de 6 dígitos (síncrono)
 */
export function verifyTotpToken(token: string, secret: string): boolean {
  try {
    const result = verifySync({ token, secret });
    return result.valid === true;
  } catch {
    return false;
  }
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
