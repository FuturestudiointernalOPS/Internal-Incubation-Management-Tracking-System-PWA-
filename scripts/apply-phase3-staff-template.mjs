// PHASE 3 — apply the approved Staff Default template (Option B, 11 caps).
// READ-ONLY unless --apply is passed. Idempotent — safe to re-run.
//
// Usage:
//   node scripts/apply-phase3-staff-template.mjs            # dry-run (default)
//   node scripts/apply-phase3-staff-template.mjs --apply    # apply the trim
//   node scripts/apply-phase3-staff-template.mjs --record-migrations  # pre-record
//                        the one-time cap-backfill migration names so the
//                        guarded code never re-adds removed caps (even on its
//                        first boot after deploy)
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";

const MODE = process.argv.includes("--apply") ? "apply" : process.argv.includes("--record-migrations") ? "record" : "dry";

// The 15 capabilities removed from Staff Default under Option B.
// KEEP (11): messaging.view/send, reports.create, tasks.*, knowledge.*
const REMOVE = [
  ["contacts", "view"],
  ["internal_comms", "create_announcements"],
  ["internal_comms", "moderate"],
  ["investor", "view"],
  ["investor", "create"],
  ["investor", "edit"],
  ["programs", "view"],
  ["programs", "edit"],
  ["projects", "view"],
  ["projects", "create"],
  ["projects", "edit"],
  ["projects", "delete"],
  ["reports", "view"],
  ["reports", "export"],
  ["ventures", "create"],
];

// One-time migration names added in backfill.js for the previously
// every-boot capability backfills.
const BACKFILL_MIGRATIONS = [
  "cap-backfill-knowledge",
  "cap-backfill-reports",
  "cap-backfill-announcements",
  "cap-backfill-projects",
  "cap-backfill-tasks",
  "cap-backfill-engineering",
  "cap-backfill-programs",
  "cap-backfill-ventures",
  "cap-backfill-investor",
];

const readUrl = (file) => {
  try {
    for (const line of readFileSync(resolve(process.cwd(), file), "utf-8").split("\n")) {
      if (line.startsWith("DATABASE_URL=")) return line.substring("DATABASE_URL=".length).trim();
    }
  } catch {}
  return null;
};

let pool = null;
for (const file of [".env.local", ".env.prod-verify", ".env.audit-staging"]) {
  const url = readUrl(file);
  if (!url) continue;
  try {
    const p = new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 12000 });
    await p.query("SELECT 1");
    console.log(`[phase3] connected via ${file}`);
    pool = p;
    break;
  } catch {}
}
if (!pool) {
  console.error("No working connection");
  process.exit(2);
}

try {
  const prof = await pool.query("SELECT id, name FROM access_profiles WHERE name = 'Staff Default' AND is_active = 1");
  if (prof.rows.length === 0) {
    console.error("Staff Default profile not found");
    process.exit(3);
  }
  const profileId = prof.rows[0].id;

  const before = await pool.query(
    "SELECT module, capability, access_level FROM access_profile_capabilities WHERE profile_id = $1 ORDER BY module, capability",
    [profileId]
  );
  console.log(`\n[phase3] profile #${profileId} (Staff Default) — current caps: ${before.rows.length}`);
  const beforeSet = new Set(before.rows.map((r) => `${r.module}.${r.capability}`));
  for (const r of before.rows) console.log(`  ${r.module}.${r.capability} = ${r.access_level}`);

  const present = REMOVE.filter(([m, c]) => beforeSet.has(`${m}.${c}`));
  const absent = REMOVE.filter(([m, c]) => !beforeSet.has(`${m}.${c}`));
  console.log(`\n[phase3] to remove: ${present.length} (already absent: ${absent.length})`);
  for (const [m, c] of present) console.log(`  - ${m}.${c}`);
  for (const [m, c] of absent) console.log(`  (skip, absent) ${m}.${c}`);

  if (MODE === "dry") {
    console.log("\n[phase3] DRY-RUN — no changes. Re-run with --apply to remove the rows above.");
  } else if (MODE === "apply") {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      // Simple per-pair deletes (the pooler rejects multi-row VALUES with
      // many placeholders).
      let deleted = 0;
      for (const [module, capability] of REMOVE) {
        const del = await client.query(
          "DELETE FROM access_profile_capabilities WHERE profile_id = $1 AND module = $2 AND capability = $3",
          [profileId, module, capability]
        );
        deleted += del.rowCount;
      }
      await client.query("COMMIT");
      console.log(`\n[phase3] APPLIED — deleted ${deleted} capability row(s) from Staff Default.`);
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  } else if (MODE === "record") {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      let inserted = 0;
      for (const name of BACKFILL_MIGRATIONS) {
        const r = await client.query("INSERT INTO authz_migrations (name) VALUES ($1) ON CONFLICT (name) DO NOTHING", [name]);
        if (r.rowCount > 0) inserted++;
      }
      await client.query("COMMIT");
      console.log(`\n[phase3] RECORDED ${inserted} migration name(s) — the guarded backfills will skip on every boot from now on.`);
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }

  const after = await pool.query(
    "SELECT module, capability, access_level FROM access_profile_capabilities WHERE profile_id = $1 ORDER BY module, capability",
    [profileId]
  );
  console.log(`\n[phase3] expected final caps: ${after.rows.length} (11 = Option B)`);
} catch (e) {
  console.error(`[phase3] ERROR: ${e.message}`);
  process.exit(1);
} finally {
  await pool.end();
}
