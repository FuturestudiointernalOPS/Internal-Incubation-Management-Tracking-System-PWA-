import db from "@/lib/db";

/**
 * Platform configuration + public onboarding model — data access for the
 * platform-config / migration / forensic / public controllers (Wave 5 route
 * extraction).
 *
 * Controllers → function groups:
 *  - `src/app/api/v2/kpis/route.js`                    → V2 KPI CRUD + weight redistribution
 *  - `src/app/api/kpis/route.js`                       → (V1) strategic KPI CRUD on v2_kpis
 *  - `src/app/api/kpi-progress/route.js`               → persisted KPI progress reads
 *  - `src/app/api/superadmin/standard-types/route.js`  → standard types catalog
 *  - `src/app/api/system/database/route.js`            → outstanding platform migration DDL steps
 *  - `src/app/api/forensic/user-role/route.js`         → contact role-resolution lookup
 *  - `src/app/api/migrate/phase0/route.js`             → Phase 0 schema migration steps
 *  - `src/app/api/migrate/phase1/route.js`             → Phase 1 file-driven statements
 *  - `src/app/api/migrate/phase5/route.js`             → Phase 5 file-driven statements
 *  - `src/app/api/venture-templates/route.js`          → venture playbook template reads
 *  - `src/app/api/venture-options/route.js`            → venture taxonomy option reads/writes
 *  - `src/app/api/venture-kpi-definitions/route.js`    → venture KPI catalog reads/writes
 *  - `src/app/api/public/register/route.js`            → public participant registration
 *  - `src/app/api/public/group-info/route.js`          → public group lookup + registration window
 *  - `src/app/api/public/courses/[slug]/route.js`      → free self-enrollment insert
 *
 * Each function wraps exactly one SQL statement. SQL is byte-identical to the
 * queries that used to live inline in the controllers, so behavior is unchanged.
 *
 * Model-layer rules (see docs/MVC_REFACTOR.md):
 *  - No HTTP / Next.js imports here — only the db engine.
 *  - One function per query, named after the data it returns.
 *  - Extraction is strictly 1:1 with the original inline call sites, so queries
 *    run from more than one handler (e.g. the v2_kpis list in GET/POST/PUT)
 *    intentionally repeat the same SQL across functions.
 */

// ── GET/POST/PUT/DELETE /api/v2/kpis (V2 KPI CRUD + weights) ─────────────────

/** Full KPI list for a program (GET /api/v2/kpis). */
export async function getV2KpisByProgramId(programId) {
  return db.execute({
    sql: "SELECT * FROM v2_kpis WHERE program_id = ?",
    args: [programId],
  });
}

/** Insert a KPI with auto_weight enabled (POST /api/v2/kpis). */
export async function insertV2KpiWithAutoWeight(programId, title, targetValue) {
  return db.execute({
    sql: "INSERT INTO v2_kpis (program_id, title, target_value, auto_weight) VALUES (?, ?, ?, TRUE) RETURNING *",
    args: [programId, title, targetValue],
  });
}

/** KPI list re-fetched to return alongside the freshly inserted KPI (POST /api/v2/kpis). */
export async function getV2KpisAfterCreate(programId) {
  return db.execute({
    sql: "SELECT * FROM v2_kpis WHERE program_id = ?",
    args: [programId],
  });
}

/** Apply a manually entered weight to one KPI (PUT /api/v2/kpis, manual mode). */
export async function updateV2KpiManualWeight(weight, id) {
  return db.execute({
    sql: "UPDATE v2_kpis SET weight = ?, auto_weight = FALSE WHERE id = ?",
    args: [weight, id],
  });
}

/** KPI list re-fetched after weight redistribution (PUT /api/v2/kpis). */
export async function getV2KpisAfterWeightUpdate(programId) {
  return db.execute({
    sql: "SELECT * FROM v2_kpis WHERE program_id = ?",
    args: [programId],
  });
}

/** KPI ids for a program, used to redistribute weights equally. */
export async function getV2KpiIdsByProgramId(programId) {
  return db.execute({
    sql: "SELECT id FROM v2_kpis WHERE program_id = ?",
    args: [programId],
  });
}

