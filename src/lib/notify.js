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
 */
export function notify(type, message, duration = 4000) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("impactos:notify", {
      detail: { type, message, duration },
    }),
  );
}
