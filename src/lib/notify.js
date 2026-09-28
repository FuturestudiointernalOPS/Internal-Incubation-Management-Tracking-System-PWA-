/**
 * TOASTS — the app's message channel for "this happened".
 *
 * The listener is <GlobalToast>, mounted by the section layouts (through
 * DashboardLayout). It translates the message before showing it, so a
 * translation key and a ready-made sentence are both accepted:
 *
 *   notify("success", "lms.courses.saved");
 *   notify("error", data.error || t("errors.taskCreateFailed"));
 *
 * `type` is "success" | "error" | "info" | "warning".
 *
 * `duration` defaults to 8s: a full sentence needs time to be read.
 */
export function notify(type, message, duration = 8000) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("impactos:notify", {
      detail: { type, message, duration },
    }),
  );
}
