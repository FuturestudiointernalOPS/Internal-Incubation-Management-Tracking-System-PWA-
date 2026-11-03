import db from "@/lib/db";

/**
 * VENTURE REPORTING — statements (repository layer).
 *
 * Phase 1: static profile (versioned), founders, team snapshot, baseline,
 * stage settings, bands and glossary. Decisions live in
 * `@/services/ventures/reporting/*`; this file holds SQL only.
 *
 * Every statement is additive: no existing table is written here.
 */

export function runInTransaction(fn) {
  return db.transaction(fn);
}

const exec = (query, sql, args) => (query ? query(sql, args) : db.execute({ sql, args }));

/** Resolve either the internal UUID or the human `VNT-…` code to both. */
export async function selectVentureIdentity(idOrCode) {
  return db.execute({
    sql: "SELECT id, venture_id FROM ventures WHERE id::text = ? OR venture_id = ? LIMIT 1",
    args: [String(idOrCode), String(idOrCode)],
  });
}

// ── Settings ───────────────────────────────────────────────────────────────

export async function selectStageSettings() {
  return db.execute({
    sql: `SELECT DISTINCT ON (setting_key, business_model)
                 setting_key, business_model, setting_value, value_type, effective_from
          FROM venture_stage_settings
          WHERE effective_from <= CURRENT_DATE
          ORDER BY setting_key, business_model, effective_from DESC`,
    args: [],
  });
}

export async function insertStageSetting({ settingKey, businessModel, value, valueType, actorCid }) {
  return db.execute({
    sql: `INSERT INTO venture_stage_settings
            (setting_key, business_model, setting_value, value_type, effective_from, updated_by)
          VALUES (?, ?, ?, ?, CURRENT_DATE, ?)
          ON CONFLICT (setting_key, business_model, effective_from)
          DO UPDATE SET setting_value = EXCLUDED.setting_value,
                        value_type = EXCLUDED.value_type,
                        updated_by = EXCLUDED.updated_by`,
    args: [settingKey, businessModel || "default", value, valueType || "number", actorCid || null],
  });
}

export async function selectBands() {
  return db.execute({
    sql: `SELECT DISTINCT ON (band_kind, band_code)
                 band_kind, band_code, sort_order, low, high, midpoint
          FROM venture_band_settings
          WHERE effective_from <= CURRENT_DATE
          ORDER BY band_kind, band_code, sort_order, effective_from DESC`,
    args: [],
  });
}

// ── Static profile ─────────────────────────────────────────────────────────

export async function selectCurrentProfile(ventureUuid) {
  return db.execute({
    sql: "SELECT * FROM venture_static_profile WHERE venture_uuid = ? AND is_current LIMIT 1",
    args: [ventureUuid],
  });
}

export async function selectProfileHistory(ventureUuid) {
  return db.execute({
    sql: `SELECT version, effective_from, is_current, created_at, superseded_at, superseded_reason
          FROM venture_static_profile WHERE venture_uuid = ? ORDER BY version DESC`,
    args: [ventureUuid],
  });
}

export async function selectNextProfileVersion(query, ventureUuid) {
  return exec(
    query,
    "SELECT COALESCE(MAX(version), 0) + 1 AS next_version FROM venture_static_profile WHERE venture_uuid = ?",
    [ventureUuid],
  );
}

export async function supersedeCurrentProfile(query, { ventureUuid, actorCid, reason }) {
  return exec(
    query,
    `UPDATE venture_static_profile
        SET is_current = FALSE, superseded_at = NOW(), superseded_by = ?, superseded_reason = ?
      WHERE venture_uuid = ? AND is_current`,
    [actorCid || null, reason || null, ventureUuid],
  );
}

export async function insertProfileVersion(query, p) {
  return exec(
    query,
    `INSERT INTO venture_static_profile
       (venture_uuid, venture_code, version, effective_from, is_current,
        legal_name, trade_name, founding_date, registration_status, registration_country,
        pays_taxes, social_protection, sector, business_model, problem_statement,
        ideal_customer_profile, countries_of_operation, north_star_name, north_star_definition,
        north_star_unit, reporting_currency, accounting_basis, vat_included, created_by)
     VALUES (?, ?, ?, ?, TRUE, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     RETURNING *`,
    [
      p.ventureUuid, p.ventureCode, p.version, p.effectiveFrom,
      p.legalName, p.tradeName, p.foundingDate, p.registrationStatus, p.registrationCountry,
      p.paysTaxes, p.socialProtection, p.sector, p.businessModel, p.problemStatement,
      p.idealCustomerProfile, p.countriesOfOperation, p.northStarName, p.northStarDefinition,
      p.northStarUnit, p.reportingCurrency, p.accountingBasis, p.vatIncluded, p.actorCid,
    ],
  );
}

// ── Founders ───────────────────────────────────────────────────────────────

export async function selectCurrentFounders(ventureUuid) {
  return db.execute({
    sql: `SELECT id, contact_id, name, gender, date_of_birth, role, employment_type, effective_from
          FROM venture_founder WHERE venture_uuid = ? AND is_current
          ORDER BY created_at ASC`,
    args: [ventureUuid],
  });
}

export async function deactivateFounders(query, ventureUuid) {
  return exec(query, "UPDATE venture_founder SET is_current = FALSE WHERE venture_uuid = ? AND is_current", [ventureUuid]);
}

