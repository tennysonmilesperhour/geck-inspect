/**
 * Shared client-side cache + request helpers used by Layout.jsx.
 *
 * Extracted from src/Layout.jsx as part of the hairball cleanup.
 * The DataCache class and its sibling helpers (delay, retryApiCall,
 * debouncedApiCall) are pure JS with no React or DOM dependencies,
 * so they belong in a plain .js module.
 */

// Aggressive cache with long durations ,  we're caching things like the
// current user and their contribution counts, which don't change often.
class DataCache {
  constructor() {
    this.cache = new Map();
    this.cacheTimestamps = new Map();
    this.requestTimestamps = new Map();
    this.CACHE_DURATION = 5 * 60 * 60 * 1000; // 5 hours
    this.MIN_REQUEST_INTERVAL = 120000;         // 2 minutes between same-key requests
  }

  isCacheValid(key) {
    const timestamp = this.cacheTimestamps.get(key);
    if (!timestamp) return false;
    return Date.now() - timestamp < this.CACHE_DURATION;
  }

  canMakeRequest(key) {
    const lastRequest = this.requestTimestamps.get(key);
    if (!lastRequest) return true;
    return Date.now() - lastRequest > this.MIN_REQUEST_INTERVAL;
  }

  markRequestMade(key) {
    this.requestTimestamps.set(key, Date.now());
  }

  get(key) {
    if (this.isCacheValid(key)) return this.cache.get(key);
    return null;
  }

  set(key, data) {
    this.cache.set(key, data);
    this.cacheTimestamps.set(key, Date.now());
  }

  clear(key) {
    this.cache.delete(key);
    this.cacheTimestamps.delete(key);
    this.requestTimestamps.delete(key);
  }

  clearAll() {
    this.cache.clear();
    this.cacheTimestamps.clear();
    this.requestTimestamps.clear();
  }
}

// One shared instance for the whole app.
export const dataCache = new DataCache();

// Sleep for N ms.
export const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Retry an async API call on HTTP 429 with exponential backoff.
 * Defaults: up to 2 retries, 10-second initial delay (doubled each
 * attempt). Non-429 errors rethrow immediately.
 */
export const retryApiCall = async (apiCall, maxRetries = 2, initialDelayMs = 10000) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await apiCall();
    } catch (error) {
      if (error.response?.status === 429 && attempt < maxRetries) {
        const delayMs = initialDelayMs * Math.pow(2, attempt - 1);
        console.log(`Rate limit hit, waiting ${delayMs}ms before retry (attempt ${attempt}/${maxRetries})`);
        await delay(delayMs);
        continue;
      }
      throw error;
    }
  }
};

/**
 * Per-key debounced call: if the same `key` fires again within `delayMs`,
 * cancel the pending call. Returns a Promise that resolves with the final
 * winning call's result.
 */
export const debouncedApiCall = (() => {
  const debounceMap = new Map();
  return (key, apiCall, delayMs = 5000) => {
    return new Promise((resolve, reject) => {
      if (debounceMap.has(key)) {
        clearTimeout(debounceMap.get(key));
      }
      const timeoutId = setTimeout(async () => {
        try {
          const result = await apiCall();
          resolve(result);
        } catch (error) {
          reject(error);
        } finally {
          debounceMap.delete(key);
        }
      }, delayMs);
      debounceMap.set(key, timeoutId);
    });
  };
})();

