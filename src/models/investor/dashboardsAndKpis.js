import db from "@/lib/db";

// ── GET /api/investor/dashboard ─────────────────────────────────────────────

/** dashboard — full investor profile + preference overlap fields. */
export async function getInvestorDashboardProfile(userCid) {
  return db.execute({
    sql: `SELECT ip.*, ipr.industries, ipr.countries, ipr.startup_stages
            FROM investor_profiles ip
            LEFT JOIN investor_preferences ipr ON ipr.investor_id = ip.id
            WHERE ip.user_id = ?`,
    args: [userCid],
  });
}

/** dashboard — the investor's pipeline entries, newest stage change first. */
export async function listInvestorPipelineEntries(investorId) {
  return db.execute({
    sql: `SELECT ip.*, p.name as venture_name, p.status as venture_status
            FROM investment_pipeline ip
            LEFT JOIN v2_programs p ON ip.venture_id = p.id
            WHERE ip.investor_id = ?
            ORDER BY ip.stage_changed_at DESC`,
    args: [investorId],
  });
}

/** dashboard — the investor's watchlist enriched with venture/campaign data. */
export async function listInvestorWatchlist(investorId) {
  return db.execute({
    sql: `SELECT iw.*, p.name as venture_name, p.status as venture_status,
                    p.industry, p.country, p.business_stage, p.completion_index,
                    p.funding_requirement, p.description,
                    fc.id as campaign_id, fc.name as campaign_name, fc.status as campaign_status,
                    fc.target_raise, fc.current_raised, fc.min_investment,
                    fc.opening_date, fc.closing_date,
                    (SELECT COUNT(*) FROM investment_pipeline WHERE venture_id = iw.venture_id AND stage NOT IN ('declined'))::int as investor_count
             FROM investor_watchlist iw
             LEFT JOIN v2_programs p ON iw.venture_id = p.id
             LEFT JOIN fundraising_campaigns fc ON fc.venture_id = iw.venture_id AND fc.status = 'active'
             WHERE iw.investor_id = ?
             ORDER BY iw.created_at DESC`,
    args: [investorId],
  });
}

/** dashboard — active ventures fed into the recommendation scorer. */
export async function listActiveVenturesForRecommendations() {
  return db.execute({
    sql: `SELECT p.id, p.name, p.description, p.status, p.industry,
                     p.country, p.completion_index, p.business_stage,
                     p.funding_requirement, p.created_at,
                     (SELECT COUNT(*) FROM investment_pipeline WHERE venture_id = p.id) as investor_interest_count
              FROM v2_programs p
              WHERE p.status = 'active' AND p.is_archived = 0
              ORDER BY p.created_at DESC LIMIT 50`,
    args: [],
  });
}

/** dashboard — pipeline funnel stats for the investor. */
export async function getInvestorPipelineStats(investorId) {
  return db.execute({
    sql: `SELECT
              COUNT(*) FILTER (WHERE stage = 'invested') as invested_count,
              COUNT(*) FILTER (WHERE stage IN ('due_diligence','negotiation')) as active_evaluations,
              COUNT(*) as total_pipeline
            FROM investment_pipeline WHERE investor_id = ?`,
    args: [investorId],
  });
}

/** dashboard — investor watchlist row count. */
export async function countInvestorWatchlist(investorId) {
  return db.execute({
    sql: "SELECT COUNT(*) as count FROM investor_watchlist WHERE investor_id = ?",
    args: [investorId],
  });
}

/** dashboard — active fundraising campaigns (public or invite-only). */
export async function listActiveFundraisingCampaigns() {
  return db.execute({
    sql: `SELECT fc.*, p.name as venture_name, p.industry, p.country, p.business_stage,
                     p.funding_requirement, p.completion_index,
                     (SELECT COUNT(*) FROM investment_pipeline WHERE venture_id = fc.venture_id AND stage NOT IN ('declined'))::int as investor_count,
                     (SELECT COUNT(*) FROM investment_pipeline WHERE venture_id = fc.venture_id AND stage IN ('due_diligence','negotiation'))::int as active_dd_count
              FROM fundraising_campaigns fc
              LEFT JOIN v2_programs p ON fc.venture_id = p.id
              WHERE fc.status = 'active' AND (fc.visibility = 'public' OR fc.visibility = 'invite_only')
              ORDER BY fc.created_at DESC LIMIT 20`,
    args: [],
  });
}

