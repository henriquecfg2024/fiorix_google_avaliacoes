import crypto from 'crypto';

/**
 * Módulo de criptografia AES-256-GCM para credenciais de integrações externas.
 * A chave de criptografia é derivada da variável de ambiente INTEGRATION_ENCRYPTION_KEY.
 * Se não definida, usa um fallback derivado de DATABASE_URL (não recomendado para produção).
 */

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const envKey = process.env.INTEGRATION_ENCRYPTION_KEY;
  if (envKey && envKey.length >= 32) {
    return Buffer.from(envKey.slice(0, 32), 'utf-8');
  }
  // Fallback: derivar da DATABASE_URL (hash SHA-256 produz 32 bytes)
  const seed = process.env.DATABASE_URL || 'fiorix-default-key-change-me';
  return crypto.createHash('sha256').update(seed).digest();
}

export interface EncryptedPayload {
  encrypted: string; // hex
  iv: string;        // hex
}

/**
 * Criptografa um texto plano usando AES-256-GCM.
 * Retorna o texto cifrado + IV em hexadecimal.
 */
export function encryptValue(plaintext: string): EncryptedPayload {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf-8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();
  // Concatenar authTag ao final do texto cifrado
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

  // Separar authTag do texto cifrado
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
 */
export function maskSensitiveValue(value: string): string {
  if (!value) return '';
  const visibleChars = Math.min(4, Math.floor(value.length / 3));
  if (value.length <= visibleChars) return '••••••••';
  return '••••••••' + value.slice(-visibleChars);
}

/**
 * Criptografa um objeto de configuração JSON e retorna os dados para persistência.
 */
export function encryptConfig(config: Record<string, unknown>): {
  encrypted: string;
  iv: string;
  mask: string;
} {
  const json = JSON.stringify(config);
  const { encrypted, iv } = encryptValue(json);

  // Gera máscara baseada no campo mais relevante (apiKey ou token)
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
