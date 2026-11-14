import { createHash } from 'node:crypto';
import { getSupabaseAdmin } from '@/lib/supabase';

export const EPHEMERAL_DOCUMENTAL_BUCKET =
  process.env.SUPABASE_DOCUMENTAL_BUCKET?.trim() || 'fiorix-documental-ephemeral';

export const MAX_STORAGE_UPLOAD_BYTES = 48 * 1024 * 1024; // 48 MB
export const STORAGE_DOWNLOAD_TTL_SECONDS = 900; // 15 min
export const STORAGE_OBJECT_TTL_MS = 2 * 60 * 60 * 1000; // 2 horas
export const STORAGE_MIN_CONNECTOR_VERSION = 'v2.6.13';

const BUCKET_CHECK_CACHE_MS = 10 * 60 * 1000;
const CLEANUP_THROTTLE_MS = 10 * 60 * 1000;
const MAX_BATCH_PREPARE_ITEMS = 120;
const PREPARE_BATCH_CONCURRENCY = 6;

const TENANT_ID_REGEX = /^[a-zA-Z0-9_-]{1,128}$/;
const ROOT_ID_REGEX = /^[a-z0-9_-]{1,32}$/;
const VARIANT_REGEX = /^[a-z0-9_-]{1,32}$/;
const EXT_REGEX = /^\.[a-z0-9]{1,8}$/;
const TENANT_OBJECT_PATH_REGEX = /^[a-zA-Z0-9_-]{1,128}\/[a-f0-9]{64}(?:\.[a-z0-9]{1,8})?$/;

let bucketVerifiedAt = 0;
let bucketEnsureInFlight: Promise<void> | null = null;
const cleanupLastRunByTenant = new Map<string, number>();

export function __resetEphemeralStorageStateForTests(): void {
  bucketVerifiedAt = 0;
  bucketEnsureInFlight = null;
  cleanupLastRunByTenant.clear();
}

export function isSignedStorageDocumentalEnabled(): boolean {
  const raw = process.env.USE_SIGNED_STORAGE_DOCUMENTAL;
  if (raw === undefined || raw === null || raw.trim() === '') return true;
  const normalized = raw.trim().toLowerCase();
  return !['false', '0', 'off', 'no'].includes(normalized);
}

export function normalizeRelativeStorageKey(relativePath: string): string {
  const cleaned = relativePath
    .replace(/\\/g, '/')
    .replace(/\/+/g, '/')
    .replace(/^(\.\/)+/, '')
    .replace(/^\/+/, '')
    .trim();

  if (!cleaned || cleaned === '.') {
    throw new Error('Caminho relativo documental invalido para storage.');
  }
  const segments = cleaned.split('/');
  if (segments.some((seg) => !seg || seg === '.' || seg === '..' || seg.includes('\0'))) {
    throw new Error('Caminho relativo contem segmento proibido.');
  }
  return cleaned;
}

export function normalizeStorageExt(ext: string | undefined): string {
  if (!ext) return '.bin';
  const trimmed = ext.trim().toLowerCase();
  const withDot = trimmed.startsWith('.') ? trimmed : `.${trimmed}`;
  return EXT_REGEX.test(withDot) ? withDot : '.bin';
}

export interface StoragePathInput {
  tenantId: string;
  rootId: string;
  relativePath: string;
  sizeBytes: number;
  mtimeMs: number;
  ext?: string;
  variant?: string;
}

export function computeDocumentStorageObjectPath(input: StoragePathInput): string {
  const tenantId = input.tenantId.trim();
  const rootId = input.rootId.trim();
  const variant = (input.variant || 'raw').trim().toLowerCase();

  if (!TENANT_ID_REGEX.test(tenantId)) {
    throw new Error('tenantId invalido para chave de storage documental.');
  }
  if (!ROOT_ID_REGEX.test(rootId)) {
    throw new Error('rootId invalido para chave de storage documental.');
  }
  if (!VARIANT_REGEX.test(variant)) {
    throw new Error('variant invalido para chave de storage documental.');
  }

  const normalizedRel = normalizeRelativeStorageKey(input.relativePath);
  const safeSize = Number.isFinite(input.sizeBytes) && input.sizeBytes >= 0 ? Math.trunc(input.sizeBytes) : 0;
  const safeMtime = Number.isFinite(input.mtimeMs) && input.mtimeMs >= 0 ? Math.trunc(input.mtimeMs) : 0;
  const safeExt = normalizeStorageExt(input.ext);

  const hash = createHash('sha256')
    .update(`${tenantId}|${rootId}|${normalizedRel}|${safeSize}|${safeMtime}|${variant}`)
    .digest('hex');

  return `${tenantId}/${hash}${safeExt}`;
}

