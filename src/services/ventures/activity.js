/**
 * VENTURE ACTIVITY, HISTORY AND NOTIFICATIONS.
 *
 * The three streams every Venture write path feeds:
 *   - the activity log (`logVentureActivity`);
 *   - the institutional history (`addVentureHistory`);
 *   - the in-app notification inbox (`createVentureNotification`,
 *     `notifyVentureFounders`).
 *
 * The decisions — how a notification's context columns are assembled, the
 * dedupe probe, and the founder audience — live here; every statement in
 * `@/models/ventureActivityStore`. Nothing here runs SQL.
 *
 * This module used to be re-exported through `@/lib/ventures`; that barrel is
 * gone (CH-4) and importers read this module directly. See docs/LAYER_SPLIT.md.
 */

import {
  insertVentureActivity,
  insertVentureHistory,
  selectNotificationByDedupe,
  insertVentureNotification,
  selectActivityVentureCode,
  selectFounderContactIds,
} from "@/models/ventureActivityStore";

/** Add an entry to a venture's activity log. */
export async function logVentureActivity({
  venture_id,
  action,
  actor_cid,
  actor_name,
  details = {},
}) {
  await insertVentureActivity(venture_id, action, actor_cid, actor_name || "", JSON.stringify(details));
}

/**
 * Add venture history entry (startup profile wizard step).
 */
export async function addVentureHistory({
  venture_id,
  event_type,
  description,
  metadata = {},
}) {
  await insertVentureHistory(venture_id, event_type, description || "", JSON.stringify(metadata));
}

const NOTIFICATION_CONTEXT_COLS = {
  venture_id: "entity_venture_id",
  journey_stage_id: "entity_journey_stage_id",
  milestone_id: "entity_milestone_id",
  task_id: "entity_task_id",
  session_id: "entity_session_id",
};

/**
 * Create a notification for a venture event.
 *
 * `context` (optional) records where the notification happened so the
 * platform inbox can drill down: venture → journey stage → milestone →
 * task/session (Vinance 3 Phase 1). All entity refs are nullable soft refs.
 *
 * Professional hardening (additive, non-disruptive):
 *   - templateKey/params store the i18n-able event identity alongside the
 *     pre-rendered title/message, so future renderers can localize without
 *     touching legacy consumers (which keep reading title/message).
 *   - dedupeKey makes producers idempotent: the same event never creates a
 *     second notification for the same recipient (noise control).
 */
export async function createVentureNotification({
  recipient_id,
  title,
  message,
  type = "venture",
  context = {},
  templateKey = null,
  params = null,
  dedupeKey = null,
}) {
  if (dedupeKey) {
    const dup = await selectNotificationByDedupe(recipient_id, dedupeKey).catch(() => ({ rows: [] }));
    if (dup.rows?.length) return { skipped: true, dedupeKey };
  }

  const cols = ["recipient_id", "title", "message", "type", "is_read", "created_at"];
  const placeholders = ["?", "?", "?", "?", 0, "NOW()"];
  const args = [recipient_id, title, message, type];
  for (const [key, column] of Object.entries(NOTIFICATION_CONTEXT_COLS)) {
    const contextValue = context ? context[key] : undefined;
    if (contextValue !== undefined && contextValue !== null && contextValue !== "") {
      cols.push(column);
      placeholders.push("?");
      args.push(String(contextValue));
    }
  }
  if (templateKey) {
    cols.push("template_key");
    placeholders.push("?");
    args.push(String(templateKey));
  }
  if (params !== null && params !== undefined) {
    cols.push("params");
    placeholders.push("?::jsonb");
    args.push(JSON.stringify(params));
  }
  if (dedupeKey) {
    cols.push("dedupe_key");
    placeholders.push("?");
    args.push(String(dedupeKey));
  }
  await insertVentureNotification(cols, placeholders, args);
  return { success: true };
}

/** Notify all venture founders about an event */
export async function notifyVentureFounders(dbId, title, message, context = {}, template = {}) {
  try {
    // venture_members stores venture_id as the VNT code (TEXT)
    const ventureResult = await selectActivityVentureCode(dbId);
    const code = ventureResult.rows?.[0]?.venture_id || dbId;
    const notificationContext = { ...(context || {}), venture_id: context?.venture_id || dbId };
    const { templateKey = null, params = null, dedupeKey = null } = template || {};
    const founders = await selectFounderContactIds(code);
    for (const founder of founders.rows || []) {
      if (founder.contact_id) {
        await createVentureNotification({
          recipient_id: founder.contact_id, title, message, context: notificationContext,
          templateKey, params, dedupeKey,
        });
      }
    }
    // Also notify the venture venture_id (for super admin overview)
    const vid = ventureResult.rows?.[0]?.venture_id;
    if (vid) {
      await createVentureNotification({
        recipient_id: "sa", title: `[${vid}] ${title}`, message, context: notificationContext,
        templateKey, params, dedupeKey: dedupeKey ? `sa:${dedupeKey}` : null,
      });
    }
  } catch { /* non-blocking */ }
}
