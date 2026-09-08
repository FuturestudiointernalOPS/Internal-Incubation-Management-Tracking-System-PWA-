// Run once: node scripts/run_phase0_migration.mjs
// Uses the app's existing DATABASE_URL connection — no psql needed.

import { initDb } from "../src/lib/db.js";

const statements = [
  // v2_attendance
  `ALTER TABLE v2_attendance ADD COLUMN IF NOT EXISTS program_id TEXT`,
  `ALTER TABLE v2_attendance ADD COLUMN IF NOT EXISTS date DATE DEFAULT CURRENT_DATE`,
  `ALTER TABLE v2_attendance ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()`,

  // contacts
  `ALTER TABLE contacts ADD COLUMN IF NOT EXISTS invited_at TIMESTAMPTZ`,
  `ALTER TABLE contacts ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ`,
  `ALTER TABLE contacts ADD COLUMN IF NOT EXISTS archived_by TEXT`,
  `ALTER TABLE contacts ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ`,
  `ALTER TABLE contacts ADD COLUMN IF NOT EXISTS deleted_by TEXT`,

  // families
  `ALTER TABLE families ADD COLUMN IF NOT EXISTS is_archived INTEGER DEFAULT 0`,

  // indexes
  `CREATE INDEX IF NOT EXISTS idx_contacts_archived_at ON contacts(archived_at) WHERE archived_at IS NOT NULL`,
  `CREATE INDEX IF NOT EXISTS idx_contacts_deleted_at ON contacts(deleted_at) WHERE deleted_at IS NOT NULL`,
  `CREATE INDEX IF NOT EXISTS idx_attendance_session ON v2_attendance(session_id)`,
  `CREATE INDEX IF NOT EXISTS idx_attendance_participant ON v2_attendance(participant_id)`,
  `CREATE INDEX IF NOT EXISTS idx_attendance_program ON v2_attendance(program_id) WHERE program_id IS NOT NULL`,
];

const db = await initDb();
console.log("Connected. Running Phase 0 migrations...\n");

for (const sql of statements) {
  try {
    await db.execute({ sql, args: [] });
    console.log("  ✓", sql.substring(0, 80) + "...");
  } catch (e) {
    console.log("  ⚠ Skipped (already exists):", e.message.split("\n")[0]);
  }
}

console.log("\nPhase 0 migrations complete.");
process.exit(0);
