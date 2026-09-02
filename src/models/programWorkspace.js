import db from "@/lib/db";

/**
 * ProgramWorkspace model — data access for the PM program workspace
 * (full-state view, schedule, submissions review and export).
 *
 * Sources migrated from route controllers (docs/MVC_REFACTOR.md Wave 2):
 *  - /api/pm/full-state
 *  - /api/pm/schedule
 *  - /api/pm/submissions
 *  - /api/pm/export
 *
 * Each function wraps exactly one SQL statement (or one parallel batch).
 * SQL is byte-identical to the queries that used to live inline in the
 * controllers, so behavior is unchanged.
 *
 * Model-layer rules (see docs/MVC_REFACTOR.md §4):
 *  - No HTTP / Next.js imports here — only the db engine.
 *  - One function per query, named after the data/outcome it returns.
 */

// ────────────────────────────────────────────────────────────
// /api/pm/full-state — PM program full-state view
// ────────────────────────────────────────────────────────────

/**
 * All program workspace queries (program, participants, teams, sessions,
 * staff list, events, kpis, documents, followups, assigned staff,
 * submissions, reports, families, deliverables) run in parallel. Each query
 * keeps its own name-tagged failure isolation (logged, `{ rows: [] }`
 * fallback) exactly like the original controller batch.
 */
export async function getProgramFullStateData(id) {
  const queries = [
    {
      name: "program",
      sql: `SELECT p.*, k.title as note_title, k.url as note_files, k.description as note_description, c.name as pm_name, NULL as completion_index FROM v2_programs p LEFT JOIN v2_knowledge_bank k ON CAST(p.note_id AS TEXT) = CAST(k.id AS TEXT) LEFT JOIN contacts c ON p.assigned_pm_id = c.cid WHERE p.id = ?`,
      args: [id],
    },
    {
      // PARTICIPANTS = real participant_programs membership + active account
      // + NOT a facilitator of the same program + not deleted/archived.
      // v2_participants and contacts-by-group are intake/history only and are
      // intentionally NOT treated as operational participant membership.
      name: "participants",
      sql: `SELECT CAST(c.cid AS TEXT) as id, pp.program_id, c.name, c.email, c.phone,
                     COALESCE(pp.screening_status, 'pending') as screening_status, c.status, c.created_at, c.group_name,
                     'enrolled' as source, c.v2_team_id
              FROM participant_programs pp
              JOIN contacts c ON pp.participant_id = c.cid
              WHERE CAST(pp.program_id AS TEXT) = ?
                AND c.deleted = 0
                AND c.deleted_at IS NULL
                AND c.archived_at IS NULL
                AND LOWER(COALESCE(c.status, '')) = 'active'
                AND NOT EXISTS (
                  SELECT 1 FROM v2_program_staff ps
                  WHERE CAST(ps.program_id AS TEXT) = ?
                    AND ps.role = 'facilitator'
                    AND (ps.staff_id = c.cid OR LOWER(TRIM(ps.staff_id)) = LOWER(TRIM(c.email)))
                )`,
      args: [String(id), String(id)],
    },
    {
      name: "teams",
      sql: "SELECT * FROM v2_teams WHERE program_id = ?",
      args: [id],
    },
    {
      name: "sessions",
      sql: "SELECT * FROM v2_sessions WHERE program_id = ? AND (status IS NULL OR status != 'archived')",
      args: [id],
    },
    {
      name: "staffList",
      sql: "SELECT cid, name, email, phone, role FROM contacts WHERE role IN ('teacher', 'staff', 'admin') AND deleted = 0",
      args: [],
    },
    {
      name: "events",
      sql: "SELECT * FROM v2_events WHERE program_id = ?",
      args: [id],
    },
    {
      name: "kpis",
      sql: "SELECT * FROM v2_kpis WHERE program_id = ?",
      args: [id],
    },
    {
      name: "documents",
      sql: "SELECT * FROM v2_document_requirements WHERE program_id = ?",
      args: [id],
    },
    {
      name: "followups",
      sql: "SELECT * FROM v2_followups WHERE program_id = ? ORDER BY created_at DESC",
      args: [id],
    },
    {
      name: "assignedStaff",
      sql: `SELECT ps.id, c.cid, c.name, c.email, ps.role FROM v2_program_staff ps LEFT JOIN contacts c ON ps.staff_id = c.cid OR LOWER(TRIM(c.email)) = LOWER(TRIM(ps.staff_id)) WHERE ps.program_id = ?`,
      args: [id],
    },
    {
      name: "submissions",
      sql: `SELECT s.*, 
                     c.name as participant_name, 
                     d.title as deliverable_title
              FROM v2_submissions s
              LEFT JOIN contacts c ON s.participant_id::text = c.cid
              LEFT JOIN v2_document_requirements d ON s.deliverable_id::text = d.id::text
              WHERE s.program_id::text = ?`,
      args: [id],
    },
    {
      name: "reports",
      sql: "SELECT * FROM v2_weekly_reports WHERE program_id = ? ORDER BY week_number DESC",
      args: [id],
    },
    {
      name: "families",
      sql: "SELECT * FROM families WHERE program_id = ?",
      args: [id],
    },
    {
      name: "deliverables",
      sql: "SELECT * FROM v2_deliverables WHERE program_id = ? ORDER BY week_number ASC",
      args: [id],
    },
  ];

  return Promise.all(
    queries.map(async (q) => {
      try {
        return await db.execute({ sql: q.sql, args: q.args });
      } catch (e) {
        console.error(` forensic | Query [${q.name}] failed:`, e.message);
        return { rows: [] };
      }
    }),
  );
}

