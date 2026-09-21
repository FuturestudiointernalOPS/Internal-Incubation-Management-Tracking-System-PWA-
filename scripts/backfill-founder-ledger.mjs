/**
 * BACKFILL THE FOUNDER LEDGER — one-off, for Ventures created before it was
 * written automatically.
 *
 * A Venture's people live in the membership list; its founder screen reads the
 * founder ledger. Creation now writes both, but Ventures created earlier have
 * their founders only in the membership list, so their founder screen reads
 * "no founders" for a Venture that plainly has one. This run records the
 * missing ledger rows as ACCEPTED (the people are already in — nobody invited
 * them), matching what creation writes today.
 *
 * SAFE BY CONSTRUCTION
 *   - dry run unless --apply is passed: the preview writes nothing at all
 *   - idempotent: a founder already recorded (same email) is left untouched, so
 *     re-running adds nothing
 *   - additive: it never updates or deletes an existing row
 *   - the venture's own data is never renamed or overwritten
 *
 * Usage:
 *   node scripts/backfill-founder-ledger.mjs            -> dry run (preview)
 *   node scripts/backfill-founder-ledger.mjs --apply     -> execute
 *   npm run backfill:founder-ledger -- --apply
 *
 * The connection comes from DATABASE_URL, or from the env file passed as an
 * argument, or from the application's own .env.local. The connection string is
 * never printed.
 */

const APPLY = process.argv.includes("--apply");
const ENV_FILE_ARG = process.argv.slice(2).find((a) => !a.startsWith("--"));

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
  console.error("\nDATABASE_URL is not set. Pass an env file:\n  node scripts/backfill-founder-ledger.mjs .env.local --apply\n");
  process.exit(1);
}

const { initDb } = await import("../src/lib/db.js");
const { reconcileFounderLedger } = await import("../src/models/ventureFounderLedger.js");

const db = await initDb();

console.log("\n=== BACKFILL — FOUNDER LEDGER ===");
console.log(`  mode: ${APPLY ? "APPLY (writes)" : "DRY RUN (writes nothing)"}\n`);

const report = await reconcileFounderLedger(db, { dryRun: !APPLY }).catch((e) => {
  // A connection problem must not look like a data problem.
  console.error(`\nThe run could not reach the database: ${e?.code || e?.message || e}\n`);
  process.exit(1);
});

console.log(`  ventures examined:  ${report.ventures}`);
console.log(`  founder members:    ${report.examined}`);
console.log(`  already recorded:   ${report.already_recorded}`);
console.log(`  without an email:   ${report.without_email}   (nothing to record them by)`);
console.log(`  ${APPLY ? "records written:   " : "records to write:  "} ${report.added}\n`);

if (report.added_rows.length > 0) {
  for (const row of report.added_rows.slice(0, 50)) {
    console.log(`   ${row.venture_id}  ${row.name || "(no name)"} <${row.email}>  ${row.role}`);
  }
  if (report.added_rows.length > 50) {
    console.log(`   … and ${report.added_rows.length - 50} more`);
  }
  console.log("");
}

if (!APPLY) {
  console.log("Nothing was written. Re-run with --apply to record these founders.\n");
} else {
  console.log("Done. Re-run without --apply to confirm nothing is left to record.\n");
}

process.exit(0);