export function isValidTenantStoragePath(tenantId: string, storagePath: string): boolean {
  if (!tenantId || !storagePath || typeof storagePath !== 'string') return false;
  if (!TENANT_ID_REGEX.test(tenantId)) return false;
  if (storagePath.includes('..') || storagePath.includes('\\') || storagePath.includes('\0')) return false;
  if (!storagePath.startsWith(`${tenantId}/`)) return false;
  return TENANT_OBJECT_PATH_REGEX.test(storagePath);
}

export async function ensureEphemeralBucketExists(): Promise<void> {
  const now = Date.now();
  if (bucketVerifiedAt > 0 && now - bucketVerifiedAt < BUCKET_CHECK_CACHE_MS) {
    return;
  }
  if (bucketEnsureInFlight) {
    return bucketEnsureInFlight;
  }

  bucketEnsureInFlight = (async () => {
    const admin = getSupabaseAdmin();
    const { data: existing, error: getErr } = await admin.storage.getBucket(EPHEMERAL_DOCUMENTAL_BUCKET);

    if (existing && !getErr) {
      if (existing.public) {
        await admin.storage.updateBucket(EPHEMERAL_DOCUMENTAL_BUCKET, {
          public: false,
          fileSizeLimit: MAX_STORAGE_UPLOAD_BYTES,
        });
      }
      bucketVerifiedAt = Date.now();
      return;
    }

    const { error: createErr } = await admin.storage.createBucket(EPHEMERAL_DOCUMENTAL_BUCKET, {
      public: false,
      fileSizeLimit: MAX_STORAGE_UPLOAD_BYTES,
    });

    if (createErr) {
      const msg = (createErr.message || '').toLowerCase();
      if (!msg.includes('already exists') && !msg.includes('duplicate')) {
        throw new Error(`Falha ao garantir bucket documental privado: ${createErr.message}`);
      }
    }

    bucketVerifiedAt = Date.now();
  })().finally(() => {
    bucketEnsureInFlight = null;
  });

  return bucketEnsureInFlight;
}

export interface PreparedSignedUpload {
  storagePath: string;
  alreadyExists: boolean;
  signedUploadUrl: string | null;
  token: string | null;
}

async function prepareSingleSignedUploadInternal(
  tenantId: string,
  item: Omit<StoragePathInput, 'tenantId'>,
): Promise<PreparedSignedUpload> {
  if (!isSignedStorageDocumentalEnabled()) {
    throw new Error('Signed Storage documental desabilitado por configuracao.');
  }
  if (!Number.isFinite(item.sizeBytes) || item.sizeBytes <= 0 || item.sizeBytes > MAX_STORAGE_UPLOAD_BYTES) {
    throw new Error(`Tamanho de arquivo fora da faixa permitida para storage (${item.sizeBytes} bytes).`);
  }

  const storagePath = computeDocumentStorageObjectPath({ tenantId, ...item });
  const admin = getSupabaseAdmin();
  const bucket = admin.storage.from(EPHEMERAL_DOCUMENTAL_BUCKET);

  try {
    const existsRes = await bucket.exists(storagePath);
    if (!existsRes.error && existsRes.data === true) {
      return {
        storagePath,
        alreadyExists: true,
        signedUploadUrl: null,
        token: null,
      };
    }
  } catch {
    // Segue para createSignedUploadUrl caso exists nao esteja disponivel
  }

  const { data, error } = await bucket.createSignedUploadUrl(storagePath, { upsert: true });
  if (error || !data?.signedUrl) {
    throw new Error(error?.message || 'Nao foi possivel emitir signed upload URL.');
  }

  return {
    storagePath,
    alreadyExists: false,
    signedUploadUrl: data.signedUrl,
    token: data.token ?? null,
  };
}