/** Knowledge-attachment file names/urls for a program note. */
export async function getProgramNoteAttachments(noteId) {
  return db.execute({
    sql: "SELECT name, url FROM v2_knowledge_attachments WHERE CAST(note_id AS TEXT) = CAST(? AS TEXT)",
    args: [noteId],
  });
}

/**
 * Contact rows (cid, name, email, phone, role) for a set of assistant cids.
 * The placeholder list is derived from the number of ids, so the generated
 * SQL is identical to the original inline `cid IN (?,?,...)` query.
 */
export async function getAssistantContactsByCids(assistantIds) {
  return db.execute({
    sql: `SELECT cid, name, email, phone, role FROM contacts WHERE cid IN (${assistantIds.map(() => "?").join(",")})`,
    args: assistantIds,
  });
}

/** Persisted KPI progress rows for a program (fallback = dynamic calc). */
export async function getPersistedKpiProgress(programId) {
  return db.execute({
    sql: "SELECT * FROM kpi_progress WHERE program_id = ? ORDER BY kpi_id ASC",
    args: [programId],
  });
}

// ────────────────────────────────────────────────────────────
// /api/pm/schedule — PM schedule (full or own scope)
// ────────────────────────────────────────────────────────────

/** Full session calendar — Super Admin only. */
export async function getSuperAdminSchedule() {
  return db.execute({
    sql: `
             SELECT s.*, p.name as program_name
             FROM v2_sessions s
             JOIN v2_programs p ON s.program_id = p.id
             WHERE s.scheduled_date IS NOT NULL AND p.is_archived = 0
             ORDER BY s.scheduled_date ASC
          `,
    args: [],
  });
}

/** Own schedule — sessions this contact handles or manages as assigned PM. */
export async function getOwnSchedule(ownCid) {
  return db.execute({
    sql: `
             SELECT s.*, p.name as program_name
             FROM v2_sessions s
             JOIN v2_programs p ON s.program_id = p.id
             WHERE s.scheduled_date IS NOT NULL AND p.is_archived = 0
               AND (s.handler_id = ? OR p.assigned_pm_id = ?)
             ORDER BY s.scheduled_date ASC
          `,
    args: [ownCid, ownCid],
  });
}

// ────────────────────────────────────────────────────────────
// /api/pm/submissions — PM submission review
// ────────────────────────────────────────────────────────────

/** Ensure the v2_submissions(program_id) index exists (best-effort). */
export async function ensureSubmissionProgramIdIndex() {
  return db.execute("CREATE INDEX IF NOT EXISTS idx_v2_submissions_program_id ON v2_submissions(program_id)");
}

/** Ensure the v2_submissions(participant_id, program_id) index exists. */
export async function ensureSubmissionParticipantProgramIndex() {
  return db.execute("CREATE INDEX IF NOT EXISTS idx_v2_submissions_participant_program ON v2_submissions(participant_id, program_id)");
}

/** Ensure the v2_submissions(deliverable_id) index exists. */
export async function ensureSubmissionDeliverableIndex() {
  return db.execute("CREATE INDEX IF NOT EXISTS idx_v2_submissions_deliverable ON v2_submissions(deliverable_id)");
}

