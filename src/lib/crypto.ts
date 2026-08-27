import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits para GCM
const TAG_LENGTH = 16; // 128 bits

function getEncryptionKey(): Buffer {
  const keyHex = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY;
  if (!keyHex || keyHex.length !== 64) {
    throw new Error(
      'GOOGLE_TOKEN_ENCRYPTION_KEY ausente ou inválida. ' +
      'Gere com: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }
  return Buffer.from(keyHex, 'hex');
}

/**
 * Criptografa um token em texto plano.
 * Formato de saída: iv_hex:ciphertext_hex:tag_hex
 */
export function encryptToken(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${encrypted}:${tag.toString('hex')}`;
}

/**
 * Descriptografa um token criptografado.
 * Aceita formato: iv_hex:ciphertext_hex:tag_hex
 *
 * Se o valor não parece criptografado (não contém ':' ou tem menos de 3 partes),
 * retorna o valor como está — compatibilidade com tokens antigos em texto plano.
 */
export function decryptToken(encryptedValue: string): string {
  const parts = encryptedValue.split(':');

  // Compatibilidade: tokens antigos em texto plano não têm o formato iv:cipher:tag
  if (parts.length !== 3) {
    return encryptedValue;
  }

  const [ivHex, ciphertextHex, tagHex] = parts;

  // Validação extra: IV deve ter 24 hex chars (12 bytes), tag deve ter 32 hex chars (16 bytes)
  if (ivHex.length !== IV_LENGTH * 2 || tagHex.length !== TAG_LENGTH * 2) {
    return encryptedValue;
  }

  try {
    const key = getEncryptionKey();
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(ciphertextHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error: any) {
    throw new Error('Falha ao descriptografar o token de segurança: dados corrompidos ou chave inválida.');
  }
}