export async function cleanupExpiredTenantStorageObjects(tenantId: string): Promise<number> {
  if (!TENANT_ID_REGEX.test(tenantId)) return 0;

  const admin = getSupabaseAdmin();
  const bucket = admin.storage.from(EPHEMERAL_DOCUMENTAL_BUCKET);
  const { data: listed, error } = await bucket.list(tenantId, {
    limit: 100,
    sortBy: { column: 'created_at', order: 'asc' },
  });

  if (error || !Array.isArray(listed) || listed.length === 0) {
    return 0;
  }

  const cutoffMs = Date.now() - STORAGE_OBJECT_TTL_MS;
  const expiredPaths: string[] = [];

  for (const obj of listed) {
    if (!obj || typeof obj.name !== 'string') continue;
    const tsRaw = obj.created_at || obj.updated_at;
    const ts = typeof tsRaw === 'string' ? Date.parse(tsRaw) : NaN;
    if (!Number.isFinite(ts) || ts >= cutoffMs) continue;
    const candidate = `${tenantId}/${obj.name}`;
    if (isValidTenantStoragePath(tenantId, candidate)) {
      expiredPaths.push(candidate);
    }
  }

  if (expiredPaths.length === 0) return 0;
  const { error: removeErr } = await bucket.remove(expiredPaths);
  return removeErr ? 0 : expiredPaths.length;
}

function scheduleOpportunisticCleanup(tenantId: string): void {
  const now = Date.now();
  const lastRun = cleanupLastRunByTenant.get(tenantId) ?? 0;
  if (now - lastRun < CLEANUP_THROTTLE_MS) return;

  cleanupLastRunByTenant.set(tenantId, now);
  void cleanupExpiredTenantStorageObjects(tenantId).catch(() => {
    // Melhor esforco em segundo plano; nao impacta o upload corrente
  });
}

export async function prepareConnectorSignedUpload(
  tenantId: string,
  item: Omit<StoragePathInput, 'tenantId'>,
): Promise<PreparedSignedUpload> {
  await ensureEphemeralBucketExists();
  scheduleOpportunisticCleanup(tenantId);
  return prepareSingleSignedUploadInternal(tenantId, item);
}

