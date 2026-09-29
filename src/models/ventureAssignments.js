/**
 * EXTERNAL ASSIGNMENTS — the NAME half of an assignment.
 *
 * An assignment is a `contact_id` OR a `name`, and needs at least one:
 *
 *   platform member      the contact id is set — the person has an account
 *   external assignment  only the name is set — the person does not
 *
 * The name is a REFERENCE. It records that the work belongs to someone called
 * Amina without Amina existing anywhere in ImpactOS.
 *
 * THERE IS DELIBERATELY NO PERSON TABLE BEHIND THIS. A name typed into a tracker
 * must never become an account, so there is nothing here to promote. Resolving an
 * external assignment sets the contact id BESIDE the name and leaves the name —
 * and everything hanging off the assignment — exactly where it was. That is why
 * resolving cannot lose or duplicate a single assignment: the assignment never
 * moved.
 *
 * A REAL ImpactOS person is a different thing: Name + Email + Phone, created
 * through the platform's own person flow and invited BY EMAIL. Adding one is not
 * this module's job, and assigning work is not how a person is created.
 */
import db from "@/lib/db";
import { recordVentureChange } from "@/models/ventureChangeLog";

/** Where an assignment lives, level by level. `venture_tasks.venture_id` is TEXT
 *  while the others are uuid — the comparison is done as text throughout so one
 *  shape covers all four. */
export const ASSIGNMENT_LEVELS = {
  journey: { table: "venture_journey_stages", cidColumn: "owner_cid", nameColumn: "owner_name", changeType: "journey" },
  milestone: { table: "venture_milestones", cidColumn: "owner_cid", nameColumn: "owner_name", changeType: "milestone" },
  task: { table: "venture_tasks", cidColumn: "assigned_cid", nameColumn: "assigned_name", changeType: "task" },
  deliverable: { table: "venture_deliverables", cidColumn: "assigned_cid", nameColumn: "assigned_name", changeType: "deliverable" },
};

export const ASSIGNMENT_LEVEL_NAMES = Object.keys(ASSIGNMENT_LEVELS);

const rowsOf = (result) => (result && result.rows) || [];
const cleanName = (value) => String(value ?? "").replace(/\s+/g, " ").trim();

/**
 * Every assignment still standing on a name alone, grouped by name.
 *
 * This is what "external assignments detected" is about: names the Venture is
 * tracking that are not platform members. It is information, not an error — the
 * plan is complete without them ever becoming members.
 */
export async function listExternalAssignees({ dbId }) {
  if (!dbId) return [];
  const found = new Map();

  for (const [level, config] of Object.entries(ASSIGNMENT_LEVELS)) {
    const result = await db
      .execute({
        sql: `SELECT ${config.nameColumn} AS name, COUNT(*) AS count
                FROM ${config.table}
               WHERE venture_id::text = ?::text
                 AND COALESCE(${config.cidColumn}, '') = ''
                 AND COALESCE(${config.nameColumn}, '') <> ''
               GROUP BY ${config.nameColumn}`,
        args: [String(dbId)],
      })
      .catch(() => ({ rows: [] }));

    for (const row of rowsOf(result)) {
      const name = cleanName(row.name);
      if (!name) continue;
      const key = name.toLowerCase();
      const entry = found.get(key) || { name, total: 0, levels: {} };
      entry.total += Number(row.count || 0);
      entry.levels[level] = Number(row.count || 0);
      found.set(key, entry);
    }
  }

  return [...found.values()].sort((left, right) => left.name.localeCompare(right.name));
}

/**
 * Resolve ONE assignment's external name to a real ImpactOS person.
 *
 * The name is KEPT. It is the record of what the tracker said, and clearing it
 * would erase the only trace of where the assignment came from.
 */
export async function resolveExternalAssignment({ dbId, level, entityId, contactId, actorCid = null }) {
  const config = ASSIGNMENT_LEVELS[level];
  if (!dbId || !config || !entityId || !contactId) return { error: "A level, an assignment and a contact are required." };

  const result = await db.execute({
    sql: `UPDATE ${config.table}
             SET ${config.cidColumn} = ?
           WHERE id::text = ? AND venture_id::text = ?::text AND COALESCE(${config.nameColumn}, '') <> ''
           RETURNING id, ${config.nameColumn} AS name`,
    args: [String(contactId), String(entityId), String(dbId)],
  });
  const row = rowsOf(result)[0];
  if (!row) return { error: "errors.notFound" };

  await recordVentureChange({
    dbId,
    entityType: config.changeType,
    entityId: row.id,
    entityLabel: cleanName(row.name) || null,
    action: "assignee_resolved",
    actorCid,
    changes: [{ field: "owner", from: cleanName(row.name) || null, to: String(contactId) }],
  });

  return { resolved: 1 };
}

/**
 * Resolve EVERY assignment standing on one name — the bulk case, where a tracker's
 * "Amina" is on nine rows and the human has decided which Amina she is.
 *
 * One decision, many assignments, and still no re-pointing: each row keeps its
 * name and gains the contact id.
 */
export async function resolveExternalName({ dbId, displayName, contactId, actorCid = null }) {
  const name = cleanName(displayName);
  if (!dbId || !name || !contactId) return { error: "A name and a contact are required." };

  const counts = {};
  let total = 0;
  for (const [level, config] of Object.entries(ASSIGNMENT_LEVELS)) {
    const result = await db
      .execute({
        sql: `UPDATE ${config.table}
                 SET ${config.cidColumn} = ?
               WHERE venture_id::text = ?::text
                 AND LOWER(COALESCE(${config.nameColumn}, '')) = LOWER(?)
                 AND COALESCE(${config.cidColumn}, '') = ''
               RETURNING id`,
        args: [String(contactId), String(dbId), name],
      })
      .catch(() => ({ rows: [] }));
    const changed = rowsOf(result).length;
    if (changed > 0) counts[level] = changed;
    total += changed;
  }

  if (total > 0) {
    await recordVentureChange({
      dbId,
      entityType: "import",
      entityId: null,
      entityLabel: name,
      action: "assignee_resolved",
      actorCid,
      metadata: { name, contact_id: String(contactId), assignments: counts },
    });
  }

  return { resolved: total, counts };
}

/** Everything assigned to one real person, across the hierarchy. */
export async function listContactAssignments({ dbId, contactId }) {
  if (!dbId || !contactId) return { milestones: [], tasks: [], deliverables: [] };
  const cid = String(contactId);
  const [milestones, tasks, deliverables] = await Promise.all([
    db.execute({
      sql: "SELECT id, title, status FROM venture_milestones WHERE owner_cid = ? AND venture_id::text = ?::text ORDER BY created_at ASC",
      args: [cid, String(dbId)],
    }).catch(() => ({ rows: [] })),
    db.execute({
      sql: "SELECT id, title, status FROM venture_tasks WHERE assigned_cid = ? AND venture_id::text = ?::text ORDER BY created_at ASC",
      args: [cid, String(dbId)],
    }).catch(() => ({ rows: [] })),
    db.execute({
      sql: "SELECT id, title, status FROM venture_deliverables WHERE assigned_cid = ? AND venture_id::text = ?::text ORDER BY created_at ASC",
      args: [cid, String(dbId)],
    }).catch(() => ({ rows: [] })),
  ]);
  return { milestones: rowsOf(milestones), tasks: rowsOf(tasks), deliverables: rowsOf(deliverables) };
}

export default {
  ASSIGNMENT_LEVELS,
  ASSIGNMENT_LEVEL_NAMES,
  listExternalAssignees,
  resolveExternalAssignment,
  resolveExternalName,
  listContactAssignments,
};
