import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import {
  decryptFieldSecret,
  isEncryptedFieldSecret,
  resolveDomainKeys,
} from './security/field-crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits para GCM
const TAG_LENGTH = 16; // 128 bits

/**
 * Criptografa um token OAuth em repouso com AES-256-GCM.
 * Utiliza GOOGLE_TOKEN_ENCRYPTION_KEY (primária) ou derivação HKDF segura sem fallback estático hardcoded.
 * Formato de saída: iv_hex:ciphertext_hex:tag_hex
 */
export function encryptToken(plaintext: string): string {
  if (!plaintext) return '';
  const [key] = resolveDomainKeys('google-oauth');
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${encrypted}:${tag.toString('hex')}`;
}

/**
 * Descriptografa um token OAuth criptografado (`iv:cipher:tag` ou `enc:v1:...`),
 * mantendo compatibilidade retroativa com registros legados em texto plano.
 */
export function decryptToken(encryptedValue: string): string {
  if (!encryptedValue) return '';
  if (isEncryptedFieldSecret(encryptedValue)) {
    return decryptFieldSecret(encryptedValue, 'google-oauth');
  }

  const parts = encryptedValue.split(':');
  if (parts.length !== 3) {
    return encryptedValue;
  }

  const [ivHex, ciphertextHex, tagHex] = parts;
  if (ivHex.length !== IV_LENGTH * 2 || tagHex.length !== TAG_LENGTH * 2) {
    return encryptedValue;
  }

  const candidateKeys = resolveDomainKeys('google-oauth');
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');

  for (const key of candidateKeys) {
    try {
      const decipher = createDecipheriv(ALGORITHM, key, iv);
      decipher.setAuthTag(tag);
      let decrypted = decipher.update(ciphertextHex, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch {
      // Tenta próxima chave candidata
    }
  }

  throw new Error('Falha ao descriptografar o token de segurança: dados corrompidos ou chave inválida.');
}
