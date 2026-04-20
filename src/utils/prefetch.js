/**
 * ImpactOS Prefetch Engine
 * Proactively fetches API data before navigation to achieve zero-latency state transitions.
 */

const prefetchStore = new Map();

export const prefetchData = async (url, cacheKey) => {
  if (prefetchStore.has(url)) return;
  
  try {
    console.log(`[Prefetch] Priming node: ${url}`);
    const res = await fetch(url);
    const data = await res.json();
    
    if (data.success) {
      prefetchStore.set(url, { data, timestamp: Date.now() });
      if (cacheKey) {
        localStorage.setItem(`impactos_cache_${cacheKey}`, JSON.stringify(data));
      }
    }
  } catch (e) {
    console.warn(`[Prefetch] Acceleration failed for ${url}`);
  }
};

export const getPrefetchedData = (url) => {
  const item = prefetchStore.get(url);
  if (!item) return null;
  
  // Cache valid for 30 seconds for immediate prefetch use
  if (Date.now() - item.timestamp < 30000) {
    prefetchStore.delete(url); // Consume it
    return item.data;
  }
  return null;
};
