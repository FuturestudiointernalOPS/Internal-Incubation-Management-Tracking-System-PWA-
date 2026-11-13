"use client";

/**
 * Toast helper — dispatches the global ImpactOS notification event.
 * GlobalToast (mounted in DashboardLayout) translates the message key.
 */
export function notify(type, message) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("impactos:notify", {
      detail: { type, message, duration: 4000 },
    }),
  );
}