/** Apply an equally redistributed weight to one KPI. */
export async function updateV2KpiAutoWeight(weight, id) {
  return db.execute({
    sql: "UPDATE v2_kpis SET weight = ?, auto_weight = TRUE WHERE id = ?",
    args: [weight, id],
  });
}

/** Program id owning a KPI — read before deleting so weights can be rebalanced. */
export async function getV2KpiProgramId(id) {
  return db.execute({
    sql: "SELECT program_id FROM v2_kpis WHERE id = ?",
    args: [id],
  });
}

/** Delete a KPI row (DELETE /api/v2/kpis). */
export async function deleteV2Kpi(id) {
  return db.execute({
    sql: "DELETE FROM v2_kpis WHERE id = ?",
    args: [id],
  });
}

// ── POST/PUT/DELETE /api/kpis (V1 strategic KPI CRUD) ────────────────────────

/** Create a KPI (defaults target_value to 80 when omitted). */
export async function insertKpi(programId, title, targetValue) {
  return db.execute({
    sql: "INSERT INTO v2_kpis (program_id, title, target_value) VALUES (?, ?, ?)",
    args: [programId, title, targetValue || 80],
  });
}

/** Rename / retarget an existing KPI (defaults target_value to 80 when omitted). */
export async function updateKpi(id, title, targetValue) {
  return db.execute({
    sql: "UPDATE v2_kpis SET title = ?, target_value = ? WHERE id = ?",
    args: [title, targetValue || 80, id],
  });
}

/** Delete a KPI row (DELETE /api/kpis). */
export async function deleteKpi(id) {
  return db.execute({
    sql: "DELETE FROM v2_kpis WHERE id = ?",
    args: [id],
  });
}

// ── GET /api/kpi-progress ────────────────────────────────────────────────────

/** Persisted KPI progress rows for a program, ordered by kpi_id. */
export async function getKpiProgressByProgramId(programId) {
  return db.execute({
    sql: "SELECT * FROM kpi_progress WHERE program_id = ? ORDER BY kpi_id ASC",
    args: [programId],
  });
}

// ── GET/POST/DELETE /api/superadmin/standard-types ───────────────────────────

/** Active standard types, optionally narrowed by category (description). */
export async function listActiveStandardTypes(category) {
  let query = "SELECT * FROM v2_standard_types WHERE status = 'active'";
  let args = [];

  if (category) {
    query += " AND description = ?";
    args.push(category);
  }

  return db.execute({ sql: query, args });
}

/** Rename an existing standard type. */
export async function updateStandardType(label, id) {
  return db.execute({
    sql: "UPDATE v2_standard_types SET name = ? WHERE id = ?",
    args: [label, id],
  });
}

/** Insert a new standard type under the given category. */
export async function createStandardType(label, category) {
  return db.execute({
    sql: "INSERT INTO v2_standard_types (name, description) VALUES (?, ?)",
    args: [label, category],
  });
}

/** Delete a standard type. */
export async function deleteStandardType(id) {
  return db.execute({
    sql: "DELETE FROM v2_standard_types WHERE id = ?",
    args: [id],
  });
}

// ── POST /api/system/database (outstanding platform migrations) ──────────────

/**
 * Outstanding platform migration DDL, kept idempotent (IF NOT EXISTS /
 * CREATE TABLE IF NOT EXISTS). Executed step-by-step by the route so each
 * step's result is reported individually.
 */
