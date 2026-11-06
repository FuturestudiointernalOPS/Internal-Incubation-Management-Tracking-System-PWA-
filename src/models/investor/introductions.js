import db from "@/lib/db";

export async function insertIntroductionRequest({
  investorProfileId,
  ventureId,
  dealFlowEntryId,
  pipelineId,
  message = null,
  status = "submitted",
}) {
  return db.execute({
    sql: `INSERT INTO investor_introduction_requests
            (investor_profile_id, venture_id, deal_flow_entry_id, pipeline_id, message, status)
          VALUES (?, ?, ?, ?, ?, ?) RETURNING *`,
    args: [
      investorProfileId,
      ventureId ? String(ventureId) : null,
      dealFlowEntryId,
      pipelineId,
      message ?? null,
      status,
    ],
  });
}

export async function listIntroductionRequests({ status = null, investorProfileId = null, limit = 200 } = {}) {
  const where = ["TRUE"];
  const args = [];
  if (status) {
    where.push("status = ?");
    args.push(status);
  }
  if (investorProfileId != null) {
    where.push("investor_profile_id = ?");
    args.push(investorProfileId);
  }
  const sql = `SELECT r.*, v.venture_name, p.organization_name, c.email AS investor_email
                 FROM investor_introduction_requests r
                 LEFT JOIN LATERAL (
                   SELECT COALESCE(v.name, v.company_name, r.venture_id) AS venture_name
                     FROM ventures v
                    WHERE v.id::text = r.venture_id OR v.venture_id = r.venture_id
                    ORDER BY CASE WHEN v.id::text = r.venture_id THEN 0 ELSE 1 END
                    LIMIT 1
                 ) v ON TRUE
                 LEFT JOIN investor_profiles p ON p.id = r.investor_profile_id
                 LEFT JOIN contacts c ON c.cid = p.user_id
                WHERE ${where.join(" AND ")}
                ORDER BY r.requested_at DESC LIMIT ?`;
  args.push(limit);
  return db.execute({ sql, args });
}

export async function getIntroductionRequestById(id) {
  return db.execute({
    sql: "SELECT * FROM investor_introduction_requests WHERE id = ?",
    args: [id],
  });
}

export async function getIntroductionNotificationContext(investorProfileId, ventureId) {
  return db.execute({
    sql: `SELECT c.cid, c.email,
                 CASE WHEN c.language IN ('en', 'fr') THEN c.language ELSE 'en' END AS language,
                 COALESCE(v.venture_name, ?) AS venture_name
            FROM investor_profiles p
            JOIN contacts c ON c.cid = p.user_id
            LEFT JOIN LATERAL (
              SELECT COALESCE(v.name, v.company_name) AS venture_name
                FROM ventures v
               WHERE v.id::text = ? OR v.venture_id = ?
               ORDER BY CASE WHEN v.id::text = ? THEN 0 ELSE 1 END
               LIMIT 1
            ) v ON TRUE
           WHERE p.id = ?
           LIMIT 1`,
    args: [String(ventureId), String(ventureId), String(ventureId), String(ventureId), investorProfileId],
  });
}

export async function markIntroductionReviewStarted(id) {
  return db.execute({
    sql: `UPDATE investor_introduction_requests
             SET status = 'under_review', updated_at = NOW()
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
  internalNote = null,
  workspaceId = null,
}) {
  return db.execute({
    sql: `UPDATE investor_introduction_requests
             SET status = ?, decided_by = ?, decided_at = NOW(),
                 decline_reason = ?, internal_note = ?, workspace_id = COALESCE(?, workspace_id),
                 updated_at = NOW()
             WHERE id = ? AND status IN ('submitted', 'under_review') RETURNING *`,
    args: [status, decidedBy, declineReason, internalNote, workspaceId, id],
  });
}

export async function findActiveIntroductionRequest({ investorProfileId, dealFlowEntryId }) {
  return db.execute({
    sql: `SELECT id, status FROM investor_introduction_requests
           WHERE investor_profile_id = ? AND deal_flow_entry_id = ?
             AND status IN ('submitted', 'under_review', 'approved')
           ORDER BY requested_at DESC LIMIT 1`,
    args: [investorProfileId, dealFlowEntryId],
  });
}

export async function withdrawIntroductionRequest({ id, investorProfileId }) {
  return db.execute({
    sql: `UPDATE investor_introduction_requests
             SET status = 'withdrawn', updated_at = NOW()
           WHERE id = ? AND investor_profile_id = ?
             AND status IN ('submitted', 'under_review')
           RETURNING id, venture_id, status, requested_at`,
    args: [id, investorProfileId],
  });
}

export async function listInvestorIntroductionRequests(investorProfileId, limit = 200) {
  return db.execute({
    sql: `SELECT r.id, r.venture_id, v.venture_name, r.message, r.status, r.requested_at,
                 r.decline_reason, r.workspace_id
            FROM investor_introduction_requests r
            LEFT JOIN LATERAL (
              SELECT COALESCE(v.name, v.company_name, r.venture_id) AS venture_name
                FROM ventures v
               WHERE v.id::text = r.venture_id OR v.venture_id = r.venture_id
               ORDER BY CASE WHEN v.id::text = r.venture_id THEN 0 ELSE 1 END
               LIMIT 1
            ) v ON TRUE
           WHERE r.investor_profile_id = ?
           ORDER BY r.requested_at DESC
           LIMIT ?`,
    args: [investorProfileId, limit],
  });
}
