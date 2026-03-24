/**
 * ImpactOS Cache Utility
 * Standardizes key-value persistence for zero-latency UI loading.
 */

export const IMPACT_CACHE = {
  get: (key) => {
    try {
      const item = localStorage.getItem(`impactos_cache_${key}`);
      if (!item) return null;
      return JSON.parse(item);
    } catch (e) {
      return null;
    }
  },
  set: (key, data) => {
    try {
      localStorage.setItem(`impactos_cache_${key}`, JSON.stringify(data));
    } catch (e) {
      console.warn('Cache write failed', e);
    }
  },
  clear: (key) => {
    if (key) {
      localStorage.removeItem(`impactos_cache_${key}`);
    } else {
      Object.keys(localStorage).forEach(k => {
        if (k.startsWith('impactos_cache_')) localStorage.removeItem(k);
      });
    }
  }
};
