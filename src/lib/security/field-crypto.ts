import crypto from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const TAG_BYTES = 16;
const PREFIX = 'enc:v1:';

export type EncryptionDomain = 'totp-secret' | 'alert-channels' | 'google-oauth';

function parseDirect32ByteKey(raw?: string | null): Buffer | null {
  const trimmed = raw?.trim();
  if (!trimmed || trimmed.includes('[SENSITIVE]')) return null;

  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    return Buffer.from(trimmed, 'hex');
  }
  if (/^[A-Za-z0-9+/]{43}=?$/.test(trimmed) || /^[A-Za-z0-9+/]{42}==$/.test(trimmed)) {
    const decoded = Buffer.from(trimmed, 'base64');
    if (decoded.length === 32) return decoded;
  }
  const utf8 = Buffer.from(trimmed, 'utf-8');
  if (utf8.length === 32) return utf8;
  return null;
}

function deriveDomainKey(masterMaterial: Buffer | string, domain: EncryptionDomain): Buffer {
  return Buffer.from(
    crypto.hkdfSync(
      'sha256',
      masterMaterial,
      'fiorix-field-crypto-salt-v1',
      `fiorix:at-rest:${domain}`,
      32
    )
  );
}

/**
 * Retorna a lista ordenada de chaves candidatas para um domínio:
 * 1) Chave explícita de criptografia (FIORIX_INTEGRATION_ENCRYPTION_KEY ou GOOGLE_TOKEN_ENCRYPTION_KEY)
 * 2) Derivação HKDF separada por domínio a partir de AUTH_SECRET / NEXTAUTH_SECRET
 * Em produção, falha de forma fechada (fail-closed) caso nenhum segredo real exista no ambiente.
 */
export function resolveDomainKeys(domain: EncryptionDomain): Buffer[] {
  const keys: Buffer[] = [];

  if (domain === 'google-oauth') {
    const googleDirect = parseDirect32ByteKey(process.env.GOOGLE_TOKEN_ENCRYPTION_KEY);
    if (googleDirect) keys.push(googleDirect);
  }

  const integrationDirect = parseDirect32ByteKey(process.env.FIORIX_INTEGRATION_ENCRYPTION_KEY);
  if (integrationDirect) {
    keys.push(deriveDomainKey(integrationDirect, domain));
  }

  const authSecret = (process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || '').trim();
  if (authSecret && !authSecret.includes('[SENSITIVE]') && authSecret.length >= 16) {
    keys.push(deriveDomainKey(authSecret, domain));
  }

  if (keys.length === 0) {
    const isTestOrDev =
      process.env.NODE_ENV === 'test' ||
      Boolean(process.env.VITEST) ||
      process.env.NODE_ENV === 'development';

    if (isTestOrDev) {
      keys.push(deriveDomainKey('fiorix-ephemeral-dev-test-only-key-material', domain));
    } else {
      throw new Error(
        `[FIORIX Security] Nenhuma chave criptográfica configurada para proteger dados em repouso (${domain}). ` +
          `Configure FIORIX_INTEGRATION_ENCRYPTION_KEY (64 hex chars) ou AUTH_SECRET no servidor.`
      );
    }
  }

  return keys;
}

export function isEncryptedFieldSecret(value?: string | null): boolean {
  return typeof value === 'string' && value.startsWith(PREFIX);
}

/**
 * Criptografa um segredo em repouso usando AES-256-GCM autenticado.
 * Idempotente: se o valor já possuir o prefixo `enc:v1:`, retorna como está.
 */
export function encryptFieldSecret(plaintext: string | null | undefined, domain: EncryptionDomain): string {
  if (!plaintext) return '';
  if (isEncryptedFieldSecret(plaintext)) return plaintext;

  const [primaryKey] = resolveDomainKeys(domain);
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, primaryKey, iv);

  let cipherHex = cipher.update(plaintext, 'utf8', 'hex');
  cipherHex += cipher.final('hex');
  const tagHex = cipher.getAuthTag().toString('hex');

  return `${PREFIX}${iv.toString('hex')}:${cipherHex}:${tagHex}`;
}

/**
 * Descriptografa um segredo persistido com `enc:v1:`.
 * Compatibilidade retroativa total: valores legados em texto plano (sem prefixo `enc:v1:`)
 * são retornados transparentemente até a próxima gravação.
 */
export function decryptFieldSecret(stored: string | null | undefined, domain: EncryptionDomain): string {
  if (!stored) return '';
  if (!isEncryptedFieldSecret(stored)) {
    return stored;
  }

  const rawBody = stored.slice(PREFIX.length);
  const parts = rawBody.split(':');
  if (parts.length !== 3) {
    throw new Error(`[FIORIX Security] Formato de segredo criptografado inválido (${domain}).`);
  }

  const [ivHex, cipherHex, tagHex] = parts;
  if (ivHex.length !== IV_BYTES * 2 || tagHex.length !== TAG_BYTES * 2) {
    throw new Error(`[FIORIX Security] Metadados AES-GCM inválidos (${domain}).`);
  }

  const candidateKeys = resolveDomainKeys(domain);
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');

  for (const key of candidateKeys) {
    try {
      const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
      decipher.setAuthTag(tag);
      let decrypted = decipher.update(cipherHex, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch {
      // Tenta próxima chave candidata (ex.: rotação AUTH_SECRET -> FIORIX_INTEGRATION_ENCRYPTION_KEY)
    }
  }

  throw new Error(
    `[FIORIX Security] Falha ao descriptografar segredo em repouso (${domain}): chave incompatível ou dados adulterados.`
  );
}

