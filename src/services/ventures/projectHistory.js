/**
 * services/ventures/projectHistory — clearing the project-management history.
 *
 * WHAT THIS IS
 *
 * A Venture's "project history" is the delivery record: the Journey and its
 * milestones, the activities under them, the deliverables they produce, and the
 * records that hang off those (submissions, reviews, comments, attachments, the
 * activity trail, the dependency edges).
 *
 * WHAT THIS IS NOT
 *
 * It is NOT the Venture. Profiles, founders, members, staff assignments,
 * responsibilities, permissions, notes, operating plans, documents,
 * verifications, coaching, KPIs, reminders and financial records are outside the
 * scope and are not referenced by the purge at all. The scope below is DATA, so
 * the screen, the API and the tests read the same list.
 *
 * WHY IT EXISTS
 *
 * A soft-deleted milestone no longer appears as active work (see
 * `@/models/workItems` and `@/models/ventureJourney`), but the rows remain — the
 * platform keeps history on purpose. Clearing it is therefore an explicit,
 * destructive, administrator act rather than something that happens as a side
 * effect of deleting a screen's contents.
 *
 * Layer (see docs/LAYER_SPLIT.md): decisions only. Every statement lives in
 * `@/models/ventureProjectHistoryStore`; the audit goes through the existing
 * audit service; nothing here runs SQL or speaks HTTP.
 */

import {
  PROJECT_HISTORY_TABLES,
  purgeVentureProjectHistory,
  selectProjectHistoryCounts,
} from "@/models/ventureProjectHistoryStore";
import { logAuditEvent } from "@/services/ventures/auditSecurity";

/**
 * What the purge removes, by table, with the word a person recognises. The table
 * names are the repository's; this adds the human label and nothing else.
 */
export const PROJECT_HISTORY_SCOPE = [
  { table: "venture_journey_stages", label: "Journey stages" },
  { table: "venture_milestones", label: "Milestones" },
  { table: "venture_tasks", label: "Activities (tasks)" },
  { table: "venture_deliverables", label: "Deliverables" },
  { table: "venture_task_submissions", label: "Task submissions" },
  { table: "venture_task_reviews", label: "Task reviews" },
  { table: "venture_task_comments", label: "Task comments" },
  { table: "venture_task_attachments", label: "Task attachments" },
  { table: "venture_task_activity", label: "Task activity trail" },
  { table: "venture_milestone_activity", label: "Milestone activity trail" },
  { table: "venture_deliverable_reviews", label: "Deliverable reviews" },
  { table: "venture_dependencies", label: "Dependency links" },
];

/**
 * Records the purge deliberately does NOT touch, named so the administrator is
 * told what stays. Kept as data for the same reason as the scope: one list, read
 * by the screen and the report.
 */
export const PROJECT_HISTORY_PROTECTED = [
  { key: "venture", label: "Venture profiles and core information" },
  { key: "people", label: "Founders, members and invitations" },
  { key: "staff", label: "Venture staff assignments and responsibilities" },
  { key: "permissions", label: "Venture permissions and access profiles" },
  { key: "documents", label: "Documents, verification and the Data bank" },
  { key: "notes", label: "Notes, operating plans and playbooks" },
  { key: "finance", label: "Financial, investor and coaching records" },
];

/** The purge never touches anything outside its own scope table list. */
export function isWithinPurgeScope(table) {
  return PROJECT_HISTORY_TABLES.includes(table);
}

/**
 * What would be removed, right now: the scope, what stays, and the live row
 * count per table. Read-only — the screen uses it to say how large the deletion
 * is BEFORE anyone confirms it.
 */
export async function previewProjectHistory() {
  const result = await selectProjectHistoryCounts().catch((error) => {
    // A count that cannot be read must not look like "nothing to delete": the
    // caller decides, but it needs to know.
    console.error("[project-history] count failed:", error?.message || error);
    return { rows: [] };
  });

  const byTable = new Map((result.rows || []).map((row) => [String(row.t), Number(row.rows) || 0]));
  const counts = PROJECT_HISTORY_SCOPE.map(({ table, label }) => ({
    table,
    label,
    rows: byTable.get(table) ?? 0,
  }));

  return {
    scope: PROJECT_HISTORY_SCOPE,
    protected: PROJECT_HISTORY_PROTECTED,
    counts,
    total: counts.reduce((sum, entry) => sum + entry.rows, 0),
  };
}

/**
 * Clear the project-management history of every Venture, then record the act.
 *
 * The delete is one transaction (all of it, or none of it). The audit row is
 * written AFTER the transaction, and deliberately outside it: a rolled-back
 * purge must never leave an audit entry claiming it happened, and a failed audit
 * write must never undo a deletion the administrator confirmed — so the outcome
 * is logged, and logging a failure is best-effort.
 *
 * @param {object} args
 * @param {object} args.actor  the session ({ cid, name, role }) that confirmed it
 * @returns {Promise<{ ok: boolean, removed: number, tables: object[], error?: string }>}
 */
export async function clearProjectHistory({ actor } = {}) {
  let outcome;
  try {
    outcome = await purgeVentureProjectHistory();
  } catch (error) {
    const message = error?.message || String(error);
    console.error("[project-history] purge failed and rolled back:", message);
    await logAuditEvent({
      eventType: "venture_project_history_purge_failed",
      actorCid: actor?.cid || null,
      actorName: actor?.name || null,
      actorRole: actor?.role || null,
      entityType: "venture_project_history",
      entityId: "all",
      description: "Clear all project history — failed, nothing was deleted",
      metadata: { outcome: "failed", error: message, tables: PROJECT_HISTORY_TABLES },
      severity: "critical",
    });
    return { ok: false, removed: 0, tables: [], error: "errors.somethingWrong" };
  }

  await logAuditEvent({
    eventType: "venture_project_history_purged",
    actorCid: actor?.cid || null,
    actorName: actor?.name || null,
    actorRole: actor?.role || null,
    entityType: "venture_project_history",
    entityId: "all",
    description: `Cleared the project history of every Venture (${outcome.removed} records)`,
    metadata: { outcome: "succeeded", removed: outcome.removed, tables: outcome.tables },
    severity: "critical",
  });

  return { ok: true, removed: outcome.removed, tables: outcome.tables };
}