export const platformMigrationSteps = [
  // ── 028: platform_evaluation_frameworks ──────────────────────────────────
  {
    name: "Create platform_evaluation_frameworks table",
    sql: `CREATE TABLE IF NOT EXISTS platform_evaluation_frameworks (
          id SERIAL PRIMARY KEY,
          form_id INTEGER NOT NULL REFERENCES platform_forms(id) ON DELETE CASCADE,
          source_document TEXT,
          framework JSONB NOT NULL,
          created_by TEXT,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW(),
          UNIQUE(form_id)
        )`,
  },
  {
    name: "Create idx_eval_frameworks_form index",
    sql: `CREATE INDEX IF NOT EXISTS idx_eval_frameworks_form ON platform_evaluation_frameworks(form_id)`,
  },
  // ── 029: platform_submission_evaluations ─────────────────────────────────
  {
    name: "Create platform_submission_evaluations table",
    sql: `CREATE TABLE IF NOT EXISTS platform_submission_evaluations (
          id SERIAL PRIMARY KEY,
          submission_id INTEGER NOT NULL REFERENCES platform_form_submissions(id) ON DELETE CASCADE,
          framework_id INTEGER REFERENCES platform_evaluation_frameworks(id) ON DELETE SET NULL,
          evaluated_by TEXT NOT NULL DEFAULT 'ai',
          model TEXT DEFAULT 'deepseek-chat',
          dimensions JSONB NOT NULL,
          overall_score NUMERIC(5,1),
          ranking TEXT,
          recommendation TEXT,
          confidence NUMERIC(4,3),
          evaluated_at TIMESTAMP DEFAULT NOW()
        )`,
  },
  {
    name: "Create idx_evaluations_submission index",
    sql: `CREATE INDEX IF NOT EXISTS idx_evaluations_submission ON platform_submission_evaluations(submission_id)`,
  },
  {
    name: "Create idx_evaluations_framework index",
    sql: `CREATE INDEX IF NOT EXISTS idx_evaluations_framework ON platform_submission_evaluations(framework_id)`,
  },
];

/** Execute a single platform migration DDL statement. */
export async function runPlatformMigrationStep(sql) {
  return db.execute({ sql, args: [] });
}

// ── GET /api/forensic/user-role ──────────────────────────────────────────────

/** Contact lookup for forensic role resolution (email is normalized first). */
export async function getContactForRoleResolution(email) {
  return db.execute({
    sql: "SELECT cid, name, email, role, group_name, status FROM contacts WHERE email = ? LIMIT 1",
    args: [email.toLowerCase().trim()],
  });
}

// ── GET /api/migrate/phase0 (Engineering Operations schema) ──────────────────

/** Phase 0: add the tasks.priority column. */
export async function addTasksPriorityColumn() {
  return db.execute({
    sql: `ALTER TABLE tasks ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'medium'`,
    args: [],
  });
}

/** Phase 0: constrain tasks.priority to the allowed levels. */
export async function addTasksPriorityCheckConstraint() {
  return db.execute({
    sql: `ALTER TABLE tasks ADD CONSTRAINT tasks_priority_check CHECK (priority IN ('critical', 'high', 'medium', 'low'))`,
    args: [],
  });
}

/** Phase 0: index tasks by priority. */
export async function createTasksPriorityIndex() {
  return db.execute({ sql: "CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority)", args: [] });
}

/** Phase 0: composite index on tasks(assigned_to, priority). */
export async function createTasksAssignedPriorityIndex() {
  return db.execute({ sql: "CREATE INDEX IF NOT EXISTS idx_tasks_assigned_priority ON tasks(assigned_to, priority)", args: [] });
}

/** Phase 0: add one error_logs column (name/type come from the column list). */
export async function addErrorLogColumn(name, type) {
  return db.execute({
    sql: `ALTER TABLE error_logs ADD COLUMN IF NOT EXISTS ${name} ${type}`,
    args: [],
  });
}

/** Phase 0: index error_logs by task_id. */
export async function createErrorLogsTaskIdIndex() {
  return db.execute({ sql: "CREATE INDEX IF NOT EXISTS idx_error_logs_task_id ON error_logs(task_id)", args: [] });
}

/** Phase 0: drop the legacy error_logs severity constraint. */
export async function dropErrorLogsSeverityCheck() {
  return db.execute({
    sql: `ALTER TABLE error_logs DROP CONSTRAINT IF EXISTS error_logs_severity_check`,
    args: [],
  });
}

/** Phase 0: re-add the error_logs severity constraint with the new levels. */
export async function addErrorLogsSeverityCheck() {
  return db.execute({
    sql: `ALTER TABLE error_logs ADD CONSTRAINT error_logs_severity_check CHECK (severity IN ('info', 'warning', 'error', 'critical', 'fatal'))`,
    args: [],
  });
}

// ── POST /api/migrate/phase1 (file-driven schema extension) ──────────────────

/** Execute one statement from the Phase 1 migration file. */
export async function runPhase1MigrationStatement(sql) {
  return db.execute({ sql, args: [] });
}

// ── POST /api/migrate/phase5 (file-driven data migration) ────────────────────

/** Execute one statement from the Phase 5 data migration file. */
export async function runPhase5MigrationStatement(sql) {
  return db.execute({ sql, args: [] });
}

