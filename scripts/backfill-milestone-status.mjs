/**
 * BACKFILL MILESTONE STATUS FROM DELIVERABLES — one-off, for milestones whose
 * deliverables were submitted or reviewed before the deliverable flow moved the
 * milestone's own status.
 *
 * The runtime path now keeps the milestone's status in step with its
 * deliverables (submitted → under review, sent back → changes requested, all
 * approved → completed, for a completion authority). Rows written earlier can
 * still read `not_started` next to approved evidence, which is how a Journey
 * showed "0/3 milestones" beside work the founder had plainly done.
 *
 * SAFE BY CONSTRUCTION
 *   - dry run unless --apply is passed: the preview writes nothing at all
 *   - idempotent: it writes only where the derived status differs from the
 *     current one, so re-running proposes nothing
 *   - derived, never invented: the target comes from the deliverables' own rows
 *   - `locked` and `completed` milestones are never touched, and nothing is
 *     deleted
 *
 * Usage:
 *   node scripts/backfill-milestone-status.mjs           -> dry run (preview)
 *   node scripts/backfill-milestone-status.mjs --apply    -> execute
 *
 * The connection comes from DATABASE_URL, or from the env file passed as an
 * argument, or from the application's own .env.local. The connection string is
 * never printed.
 */

const APPLY = process.argv.includes("--apply");
const ENV_FILE_ARG = process.argv.slice(2).find((argument) => !argument.startsWith("--"));

// Load the connection BEFORE the pool is created — a static import would run
// first and find no DATABASE_URL.
if (!process.env.DATABASE_URL) {
  for (const candidate of [ENV_FILE_ARG, ".env.local", ".env"].filter(Boolean)) {
    try {
      process.loadEnvFile(candidate);
      if (process.env.DATABASE_URL) break;
    } catch (_) {
      // File absent — try the next candidate.
    }
  }
}

if (!process.env.DATABASE_URL) {
  console.error("\nDATABASE_URL is not set. Pass an env file:\n  node scripts/backfill-milestone-status.mjs .env.local --apply\n");
  process.exit(1);
}

const { initDb } = await import("../src/lib/db.js");
const { reconcileMilestoneStatusFromDeliverables } = await import("../src/models/ventureMilestoneStatus.js");

const db = await initDb();

console.log("\n=== BACKFILL — MILESTONE STATUS FROM DELIVERABLES ===");
console.log(`  mode: ${APPLY ? "APPLY (writes)" : "DRY RUN (writes nothing)"}\n`);

const report = await reconcileMilestoneStatusFromDeliverables(db, { dryRun: !APPLY }).catch((error) => {
  // A connection problem must not look like a data problem.
  console.error(`\nThe run could not reach the database: ${error?.code || error?.message || error}\n`);
  process.exit(1);
});

console.log(`  milestones examined: ${report.examined}`);
console.log(`  ${APPLY ? "statuses written:    " : "statuses to write:   "} ${report.written || report.changes}\n`);

for (const row of report.rows.slice(0, 50)) {
  console.log(`   ${row.venture_id}  ${row.current_status} → ${row.target_status}   ${row.title || "(untitled)"}`);
}
if (report.rows.length > 50) {
  console.log(`   … and ${report.rows.length - 50} more`);
}
console.log("");

if (!APPLY) {
  console.log("Nothing was written. Re-run with --apply to write these statuses.\n");
} else {
  console.log("Done. Re-run without --apply to confirm nothing is left to change.\n");
}

process.exit(0);
