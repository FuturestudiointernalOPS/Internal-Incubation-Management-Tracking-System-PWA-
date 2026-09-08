/**
 * Venture Progress Reports (Vinance 3 — Phase 3, doc §14).
 *
 * A Manager composes a typed, period-based progress report for a Venture and
 * submits it to Super Admin — completed/outstanding items, support delivered,
 * challenges, recommendation. Read-only for Super Admin review; reports join
 * the Venture's institutional memory (listed and viewable alongside History).
 *
 * Pure data layer over venture_reports; every write is additive.
 */

function rowsOf(result) {
  return (result && result.rows) || [];
}

function jsonList(value) {
  const arr = Array.isArray(value) ? value : [];
  return arr.slice(0, 100).map((v) => (typeof v === "string" ? v.slice(0, 500) : String(v || "").slice(0, 500)));
}

const TEXT_FIELDS = {
  title: "title",
  reporting_period: "reporting_period",
  summary: "summary",
  current_journey: "current_journey",
  current_milestone: "current_milestone",
  support_delivered: "support_delivered",
  challenges: "challenges",
  recommendation: "recommendation",
};

export async function createVentureReport(db, { code, actorCid = null, fields = {} }) {
  const title = String(fields.title || "").trim();
  if (!title) return { error: "Report title is required." };

  const completedItems = jsonList(fields.completed_items);
  const outstandingItems = jsonList(fields.outstanding_items);

  const res = await db.execute({
    sql: `INSERT INTO venture_reports
            (venture_id, title, reporting_period, summary, current_journey, current_milestone,
             completed_items, outstanding_items, support_delivered, challenges, recommendation,
             status, created_by)
          VALUES (?, ?, ?, ?, ?, ?, ?::jsonb, ?::jsonb, ?, ?, ?, 'draft', ?) RETURNING id`,
    args: [
      code, title, fields.reporting_period || null, fields.summary || null,
      fields.current_journey || null, fields.current_milestone || null,
      JSON.stringify(completedItems), JSON.stringify(outstandingItems),
      fields.support_delivered || null, fields.challenges || null,
      fields.recommendation || null, actorCid || null,
    ],
  });
  return { success: true, id: res.rows?.[0]?.id ?? res.lastInsertRowid };
}

export async function listVentureReports(db, { code, status = null }) {
  let sql = "SELECT * FROM venture_reports WHERE venture_id = ?";
  const args = [code];
  if (status) {
    sql += " AND status = ?";
    args.push(status);
  }
  sql += " ORDER BY created_at DESC";
  const res = await db.execute({ sql, args }).catch(() => ({ rows: [] }));
  return rowsOf(res);
}

export async function getVentureReport(db, { code, id }) {
  const res = await db.execute({
    sql: "SELECT * FROM venture_reports WHERE id = ? AND venture_id = ?",
    args: [id, code],
  });
  return rowsOf(res)[0] || null;
}

export async function updateVentureReportStatus(db, { code, id, status }) {
  const allowed = ["draft", "submitted", "reviewed", "archived"];
  if (!allowed.includes(status)) return { error: "Unknown report status." };
  const fields = ["status = ?", "updated_at = NOW()"];
  const args = [status];
  if (status === "submitted") {
    fields.push("submitted_at = COALESCE(submitted_at, NOW())");
  }
  args.push(id, code);
  await db.execute({
    sql: `UPDATE venture_reports SET ${fields.join(", ")} WHERE id = ? AND venture_id = ?`,
    args,
  });
  return { success: true };
}

export default { createVentureReport, listVentureReports, getVentureReport, updateVentureReportStatus };