export async function prepareConnectorSignedUploadBatch(
  tenantId: string,
  items: Array<Omit<StoragePathInput, 'tenantId'>>,
): Promise<PreparedSignedUpload[]> {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('Lote de upload vazio.');
  }
  if (items.length > MAX_BATCH_PREPARE_ITEMS) {
    throw new Error(`Lote excede limite de ${MAX_BATCH_PREPARE_ITEMS} objetos.`);
  }

  await ensureEphemeralBucketExists();
  scheduleOpportunisticCleanup(tenantId);

  const results: PreparedSignedUpload[] = new Array(items.length);
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const idx = cursor++;
      results[idx] = await prepareSingleSignedUploadInternal(tenantId, items[idx]);
    }
  }

  const workerCount = Math.min(PREPARE_BATCH_CONCURRENCY, items.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

export async function mintTenantSignedDownloadUrl(
  tenantId: string,
  storagePath: string,
  expiresInSec = STORAGE_DOWNLOAD_TTL_SECONDS,
): Promise<{ signedUrl: string; expiresAt: string } | null> {
  if (!isSignedStorageDocumentalEnabled()) return null;
  if (!isValidTenantStoragePath(tenantId, storagePath)) return null;

  try {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin.storage
      .from(EPHEMERAL_DOCUMENTAL_BUCKET)
      .createSignedUrl(storagePath, expiresInSec);

    if (error || !data?.signedUrl) {
      return null;
    }

    return {
      signedUrl: data.signedUrl,
      expiresAt: new Date(Date.now() + expiresInSec * 1000).toISOString(),
    };
  } catch {
    return null;
  }
}

export async function mintTenantSignedBatchUrls(
  tenantId: string,
  storagePaths: string[],
  expiresInSec = STORAGE_DOWNLOAD_TTL_SECONDS,
): Promise<{ signedUrls: string[]; expiresAt: string } | null> {
  if (!isSignedStorageDocumentalEnabled()) return null;
  if (!Array.isArray(storagePaths) || storagePaths.length === 0 || storagePaths.length > MAX_BATCH_PREPARE_ITEMS) {
    return null;
  }
  if (!storagePaths.every((p) => isValidTenantStoragePath(tenantId, p))) {
    return null;
  }

  try {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin.storage
      .from(EPHEMERAL_DOCUMENTAL_BUCKET)
      .createSignedUrls(storagePaths, expiresInSec);

    if (error || !Array.isArray(data) || data.length !== storagePaths.length) {
      return null;
    }

    const signedUrls: string[] = [];
    for (const entry of data) {
      if (!entry || entry.error || !entry.signedUrl) {
        return null;
      }
      signedUrls.push(entry.signedUrl);
    }

    return {
      signedUrls,
      expiresAt: new Date(Date.now() + expiresInSec * 1000).toISOString(),
    };
  } catch {
    return null;
  }
}

export async function deleteTenantStorageObjects(tenantId: string, storagePaths: string[]): Promise<number> {
  if (!TENANT_ID_REGEX.test(tenantId) || !Array.isArray(storagePaths) || storagePaths.length === 0) {
    return 0;
  }
  const validPaths = Array.from(new Set(storagePaths.filter((p) => isValidTenantStoragePath(tenantId, p))));
  if (validPaths.length === 0) return 0;

  try {
    const admin = getSupabaseAdmin();
    let deleted = 0;
    for (let i = 0; i < validPaths.length; i += 100) {
      const slice = validPaths.slice(i, i + 100);
      const { error } = await admin.storage.from(EPHEMERAL_DOCUMENTAL_BUCKET).remove(slice);
      if (!error) deleted += slice.length;
    }
    return deleted;
  } catch {
    return 0;
  }
}

export interface HydratedDocumentResult {
  result: Record<string, unknown>;
  storageValid: boolean;
}

export async function hydrateDocumentJobResultForBrowser(
  tenantId: string,
  rawResult: unknown,
): Promise<{ result: unknown; storageValid: boolean }> {
  if (!rawResult || typeof rawResult !== 'object' || Array.isArray(rawResult)) {
    return { result: rawResult, storageValid: true };
  }

  const record = rawResult as Record<string, unknown>;
  const singlePath = typeof record.storagePath === 'string' ? record.storagePath : null;
  const pagePaths = Array.isArray(record.pageStoragePaths)
    ? record.pageStoragePaths.filter((p): p is string => typeof p === 'string')
    : [];

  if (!singlePath && pagePaths.length === 0) {
    return { result: rawResult, storageValid: true };
  }

  if (!isSignedStorageDocumentalEnabled()) {
    const hasInlineFallback =
      typeof record.pdfDataUrl === 'string' ||
      (Array.isArray(record.pages) && record.pages.length > 0) ||
      typeof record.localUrl === 'string';
    return { result: rawResult, storageValid: hasInlineFallback };
  }

  const hydrated: Record<string, unknown> = { ...record };

  if (singlePath) {
    if (!isValidTenantStoragePath(tenantId, singlePath)) {
      return { result: rawResult, storageValid: false };
    }
    const minted = await mintTenantSignedDownloadUrl(tenantId, singlePath);
    if (!minted) {
      return { result: rawResult, storageValid: false };
    }
    hydrated.signedUrl = minted.signedUrl;
    hydrated.signedUrlExpiresAt = minted.expiresAt;
  }

  if (pagePaths.length > 0) {
    const mintedBatch = await mintTenantSignedBatchUrls(tenantId, pagePaths);
    if (!mintedBatch) {
      return { result: rawResult, storageValid: false };
    }
    hydrated.pages = mintedBatch.signedUrls;
    hydrated.signedUrlsExpiresAt = mintedBatch.expiresAt;
  }

  return { result: hydrated, storageValid: true };
}

