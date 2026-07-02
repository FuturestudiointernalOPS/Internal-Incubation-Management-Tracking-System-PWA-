import db, { initDb } from "../src/lib/db.js";

/**
 * MIGRATION: Create v2_op_reports table for company-wide operational reporting.
 *
 * This table stores weekly reports submitted by all staff/team members.
 * Two report cycles per week:
 *   - standup (Monday) — planning, priorities, deliverables, risks
 *   - retro (Friday)   — completed work, unfinished tasks, challenges, wins
 *
 * Run: set -a && . .env.local && node scripts/add_op_reports_table.mjs
 */

async function migrate() {
  await initDb();
  console.log("Setting up v2_op_reports table...\n");

  // Try to create the table first (harmless if it already exists)
  try {
    await db.execute({
      sql: `CREATE TABLE IF NOT EXISTS v2_op_reports (
          id SERIAL PRIMARY KEY,
          user_id TEXT NOT NULL,
          user_name TEXT NOT NULL,
          user_role TEXT DEFAULT 'staff',
          report_type TEXT NOT NULL CHECK (report_type IN ('standup', 'retro')),
          week_number INTEGER NOT NULL,
          year INTEGER NOT NULL,
          status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'submitted')),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          -- Monday Stand-Up
          weekly_priorities TEXT,
          key_deliverables TEXT,
          top_priorities TEXT,
          expected_deliverables TEXT,
          projects_tasks TEXT,
          has_dependencies BOOLEAN DEFAULT NULL,
          dependency_note TEXT,
          risks_blockers TEXT,
          has_blockers BOOLEAN DEFAULT NULL,
          blocker_description TEXT,
          needs_support BOOLEAN DEFAULT NULL,
          support_note TEXT,
          additional_notes TEXT,
          -- Friday Retro
          completed_work TEXT,
          unfinished_tasks TEXT,
          challenges TEXT,
          wins TEXT,
          carryover_items TEXT,
          retro_notes TEXT,
          -- Retro structured fields
          week_status VARCHAR(50) DEFAULT NULL,
          had_blockers BOOLEAN DEFAULT NULL,
          blocker_type VARCHAR(50) DEFAULT NULL,
          blocker_desc TEXT DEFAULT NULL,
          major_achievement TEXT DEFAULT NULL,
          -- Unique constraint
          UNIQUE(user_id, week_number, year, report_type)
        )`,
      args: [],
    });
    console.log("  ✅ v2_op_reports table ready");
  } catch (e) {
    console.log("  ⚠️  Table already exists, adding new columns...");
    // If table exists, add any missing columns
    const retroColumns = [
      ["week_status", "VARCHAR(50) DEFAULT NULL"],
      ["had_blockers", "BOOLEAN DEFAULT NULL"],
      ["blocker_type", "VARCHAR(50) DEFAULT NULL"],
      ["blocker_desc", "TEXT DEFAULT NULL"],
      ["major_achievement", "TEXT DEFAULT NULL"],
      ["top_priorities", "TEXT DEFAULT NULL"],
      ["expected_deliverables", "TEXT DEFAULT NULL"],
      ["projects_tasks", "TEXT DEFAULT NULL"],
      ["has_dependencies", "BOOLEAN DEFAULT NULL"],
      ["dependency_note", "TEXT DEFAULT NULL"],
      ["has_blockers", "BOOLEAN DEFAULT NULL"],
      ["blocker_description", "TEXT DEFAULT NULL"],
      ["needs_support", "BOOLEAN DEFAULT NULL"],
      ["support_note", "TEXT DEFAULT NULL"],
    ];
    for (const [col, def] of retroColumns) {
      try {
        await db.execute({
          sql: `ALTER TABLE IF EXISTS v2_op_reports ADD COLUMN IF NOT EXISTS ${col} ${def}`,
          args: [],
        });
        console.log(`  ✅ Column ${col} added`);
      } catch (colErr) {
        console.log(`  ⚠️  Column ${col}: ${colErr.message}`);
      }
    }
  }

  console.log("\n✅ Migration complete.");
}

migrate().then(() => process.exit(0));