export async function insertFounder(query, f) {
  return exec(
    query,
    `INSERT INTO venture_founder
       (venture_uuid, venture_code, contact_id, name, gender, date_of_birth, role, employment_type, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      f.ventureUuid, f.ventureCode, f.contactId || null, f.name,
      f.gender || null, f.dateOfBirth || null, f.role || null, f.employmentType || null, f.actorCid || null,
    ],
  );
}

// ── Team ───────────────────────────────────────────────────────────────────

export async function selectTeamSnapshot(ventureUuid, period) {
  return db.execute({
    sql: "SELECT * FROM venture_team_snapshot WHERE venture_uuid = ? AND reporting_period = ? LIMIT 1",
    args: [ventureUuid, period],
  });
}

/** The most recent team snapshot — what the dashboard shows for shares. */
export async function selectLatestTeamSnapshot(ventureUuid) {
  return db.execute({
    sql: `SELECT * FROM venture_team_snapshot
           WHERE venture_uuid = ?
           ORDER BY reporting_period DESC
           LIMIT 1`,
    args: [ventureUuid],
  });
}

export async function upsertTeamSnapshot(t) {
  return db.execute({
    sql: `INSERT INTO venture_team_snapshot
            (venture_uuid, venture_code, reporting_period,
             women_employees, men_employees, under35_women, under35_men,
             full_time_employees, part_time_employees, part_time_days,
             full_time_founders, part_time_founders, created_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT (venture_uuid, reporting_period)
          DO UPDATE SET women_employees = EXCLUDED.women_employees,
                        men_employees = EXCLUDED.men_employees,
                        under35_women = EXCLUDED.under35_women,
                        under35_men = EXCLUDED.under35_men,
                        full_time_employees = EXCLUDED.full_time_employees,
                        part_time_employees = EXCLUDED.part_time_employees,
                        part_time_days = EXCLUDED.part_time_days,
                        full_time_founders = EXCLUDED.full_time_founders,
                        part_time_founders = EXCLUDED.part_time_founders
          RETURNING *`,
    args: [
      t.ventureUuid, t.ventureCode, t.period,
      t.womenEmployees, t.menEmployees, t.under35Women, t.under35Men,
      t.fullTimeEmployees, t.partTimeEmployees, t.partTimeDays,
      t.fullTimeFounders, t.partTimeFounders, t.actorCid || null,
    ],
  });
}

// ── Baseline ───────────────────────────────────────────────────────────────

export async function selectActiveBaseline(ventureUuid) {
  return db.execute({
    sql: "SELECT * FROM venture_baseline WHERE venture_uuid = ? AND superseded_at IS NULL LIMIT 1",
    args: [ventureUuid],
  });
}

export async function insertBaseline(b, query) {
  return exec(
    query,
    `INSERT INTO venture_baseline
            (venture_uuid, venture_code, fte, paying_customers,
             cash_mode, cash_value, cash_band,
             outside_financing_mode, outside_financing_value, outside_financing_band, currency, created_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          RETURNING *`,
    [
      b.ventureUuid, b.ventureCode, b.fte, b.payingCustomers,
      b.cashMode, b.cashValue, b.cashBand,
      b.outsideFinancingMode, b.outsideFinancingValue, b.outsideFinancingBand, b.currency || null, b.actorCid || null,
    ],
  );
}

export async function supersedeBaseline(query, { ventureUuid, actorCid, reason }) {
  return exec(
    query,
    `UPDATE venture_baseline
        SET superseded_at = NOW(), superseded_by = ?, superseded_reason = ?
      WHERE venture_uuid = ? AND superseded_at IS NULL`,
    [actorCid || null, reason, ventureUuid],
  );
}

// ── Glossary ───────────────────────────────────────────────────────────────

export async function selectGlossary() {
  return db.execute({ sql: "SELECT term, definition_en, definition_fr FROM venture_glossary ORDER BY term", args: [] });
}

/** Write one glossary term. The studio owns the wording; the engine reads it. */
export async function upsertGlossaryTerm({ term, definition_en, definition_fr, actorCid }) {
  return db.execute({
    sql: `INSERT INTO venture_glossary (term, definition_en, definition_fr, updated_by)
          VALUES (?, ?, ?, ?)
          ON CONFLICT (term) DO UPDATE SET
            definition_en = EXCLUDED.definition_en,
            definition_fr = EXCLUDED.definition_fr,
            updated_by = EXCLUDED.updated_by,
            updated_at = NOW()`,
    args: [term, definition_en, definition_fr, actorCid || null],
  });
}

/**
 * Drop an override so a business model inherits `default` again.
 *
 * This is the ONE configuration operation that removes rows instead of adding
 * them: an override that no longer applies cannot be expressed as a value, and
 * leaving a phantom row equal to the default would freeze the model against
 * every future change of the default.
 */
export async function deleteStageSetting({ settingKey, businessModel }) {
  return db.execute({
    sql: "DELETE FROM venture_stage_settings WHERE setting_key = ? AND business_model = ?",
    args: [settingKey, businessModel],
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 2 — monthly reports
// ═══════════════════════════════════════════════════════════════════════════

/** Every version of every month, newest first — the review screen's history. */
export async function selectMonthlyReports(ventureUuid) {
  return db.execute({
    sql: `SELECT * FROM venture_monthly_report
          WHERE venture_uuid = ?
          ORDER BY reporting_period DESC, version DESC`,
    args: [ventureUuid],
  });
}

/** Every version of ONE month, newest first. */
export async function selectMonthlyReportVersions(ventureUuid, period) {
  return db.execute({
    sql: `SELECT * FROM venture_monthly_report
          WHERE venture_uuid = ? AND reporting_period = ?
          ORDER BY version DESC`,
    args: [ventureUuid, period],
  });
}

/**
 * The one row the founder may still edit or the studio may still decide on.
 * A rejected row is CLOSED: correction creates a new version instead, so the
 * refusal is never overwritten.
 */
export async function selectOpenReport(ventureUuid, period) {
  return db.execute({
    sql: `SELECT * FROM venture_monthly_report
          WHERE venture_uuid = ? AND reporting_period = ?
            AND status IN ('draft','submitted') AND superseded_at IS NULL
          ORDER BY version DESC LIMIT 1`,
    args: [ventureUuid, period],
  });
}

/** The validated row that currently feeds the KPIs for this month. */
export async function selectLiveValidatedReport(ventureUuid, period) {
  return db.execute({
    sql: `SELECT * FROM venture_monthly_report
          WHERE venture_uuid = ? AND reporting_period = ?
            AND status = 'validated' AND superseded_at IS NULL
          LIMIT 1`,
    args: [ventureUuid, period],
  });
}

/** Every live validated month — the metric engine's whole input. */
export async function selectValidatedReports(ventureUuid) {
  return db.execute({
    sql: `SELECT * FROM venture_monthly_report
          WHERE venture_uuid = ? AND status = 'validated' AND superseded_at IS NULL
          ORDER BY reporting_period ASC`,
    args: [ventureUuid],
  });
}

export async function selectNextReportVersion(query, ventureUuid, period) {
  return exec(
    query,
    `SELECT COALESCE(MAX(version), 0) + 1 AS next_version
       FROM venture_monthly_report WHERE venture_uuid = ? AND reporting_period = ?`,
    [ventureUuid, period],
  );
}

export async function insertMonthlyReport(query, r) {
  return exec(
    query,
    `INSERT INTO venture_monthly_report
       (venture_uuid, venture_code, reporting_period, version, status,
        mrr_mode, mrr_value, mrr_band,
        other_revenue_mode, other_revenue_value, other_revenue_band,
        expenses_mode, expenses_value, expenses_band,
        cash_mode, cash_value, cash_band,
        financing_received, active_users, paying_customers, new_paying_customers,
        full_time, part_time, part_time_days, full_time_founders,
        north_star_value, narrative, channels, currency, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     RETURNING *`,
    [
      r.ventureUuid, r.ventureCode, r.period, r.version, r.status,
      r.mrr_mode, r.mrr_value, r.mrr_band,
      r.other_revenue_mode, r.other_revenue_value, r.other_revenue_band,
      r.expenses_mode, r.expenses_value, r.expenses_band,
      r.cash_mode, r.cash_value, r.cash_band,
      r.financing_received, r.active_users, r.paying_customers, r.new_paying_customers,
      r.full_time, r.part_time, r.part_time_days, r.full_time_founders,
      r.north_star_value, r.narrative, r.channels, r.currency, r.created_by,
    ],
  );
}

/** Edit a draft in place. Only ever called on a row that is still open. */
export async function updateOpenReport(query, id, r) {
  return exec(
    query,
    `UPDATE venture_monthly_report SET
        mrr_mode = ?, mrr_value = ?, mrr_band = ?,
        other_revenue_mode = ?, other_revenue_value = ?, other_revenue_band = ?,
        expenses_mode = ?, expenses_value = ?, expenses_band = ?,
        cash_mode = ?, cash_value = ?, cash_band = ?,
        financing_received = ?, active_users = ?, paying_customers = ?,
        new_paying_customers = ?, full_time = ?, part_time = ?,
        part_time_days = ?, full_time_founders = ?, north_star_value = ?,
        narrative = ?, channels = ?, currency = ?, updated_at = NOW()
      WHERE id = ? AND status IN ('draft','submitted')
      RETURNING *`,
    [
      r.mrr_mode, r.mrr_value, r.mrr_band,
      r.other_revenue_mode, r.other_revenue_value, r.other_revenue_band,
      r.expenses_mode, r.expenses_value, r.expenses_band,
      r.cash_mode, r.cash_value, r.cash_band,
      r.financing_received, r.active_users, r.paying_customers,
      r.new_paying_customers, r.full_time, r.part_time,
      r.part_time_days, r.full_time_founders, r.north_star_value,
      r.narrative, r.channels, r.currency, id,
    ],
  );
}

export async function markReportSubmitted(query, id, actorCid) {
  return exec(
    query,
    `UPDATE venture_monthly_report
        SET status = 'submitted', submitted_at = NOW(), submitted_by = ?, updated_at = NOW()
      WHERE id = ? AND status IN ('draft','submitted')
      RETURNING *`,
    [actorCid || null, id],
  );
}

/**
 * Retire the previous validated row for the same month. Called in the SAME
 * transaction that validates its replacement, so the partial unique index
 * `idx_vmr_one_validated` is never violated and the dashboard never reads two
 * truths for one month.
 */
export async function supersedeValidatedReports(query, { ventureUuid, period, actorCid, reason }) {
  return exec(
    query,
    `UPDATE venture_monthly_report
        SET superseded_at = NOW(), superseded_by = ?, superseded_reason = ?
      WHERE venture_uuid = ? AND reporting_period = ?
        AND status = 'validated' AND superseded_at IS NULL`,
    [actorCid || null, reason || null, ventureUuid, period],
  );
}

export async function markReportValidated(query, id, actorCid) {
  return exec(
    query,
    `UPDATE venture_monthly_report
        SET status = 'validated', validated_at = NOW(), validated_by = ?, updated_at = NOW()
      WHERE id = ? AND status = 'submitted'
      RETURNING *`,
    [actorCid || null, id],
  );
}

export async function markReportRejected(query, id, { actorCid, reason }) {
  return exec(
    query,
    `UPDATE venture_monthly_report
        SET status = 'rejected', rejected_at = NOW(), rejected_by = ?,
            rejection_reason = ?, updated_at = NOW()
      WHERE id = ? AND status = 'submitted'
      RETURNING *`,
    [actorCid || null, reason, id],
  );
}

// ── Calculated metrics ─────────────────────────────────────────────────────

export async function selectMetrics(ventureUuid, period) {
  return db.execute({
    sql: `SELECT metric_key, value, value_low, value_high, is_approximate, status, computed_at
            FROM venture_metrics_monthly
           WHERE venture_uuid = ? AND reporting_period = ?`,
    args: [ventureUuid, period],
  });
}

export async function selectMetricsSeries(ventureUuid) {
  return db.execute({
    sql: `SELECT reporting_period, metric_key, value, value_low, value_high, is_approximate, status
            FROM venture_metrics_monthly
           WHERE venture_uuid = ?
           ORDER BY reporting_period ASC`,
    args: [ventureUuid],
  });
}

/**
 * Write one month's metric set. Every key is written on every recompute — a
 * value that has become not applicable must overwrite its previous number,
 * otherwise a corrected month would keep showing a stale figure.
 */
export async function upsertMetrics(query, { ventureUuid, ventureCode, period, reportId, metrics }) {
  const written = [];
  for (const [metricKey, metric] of Object.entries(metrics || {})) {
    const result = await exec(
      query,
      `INSERT INTO venture_metrics_monthly
         (venture_uuid, venture_code, reporting_period, metric_key,
          value, value_low, value_high, is_approximate, status, source_report_id, computed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
       ON CONFLICT (venture_uuid, reporting_period, metric_key)
       DO UPDATE SET value = EXCLUDED.value,
                     value_low = EXCLUDED.value_low,
                     value_high = EXCLUDED.value_high,
                     is_approximate = EXCLUDED.is_approximate,
                     status = EXCLUDED.status,
                     source_report_id = EXCLUDED.source_report_id,
                     computed_at = NOW()`,
      [
        ventureUuid, ventureCode, period, metricKey,
        metric.value, metric.valueLow, metric.valueHigh,
        Boolean(metric.approximate), metric.status, reportId,
      ],
    );
    written.push(result);
  }
  return written;
}

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 3 — event log
// ═══════════════════════════════════════════════════════════════════════════

/** Every live event of a Venture, newest first. Soft-deleted rows never appear. */
export async function selectEvents(ventureUuid) {
  return db.execute({
    sql: `SELECT id, event_type, event_date, title, description, customer_name,
                 amount_mode, amount_value, amount_band, financing_type, source,
                 market_description, status_from, status_to,
                 evidence, evidence_name, created_by, created_at
            FROM venture_event_log
           WHERE venture_uuid = ? AND deleted_at IS NULL
           ORDER BY event_date DESC, created_at DESC`,
    args: [ventureUuid],
  });
}

export async function insertEvent(query, e) {
  return exec(
    query,
    `INSERT INTO venture_event_log
       (venture_uuid, venture_code, event_type, event_date, title, description,
        customer_name, amount_mode, amount_value, amount_band, financing_type, source,
        market_description, status_from, status_to, evidence, evidence_name, currency, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     RETURNING *`,
    [
      e.ventureUuid, e.ventureCode, e.eventType, e.eventDate, e.title, e.description,
      e.customerName, e.amountMode, e.amountValue, e.amountBand, e.financingType, e.source,
      e.marketDescription, e.statusFrom, e.statusTo, e.evidence, e.evidenceName, e.currency, e.actorCid,
    ],
  );
}

/** A soft delete: an event that was entered by mistake leaves a trace. */
export async function softDeleteEvent(query, { ventureUuid, id, actorCid }) {
  return exec(
    query,
    `UPDATE venture_event_log SET deleted_at = NOW(), created_by = COALESCE(created_by, ?)
      WHERE id = ? AND venture_uuid = ? AND deleted_at IS NULL`,
    [actorCid || null, id, ventureUuid],
  );
}

// ── Customer-discovery interviews (existing table, now with evidence) ──────

export async function selectInterviews(ventureUuid) {
  return db.execute({
    sql: `SELECT id, customer_segment, interviewee_name, interview_date, notes, insights,
                 evidence, evidence_name, created_at
            FROM venture_customer_interviews
           WHERE venture_id = ?
           ORDER BY interview_date DESC NULLS LAST, created_at DESC`,
    args: [ventureUuid],
  });
}

export async function insertInterview(query, i) {
  return exec(
    query,
    `INSERT INTO venture_customer_interviews
       (venture_id, customer_segment, interviewee_name, interview_date, notes, insights,
        evidence, evidence_name, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     RETURNING *`,
    [
      i.ventureUuid, i.customerSegment, i.intervieweeName, i.interviewDate,
      i.notes, i.insights, i.evidence, i.evidenceName, i.actorCid,
    ],
  );
}

/** Interviews that carry evidence — the number the stage rule will read. */
export async function countEvidenceBackedInterviews(ventureUuid) {
  return db.execute({
    sql: `SELECT COUNT(*)::int AS total
            FROM venture_customer_interviews
           WHERE venture_id = ? AND evidence IS NOT NULL AND evidence <> ''`,
    args: [ventureUuid],
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 5 — stage engine
// ═══════════════════════════════════════════════════════════════════════════
// `ventures.business_stage` is the CURRENT value and is written only here —
// when a proposal is approved. The history table is the record behind it.

export async function selectVentureStage(ventureUuid) {
  return db.execute({
    sql: "SELECT business_stage FROM ventures WHERE id = ? LIMIT 1",
    args: [ventureUuid],
  });
}

/** The Venture's start date — the clock survival is measured from. */
export async function selectVentureCreatedAt(ventureUuid) {
  return db.execute({
    sql: "SELECT created_at FROM ventures WHERE id = ? LIMIT 1",
    args: [ventureUuid],
  });
}

/** Every venture the scheduled stage sweep should evaluate. */
export async function selectVenturesForStageSweep() {
  return db.execute({
    sql: "SELECT id, venture_id FROM ventures ORDER BY created_at ASC",
    args: [],
  });
}

/**
 * Milestones that were DUE by today, and how many were completed on time.
 *
 * "On time" needs a completion timestamp, which `venture_milestones` does not
 * carry — but `venture_milestone_activity` records every completion with
 * `created_at`, so the first 'completed' activity is the real completion date.
 * Milestones still in the future are excluded: not yet done is not late.
 */
export async function selectMilestoneOnTimeStats(ventureUuid) {
  return db.execute({
    sql: `SELECT
            COUNT(*)::int AS due_total,
            COUNT(*) FILTER (
              WHERE a.completed_on IS NOT NULL
                AND a.completed_on <= COALESCE(m.due_date, m.target_date)
            )::int AS on_time
          FROM venture_milestones m
          LEFT JOIN LATERAL (
            SELECT MIN(act.created_at)::date AS completed_on
              FROM venture_milestone_activity act
             WHERE act.milestone_id = m.id AND act.action = 'completed'
          ) a ON TRUE
          WHERE m.venture_id = ?
            AND m.is_archived = FALSE
            AND COALESCE(m.due_date, m.target_date) IS NOT NULL
            AND COALESCE(m.due_date, m.target_date) <= CURRENT_DATE`,
    args: [ventureUuid],
  });
}

export async function updateVentureStage(query, { ventureUuid, toStage }) {
  return exec(query, "UPDATE ventures SET business_stage = ? WHERE id = ?", [toStage, ventureUuid]);
}

export async function selectPendingStageProposal(ventureUuid) {
  return db.execute({
    sql: `SELECT * FROM venture_stage_proposal
           WHERE venture_uuid = ? AND status = 'pending' LIMIT 1`,
    args: [ventureUuid],
  });
}

export async function selectStageProposals(ventureUuid) {
  return db.execute({
    sql: `SELECT * FROM venture_stage_proposal
           WHERE venture_uuid = ? ORDER BY created_at DESC LIMIT 50`,
    args: [ventureUuid],
  });
}

export async function selectStageHistory(ventureUuid) {
  return db.execute({
    sql: `SELECT * FROM venture_stage_history
           WHERE venture_uuid = ? ORDER BY decided_at ASC`,
    args: [ventureUuid],
  });
}

export async function supersedePendingProposals(query, ventureUuid) {
  return exec(
    query,
    `UPDATE venture_stage_proposal
        SET status = 'superseded', decided_at = NOW()
      WHERE venture_uuid = ? AND status = 'pending'`,
    [ventureUuid],
  );
}

export async function insertStageProposal(query, proposal) {
  return exec(
    query,
    `INSERT INTO venture_stage_proposal
       (venture_uuid, venture_code, from_stage, to_stage, status, progress, snapshot, created_by)
     VALUES (?, ?, ?, ?, 'pending', ?, ?, ?)
     RETURNING *`,
    [
      proposal.ventureUuid,
      proposal.ventureCode,
      proposal.fromStage,
      proposal.toStage,
      proposal.progress,
      JSON.stringify(proposal.snapshot || {}),
      proposal.actorCid || null,
    ],
  );
}

export async function markStageProposal(query, { id, status, actorCid, reason }) {
  return exec(
    query,
    `UPDATE venture_stage_proposal
        SET status = ?, decided_at = NOW(), decided_by = ?, rejection_reason = ?
      WHERE id = ? AND status = 'pending'
      RETURNING *`,
    [status, actorCid || null, reason || null, id],
  );
}

export async function insertStageHistory(query, entry) {
  return exec(
    query,
    `INSERT INTO venture_stage_history
       (venture_uuid, venture_code, from_stage, to_stage, progress, snapshot, decided_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     RETURNING *`,
    [
      entry.ventureUuid,
      entry.ventureCode,
      entry.fromStage,
      entry.toStage,
      entry.progress,
      JSON.stringify(entry.snapshot || {}),
      entry.actorCid || null,
    ],
  );
}

/**
 * Does this stored path actually belong to this Venture?
 *
 * The evidence viewer signs whatever it is given, so it must never sign a path
 * that was not recorded against the Venture being asked about — otherwise a
 * founder could read another Venture's private file by guessing a path.
 */
export async function countEvidenceReferences(ventureUuid, path) {
  return db.execute({
    sql: `SELECT (
            (SELECT COUNT(*)::int FROM venture_event_log
              WHERE venture_uuid = ? AND evidence = ? AND deleted_at IS NULL)
          + (SELECT COUNT(*)::int FROM venture_customer_interviews
              WHERE venture_id = ? AND evidence = ?)
          ) AS total`,
    args: [ventureUuid, path, ventureUuid, path],
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 3b — quarterly reports
// ═══════════════════════════════════════════════════════════════════════════
// The lifecycle is deliberately identical to the monthly one: same statuses,
// same versioning, same "one validated, one open" invariant. Only the table and
// the questions differ, so a reader who knows one already knows the other.

export async function selectQuarterlyReports(ventureUuid) {
  return db.execute({
    sql: `SELECT * FROM venture_quarterly_report
          WHERE venture_uuid = ? ORDER BY reporting_period DESC, version DESC`,
    args: [ventureUuid],
  });
}

export async function selectQuarterlyVersions(ventureUuid, period) {
  return db.execute({
    sql: `SELECT * FROM venture_quarterly_report
          WHERE venture_uuid = ? AND reporting_period = ? ORDER BY version DESC`,
    args: [ventureUuid, period],
  });
}

export async function selectOpenQuarterly(ventureUuid, period) {
  return db.execute({
    sql: `SELECT * FROM venture_quarterly_report
          WHERE venture_uuid = ? AND reporting_period = ?
            AND status IN ('draft','submitted') AND superseded_at IS NULL
          ORDER BY version DESC LIMIT 1`,
    args: [ventureUuid, period],
  });
}

export async function selectValidatedQuarters(ventureUuid) {
  return db.execute({
    sql: `SELECT * FROM venture_quarterly_report
          WHERE venture_uuid = ? AND status = 'validated' AND superseded_at IS NULL
          ORDER BY reporting_period ASC`,
    args: [ventureUuid],
  });
}

export async function selectNextQuarterVersion(query, ventureUuid, period) {
  return exec(
    query,
    `SELECT COALESCE(MAX(version), 0) + 1 AS next_version
       FROM venture_quarterly_report WHERE venture_uuid = ? AND reporting_period = ?`,
    [ventureUuid, period],
  );
}

export async function insertQuarterlyReport(query, r) {
  return exec(
    query,
    `INSERT INTO venture_quarterly_report
       (venture_uuid, venture_code, reporting_period, version, status,
        team_confirmed, mvp_milestones_planned, mvp_milestones_hit,
        pilots_signed, pilots_converted, channels,
        sales_marketing_mode, sales_marketing_value, sales_marketing_band,
        open_deals, sales_cycle_days, top3_share_band,
        expansion_mode, expansion_value, expansion_band,
        churned_mode, churned_value, churned_band,
        narrative, currency, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     RETURNING *`,
    [
      r.ventureUuid, r.ventureCode, r.period, r.version, r.status,
      r.team_confirmed, r.mvp_milestones_planned, r.mvp_milestones_hit,
      r.pilots_signed, r.pilots_converted, r.channels,
      r.sales_marketing_mode, r.sales_marketing_value, r.sales_marketing_band,
      r.open_deals, r.sales_cycle_days, r.top3_share_band,
      r.expansion_mode, r.expansion_value, r.expansion_band,
      r.churned_mode, r.churned_value, r.churned_band,
      r.narrative, r.currency, r.created_by,
    ],
  );
}

export async function updateOpenQuarterly(query, id, r) {
  return exec(
    query,
    `UPDATE venture_quarterly_report SET
        team_confirmed = ?, mvp_milestones_planned = ?, mvp_milestones_hit = ?,
        pilots_signed = ?, pilots_converted = ?, channels = ?,
        sales_marketing_mode = ?, sales_marketing_value = ?, sales_marketing_band = ?,
        open_deals = ?, sales_cycle_days = ?, top3_share_band = ?,
        expansion_mode = ?, expansion_value = ?, expansion_band = ?,
        churned_mode = ?, churned_value = ?, churned_band = ?,
        narrative = ?, currency = ?, updated_at = NOW()
      WHERE id = ? AND status IN ('draft','submitted')
      RETURNING *`,
    [
      r.team_confirmed, r.mvp_milestones_planned, r.mvp_milestones_hit,
      r.pilots_signed, r.pilots_converted, r.channels,
      r.sales_marketing_mode, r.sales_marketing_value, r.sales_marketing_band,
      r.open_deals, r.sales_cycle_days, r.top3_share_band,
      r.expansion_mode, r.expansion_value, r.expansion_band,
      r.churned_mode, r.churned_value, r.churned_band,
      r.narrative, r.currency, id,
    ],
  );
}

export async function markQuarterSubmitted(query, id, actorCid) {
  return exec(
    query,
    `UPDATE venture_quarterly_report
        SET status = 'submitted', submitted_at = NOW(), submitted_by = ?, updated_at = NOW()
      WHERE id = ? AND status IN ('draft','submitted')
      RETURNING *`,
    [actorCid || null, id],
  );
}

export async function supersedeValidatedQuarters(query, { ventureUuid, period, actorCid, reason }) {
  return exec(
    query,
    `UPDATE venture_quarterly_report
        SET superseded_at = NOW(), superseded_by = ?, superseded_reason = ?
      WHERE venture_uuid = ? AND reporting_period = ?
        AND status = 'validated' AND superseded_at IS NULL`,
    [actorCid || null, reason || null, ventureUuid, period],
  );
}

export async function markQuarterValidated(query, id, actorCid) {
  return exec(
    query,
    `UPDATE venture_quarterly_report
        SET status = 'validated', validated_at = NOW(), validated_by = ?, updated_at = NOW()
      WHERE id = ? AND status = 'submitted'
      RETURNING *`,
    [actorCid || null, id],
  );
}

export async function markQuarterRejected(query, id, { actorCid, reason }) {
  return exec(
    query,
    `UPDATE venture_quarterly_report
        SET status = 'rejected', rejected_at = NOW(), rejected_by = ?,
            rejection_reason = ?, updated_at = NOW()
      WHERE id = ? AND status = 'submitted'
      RETURNING *`,
    [actorCid || null, reason, id],
  );
}

export async function selectQuarterMetrics(ventureUuid, period) {
  return db.execute({
    sql: `SELECT metric_key, value, value_low, value_high, is_approximate, status, computed_at
            FROM venture_metrics_quarterly
           WHERE venture_uuid = ? AND reporting_period = ?`,
    args: [ventureUuid, period],
  });
}

export async function upsertQuarterMetrics(query, { ventureUuid, ventureCode, period, reportId, metrics }) {
  const written = [];
  for (const [metricKey, metric] of Object.entries(metrics || {})) {
    written.push(
      await exec(
        query,
        `INSERT INTO venture_metrics_quarterly
           (venture_uuid, venture_code, reporting_period, metric_key,
            value, value_low, value_high, is_approximate, status, source_report_id, computed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
         ON CONFLICT (venture_uuid, reporting_period, metric_key)
         DO UPDATE SET value = EXCLUDED.value,
                       value_low = EXCLUDED.value_low,
                       value_high = EXCLUDED.value_high,
                       is_approximate = EXCLUDED.is_approximate,
                       status = EXCLUDED.status,
                       source_report_id = EXCLUDED.source_report_id,
                       computed_at = NOW()`,
        [
          ventureUuid, ventureCode, period, metricKey,
          metric.value, metric.valueLow, metric.valueHigh,
          Boolean(metric.approximate), metric.status, reportId,
        ],
      ),
    );
  }
  return written;
}

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 6b — portfolio roll-ups (spec §14) and reporting discipline (§13.9)
// ═══════════════════════════════════════════════════════════════════════════
// These are SET-BASED on purpose: one query for the whole portfolio, never one
// per Venture. A roll-up that costs a query per Venture does not survive a
// portfolio of a hundred, and it is the first thing that makes a dashboard
// look slow for no visible reason.

/** Every Venture, with the projections the roll-up groups on. */
export async function selectPortfolioVentures() {
  return db.execute({
    sql: `SELECT id, venture_id, company_name, name, business_stage, status, created_at
            FROM ventures
           ORDER BY created_at ASC`,
    args: [],
  });
}

/**
 * The first VALIDATED month in which a Venture had a paying customer.
 *
 * "Time to first paying customer" is measured from the Venture's start to this
 * period — drafts and rejected months are not evidence of anything.
 */
export async function selectPortfolioFirstPayingMonth() {
  return db.execute({
    sql: `SELECT venture_uuid, MIN(reporting_period) AS first_period
            FROM venture_monthly_report
           WHERE status = 'validated'
             AND superseded_at IS NULL
             AND paying_customers > 0
           GROUP BY venture_uuid`,
    args: [],
  });
}

/** The latest VALIDATED month of each Venture — the figures the dashboard shows. */
export async function selectPortfolioLatestMonths() {
  return db.execute({
    sql: `SELECT DISTINCT ON (venture_uuid)
                 venture_uuid, reporting_period, paying_customers
            FROM venture_monthly_report
           WHERE status = 'validated' AND superseded_at IS NULL
           ORDER BY venture_uuid, reporting_period DESC`,
    args: [],
  });
}

/**
 * The latest VALIDATED value of each metric a portfolio figure needs.
 *
 * They are read from the metrics table rather than recomputed: the roll-up
 * shows the same number the Venture's own dashboard shows, or nothing.
 */
export async function selectPortfolioLatestMetrics() {
  return db.execute({
    sql: `SELECT DISTINCT ON (m.venture_uuid, m.metric_key)
                 m.venture_uuid, m.metric_key, m.value, m.status
            FROM venture_metrics_monthly m
            JOIN venture_monthly_report r
              ON r.venture_uuid = m.venture_uuid
             AND r.reporting_period = m.reporting_period
             AND r.status = 'validated'
             AND r.superseded_at IS NULL
           WHERE m.metric_key IN ('fte', 'runway_months', 'customer_growth_3m')
             AND m.status = 'computed'
           ORDER BY m.venture_uuid, m.metric_key, m.reporting_period DESC`,
    args: [],
  });
}

/** The most recent team snapshot of each Venture — women and youth shares. */
export async function selectPortfolioLatestTeams() {
  return db.execute({
    sql: `SELECT DISTINCT ON (venture_uuid) *
            FROM venture_team_snapshot
           ORDER BY venture_uuid, reporting_period DESC`,
    args: [],
  });
}

/** The locked baseline of each Venture — the other half of "jobs created". */
export async function selectPortfolioBaselines() {
  return db.execute({
    sql: `SELECT venture_uuid, fte
            FROM venture_baseline
           WHERE superseded_at IS NULL`,
    args: [],
  });
}

/**
 * Financing events across the portfolio.
 *
 * The MODE travels with the amount so a band stays approximate all the way to
 * the total: the roll-up never turns an estimate into a precise figure.
 */
export async function selectPortfolioFinancingEvents() {
  return db.execute({
    sql: `SELECT venture_uuid, financing_type, amount_mode, amount_value, amount_band
            FROM venture_event_log
           WHERE event_type = 'financing_received' AND deleted_at IS NULL`,
    args: [],
  });
}

/** Every approved stage change, oldest first — the source of "time in stage". */
export async function selectPortfolioStageHistory() {
  return db.execute({
    sql: `SELECT venture_uuid, from_stage, to_stage, decided_at
            FROM venture_stage_history
           ORDER BY venture_uuid, decided_at ASC`,
    args: [],
  });
}

/** Every status change — what survival is measured from. */
export async function selectPortfolioStatusEvents() {
  return db.execute({
    sql: `SELECT venture_uuid, status_to, event_date
            FROM venture_event_log
           WHERE event_type = 'status_change'
             AND status_to IS NOT NULL
             AND deleted_at IS NULL
           ORDER BY venture_uuid, event_date ASC`,
    args: [],
  });
}

/**
 * Every monthly row since a period, ALL statuses, every version.
 *
 * Discipline needs the attempts, not just the successes: a rejected month is a
 * submission that was received, and a draft that was never submitted is not.
 */
export async function selectPortfolioMonthlyRows(sincePeriod) {
  return db.execute({
    sql: `SELECT venture_uuid, reporting_period, version, status,
                 submitted_at, validated_at, rejected_at, superseded_at
            FROM venture_monthly_report
           WHERE reporting_period >= ?
           ORDER BY venture_uuid, reporting_period, version DESC`,
    args: [sincePeriod],
  });
}

/** The quarterly equivalent of `selectPortfolioMonthlyRows`. */
export async function selectPortfolioQuarterlyRows(sincePeriod) {
  return db.execute({
    sql: `SELECT venture_uuid, reporting_period, version, status,
                 submitted_at, validated_at, rejected_at, superseded_at
            FROM venture_quarterly_report
           WHERE reporting_period >= ?
           ORDER BY venture_uuid, reporting_period, version DESC`,
    args: [sincePeriod],
  });
}

/**
 * Milestones that were DUE by today, per Venture, with how many were on time.
 *
 * The same definition as `selectMilestoneOnTimeStats`, grouped instead of
 * filtered: a milestone still in the future is not late.
 */
export async function selectPortfolioMilestoneStats() {
  return db.execute({
    sql: `SELECT m.venture_id AS venture_uuid,
                 COUNT(*)::int AS due_total,
                 COUNT(*) FILTER (
                   WHERE a.completed_on IS NOT NULL
                     AND a.completed_on <= COALESCE(m.due_date, m.target_date)
                 )::int AS on_time
            FROM venture_milestones m
            LEFT JOIN LATERAL (
              SELECT MIN(act.created_at)::date AS completed_on
                FROM venture_milestone_activity act
               WHERE act.milestone_id = m.id AND act.action = 'completed'
            ) a ON TRUE
           WHERE m.is_archived = FALSE
             AND COALESCE(m.due_date, m.target_date) IS NOT NULL
             AND COALESCE(m.due_date, m.target_date) <= CURRENT_DATE
           GROUP BY m.venture_id`,
    args: [],
  });
}

/** Update reporting currency on the current active profile row or insert fallback */
export async function updateCurrentProfileCurrency({ ventureUuid, ventureCode, currency }) {
  const current = await db.execute({
    sql: "SELECT id FROM venture_static_profile WHERE venture_uuid = ? AND is_current LIMIT 1",
    args: [ventureUuid],
  });
  if (current.rows?.length) {
    return db.execute({
      sql: "UPDATE venture_static_profile SET reporting_currency = ? WHERE id = ?",
      args: [currency, current.rows[0].id],
    });
  } else {
    return db.execute({
      sql: `INSERT INTO venture_static_profile
             (venture_uuid, venture_code, version, effective_from, is_current, reporting_currency)
           VALUES (?, ?, 1, CURRENT_DATE, TRUE, ?)`,
      args: [ventureUuid, ventureCode || "VNT", currency],
    });
  }
}
