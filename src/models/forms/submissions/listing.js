import db from "@/lib/db";

/**
 * Forms & submissions model — submission listing (REPOSITORY layer).
 *
 * The filtered submission list with the optional latest-version-per-deliverable
 * mode, behind `GET src/app/api/submissions/route.js`. Split verbatim out of
 * `models/forms/submissions.js` — see docs/LAYER_SPLIT.md.
 *
 * Model-layer rules: no HTTP, one function per query, named after the data.
 */

/** Submissions with filters; optional latest-version-per-deliverable mode. */
export async function listSubmissions({
  participant_id,
  team_id,
  group_id,
  program_id,
  deliverable_id,
  document_id,
  status,
  latest_only,
  facScopeFilter,
  facScopeArgs,
}) {
  let sql = `
       SELECT s.*,
              d.title as deliverable_title,
              d.week_number as deliverable_week,
              d.due_date as deliverable_due_date,
              c.name as participant_name, g.name as group_name
       FROM v2_submissions s
       LEFT JOIN v2_deliverables d ON s.deliverable_id::text = d.id::text
       LEFT JOIN contacts c ON s.participant_id::text = c.cid
       LEFT JOIN v2_groups g ON s.group_id::text = g.id::text
       WHERE 1=1
    `;
  let args = [];

  if (participant_id) {
    sql += " AND s.participant_id::text = ?";
    args.push(participant_id);
  }
  if (team_id) {
    sql += " AND s.team_id::text = ?";
    args.push(team_id);
  }
  if (group_id) {
    sql += " AND s.group_id::text = ?";
    args.push(group_id);
  }
  if (program_id) {
    sql += " AND s.program_id::text = ?";
    args.push(program_id);
  }
  if (deliverable_id) {
    sql += " AND s.deliverable_id::text = ?";
    args.push(deliverable_id);
  }
  if (document_id) {
    sql += " AND s.document_id = ?";
    args.push(Number(document_id));
  }
  if (status) {
    sql += " AND s.status = ?";
    args.push(status);
  }
  if (facScopeFilter) {
    sql += " AND " + facScopeFilter;
    args.push(...facScopeArgs);
  }

  // If latest_only, get the latest version per participant+deliverable
  if (latest_only) {
    sql = `
        SELECT s1.*,
               COALESCE(del.title, dr.title) as deliverable_title,
               COALESCE(del.week_number, dr.week_number) as deliverable_week,
               del.due_date as deliverable_due_date,
               c.name as participant_name, g.name as group_name
        FROM v2_submissions s1
        LEFT JOIN v2_deliverables del ON s1.deliverable_id::text = del.id::text
        LEFT JOIN v2_document_requirements dr ON s1.document_id = dr.id
        LEFT JOIN contacts c ON s1.participant_id::text = c.cid
        LEFT JOIN v2_groups g ON s1.group_id::text = g.id::text
        INNER JOIN (
          SELECT participant_id, COALESCE(deliverable_id::text, document_id::text) as lookup_id, MAX(version_number) as max_ver
          FROM v2_submissions
          WHERE 1=1
      `;
    let innerArgs = [];
    if (participant_id) {
      sql += " AND participant_id::text = ?";
      innerArgs.push(participant_id);
    }
    if (program_id) {
      sql += " AND program_id::text = ?";
      innerArgs.push(program_id);
    }
    if (deliverable_id) {
      sql += " AND (deliverable_id::text = ? OR document_id = ?)";
      innerArgs.push(deliverable_id, Number(deliverable_id) || 0);
    }
    if (facScopeFilter) {
      sql +=
        " AND participant_id IN (SELECT c.cid FROM contacts c WHERE c.v2_team_id IN (" +
        facScopeArgs.map(() => "?").join(",") +
        "))";
      innerArgs.push(...facScopeArgs);
    }
    sql += " GROUP BY participant_id::text, COALESCE(deliverable_id::text, document_id::text)";
    sql += " ) s2";
    sql += " ON s1.participant_id::text = s2.participant_id AND COALESCE(s1.deliverable_id::text, s1.document_id::text) = s2.lookup_id AND s1.version_number = s2.max_ver";
    args = [...innerArgs];
  }

  sql += " ORDER BY s.created_at DESC";

  return db.execute({ sql, args });
}
