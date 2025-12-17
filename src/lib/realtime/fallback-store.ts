/**
 * In-Memory Fallback Store
 * Provides a Redis-compatible in-memory store for graceful degradation
 * when Redis is unavailable.
 *
 * Requirements: 1.1, 6.2
 */

interface StoreEntry {
  value: string;
  expiresAt: number | null; // Unix timestamp in ms, null = no expiry
}

/**
 * In-memory store with TTL support
 * Used as fallback when Redis is unavailable
 */
export class InMemoryStore {
  private store: Map<string, StoreEntry> = new Map();
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    // Start periodic cleanup of expired entries every 10 seconds
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpired();
    }, 10000);
  }

  /**
   * Get a value by key
   * Returns null if key doesn't exist or has expired
   */
  get(key: string): string | null {
    const entry = this.store.get(key);

    if (!entry) {
      return null;
    }

    // Check if entry has expired
    if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }

    return entry.value;
  }

  /**
   * Set a value with optional TTL
   * @param key - The key to set
   * @param value - The value to store
   * @param ttlSeconds - Optional TTL in seconds
   */
  set(key: string, value: string, ttlSeconds?: number): void {
    const expiresAt = ttlSeconds ? Date.now() + ttlSeconds * 1000 : null;

    this.store.set(key, {
      value,
      expiresAt,
    });
  }

  /**
   * Increment a numeric value by 1
   * If key doesn't exist, initializes to 1
   * @returns The new value after increment
   */
  incr(key: string): number {
    const entry = this.store.get(key);

    // Check for expiry
    if (entry && entry.expiresAt !== null && Date.now() > entry.expiresAt) {
      this.store.delete(key);
    }

    const currentEntry = this.store.get(key);

    if (!currentEntry) {
      // Key doesn't exist, initialize to 1
      this.store.set(key, {
        value: "1",
        expiresAt: null,
      });
      return 1;
    }

    const currentValue = parseInt(currentEntry.value, 10);
    const newValue = isNaN(currentValue) ? 1 : currentValue + 1;

    this.store.set(key, {
      value: newValue.toString(),
      expiresAt: currentEntry.expiresAt,
    });

    return newValue;
  }

  /**
   * Delete a key
   * @returns true if key existed and was deleted, false otherwise
   */
  del(key: string): boolean {
    return this.store.delete(key);
  }

  /**
   * Check if a key exists and is not expired
   */
  exists(key: string): boolean {
    const entry = this.store.get(key);

    if (!entry) {
      return false;
    }

    // Check if entry has expired
    if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Clear all entries from the store
   */
  clear(): void {
    this.store.clear();
  }

  /**
   * Get the number of entries in the store (including expired)
   * Primarily for testing purposes
   */
  size(): number {
    return this.store.size;
  }

  /**
   * Clean up expired entries
   * Called periodically and can be called manually
   */
  cleanupExpired(): void {
    const now = Date.now();

    for (const [key, entry] of this.store.entries()) {
      if (entry.expiresAt !== null && now > entry.expiresAt) {
        this.store.delete(key);
      }
    }
  }

  /**
   * Stop the cleanup interval
   * Should be called when the store is no longer needed
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.store.clear();
  }
}

// Singleton instance for application-wide use
let fallbackStoreInstance: InMemoryStore | null = null;

/**
 * Get the singleton fallback store instance
 */
export function getFallbackStore(): InMemoryStore {
  if (!fallbackStoreInstance) {
    fallbackStoreInstance = new InMemoryStore();
  }
  return fallbackStoreInstance;
}

/**
 * Reset the fallback store (primarily for testing)
 */
export function resetFallbackStore(): void {
  if (fallbackStoreInstance) {
    fallbackStoreInstance.destroy();
    fallbackStoreInstance = null;
  }
}
