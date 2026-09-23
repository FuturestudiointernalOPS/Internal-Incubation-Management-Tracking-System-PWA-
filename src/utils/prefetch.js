/**
 * ImpactOS Prefetch Engine
 * Proactively fetches API data before navigation to achieve zero-latency state transitions.
 */

const prefetchStore = new Map();

export const prefetchData = async (url, cacheKey) => {
  if (prefetchStore.has(url)) return;

  try {
    console.log(`[Prefetch] Priming node: ${url}`);
    const response = await fetch(url);
    const payload = await response.json();

    if (payload.success) {
      prefetchStore.set(url, { data: payload, timestamp: Date.now() });
      if (cacheKey) {
        localStorage.setItem(`impactos_cache_${cacheKey}`, JSON.stringify(payload));
      }
    }
  } catch {
    console.warn(`[Prefetch] Acceleration failed for ${url}`);
  }
};

export const getPrefetchedData = (url) => {
  const cachedEntry = prefetchStore.get(url);
  if (!cachedEntry) return null;

  // Cache valid for 30 seconds for immediate prefetch use
  if (Date.now() - cachedEntry.timestamp < 30000) {
    prefetchStore.delete(url); // Consume it
    return cachedEntry.data;
  }
  return null;
};
