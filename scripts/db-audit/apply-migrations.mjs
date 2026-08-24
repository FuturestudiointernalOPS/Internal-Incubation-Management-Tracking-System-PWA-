/**
 * PHASE 3C — APPLY THE APP'S OWN TRACK 2/3 MIGRATION (idempotent)
 *
 * Runs the exact MIGRATION_STATEMENTS list from
 * src/app/api/admin/run-migration/route.js against the database configured in
 * .env.audit-readonly (PRODUCTION). All statements are idempotent
 * (IF NOT EXISTS / DROP CONSTRAINT IF EXISTS) and safe to re-run.
 *
 * Behavior mirrors the app's own route: each statement runs independently,
 * errors are collected per-statement, the run never aborts mid-way.
 * Prints results only — never the connection string.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..", "..");
// Optional: node apply-migrations.mjs <env-file> — defaults to .env.audit-readonly
const ENV_FILE = path.join(PROJECT_ROOT, process.argv[2] || ".env.audit-readonly");

let dbUrl = null;
for (const line of readFileSync(ENV_FILE, "utf8").split(/\r?\n/)) {
  const m = line.match(/^DATABASE_URL=(.*)$/);
  if (m) { dbUrl = m[1].trim().replace(/^["']|["']$/g, ""); break; }
}
if (!dbUrl) { console.error("Missing DATABASE_URL in .env.audit-readonly"); process.exit(1); }

// ── Exact list from src/app/api/admin/run-migration/route.js ────────────────
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

const client = new pg.Client({
  connectionString: dbUrl,
  ssl: /sslmode=/.test(dbUrl) ? undefined : { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
});
await client.connect();
const who = await client.query("SELECT current_database() AS db, current_user AS usr");
console.log(`\n=== CONNECTED: ${who.rows[0].db} as ${who.rows[0].usr} ===`);
console.log(`=== Applying ${MIGRATION_STATEMENTS.length} statements (idempotent) ===\n`);

const results = [];
const errors = [];
for (const sql of MIGRATION_STATEMENTS) {
  try {
    await client.query(sql);
    results.push(sql);
    console.log(`  OK  ${sql.slice(0, 90)}`);
  } catch (e) {
    errors.push({ sql, error: e.message });
    console.log(`  ERR ${sql.slice(0, 90)}\n      -> ${e.message}`);
  }
}

console.log(`\n=== RESULT: ${results.length}/${MIGRATION_STATEMENTS.length} succeeded, ${errors.length} failed ===`);
await client.end();
if (errors.length > 0) process.exitCode = 1;
