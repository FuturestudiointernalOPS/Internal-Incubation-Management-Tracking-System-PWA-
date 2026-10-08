/**
 * Raise a toast through the app's global notification hub (GlobalToast).
 * `message` may be a translation key or already-translated text — the hub
 * resolves keys itself.
 */
export function notify(type, message) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("impactos:notify", { detail: { type, message } }));
}