/** dashboard — active relationship workspaces of the investor with RM names. */
export async function listActiveInvestorRelationshipWorkspaces(investorId) {
  return db.execute({
    sql: `SELECT rw.*, p.name as venture_name, p.industry,
                     rm.name as relationship_manager_name,
                     (SELECT COUNT(*) FROM relationship_meetings WHERE workspace_id = rw.id AND status = 'scheduled')::int as upcoming_meetings
              FROM relationship_workspaces rw
              LEFT JOIN v2_programs p ON rw.venture_id = p.id
              LEFT JOIN contacts rm ON rw.relationship_manager_id = rm.cid
              WHERE rw.investor_id = ? AND rw.status = 'active'
              ORDER BY rw.updated_at DESC`,
    args: [investorId],
  });
}

/** dashboard — next scheduled meetings of a relationship workspace. */
export async function listUpcomingRelationshipMeetings(workspaceId) {
  return db.execute({
    sql: `SELECT id, meeting_type, scheduled_date, scheduled_time, status, location
                FROM relationship_meetings
                WHERE workspace_id = ? AND status = 'scheduled'
                ORDER BY scheduled_date ASC LIMIT 3`,
    args: [workspaceId],
  });
}

// ── GET /api/investor/executive-dashboard ───────────────────────────────────

/**
 * executive-dashboard GET — run one parameterless report query and return its
 * rows. The controller feeds the eight report SQL strings through this single
 * execute site (it previously did so through an inline q(sql) helper), so the
 * extraction is 1:1 with the original call site; the SQL text stays with the
 * caller by design.
 */
/** executive-dashboard — investor counts by approval state. */
export async function getExecutiveDashboardInvestors() {
  return (await db.execute({ sql: `SELECT (SELECT COUNT(*) FROM investor_profiles WHERE approval_status='approved')::int as total_verified, (SELECT COUNT(*) FROM investor_profiles WHERE approval_status='pending_review')::int as total_pending, (SELECT COUNT(*) FROM investor_profiles)::int as total_registered`, args: [] })).rows;
}

/** executive-dashboard — active programme / campaign counts. */
export async function getExecutiveDashboardVentures() {
  return (await db.execute({ sql: `SELECT (SELECT COUNT(*) FROM v2_programs WHERE status='active' AND is_archived=0)::int as active_ventures, (SELECT COUNT(*) FROM fundraising_campaigns WHERE status='active')::int as active_campaigns`, args: [] })).rows;
}

/** executive-dashboard — fundraising targets/raised/committed. */
export async function getExecutiveDashboardFundraising() {
  return (await db.execute({ sql: `SELECT COALESCE(SUM(target_raise),0)::float as total_sought, COALESCE(SUM(current_raised),0)::float as total_raised, (SELECT COALESCE(SUM(investment_amount),0)::float FROM investment_decisions WHERE decision_type='invest') as total_committed FROM fundraising_campaigns`, args: [] })).rows;
}

/** executive-dashboard — relationship / pipeline counts. */
export async function getExecutiveDashboardRelationships() {
  return (await db.execute({ sql: `SELECT (SELECT COUNT(*) FROM relationship_workspaces WHERE status='active')::int as active_relationships, (SELECT COUNT(*) FROM relationship_meetings WHERE status='completed')::int as meetings_completed, (SELECT COUNT(*) FROM investment_pipeline WHERE stage='invested')::int as total_invested`, args: [] })).rows;
}

/** executive-dashboard — pipeline counts per stage. */
export async function getExecutiveDashboardPipeline() {
  return (await db.execute({ sql: `SELECT stage, COUNT(*)::int as count FROM investment_pipeline GROUP BY stage ORDER BY count DESC`, args: [] })).rows;
}

/** executive-dashboard — most active approved investors. */
export async function getExecutiveDashboardTopInvestors() {
  return (await db.execute({ sql: `SELECT c.name, (SELECT COUNT(*) FROM investment_pipeline WHERE investor_id = ip.id)::int as pipeline_count, (SELECT COUNT(*) FROM investment_pipeline WHERE investor_id = ip.id AND stage='invested')::int as invested_count FROM investor_profiles ip JOIN contacts c ON ip.user_id = c.cid WHERE ip.approval_status='approved' ORDER BY pipeline_count DESC LIMIT 5`, args: [] })).rows;
}

