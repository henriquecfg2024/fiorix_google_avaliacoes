/**
 * Módulo de criptografia AES-256-GCM para credenciais de integrações externas.
 *
 * SEGURANÇA:
 * - Executado EXCLUSIVAMENTE no backend (Node.js server runtime).
 * - NÃO importar em componentes 'use client' ou código que rode no navegador.
 * - A chave de criptografia é lida da variável de ambiente FIORIX_INTEGRATION_ENCRYPTION_KEY.
 * - A chave deve ter exatamente 32 bytes (64 caracteres hex ou 44 caracteres base64).
 * - Em produção, a aplicação falha se a variável estiver ausente ou inválida.
 * - Nenhuma chave padrão, fallback ou geração automática é utilizada.
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;   // 128 bits
const AUTH_TAG_LENGTH = 16; // 128 bits
const REQUIRED_KEY_BYTES = 32;

const ENV_VAR_NAME = 'FIORIX_INTEGRATION_ENCRYPTION_KEY';

/** Cache da chave derivada para evitar reprocessamento a cada chamada */
let _cachedKey: Buffer | null = null;

/**
 * Obtém e valida a chave de criptografia da variável de ambiente.
 * Falha de forma controlada se a chave estiver ausente ou inválida.
 */
function getEncryptionKey(): Buffer {
  if (_cachedKey) return _cachedKey;

  const rawKey = process.env[ENV_VAR_NAME];

  if (!rawKey || rawKey.trim().length === 0) {
    throw new Error(
      `[FIORIX Security] Variável de ambiente ${ENV_VAR_NAME} não configurada. ` +
      `A criptografia de credenciais de integrações requer esta variável. ` +
      `Gere com: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
    );
  }

  let keyBuffer: Buffer;

  // Tentar interpretar como hex (64 chars = 32 bytes)
  if (/^[0-9a-fA-F]{64}$/.test(rawKey.trim())) {
    keyBuffer = Buffer.from(rawKey.trim(), 'hex');
  }
  // Tentar interpretar como base64 (44 chars padded = 32 bytes)
  else if (/^[A-Za-z0-9+/]{43}=?$/.test(rawKey.trim()) || /^[A-Za-z0-9+/]{42}==$/.test(rawKey.trim())) {
    keyBuffer = Buffer.from(rawKey.trim(), 'base64');
  }
  // Tentar como UTF-8 direto (exatamente 32 bytes)
  else {
    keyBuffer = Buffer.from(rawKey.trim(), 'utf-8');
  }

  if (keyBuffer.length !== REQUIRED_KEY_BYTES) {
    throw new Error(
      `[FIORIX Security] ${ENV_VAR_NAME} inválida: esperados ${REQUIRED_KEY_BYTES} bytes, ` +
      `recebidos ${keyBuffer.length} bytes. ` +
      `Use hex (64 chars) ou base64 (44 chars). ` +
      `Gere com: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
    );
  }

  _cachedKey = keyBuffer;
  return _cachedKey;
}

export interface EncryptedPayload {
  encrypted: string; // hex (ciphertext + authTag)
  iv: string;        // hex
}

/**
 * Criptografa um texto plano usando AES-256-GCM.
 * Retorna o texto cifrado (com authTag concatenado) + IV em hexadecimal.
 */
export function encryptValue(plaintext: string): EncryptedPayload {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf-8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();
  encrypted += authTag.toString('hex');

  return {
    encrypted,
    iv: iv.toString('hex'),
  };
}

/**
 * Decriptografa um valor cifrado com AES-256-GCM.
 */
export function decryptValue(encryptedHex: string, ivHex: string): string {
  const key = getEncryptionKey();
  const iv = Buffer.from(ivHex, 'hex');

  const authTagHex = encryptedHex.slice(-AUTH_TAG_LENGTH * 2);
  const cipherTextHex = encryptedHex.slice(0, -AUTH_TAG_LENGTH * 2);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));

  let decrypted = decipher.update(cipherTextHex, 'hex', 'utf-8');
  decrypted += decipher.final('utf-8');

  return decrypted;
}

/**
 * Gera uma representação mascarada de um valor sensível.
 * Ex: "sk_live_abc123XYZ" → "••••••••3XYZ"
 * Nunca retorna o valor original.
 */
export function maskSensitiveValue(value: string): string {
  if (!value) return '';
  const visibleChars = Math.min(4, Math.floor(value.length / 3));
  if (value.length <= visibleChars) return '••••••••';
  return '••••••••' + value.slice(-visibleChars);
}

/**
 * Criptografa um objeto de configuração JSON e retorna os dados para persistência.
 * A máscara é derivada do campo apiKey ou token, nunca do valor completo.
 */
export function encryptConfig(config: Record<string, unknown>): {
  encrypted: string;
  iv: string;
  mask: string;
} {
  const json = JSON.stringify(config);
  const { encrypted, iv } = encryptValue(json);

  const apiKey = (config.apiKey as string) || (config.token as string) || '';
  const mask = maskSensitiveValue(apiKey);

  return { encrypted, iv, mask };
}

/**
 * Decriptografa uma configuração persistida e retorna o objeto original.
 */
export function decryptConfig(encryptedHex: string, ivHex: string): Record<string, unknown> {
  const json = decryptValue(encryptedHex, ivHex);
  return JSON.parse(json);
}