// ── GET /api/venture-templates (playbook reads) ──────────────────────────────

/** Active playbook templates with their stage counts, newest first. */
export async function listActivePlaybookTemplates() {
  return db.execute({
    sql: `SELECT t.*,
              (SELECT COUNT(*) FROM venture_playbook_template_stages s WHERE s.template_id = t.id) AS stage_count
            FROM venture_playbook_templates t
            WHERE t.is_active = TRUE
            ORDER BY t.created_at DESC`,
    args: [],
  });
}

/** Stages of one playbook template, in display order. */
export async function getPlaybookTemplateStages(templateId) {
  return db.execute({
    sql: `SELECT s.id, s.stage_order, s.name, s.description, s.objective, s.completion_criteria
              FROM venture_playbook_template_stages s WHERE s.template_id = ? ORDER BY s.stage_order`,
    args: [templateId],
  });
}

/** Milestones attached to a set of playbook stages (IN clause mirrors stage count). */
export async function getPlaybookStageMilestones(stageIds) {
  return db.execute({
    sql: `SELECT sm.stage_id, m.id, m.name, m.description, m.expected_outcome, m.default_due_days
                  FROM venture_playbook_stage_milestones sm
                  JOIN venture_milestone_templates m ON m.id = sm.milestone_template_id
                  WHERE sm.stage_id IN (${stageIds.map(() => "?").join(", ")}) ORDER BY sm.sort_order`,
    args: stageIds,
  });
}

// ── GET/POST/PATCH /api/venture-options (taxonomy config) ────────────────────

/** Venture taxonomy options with optional type filter / inactive inclusion. */
export async function listVentureOptions(optionType, includeInactive) {
  let sql = "SELECT id, option_type, value, label, sort_order, is_active FROM venture_option_values WHERE 1=1";
  const args = [];
  if (optionType) {
    sql += " AND option_type = ?";
    args.push(optionType);
  }
  if (!includeInactive) {
    sql += " AND is_active = TRUE";
  }
  sql += " ORDER BY option_type ASC, sort_order ASC, value ASC";

  return db.execute({ sql, args });
}

/** Insert (or re-label on conflict) one venture taxonomy option. */
export async function upsertVentureOption(optionType, value, label, sortOrder) {
  return db.execute({
    sql: `INSERT INTO venture_option_values (option_type, value, label, sort_order, is_active, created_at)
            VALUES (?, ?, ?, ?, TRUE, NOW())
            ON CONFLICT (option_type, value) DO UPDATE SET label = EXCLUDED.label
            RETURNING id`,
    args: [optionType, value, label || value, sortOrder || 0],
  });
}

/**
 * Partially update one venture option. `sets` holds the "col = ?" fragments
 * collected by the controller and `args` ends with the target id.
 */
export async function updateVentureOption(sets, args) {
  return db.execute({
    sql: `UPDATE venture_option_values SET ${sets.join(", ")} WHERE id = ?`,
    args,
  });
}

// ── GET/POST/PATCH /api/venture-kpi-definitions (catalog config) ─────────────

/** Active venture KPI definitions ordered by name. */
export async function listActiveVentureKpiDefinitions() {
  return db.execute({ sql: "SELECT * FROM venture_kpi_definitions WHERE is_active = true ORDER BY name", args: [] });
}

/** Create a venture KPI definition (optional fields default to null). */
export async function createVentureKpiDefinition(
  name,
  description,
  unit,
  autoCalcSource,
  formula,
  frequency,
  measurementMethod,
  defaultTarget,
  createdBy,
) {
  return db.execute({
    sql: "INSERT INTO venture_kpi_definitions (name, description, unit, auto_calc_source, formula, frequency, measurement_method, default_target, created_by) VALUES (?,?,?,?,?,?,?,?,?)",
    args: [
      name,
      description || null,
      unit || null,
      autoCalcSource || null,
      formula || null,
      frequency || null,
      measurementMethod || null,
      defaultTarget ?? null,
      createdBy || null,
    ],
  });
}

/**
 * Partially update one venture KPI definition. `updates` holds the "col = ?"
 * fragments collected by the controller and `args` ends with the target id.
 */
