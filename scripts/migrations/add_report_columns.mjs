import db, { initDb } from "../src/lib/db.js";

async function addColumn(table, column, definition) {
  try {
    await db.execute({
      sql: `ALTER TABLE IF EXISTS ${table} ADD COLUMN IF NOT EXISTS ${column} ${definition}`,
      args: [],
    });
    console.log(`  ✅ ${column}`);
  } catch (e) {
    console.log(`  ⚠️  ${column}: ${e.message}`);
  }
}

async function migrate() {
  await initDb();
  console.log("Adding columns to v2_weekly_reports...\n");

  // ── Section 1: Weekly Overview ──
  console.log("[Section 1: Weekly Overview]");
  await addColumn(
    "v2_weekly_reports",
    "week_status",
    "VARCHAR(50) DEFAULT NULL",
  );
  await addColumn(
    "v2_weekly_reports",
    "week_rating",
    "VARCHAR(50) DEFAULT NULL",
  );
  await addColumn("v2_weekly_reports", "main_topic", "TEXT DEFAULT NULL");

  // ── Assignment Tracking (KPI-linked) ──
  console.log("\n[Assignment Tracking]");
  await addColumn(
    "v2_weekly_reports",
    "assignment_given",
    "BOOLEAN DEFAULT NULL",
  );
  await addColumn(
    "v2_weekly_reports",
    "assignment_kpi_ids",
    "TEXT DEFAULT NULL",
  );
  await addColumn(
    "v2_weekly_reports",
    "assignment_objective",
    "TEXT DEFAULT NULL",
  );
  await addColumn(
    "v2_weekly_reports",
    "assignment_outcome",
    "TEXT DEFAULT NULL",
  );

  // ── Section 2: Participation ──
  console.log("\n[Section 2: Participation]");
  await addColumn(
    "v2_weekly_reports",
    "attendance_level",
    "VARCHAR(50) DEFAULT NULL",
  );
  await addColumn(
    "v2_weekly_reports",
    "participation_level",
    "VARCHAR(50) DEFAULT NULL",
  );
  await addColumn(
    "v2_weekly_reports",
    "participants_need_attention",
    "BOOLEAN DEFAULT NULL",
  );
  await addColumn(
    "v2_weekly_reports",
    "participants_attention_notes",
    "TEXT DEFAULT NULL",
  );
  await addColumn(
    "v2_weekly_reports",
    "standout_participants",
    "BOOLEAN DEFAULT NULL",
  );
  await addColumn("v2_weekly_reports", "standout_notes", "TEXT DEFAULT NULL");

  // ── Section 3: Delivery Feedback ──
  console.log("\n[Section 3: Delivery Feedback]");
  await addColumn(
    "v2_weekly_reports",
    "delivery_quality",
    "VARCHAR(50) DEFAULT NULL",
  );
  await addColumn(
    "v2_weekly_reports",
    "participant_understanding",
    "VARCHAR(50) DEFAULT NULL",
  );
  await addColumn(
    "v2_weekly_reports",
    "delivery_challenges",
    "BOOLEAN DEFAULT NULL",
  );
  await addColumn(
    "v2_weekly_reports",
    "delivery_challenge_note",
    "TEXT DEFAULT NULL",
  );

  // ── Section 4: Issues & Support ──
  console.log("\n[Section 4: Issues & Support]");
  await addColumn("v2_weekly_reports", "had_issues", "BOOLEAN DEFAULT NULL");
  await addColumn("v2_weekly_reports", "issue_types", "TEXT[] DEFAULT NULL");
  await addColumn(
    "v2_weekly_reports",
    "requires_admin_attention",
    "BOOLEAN DEFAULT NULL",
  );
  await addColumn(
    "v2_weekly_reports",
    "additional_issue_note",
    "TEXT DEFAULT NULL",
  );

  // ── Section 5: Next Week ──
  console.log("\n[Section 5: Next Week]");
  await addColumn(
    "v2_weekly_reports",
    "program_on_track",
    "BOOLEAN DEFAULT NULL",
  );
  await addColumn(
    "v2_weekly_reports",
    "planned_adjustments",
    "TEXT DEFAULT NULL",
  );

  console.log("\n✅ Migration complete.");
}

migrate().then(() => process.exit(0));
