/**
 * Notification text resolution.
 *
 * Most notification rows carry their prose in `title`/`message`. Rows produced
 * with a `template_key` (CRM alerts do) are rendered in the reader's language
 * instead, with their stored prose as the fallback — so a consumer that never
 * localizes still shows something correct.
 *
 * Pure: no db, no React. `t` is the caller's translator.
 */
export function notificationText(notification, t) {
  const key = notification?.template_key;

  if (typeof key === "string" && key.startsWith("crm.")) {
    let params = notification.params;
    if (typeof params === "string") {
      try {
        params = JSON.parse(params);
      } catch (_) {
        params = {};
      }
    }
    if (!params || typeof params !== "object") params = {};

    const titleKey = `${key}.title`;
    const messageKey = `${key}.message`;
    const title = t(titleKey, params);
    const message = t(messageKey, params);

    return {
      title: title && title !== titleKey ? title : notification.title,
      message: message && message !== messageKey ? message : notification.message,
    };
  }

  return { title: notification?.title, message: notification?.message };
}
