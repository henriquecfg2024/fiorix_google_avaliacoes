/**
 * Mapa em memória com capacidade máxima (`maxSize`), expiração por TTL (`defaultTtlMs`),
 * poda automática de entradas expiradas e política de evicção LRU determinística (`LOW-01`).
 */
export class BoundedTtlMap<K, V> {
  private readonly store = new Map<K, { value: V; expiresAt: number }>();
  private readonly maxSize: number;
  private readonly defaultTtlMs: number;

  constructor(maxSize: number, defaultTtlMs: number) {
    if (!Number.isInteger(maxSize) || maxSize <= 0) {
      throw new Error('BoundedTtlMap requer maxSize inteiro positivo.');
    }
    if (!Number.isFinite(defaultTtlMs) || defaultTtlMs <= 0) {
      throw new Error('BoundedTtlMap requer defaultTtlMs positivo.');
    }
    this.maxSize = maxSize;
    this.defaultTtlMs = defaultTtlMs;
  }

  get size(): number {
    return this.store.size;
  }

  get maxEntries(): number {
    return this.maxSize;
  }

  pruneExpired(now = Date.now()): number {
    let removed = 0;
    for (const [key, entry] of this.store.entries()) {
      if (entry.expiresAt <= now) {
        this.store.delete(key);
        removed++;
      }
    }
    return removed;
  }

  get(key: K, now = Date.now()): V | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= now) {
      this.store.delete(key);
      return undefined;
    }
    // Promove para o fim do Map (LRU)
    this.store.delete(key);
    this.store.set(key, entry);
    return entry.value;
  }

  has(key: K, now = Date.now()): boolean {
    const entry = this.store.get(key);
    if (!entry) return false;
    if (entry.expiresAt <= now) {
      this.store.delete(key);
      return false;
    }
    return true;
  }

  set(key: K, value: V, customTtlMs?: number, now = Date.now()): this {
    const ttl = customTtlMs !== undefined && customTtlMs > 0 ? customTtlMs : this.defaultTtlMs;
    if (this.store.has(key)) {
      this.store.delete(key);
    } else if (this.store.size >= this.maxSize) {
      this.pruneExpired(now);
      while (this.store.size >= this.maxSize) {
        const oldestKey = this.store.keys().next().value;
        if (oldestKey === undefined) break;
        this.store.delete(oldestKey);
      }
    }
    this.store.set(key, { value, expiresAt: now + ttl });
    return this;
  }

  delete(key: K): boolean {
    return this.store.delete(key);
  }

  deleteWhere(predicate: (key: K, value: V) => boolean): number {
    let removed = 0;
    for (const [key, entry] of this.store.entries()) {
      if (predicate(key, entry.value)) {
        this.store.delete(key);
        removed++;
      }
    }
    return removed;
  }

  clear(): void {
    this.store.clear();
  }
}

