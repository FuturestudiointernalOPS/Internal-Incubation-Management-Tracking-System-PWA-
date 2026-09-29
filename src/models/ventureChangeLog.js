/**
 * VENTURE CHANGE LOG — what changed, from what, to what, when, and by whom.
 *
 * The same field-level shape as the existing `task_audit_logs` (action +
 * field_name / old_value / new_value + actor + timestamp), generalised to the
 * whole Venture structure so a Journey or a Milestone is as answerable as a
 * task: "who moved this date, and what was it before?"
 *
 * Two contracts matter here:
 *
 *   NON-FATAL — recording is never more important than the change it describes.
 *   Every writer goes through `recordVentureChange`, which logs a failure and
 *   swallows it. A history gap is better than a broken save.
 *
 *   CHANGE-SHAPED — a row says WHAT moved. Comparing a Date to the string the
 *   browser sent would report a change on every save, so values are normalised
 *   before they are compared: the log only ever says something moved if it did.
 */
import db, { initDb } from "@/lib/db";

export const CHANGE_ENTITY_TYPES = ["journey", "milestone", "task", "deliverable", "dependency", "import"];

const MAX_VALUE_CHARS = 2000;

/**
 * One comparable form for a value. A `date` column comes back as a Date and the
 * browser sends "2026-12-22" — those are the same day and must compare equal,
 * or every save would file a phantom change.
 */
export function normaliseChangeValue(value) {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) {
    const pad = (part) => String(part).padStart(2, "0");
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
  }
  const text = String(value).trim();
  if (!text) return null;
  const isoDay = /^(\d{4}-\d{2}-\d{2})T/.exec(text);
  return (isoDay ? isoDay[1] : text).slice(0, MAX_VALUE_CHARS);
}

/**
 * The fields that actually changed, each with its before and after.
 *
 * `after` is the incoming update: a field that was not sent is not a change, so
 * a partial PATCH only ever reports the fields it touched.
 */
export function diffFields(before, after, fields) {
  const changes = [];
  for (const field of fields) {
    if (!after || after[field] === undefined) continue;
    const from = normaliseChangeValue(before ? before[field] : null);
    const to = normaliseChangeValue(after[field]);
    if (from !== to) changes.push({ field, from, to });
  }
  return changes;
}

/**
 * Record a change on a Venture. Never throws, never rejects.
 *
 * `changes` is a list of `{ field, from, to }` (from `diffFields`). When it is
 * empty the row records the action itself — "this was activated", "this came
 * from an import" — which is exactly as much as happened.
 */
export async function recordVentureChange({
  dbId,
  entityType,
  entityId = null,
  entityLabel = null,
  action,
  actorCid = null,
  actorName = null,
  changes = [],
  metadata = null,
}) {
  try {
    if (!dbId || !entityType || !action) return;
    if (!CHANGE_ENTITY_TYPES.includes(entityType)) return;
    await initDb().catch(() => {});

    const rows = (changes || []).length ? changes : [{ field: null, from: null, to: null }];
    for (const change of rows) {
      await db.execute({
        sql: `INSERT INTO venture_change_log
                (venture_id, entity_type, entity_id, entity_label, action,
                 field_name, old_value, new_value, actor_cid, actor_name, metadata)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb)`,
        args: [
          dbId,
          entityType,
          entityId === null || entityId === undefined ? null : String(entityId),
          entityLabel ? String(entityLabel).slice(0, 500) : null,
          action,
          change.field ?? null,
          change.from === undefined ? null : change.from,
          change.to === undefined ? null : change.to,
          actorCid || null,
          actorName || null,
          metadata ? JSON.stringify(metadata) : null,
        ],
      });
    }
  } catch (error) {
    // Deliberately swallowed: the change already happened.
    console.error("[ventureChangeLog] could not record:", error?.message);
  }
}

/** The Venture's history, newest first, optionally narrowed to one entity. */
export async function listVentureChanges({ dbId, entityType = null, entityId = null, limit = 200 }) {
  if (!dbId) return [];
  const clauses = ["venture_id = ?"];
  const args = [dbId];
  if (entityType) {
    clauses.push("entity_type = ?");
    args.push(entityType);
  }
  if (entityId !== null && entityId !== undefined && entityId !== "") {
    clauses.push("entity_id = ?");
    args.push(String(entityId));
  }
  const capped = Math.min(Math.max(Number(limit) || 200, 1), 500);

  const result = await db.execute({
    sql: `SELECT id, entity_type, entity_id, entity_label, action, field_name,
                 old_value, new_value, actor_cid, actor_name, metadata, created_at
            FROM venture_change_log
           WHERE ${clauses.join(" AND ")}
           ORDER BY created_at DESC
           LIMIT ?`,
    args: [...args, capped],
  });
  return result.rows || [];
}

export default { recordVentureChange, listVentureChanges, diffFields, normaliseChangeValue };
