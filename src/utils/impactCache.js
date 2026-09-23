/**
 * ImpactOS Cache Utility
 * Standardizes key-value persistence for zero-latency UI loading.
 */

export const IMPACT_CACHE = {
  get: (key) => {
    try {
      const storedValue = localStorage.getItem(`impactos_cache_${key}`);
      if (!storedValue) return null;
      return JSON.parse(storedValue);
    } catch {
      return null;
    }
  },
  set: (key, value) => {
    try {
      localStorage.setItem(`impactos_cache_${key}`, JSON.stringify(value));
    } catch (error) {
      console.warn('Cache write failed', error);
    }
  },
  clear: (key) => {
    if (key) {
      localStorage.removeItem(`impactos_cache_${key}`);
    } else {
      Object.keys(localStorage).forEach(storageKey => {
        if (storageKey.startsWith('impactos_cache_')) localStorage.removeItem(storageKey);
      });
    }
  }
};
