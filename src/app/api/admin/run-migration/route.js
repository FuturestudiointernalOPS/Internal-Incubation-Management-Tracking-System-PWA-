import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";

/**
 * TEMPORARY MIGRATION RUNNER
 * Executes the Track 2 + Track 3 schema migration.
 * Only accessible by super_admin.
 * 
 * POST /api/admin/run-migration
 */

const MIGRATION_STATEMENTS = [
  // ── Track 2: v2_sessions ──
  "ALTER TABLE v2_sessions ADD COLUMN IF NOT EXISTS description TEXT",
  "ALTER TABLE v2_sessions ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'not started'",
  "ALTER TABLE v2_sessions ADD COLUMN IF NOT EXISTS weight INTEGER DEFAULT 1",
  "ALTER TABLE v2_sessions ADD COLUMN IF NOT EXISTS scheduled_date DATE",
  "ALTER TABLE v2_sessions ADD COLUMN IF NOT EXISTS end_date DATE",
  "ALTER TABLE v2_sessions ADD COLUMN IF NOT EXISTS start_time TIME",
  "ALTER TABLE v2_sessions ADD COLUMN IF NOT EXISTS end_time TIME",
  "ALTER TABLE v2_sessions ADD COLUMN IF NOT EXISTS assignment_type TEXT",
  "ALTER TABLE v2_sessions ADD COLUMN IF NOT EXISTS task_type TEXT",
  "ALTER TABLE v2_sessions ADD COLUMN IF NOT EXISTS handler_id TEXT",
  "ALTER TABLE v2_sessions ADD COLUMN IF NOT EXISTS handler_name TEXT",
  "ALTER TABLE v2_sessions ADD COLUMN IF NOT EXISTS kpi_ids JSONB DEFAULT '[]'::jsonb",
  "ALTER TABLE v2_sessions ADD COLUMN IF NOT EXISTS notes TEXT",
  "ALTER TABLE v2_sessions ADD COLUMN IF NOT EXISTS extra_materials JSONB DEFAULT '[]'::jsonb",

  // ── Track 2: v2_document_requirements ──
  "ALTER TABLE v2_document_requirements ADD COLUMN IF NOT EXISTS session_id INTEGER",
  "ALTER TABLE v2_document_requirements ADD COLUMN IF NOT EXISTS allowed_format TEXT DEFAULT 'pdf'",
  "ALTER TABLE v2_document_requirements ADD COLUMN IF NOT EXISTS weight INTEGER DEFAULT 1",
  "ALTER TABLE v2_document_requirements ADD COLUMN IF NOT EXISTS kpi_ids JSONB DEFAULT '[]'::jsonb",
  "ALTER TABLE v2_document_requirements ADD COLUMN IF NOT EXISTS week_number INTEGER",

  // ── Track 2: v2_programs ──
  "ALTER TABLE v2_programs ADD COLUMN IF NOT EXISTS concept_note TEXT",
  "ALTER TABLE v2_programs ADD COLUMN IF NOT EXISTS vision TEXT",
  "ALTER TABLE v2_programs ADD COLUMN IF NOT EXISTS objectives TEXT",
  "ALTER TABLE v2_programs ADD COLUMN IF NOT EXISTS program_type TEXT DEFAULT 'incubation'",
  "ALTER TABLE v2_programs ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'private'",
  "ALTER TABLE v2_programs ADD COLUMN IF NOT EXISTS participant_limit INTEGER DEFAULT 0",
  "ALTER TABLE v2_programs ADD COLUMN IF NOT EXISTS registration_window TEXT",
  "ALTER TABLE v2_programs ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'en'",
  "ALTER TABLE v2_programs ADD COLUMN IF NOT EXISTS note_id TEXT",
  "ALTER TABLE v2_programs ADD COLUMN IF NOT EXISTS assigned_assistant_id TEXT",
  "ALTER TABLE v2_programs ADD COLUMN IF NOT EXISTS is_archived INTEGER DEFAULT 0",
  "ALTER TABLE v2_programs ADD COLUMN IF NOT EXISTS materials JSONB DEFAULT '[]'::jsonb",

  // ── Track 3: v2_submissions ──
  "ALTER TABLE v2_submissions ADD COLUMN IF NOT EXISTS version_number INTEGER NOT NULL DEFAULT 1",
  "ALTER TABLE v2_submissions ADD COLUMN IF NOT EXISTS supporting_url TEXT",
  "ALTER TABLE v2_submissions ADD COLUMN IF NOT EXISTS review_action TEXT",
  "ALTER TABLE v2_submissions ADD COLUMN IF NOT EXISTS rejection_reason TEXT",
  "ALTER TABLE v2_submissions ADD COLUMN IF NOT EXISTS document_id INTEGER",
  "ALTER TABLE v2_submissions ADD COLUMN IF NOT EXISTS team_id TEXT",
  "ALTER TABLE v2_submissions ADD COLUMN IF NOT EXISTS score INTEGER DEFAULT NULL",
  "ALTER TABLE v2_submissions ADD COLUMN IF NOT EXISTS evaluation_score INTEGER DEFAULT NULL",
  "ALTER TABLE v2_submissions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL",

  // ── Track 3: v2_submissions status constraint ──
  "ALTER TABLE v2_submissions DROP CONSTRAINT IF EXISTS v2_submissions_status_check",
  "ALTER TABLE v2_submissions ADD CONSTRAINT v2_submissions_status_check CHECK (status IN ('pending', 'approved', 'rejected', 'revision_requested', 'pending_followup'))",

  // ── Track 3: v2_programs grading_mode ──
  "ALTER TABLE v2_programs DROP CONSTRAINT IF EXISTS v2_programs_grading_mode_check",
  "ALTER TABLE v2_programs ADD CONSTRAINT v2_programs_grading_mode_check CHECK (grading_mode IN ('graded', 'review', 'followup', 'academic', 'incubation'))",
  "ALTER TABLE v2_programs ADD COLUMN IF NOT EXISTS evaluation_config JSONB DEFAULT '{}'::jsonb",

  // ── Track 3: v2_followups ──
  "ALTER TABLE v2_followups ADD COLUMN IF NOT EXISTS participant_id TEXT",
  "ALTER TABLE v2_followups ADD COLUMN IF NOT EXISTS submission_id UUID REFERENCES v2_submissions(id) ON DELETE CASCADE",
  "ALTER TABLE v2_followups ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMP WITH TIME ZONE",
  "ALTER TABLE v2_followups ADD COLUMN IF NOT EXISTS duration_minutes INTEGER DEFAULT 30",
  "ALTER TABLE v2_followups ADD COLUMN IF NOT EXISTS meeting_link TEXT",
  "ALTER TABLE v2_followups ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'scheduled'",
  "ALTER TABLE v2_followups ADD COLUMN IF NOT EXISTS notes TEXT",

  // ── Track 3: v2_attendance ──
  "ALTER TABLE v2_attendance ADD COLUMN IF NOT EXISTS kpi_id INTEGER",

  // ── Indexes ──
  "CREATE INDEX IF NOT EXISTS idx_v2_submissions_participant_deliverable ON v2_submissions(participant_id, deliverable_id)",
  "CREATE INDEX IF NOT EXISTS idx_v2_submissions_version ON v2_submissions(participant_id, deliverable_id, version_number)",
  "CREATE INDEX IF NOT EXISTS idx_v2_followups_participant ON v2_followups(participant_id)",
  "CREATE INDEX IF NOT EXISTS idx_v2_followups_submission ON v2_followups(submission_id)",
];

export async function POST() {
  try {
    await initDb();
    const authError = await requireAuth(["super_admin"]);
    if (authError) return authError;

    const results = [];
    const errors = [];

    for (const sql of MIGRATION_STATEMENTS) {
      try {
        await db.execute({ sql, args: [] });
        results.push({ sql: sql.substring(0, 80) + "...", status: "ok" });
      } catch (e) {
        errors.push({ sql: sql.substring(0, 80) + "...", error: e.message });
      }
    }

    return NextResponse.json({
      success: true,
      total: MIGRATION_STATEMENTS.length,
      succeeded: results.length,
      failed: errors.length,
      results,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 },
    );
  }
}
