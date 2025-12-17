/**
 * Unit tests for In-Memory Fallback Store
 * Tests TTL expiration behavior and incr operation on non-existent keys
 *
 * Requirements: 6.2, 6.3
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  InMemoryStore,
  getFallbackStore,
  resetFallbackStore,
} from "@/lib/realtime/fallback-store";

describe("InMemoryStore", () => {
  let store: InMemoryStore;

  beforeEach(() => {
    vi.useFakeTimers();
    store = new InMemoryStore();
  });

  afterEach(() => {
    store.destroy();
    vi.useRealTimers();
  });

  describe("TTL expiration behavior", () => {
    it("should return value before TTL expires", () => {
      store.set("key", "value", 60); // 60 seconds TTL

      // Advance time by 30 seconds (before expiry)
      vi.advanceTimersByTime(30000);

      expect(store.get("key")).toBe("value");
      expect(store.exists("key")).toBe(true);
    });

    it("should return null after TTL expires", () => {
      store.set("key", "value", 1); // 1 second TTL

      // Advance time by 2 seconds (after expiry)
      vi.advanceTimersByTime(2000);

      expect(store.get("key")).toBeNull();
      expect(store.exists("key")).toBe(false);
    });

    it("should handle TTL at exact expiry boundary", () => {
      store.set("key", "value", 5); // 5 seconds TTL

      // Advance time to exactly 5 seconds - key is still valid at boundary
      vi.advanceTimersByTime(5000);
      expect(store.get("key")).toBe("value");

      // Advance 1ms past boundary - now expired
      vi.advanceTimersByTime(1);
      expect(store.get("key")).toBeNull();
    });

    it("should preserve TTL when incrementing existing key", () => {
      store.set("counter", "5", 60); // 60 seconds TTL

      // Increment the value
      store.incr("counter");

      // Advance time by 30 seconds
      vi.advanceTimersByTime(30000);

      // Value should still be accessible
      expect(store.get("counter")).toBe("6");
    });

    it("should expire incremented value after TTL", () => {
      store.set("counter", "5", 1); // 1 second TTL

      // Increment the value
      store.incr("counter");

      // Advance time by 2 seconds
      vi.advanceTimersByTime(2000);

      // Value should be expired
      expect(store.get("counter")).toBeNull();
    });

    it("should clean up expired entries during periodic cleanup", () => {
      store.set("key1", "value1", 5);
      store.set("key2", "value2", 15);
      store.set("key3", "value3"); // No TTL

      // Advance time by 10 seconds (key1 should expire)
      vi.advanceTimersByTime(10000);

      // Trigger cleanup
      store.cleanupExpired();

      expect(store.get("key1")).toBeNull();
      expect(store.get("key2")).toBe("value2");
      expect(store.get("key3")).toBe("value3");
    });

    it("should handle keys without TTL (never expire)", () => {
      store.set("permanent", "value");

      // Advance time by a long time
      vi.advanceTimersByTime(86400000); // 24 hours

      expect(store.get("permanent")).toBe("value");
      expect(store.exists("permanent")).toBe(true);
    });
  });

  describe("incr operation on non-existent keys", () => {
    it("should initialize to 1 when key does not exist", () => {
      const result = store.incr("newkey");
      expect(result).toBe(1);
      expect(store.get("newkey")).toBe("1");
    });

    it("should increment existing numeric value", () => {
      store.set("counter", "10");
      const result = store.incr("counter");
      expect(result).toBe(11);
    });

    it("should handle multiple increments on new key", () => {
      expect(store.incr("counter")).toBe(1);
      expect(store.incr("counter")).toBe(2);
      expect(store.incr("counter")).toBe(3);
    });

    it("should handle non-numeric value by resetting to 1", () => {
      store.set("key", "not-a-number");
      const result = store.incr("key");
      expect(result).toBe(1);
    });

    it("should initialize to 1 after key expires", () => {
      store.set("counter", "5", 1); // 1 second TTL

      // Advance time to expire the key
      vi.advanceTimersByTime(2000);

      // Incr should initialize to 1
      const result = store.incr("counter");
      expect(result).toBe(1);
    });

    it("should handle zero value correctly", () => {
      store.set("counter", "0");
      const result = store.incr("counter");
      expect(result).toBe(1);
    });

    it("should handle negative value correctly", () => {
      store.set("counter", "-5");
      const result = store.incr("counter");
      expect(result).toBe(-4);
    });
  });

  describe("basic operations", () => {
    it("should set and get values", () => {
      store.set("key", "value");
      expect(store.get("key")).toBe("value");
    });

    it("should overwrite existing values", () => {
      store.set("key", "value1");
      store.set("key", "value2");
      expect(store.get("key")).toBe("value2");
    });

    it("should delete existing keys", () => {
      store.set("key", "value");
      expect(store.del("key")).toBe(true);
      expect(store.get("key")).toBeNull();
    });

    it("should return false when deleting non-existent key", () => {
      expect(store.del("nonexistent")).toBe(false);
    });

    it("should clear all entries", () => {
      store.set("key1", "value1");
      store.set("key2", "value2");
      store.clear();
      expect(store.size()).toBe(0);
    });
  });
});

describe("Singleton fallback store", () => {
  afterEach(() => {
    resetFallbackStore();
  });

  it("should return the same instance", () => {
    const store1 = getFallbackStore();
    const store2 = getFallbackStore();
    expect(store1).toBe(store2);
  });

  it("should reset and create new instance", () => {
    const store1 = getFallbackStore();
    store1.set("key", "value");

    resetFallbackStore();

    const store2 = getFallbackStore();
    expect(store2.get("key")).toBeNull();
  });
});
