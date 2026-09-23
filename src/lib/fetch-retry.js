/**
 * fetchWithRetry — resilient fetch with automatic retry on network failure.
 * Used for critical API calls to handle intermittent network interruptions.
 */
export async function fetchWithRetry(url, options = {}, maxRetries = 3, delayMs = 1000) {
  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, options);
      if (res.ok || res.status < 500) return res;
      // Server error — retry
      lastError = new Error(`Server error: ${res.status}`);
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, delayMs * (attempt + 1)));
      }
    }
  }
  throw lastError;
}
