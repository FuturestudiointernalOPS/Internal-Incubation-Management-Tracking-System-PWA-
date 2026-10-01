/**
 * Toast via the app-wide listener (src/components/ui/GlobalToast.js). Kept
 * local, like OperationsView's, so this screen needs no cross-feature import.
 */
export function notify(type, message) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("impactos:notify", { detail: { type, message } }),
  );
}