/** executive-dashboard — investor interest per programme sector. */
export async function getExecutiveDashboardSectorDemand() {
  return (await db.execute({ sql: `SELECT p.industry, COUNT(ip.id)::int as interest_count FROM v2_programs p LEFT JOIN investment_pipeline ip ON ip.venture_id = p.id WHERE p.status='active' AND p.is_archived=0 AND p.industry IS NOT NULL GROUP BY p.industry ORDER BY interest_count DESC LIMIT 6`, args: [] })).rows;
}

/** executive-dashboard — live campaign progress, most advanced first. */
export async function getExecutiveDashboardCampaignPerformance() {
  return (await db.execute({ sql: `SELECT p.name as venture_name, p.industry, fc.target_raise, fc.current_raised, CASE WHEN fc.target_raise > 0 THEN ROUND((fc.current_raised / fc.target_raise) * 100) ELSE 0 END as pct FROM fundraising_campaigns fc LEFT JOIN v2_programs p ON fc.venture_id = p.id WHERE fc.status = 'active' ORDER BY pct DESC LIMIT 10`, args: [] })).rows;
}

// ── GET /api/investor/admin-overview ────────────────────────────────────────

/** admin-overview — DD workspaces joined with pipeline/investor/venture info. */
export async function listAdminOverviewWorkspaces() {
  return db.execute({
    sql: `SELECT dw.*, ip.venture_id, ip.stage, ipr.organization_name, c.name as investor_name, c.email as investor_email, p.name as venture_name FROM due_diligence_workspaces dw JOIN investment_pipeline ip ON dw.pipeline_id = ip.id LEFT JOIN investor_profiles ipr ON ip.investor_id = ipr.id LEFT JOIN contacts c ON ipr.user_id = c.cid LEFT JOIN v2_programs p ON ip.venture_id = p.id ORDER BY dw.updated_at DESC`,
    args: [],
  });
}

/** admin-overview — active pipelines with investor, venture and decision data. */
export async function listAdminOverviewPipelines() {
  return db.execute({
    sql: `SELECT ip.*, ipr.organization_name, c.name as investor_name, c.email, c.cid as investor_cid,
                           p.name as venture_name, d.decision_type, d.investment_amount, d.decision_date,
                           ipref.industries, ipref.countries, ipref.startup_stages,
                           ipref.ticket_size_min, ipref.ticket_size_max, ipref.investment_philosophy
                    FROM investment_pipeline ip
                    LEFT JOIN investor_profiles ipr ON ip.investor_id = ipr.id
                    LEFT JOIN contacts c ON ipr.user_id = c.cid
                    LEFT JOIN v2_programs p ON ip.venture_id = p.id
                    LEFT JOIN investment_decisions d ON d.pipeline_id = ip.id
                    LEFT JOIN investor_preferences ipref ON ipref.investor_id = ipr.id
                    WHERE ip.stage IN ('invested','negotiation','due_diligence','meeting_requested')
                    ORDER BY ip.stage_changed_at DESC`,
    args: [],
  });
}

/** admin-overview — headline investor/DD/pipeline counters. */
export async function getAdminOverviewStats() {
  return db.execute({
    sql: `SELECT (SELECT COUNT(*) FROM investor_profiles WHERE approval_status='approved')::int as approved_investors, (SELECT COUNT(*) FROM investor_profiles WHERE approval_status='pending_review')::int as pending_investors, (SELECT COUNT(*) FROM due_diligence_workspaces WHERE status='active')::int as active_dd, (SELECT COUNT(*) FROM investment_pipeline WHERE stage='invested')::int as total_invested`,
    args: [],
  });
}

/** admin-overview — recent DD information requests (50) with context joins. */
export async function listAdminOverviewRequests() {
  return db.execute({
    sql: `SELECT r.*, dw.pipeline_id, ip.venture_id, p.name as venture_name, ipr.organization_name, c.name as investor_name FROM dd_information_requests r JOIN due_diligence_workspaces dw ON r.workspace_id = dw.id JOIN investment_pipeline ip ON dw.pipeline_id = ip.id LEFT JOIN investor_profiles ipr ON ip.investor_id = ipr.id LEFT JOIN contacts c ON ipr.user_id = c.cid LEFT JOIN v2_programs p ON ip.venture_id = p.id ORDER BY r.created_at DESC LIMIT 50`,
    args: [],
  });
}

// ── GET/POST /api/investor/evaluation ───────────────────────────────────────

/** evaluation GET — founder evaluations of a pipeline, newest first. */
export async function listFounderEvaluationsByPipelineId(pipelineId) {
  return db.execute({
    sql: "SELECT * FROM founder_evaluations WHERE pipeline_id = ? ORDER BY created_at DESC",
    args: [pipelineId],
  });
}

