export const DOCUMENTAL_INDEXEDDB_NAME = 'fiorix-documental-cache-v1';
export const DOCUMENTAL_INDEXEDDB_STORE = 'blobs';
export const MAX_CACHE_ENTRIES = 35;
export const MAX_CACHE_TOTAL_BYTES = 180 * 1024 * 1024; // 180 MB
export const CACHE_ENTRY_TTL_MS = 12 * 60 * 60 * 1000; // 12 horas
export const MAX_SINGLE_BLOB_BYTES = 48 * 1024 * 1024; // 48 MB

interface CachedBlobEntry {
  cacheKey: string;
  blob: Blob;
  sizeBytes: number;
  storedAt: number;
  lastAccessedAt: number;
}

export interface DocumentalBlobCacheKeyParams {
  connectorId?: string;
  rootId?: string;
  relativePath?: string;
  size?: number;
}

export function buildDocumentalBlobCacheKey(params: DocumentalBlobCacheKeyParams): string | null {
  const rootPart = typeof params.rootId === 'string' ? params.rootId.trim().toLowerCase() : '';
  const rawRel = typeof params.relativePath === 'string' ? params.relativePath : '';
  const relPart = rawRel
    .replace(/\\/g, '/')
    .replace(/\/+/g, '/')
    .replace(/^\/+|\/+$/g, '')
    .trim()
    .toLowerCase();

  if (!rootPart || !relPart) {
    return null;
  }

  const sizePart =
    typeof params.size === 'number' && Number.isFinite(params.size) && params.size > 0
      ? Math.trunc(params.size)
      : 0;

  return `v1|${rootPart}|${relPart}|${sizePart}`;
}

function getIndexedDbFactory(): IDBFactory | null {
  if (typeof globalThis === 'undefined') return null;
  try {
    const idb = (globalThis as { indexedDB?: IDBFactory }).indexedDB;
    return idb ?? null;
  } catch {
    return null;
  }
}

