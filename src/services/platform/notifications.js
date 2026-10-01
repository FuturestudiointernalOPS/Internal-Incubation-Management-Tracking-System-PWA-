/**
 * Platform — user notifications (SERVICE layer).
 *
 * The domain work behind `/api/platform/notifications`: the unread/all list and
 * the "mark one / mark all" write. The CONTROLLER keeps `initDb`, the session
 * gate and the response envelope.
 *
 * Layer (see docs/LAYER_SPLIT.md): decisions and orchestration, no SQL, no HTTP.
 * It reads and writes through `@/models/**`.
 */

import {
  listPlatformNotifications,
  markAllPlatformNotificationsRead,
  markPlatformNotificationRead,
} from "@/models/forms";

/** @returns {Promise<{status: number, body: Object}>} */
export async function listNotifications({ cid, all }) {
  const result = await listPlatformNotifications(cid, all);
  return { status: 200, body: { success: true, notifications: result.rows } };
}

/**
 * `{ mark_all: true }` clears every notification; `{ id }` clears one.
 *
 * @returns {Promise<{status: number, body: Object}>}
 */
export async function markNotificationsRead({ body, cid }) {
  if (body.mark_all) {
    await markAllPlatformNotificationsRead(cid);
    return { status: 200, body: { success: true } };
  }

  if (body.id) {
    await markPlatformNotificationRead(body.id, cid);
    return { status: 200, body: { success: true } };
  }

  return { status: 400, body: { success: false, error: "id or mark_all required" } };
}