export async function updateVentureKpiDefinition(updates, args) {
  return db.execute({
    sql: `UPDATE venture_kpi_definitions SET ${updates.join(", ")} WHERE id = ?`,
    args,
  });
}

// ── POST /api/public/register (participant self-registration) ────────────────

/** Look up the target group in families (by registration_id or text id). */
export async function findRegistrationGroupInFamilies(groupId) {
  return db.execute({
    sql: "SELECT CAST(id AS TEXT) as id, name, program_id, registration_id FROM families WHERE registration_id = ? OR CAST(id AS TEXT) = ?",
    args: [groupId, groupId],
  });
}

/** Fallback group lookup in v2_groups (by registration_id or text id). */
export async function findRegistrationGroupInV2Groups(groupId) {
  return db.execute({
    sql: "SELECT CAST(id AS TEXT) as id, name, program_id, registration_id FROM v2_groups WHERE registration_id = ? OR CAST(id AS TEXT) = ?",
    args: [groupId, groupId],
  });
}

/** Existing contact check for the normalized email being registered. */
export async function findContactCidByEmail(email) {
  return db.execute({
    sql: "SELECT cid FROM contacts WHERE email = ? AND deleted = 0",
    args: [email],
  });
}

/** Re-activate an existing contact as a pending participant of the group. */
export async function updateContactForRegistration(password, name, group, email) {
  return db.execute({
    sql: "UPDATE contacts SET password = ?, name = ?, status = 'pending', group_name = ? WHERE email = ?",
    args: [password, name, String(group?.name || "").trim().toUpperCase(), email],
  });
}

/** Insert a new pending participant contact. */
export async function insertContactForRegistration(cid, name, email, phone, password, groupName) {
  return db.execute({
    sql: "INSERT INTO contacts (cid, name, email, phone, password, role, status, group_name, created_at) VALUES (?, ?, ?, ?, ?, 'participant', 'pending', ?, NOW())",
    args: [cid, name, email, phone || null, password, groupName],
  });
}

/** Add the registering contact to the program's participant list. */
export async function insertParticipantForRegistration(programId, participantCid, name, email, phone) {
  return db.execute({
    sql: "INSERT INTO v2_participants (program_id, user_id, name, email, phone, status, created_at) VALUES (?, ?, ?, ?, ?, 'pending', NOW()) ON CONFLICT DO NOTHING",
    args: [programId, participantCid, name, email, phone || null],
  });
}

/** Keep the canonical participant_programs membership table in sync. */
export async function insertParticipantProgramMembership(participantId, programId) {
  return db.execute({
    sql: "INSERT INTO participant_programs (participant_id, program_id, status, accepted_at) VALUES (?, ?, 'pending', NOW()) ON CONFLICT (participant_id, program_id) DO NOTHING",
    args: [participantId, programId],
  });
}

// ── GET /api/public/group-info (registration page lookups) ───────────────────

/** Public group lookup in families (by text id or registration_id). */
export async function findFamilyForGroupInfo(id) {
  return db.execute({
    sql: "SELECT CAST(id AS TEXT) as id, registration_id, name, program_id FROM families WHERE CAST(id AS TEXT) = ? OR registration_id = ?",
    args: [id, id],
  });
}

/** Public group lookup in v2_groups (by text id or registration_id). */
export async function findV2GroupForGroupInfo(id) {
  return db.execute({
    sql: "SELECT CAST(id AS TEXT) as id, registration_id, name, program_id FROM v2_groups WHERE CAST(id AS TEXT) = ? OR registration_id = ?",
    args: [id, id],
  });
}

/** Registration window of the program a public group belongs to. */
export async function getProgramRegistrationWindow(programId) {
  return db.execute({
    sql: "SELECT registration_window FROM v2_programs WHERE CAST(id AS TEXT) = ?",
    args: [String(programId)],
  });
}

// ── POST /api/public/courses/[slug] (free self-enrollment) ───────────────────

/** Insert an idempotent free ('self') course enrollment. */
export async function insertSelfEnrollment(courseId, userCid) {
  return db.execute({
    sql: `INSERT INTO lms_enrollments (course_id, user_cid, source)
            VALUES (?, ?, 'self')
            ON CONFLICT (course_id, user_cid) DO NOTHING`,
    args: [courseId, userCid],
  });
}
