// In-Memory Fast Cache with TTL for Performance Scaling (Phase 20)
type CacheEntry<T> = {
  data: T;
  expiry: number;
};

class CacheService {
  private store: Map<string, CacheEntry<any>> = new Map();

  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiry) {
      this.store.delete(key);
      return null;
    }
    return entry.data as T;
  }

  set<T>(key: string, data: T, ttlSeconds: number = 300): void {
    this.store.set(key, {
      data,
      expiry: Date.now() + ttlSeconds * 1000,
    });
  }

  invalidate(pattern?: string): void {
    if (!pattern) {
      this.store.clear();
      return;
    }
    for (const key of this.store.keys()) {
      if (key.includes(pattern)) {
        this.store.delete(key);
      }
    }
  }

  getStats() {
    return {
      totalKeys: this.store.size,
      activeKeys: Array.from(this.store.keys()),
    };
  }
}

export const cache = new CacheService();
export default cache;
