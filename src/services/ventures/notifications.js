/**
 * VENTURE NOTIFICATION CENTRE.
 *
 * The in-app notification catalogue (send with its delivery log, list, read,
 * archive, delete, unread count), the templates with their variable rendering and
 * the per-user preferences.
 *
 * The decisions — the recipient/status filters, the template rendering, the
 * default preferences and the templated send — live here; every statement is in
 * `@/models/ventureNotificationsStore`. Nothing here runs SQL.
 *
 * This module used to be re-exported through the `@/lib/ventures` barrel; that
 * barrel is gone (CH-4) and importers read this module directly — see
 * docs/LAYER_SPLIT.md. (Distinct from `@/services/ventures/notify`, which backs
 * the founder/coach/Lead-Manager delivery.)
 */

import {
  insertNotificationRow,
  insertNotificationDeliveryLog,
  selectNotifications,
  selectNotificationById,
  markNotificationReadRow,
  markAllNotificationsReadRow,
  archiveNotificationRow,
  deleteNotificationRow,
  countUnreadNotifications,
  selectNotificationTemplates,
  selectNotificationTemplateByKey,
  selectNotificationPreferences,
  insertNotificationPreferences,
  updateNotificationPreferencesRow,
} from "@/models/ventureNotificationsStore";

export async function sendNotification({ recipientId, recipientType, ventureId, type, title, body, data, priority, source, sourceId }) {
  const id = (await insertNotificationRow({
    recipientId, recipientType: recipientType||"user", ventureId: ventureId||null, type: type||"system",
    title, body: body||null, dataJson: JSON.stringify(data||{}), priority: priority||"normal",
    source: source||null, sourceId: sourceId||null,
  })).rows[0]?.id;
  await insertNotificationDeliveryLog(id);
  return { id };
}

export async function listNotifications(recipientId, { type, status, limit=50, offset=0 } = {}) {
  return (await selectNotifications(recipientId, { type, status, limit, offset })).rows || [];
}

export async function getNotification(notifId) {
  return (await selectNotificationById(notifId)).rows[0] || null;
}

export async function markNotificationRead(notifId) {
  await markNotificationReadRow(notifId);
  return { success: true };
}

export async function markAllNotificationsRead(recipientId) {
  await markAllNotificationsReadRow(recipientId);
  return { success: true };
}

export async function archiveNotification(notifId) {
  await archiveNotificationRow(notifId);
  return { success: true };
}

export async function deleteNotification(notifId) {
  await deleteNotificationRow(notifId);
  return { success: true };
}

export async function getUnreadCount(recipientId) {
  const result = await countUnreadNotifications(recipientId);
  return parseInt(result.rows[0]?.c||0);
}

export async function getNotificationTemplates() {
  return (await selectNotificationTemplates()).rows || [];
}

export async function renderTemplate(templateKey, variables) {
  const template = (await selectNotificationTemplateByKey(templateKey)).rows[0];
  if (!template) return null;
  let title = template.title_template, body = template.body_template||"";
  for (const [variableKey, variableValue] of Object.entries(variables||{})) {
    title = title.replace(new RegExp(`{{${variableKey}}}`, "g"), String(variableValue));
    body = body.replace(new RegExp(`{{${variableKey}}}`, "g"), String(variableValue));
  }
  return { title, body, channels: typeof template.channels==="string"?JSON.parse(template.channels):(template.channels||["in_app"]) };
}

export async function getNotificationPreferences(userCid) {
  const existing = (await selectNotificationPreferences(userCid)).rows[0];
  if (existing) return existing;
  await insertNotificationPreferences(userCid, JSON.stringify({
    system: { in_app: true, email: true }, project: { in_app: true, email: true },
    mentoring: { in_app: true, email: true }, investment: { in_app: true, email: false },
    verification: { in_app: true, email: true }, announcements: { in_app: true, email: true },
  }));
  return (await selectNotificationPreferences(userCid)).rows[0];
}

export async function updateNotificationPreferences(userCid, updates) {
  const sets = ["updated_at=NOW()"]; const args = [];
  if (updates.preferences) { sets.push("preferences=?::jsonb"); args.push(JSON.stringify(updates.preferences)); }
  if (updates.quiet_hours_start !== undefined) { sets.push("quiet_hours_start=?"); args.push(updates.quiet_hours_start); }
  if (updates.quiet_hours_end !== undefined) { sets.push("quiet_hours_end=?"); args.push(updates.quiet_hours_end); }
  if (updates.digest_frequency) { sets.push("digest_frequency=?"); args.push(updates.digest_frequency); }
  if (updates.language) { sets.push("language=?"); args.push(updates.language); }
  args.push(userCid);
  await updateNotificationPreferencesRow(sets, args);
  return { success: true };
}

export async function sendTemplatedNotification({ templateKey, recipientId, recipientType, ventureId, variables, priority, source, sourceId }) {
  const rendered = await renderTemplate(templateKey, variables);
  if (!rendered) throw new Error(`Template "${templateKey}" not found.`);
  return sendNotification({
    recipientId, recipientType, ventureId, type: templateKey.split("_")[0]||"system",
    title: rendered.title, body: rendered.body, data: variables, priority, source, sourceId,
  });
}
