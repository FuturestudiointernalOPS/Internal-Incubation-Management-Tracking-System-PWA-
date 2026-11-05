import db from "@/lib/db";

// ── Phase 5 — introduction requests ──────────────────────────────────────────

export async function insertIntroductionRequest({
  investorId,
  ventureId,
  dealFlowEntryId = null,
  pipelineId = null,
  message = null,
  status = "submitted",
}) {
  return db.execute({
    sql: `INSERT INTO introduction_requests
            (investor_id, venture_id, deal_flow_entry_id, pipeline_id, message, status)
          VALUES (?, ?, ?, ?, ?, ?) RETURNING *`,
    args: [
      investorId,
      ventureId ? String(ventureId) : null,
      dealFlowEntryId ?? null,
      pipelineId ?? null,
      message ?? null,
      status,
    ],
  });
}

export async function listIntroductionRequests({ status = null, investorId = null, limit = 200 } = {}) {
  const where = [];
  const args = [];
  if (status) {
    where.push("status = ?");
    args.push(status);
  }
  if (investorId != null) {
    where.push("investor_id = ?");
    args.push(investorId);
  }
  let sql = "SELECT * FROM introduction_requests";
  if (where.length) sql += ` WHERE ${where.join(" AND ")}`;
  sql += " ORDER BY requested_at DESC LIMIT ?";
  args.push(limit);
  return db.execute({ sql, args });
}

export async function getIntroductionRequestById(id) {
  return db.execute({
    sql: "SELECT * FROM introduction_requests WHERE id = ?",
    args: [id],
  });
}

export async function markIntroductionReviewStarted(id) {
  return db.execute({
    sql: `UPDATE introduction_requests
             SET status = 'under_review'
           WHERE id = ? AND status = 'submitted'
           RETURNING *`,
    args: [id],
  });
}

export async function updateIntroductionDecision({
  id,
  status,
  decidedBy = null,
  declineReason = null,
  workspaceId = null,
}) {
  return db.execute({
    sql: `UPDATE introduction_requests
             SET status = ?, decided_by = ?, decided_at = NOW(),
                 decline_reason = ?, workspace_id = COALESCE(?, workspace_id)
           WHERE id = ? RETURNING *`,
    args: [status, decidedBy, declineReason, workspaceId, id],
  });
}