/** Ensure the v2_submissions(created_at DESC) index exists. */
export async function ensureSubmissionCreatedAtIndex() {
  return db.execute("CREATE INDEX IF NOT EXISTS idx_v2_submissions_created ON v2_submissions(created_at DESC)");
}

/** Programs assigned to a PM (id + name, not archived). */
export async function getProgramsByAssignedPm(assignedPmId) {
  return db.execute({
    sql: "SELECT id, name FROM v2_programs WHERE assigned_pm_id = ? AND (is_archived = 0 OR is_archived IS NULL)",
    args: [assignedPmId],
  });
}

/**
 * Submissions across a set of program ids (newest first). The placeholder
 * list is derived from the number of ids, so the generated SQL is identical
 * to the original inline `program_id IN (?,?,...)` query.
 */
export async function getSubmissionsByProgramIds(programIds) {
  const placeholders = programIds.map(() => "?").join(",");
  return db.execute({
    sql: `SELECT s.*, d.title as deliverable_title, d.week_number as deliverable_week,
                   c.name as participant_name, c.group_name as participant_group,
                   prog.grading_mode
            FROM v2_submissions s
            LEFT JOIN v2_document_requirements d ON s.deliverable_id::text = d.id::text
            LEFT JOIN contacts c ON s.participant_id::text = c.cid
            LEFT JOIN v2_programs prog ON s.program_id::text = prog.id::text
            WHERE s.program_id::text IN (${placeholders})
            ORDER BY s.created_at DESC`,
    args: programIds,
  });
}

// ────────────────────────────────────────────────────────────
// /api/pm/export — PM program data export
// ────────────────────────────────────────────────────────────

/**
 * Raw export rows for a program, by export type (participants, attendance,
 * submissions, teams, ical). The SQL per type is selected here; the caller
 * validates the type and shapes the downloadable file.
 */
export async function getProgramExportRows(type, programId) {
  let sql;
  switch (type) {
    case "participants":
      sql = `SELECT c.name, c.email, c.phone, c.status, c.created_at
               FROM participant_programs pp
               JOIN contacts c ON pp.participant_id = c.cid
               WHERE CAST(pp.program_id AS TEXT) = $1
                 AND c.deleted = 0 AND c.deleted_at IS NULL AND c.archived_at IS NULL
                 AND LOWER(COALESCE(c.status, '')) = 'active'
                 AND NOT EXISTS (
                   SELECT 1 FROM v2_program_staff ps
                   WHERE CAST(ps.program_id AS TEXT) = CAST(pp.program_id AS TEXT)
                     AND ps.role = 'facilitator'
                     AND (ps.staff_id = c.cid OR LOWER(TRIM(ps.staff_id)) = LOWER(TRIM(c.email)))
                 )
               ORDER BY c.name`;
      break;
    case "attendance":
      sql = `SELECT c.name, c.email, va.status as attendance_status, va.date as session_date, va.week_number
               FROM v2_attendance va
               JOIN contacts c ON va.participant_id = c.cid
               WHERE va.program_id = $1
               ORDER BY va.date, c.name`;
      break;
    case "submissions":
      sql = `SELECT c.name, c.email, vdr.title as requirement, vsb.submission_url, vsb.status, vsb.submitted_at
               FROM v2_submissions vsb
               JOIN contacts c ON vsb.participant_id = c.cid
               JOIN v2_document_requirements vdr ON vsb.requirement_id = vdr.id
               WHERE vdr.program_id = $1
               ORDER BY c.name, vsb.submitted_at DESC`;
      break;
    case "teams":
      sql = `SELECT vt.name as team_name, COUNT(c.cid) as member_count, vt.handler_name
               FROM v2_teams vt
               LEFT JOIN contacts c ON c.v2_team_id = vt.id AND c.deleted = 0
               WHERE vt.program_id = $1
               GROUP BY vt.id, vt.name, vt.handler_name
               ORDER BY vt.name`;
      break;
    case "ical":
      sql = `SELECT vs.title as summary, vs.description, vs.scheduled_date, vs.start_time, vs.end_time, vs.timezone
               FROM v2_sessions vs
               WHERE vs.program_id = $1 AND vs.scheduled_date IS NOT NULL
               ORDER BY vs.scheduled_date`;
      break;
  }
  return db.execute({ sql, args: [programId] });
}