function openDocumentalDb(): Promise<IDBDatabase | null> {
  const idb = getIndexedDbFactory();
  if (!idb) return Promise.resolve(null);

  return new Promise((resolve) => {
    try {
      const req = idb.open(DOCUMENTAL_INDEXEDDB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(DOCUMENTAL_INDEXEDDB_STORE)) {
          db.createObjectStore(DOCUMENTAL_INDEXEDDB_STORE, { keyPath: 'cacheKey' });
        }
      };
      req.onsuccess = () => {
        const db = req.result;
        db.onversionchange = () => {
          try {
            db.close();
          } catch {
            // Ignora falha ao fechar conexao em mudanca de versao
          }
        };
        resolve(db);
      };
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

function runStoreRequest<T>(
  db: IDBDatabase,
  mode: IDBTransactionMode,
  executor: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T | null> {
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(DOCUMENTAL_INDEXEDDB_STORE, mode);
      const store = tx.objectStore(DOCUMENTAL_INDEXEDDB_STORE);
      const req = executor(store);
      let resolvedValue: T | null = null;

      req.onsuccess = () => {
        resolvedValue = req.result ?? null;
      };
      req.onerror = () => {
        resolvedValue = null;
      };
      tx.oncomplete = () => resolve(resolvedValue);
      tx.onerror = () => resolve(null);
      tx.onabort = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function getCachedDocumentBlob(cacheKey: string): Promise<Blob | null> {
  if (!cacheKey) return null;
  const db = await openDocumentalDb();
  if (!db) return null;

  try {
    const entry = await runStoreRequest<CachedBlobEntry | undefined>(db, 'readonly', (store) =>
      store.get(cacheKey),
    );
    if (!entry || !(entry.blob instanceof Blob)) {
      return null;
    }

    const now = Date.now();
    if (!Number.isFinite(entry.storedAt) || now - entry.storedAt > CACHE_ENTRY_TTL_MS) {
      await runStoreRequest(db, 'readwrite', (store) => store.delete(cacheKey));
      return null;
    }

    // Atualiza lastAccessedAt para politica LRU sem bloquear entrega do blob
    void runStoreRequest(db, 'readwrite', (store) =>
      store.put({
        ...entry,
        lastAccessedAt: now,
      }),
    );

    return entry.blob;
  } catch {
    return null;
  } finally {
    try {
      db.close();
    } catch {
      // Ignora erro ao fechar DB
    }
  }
}

export async function putCachedDocumentBlob(cacheKey: string, blob: Blob): Promise<void> {
  if (!cacheKey || !blob || !(blob instanceof Blob)) return;
  if (blob.size <= 0 || blob.size > MAX_SINGLE_BLOB_BYTES) return;

  const db = await openDocumentalDb();
  if (!db) return;

  try {
    const now = Date.now();
    const record: CachedBlobEntry = {
      cacheKey,
      blob,
      sizeBytes: blob.size,
      storedAt: now,
      lastAccessedAt: now,
    };

    await runStoreRequest(db, 'readwrite', (store) => store.put(record));

    const allEntries = await runStoreRequest<CachedBlobEntry[]>(db, 'readonly', (store) =>
      store.getAll(),
    );
    if (!Array.isArray(allEntries) || allEntries.length === 0) return;

    const expiredKeys: string[] = [];
    const active: CachedBlobEntry[] = [];
    let totalBytes = 0;

    for (const item of allEntries) {
      if (!item || typeof item.cacheKey !== 'string') continue;
      if (!Number.isFinite(item.storedAt) || now - item.storedAt > CACHE_ENTRY_TTL_MS) {
        expiredKeys.push(item.cacheKey);
        continue;
      }
      const itemSize = Number.isFinite(item.sizeBytes) && item.sizeBytes > 0 ? item.sizeBytes : 0;
      totalBytes += itemSize;
      active.push(item);
    }

    // Ordena do menos recentemente acessado para o mais recente (LRU)
    active.sort((a, b) => (a.lastAccessedAt || a.storedAt || 0) - (b.lastAccessedAt || b.storedAt || 0));

    const keysToDelete = new Set<string>(expiredKeys);
    let remainingCount = active.length;

    for (const candidate of active) {
      if (remainingCount <= MAX_CACHE_ENTRIES && totalBytes <= MAX_CACHE_TOTAL_BYTES) {
        break;
      }
      if (candidate.cacheKey === cacheKey && remainingCount > 1) {
        continue;
      }
      keysToDelete.add(candidate.cacheKey);
      remainingCount--;
      totalBytes -= Number.isFinite(candidate.sizeBytes) && candidate.sizeBytes > 0 ? candidate.sizeBytes : 0;
    }

    if (keysToDelete.size > 0) {
      await new Promise<void>((resolve) => {
        try {
          const tx = db.transaction(DOCUMENTAL_INDEXEDDB_STORE, 'readwrite');
          const store = tx.objectStore(DOCUMENTAL_INDEXEDDB_STORE);
          for (const key of keysToDelete) {
            store.delete(key);
          }
          tx.oncomplete = () => resolve();
          tx.onerror = () => resolve();
          tx.onabort = () => resolve();
        } catch {
          resolve();
        }
      });
    }
  } catch {
    // Nunca falha a visualizacao por indisponibilidade de IndexedDB
  } finally {
    try {
      db.close();
    } catch {
      // Ignora erro ao fechar DB
    }
  }
}

export async function clearDocumentalIndexedDbCache(): Promise<void> {
  const idb = getIndexedDbFactory();
  if (!idb) return;

  const db = await openDocumentalDb();
  if (db) {
    try {
      await runStoreRequest(db, 'readwrite', (store) => store.clear());
    } catch {
      // Continua para tentativa de deleteDatabase abaixo
    } finally {
      try {
        db.close();
      } catch {
        // Ignora erro ao fechar DB
      }
    }
  }

  await new Promise<void>((resolve) => {
    try {
      const delReq = idb.deleteDatabase(DOCUMENTAL_INDEXEDDB_NAME);
      delReq.onsuccess = () => resolve();
      delReq.onerror = () => resolve();
      delReq.onblocked = () => resolve();
    } catch {
      resolve();
    }
  });
}

