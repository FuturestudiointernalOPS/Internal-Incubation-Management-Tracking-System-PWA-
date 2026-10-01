/**
 * Platform form runs — the paginated run list (REPOSITORY layer).
 *
 * The shared filter definition, the count and the page query behind the run
 * list. The total-resolution DECISION (window count vs a separate count) lives in
 * `@/services/platform/formRunList`.
 *
 * SQL is byte-identical to what used to sit inline in `models/formRuns.js`.
 *
 * Layer rules (see docs/LAYER_SPLIT.md): no HTTP, one function per statement, no
 * decisions.
 */

import db from "@/lib/db";

// The count and the page used to be two statements walking the same filtered
// set, awaited one after the other — two round trips (~260ms on the current
// link) for what is a single question. The filter is now built once and the
// page query carries the total as a window column.

const RUN_LIST_FROM = `FROM platform_form_runs r
      JOIN platform_forms f ON r.form_id = f.id
      LEFT JOIN LATERAL (
        SELECT a.target_id
        FROM platform_form_run_assignments a
        WHERE a.run_id = r.id AND a.target_type = 'group'
        LIMIT 1
      ) ga ON true`;

/** The WHERE clause + args shared by the count and the page query. */
function buildRunListFilter({ groupId, programId, formId, status }) {
  const conditions = [];
  const args = [];

  if (groupId) {
    conditions.push("EXISTS (SELECT 1 FROM platform_form_run_assignments ga2 WHERE ga2.run_id = r.id AND ga2.target_type = 'group' AND ga2.target_id = ?)");
    args.push(groupId);
  }
  if (programId) {
    conditions.push("EXISTS (SELECT 1 FROM platform_form_run_assignments pa WHERE pa.run_id = r.id AND pa.target_type = 'program' AND pa.target_id = ?)");
    args.push(programId);
  }
  if (formId) { conditions.push("r.form_id = ?"); args.push(parseInt(formId)); }
  if (status && status !== "all") {
    conditions.push("r.status = ?");
    args.push(status);
  } else {
    conditions.push("r.status IS DISTINCT FROM 'archived'");
  }

  return {
    whereClause: conditions.length ? " WHERE " + conditions.join(" AND ") : "",
    args,
  };
}

/** Count of runs matching the list filters (paginated run list). */
export async function countFormRuns({ groupId, programId, formId, status }) {
  const { whereClause, args } = buildRunListFilter({
    groupId,
    programId,
    formId,
    status,
  });
  return db.execute({
    sql: `SELECT COUNT(*) AS total ${RUN_LIST_FROM}${whereClause}`,
    args,
  });
}

/** One page of runs, its matching total carried as a window column. */
export function selectFormRunsPage({ groupId, programId, formId, status, perPage, offset }) {
  const { whereClause, args } = buildRunListFilter({
    groupId,
    programId,
    formId,
    status,
  });

  return db.execute({
    sql: `SELECT r.*, f.name as form_name, ga.target_id as group_target_id, COUNT(*) OVER () AS total_count ${RUN_LIST_FROM}${whereClause} ORDER BY r.updated_at DESC LIMIT ? OFFSET ?`,
    args: [...args, perPage, offset],
  });
}