/** evaluation GET — risk assessments of a pipeline, severity first. */
export async function listRiskAssessmentsByPipelineId(pipelineId) {
  return db.execute({
    sql: "SELECT * FROM risk_assessments WHERE pipeline_id = ? ORDER BY severity DESC, created_at DESC",
    args: [pipelineId],
  });
}

/** evaluation POST (founder) — create a founder evaluation. */
export async function createFounderEvaluation({ pipeline_id, founder_name, role, experience_score, leadership_score, domain_expertise_score, overall_rating, notes, created_by }) {
  return db.execute({
    sql: `INSERT INTO founder_evaluations (pipeline_id, founder_name, role, experience_score, leadership_score, domain_expertise_score, overall_rating, notes, created_by)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`,
    args: [pipeline_id, founder_name, role || null, experience_score || 0, leadership_score || 0, domain_expertise_score || 0, overall_rating || 0, notes || null, created_by],
  });
}

/** evaluation POST (risk) — create or update a risk assessment per category. */
export async function upsertRiskAssessment({ pipeline_id, risk_category, risk_description, severity, mitigation, status, created_by }) {
  return db.execute({
    sql: `INSERT INTO risk_assessments (pipeline_id, risk_category, risk_description, severity, mitigation, status, created_by)
              VALUES (?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT (pipeline_id, risk_category) DO UPDATE
              SET risk_description = EXCLUDED.risk_description, severity = EXCLUDED.severity,
                  mitigation = EXCLUDED.mitigation, status = EXCLUDED.status, updated_at = NOW()
              RETURNING *`,
    args: [pipeline_id, risk_category, risk_description, severity || "medium", mitigation || null, status || "open", created_by],
  });
}

// ── GET /api/investor/venture-kpis ──────────────────────────────────────────

/** venture-kpis — program fields backing the derived KPI cards. */
export async function getVentureProgramKpiFields(ventureId) {
  return db.execute({
    sql: "SELECT completion_index, status, start_date, end_date FROM v2_programs WHERE id = ?",
    args: [ventureId],
  });
}

/** venture-kpis — count of active (non-facilitator) participants in a program. */
export async function countVentureParticipants(ventureId) {
  return db.execute({
    sql: `SELECT COUNT(*) as count
            FROM participant_programs pp
            JOIN contacts c ON pp.participant_id = c.cid
            WHERE CAST(pp.program_id AS TEXT) = ?
              AND c.deleted = 0
              AND c.deleted_at IS NULL
              AND c.archived_at IS NULL
              AND LOWER(COALESCE(c.status, '')) = 'active'
              AND NOT EXISTS (
                SELECT 1 FROM v2_program_staff ps
                WHERE CAST(ps.program_id AS TEXT) = CAST(pp.program_id AS TEXT)
                  AND ps.role = 'facilitator'
                  AND (ps.staff_id = c.cid OR LOWER(TRIM(ps.staff_id)) = LOWER(TRIM(c.email)))
              )`,
    args: [ventureId],
  });
}

/** venture-kpis — count of invested pipelines for a venture. */
export async function countVentureInvestedPipeline(ventureId) {
  return db.execute({
    sql: "SELECT COUNT(*) as count FROM investment_pipeline WHERE venture_id = ? AND stage = 'invested'",
    args: [ventureId],
  });
}

// ── GET/POST /api/investor/kpis ─────────────────────────────────────────────

/** kpis GET — stored venture KPIs, ordered by key. */
export async function listVentureKpisByVentureId(ventureId) {
  return db.execute({
    sql: "SELECT * FROM venture_kpis WHERE venture_id = ? ORDER BY kpi_key",
    args: [ventureId],
  });
}

/** kpis POST — upsert a venture KPI by (venture_id, kpi_key). */
export async function upsertVentureKpi({ venture_id, kpi_key, kpi_label, kpi_value, trend }) {
  return db.execute({
    sql: `INSERT INTO venture_kpis (venture_id, kpi_key, kpi_label, kpi_value, trend)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT (venture_id, kpi_key)
            DO UPDATE SET kpi_label = EXCLUDED.kpi_label, kpi_value = EXCLUDED.kpi_value,
                          trend = EXCLUDED.trend, updated_at = NOW()`,
    args: [venture_id, kpi_key, kpi_label, kpi_value, trend || "stable"],
  });
}

