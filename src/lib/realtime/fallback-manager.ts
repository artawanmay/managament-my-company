/**
 * Fallback Manager
 * Manages graceful degradation when Redis is unavailable.
 * Tracks fallback mode state and provides event callbacks for mode changes.
 *
 * Requirements: 1.1, 1.2, 1.4
 */

import { InMemoryStore, getFallbackStore } from "./fallback-store";

type FallbackCallback = () => void;

/**
 * Fallback Manager class
 * Manages the fallback mode state and provides access to the in-memory store
 */
export class FallbackManager {
  private inFallbackMode: boolean = false;
  private activatedCallbacks: FallbackCallback[] = [];
  private deactivatedCallbacks: FallbackCallback[] = [];
  private store: InMemoryStore;
  private lastModeChangeAt: Date | null = null;

  constructor(store?: InMemoryStore) {
    this.store = store || getFallbackStore();
  }

  /**
   * Check if the system is currently in fallback mode
   */
  isInFallbackMode(): boolean {
    return this.inFallbackMode;
  }

  /**
   * Get the in-memory fallback store
   */
  getStore(): InMemoryStore {
    return this.store;
  }

  /**
   * Get the timestamp of the last mode change
   */
  getLastModeChangeAt(): Date | null {
    return this.lastModeChangeAt;
  }

  /**
   * Activate fallback mode
   * Called when Redis becomes unavailable
   * Logs warning and notifies registered callbacks
   */
  activateFallback(): void {
    if (this.inFallbackMode) {
      return; // Already in fallback mode
    }

    this.inFallbackMode = true;
    this.lastModeChangeAt = new Date();

    // Log warning about degraded state (Requirement 1.4)
    console.warn(
      "[FallbackManager] Fallback mode activated - Redis unavailable. " +
        "Lockout service is now using in-memory storage (not distributed). " +
        "Pub/Sub features are disabled."
    );

    // Notify all registered callbacks
    for (const callback of this.activatedCallbacks) {
      try {
        callback();
      } catch (error) {
        console.error(
          "[FallbackManager] Error in fallback activated callback:",
          error
        );
      }
    }
  }

  /**
   * Deactivate fallback mode
   * Called when Redis becomes available again
   * Logs info and notifies registered callbacks
   */
  deactivateFallback(): void {
    if (!this.inFallbackMode) {
      return; // Not in fallback mode
    }

    this.inFallbackMode = false;
    this.lastModeChangeAt = new Date();

    // Log info about restored functionality (Requirement 1.3)
    console.info(
      "[FallbackManager] Fallback mode deactivated - Redis connection restored. " +
        "Full functionality restored. Note: In-memory lockout state was not migrated to Redis."
    );

    // Notify all registered callbacks
    for (const callback of this.deactivatedCallbacks) {
      try {
        callback();
      } catch (error) {
        console.error(
          "[FallbackManager] Error in fallback deactivated callback:",
          error
        );
      }
    }
  }

  /**
   * Register a callback to be called when fallback mode is activated
   * @param callback - Function to call when fallback mode activates
   * @returns Unsubscribe function
   */
  onFallbackActivated(callback: FallbackCallback): () => void {
    this.activatedCallbacks.push(callback);
    return () => {
      const index = this.activatedCallbacks.indexOf(callback);
      if (index > -1) {
        this.activatedCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Register a callback to be called when fallback mode is deactivated
   * @param callback - Function to call when fallback mode deactivates
   * @returns Unsubscribe function
   */
  onFallbackDeactivated(callback: FallbackCallback): () => void {
    this.deactivatedCallbacks.push(callback);
    return () => {
      const index = this.deactivatedCallbacks.indexOf(callback);
      if (index > -1) {
        this.deactivatedCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Clear all registered callbacks
   * Useful for testing and cleanup
   */
  clearCallbacks(): void {
    this.activatedCallbacks = [];
    this.deactivatedCallbacks = [];
  }

  /**
   * Reset the manager state
   * Useful for testing
   */
  reset(): void {
    this.inFallbackMode = false;
    this.lastModeChangeAt = null;
    this.clearCallbacks();
  }
}

// Singleton instance for application-wide use
let fallbackManagerInstance: FallbackManager | null = null;

/**
 * Get the singleton fallback manager instance
 */
export function getFallbackManager(): FallbackManager {
  if (!fallbackManagerInstance) {
    fallbackManagerInstance = new FallbackManager();
  }
  return fallbackManagerInstance;
}

/**
 * Reset the fallback manager (primarily for testing)
 */
export function resetFallbackManager(): void {
  if (fallbackManagerInstance) {
    fallbackManagerInstance.reset();
    fallbackManagerInstance = null;
  }
}
