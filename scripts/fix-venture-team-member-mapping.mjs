/**
 * Correct the venture context-role → profile mapping.
 *
 * `context_role_profiles` is what `syncContextGrantsForUser` materialises a
 * Venture person's capabilities from. Production has:
 *
 *   venture : founder      → 15 "Founder"          ✓ correct
 *   venture : team_member  → 15 "Founder"          ✗ wrong (grants view + EDIT)
 *
 * The code's own seed (`CONTEXT_ROLE_SEED`) maps `venture:team_member` to
 * `"Venture Member"` (ventures.view only; `venture_own` scope limits them to the
 * Venture they were added to). The seed uses ON CONFLICT DO NOTHING and the
 * backfill only fills NULLs on purpose — so a wrong non-NULL row has to be
 * corrected deliberately, which is what this does.
 *
 *   node scripts/fix-venture-team-member-mapping.mjs            # dry run
 *   node scripts/fix-venture-team-member-mapping.mjs --apply
 *   node scripts/fix-venture-team-member-mapping.mjs --apply --env=staging
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import pg from "pg";

const APPLY = process.argv.includes("--apply");
const ENV_KEY = (process.argv.find((a) => a.startsWith("--env=")) || "").split("=")[1] || "production";
const ENV_FILE = ENV_KEY === "staging" ? ".env.audit-staging" : ".env.local";

const readUrl = (f) =>
  readFileSync(f, "utf-8")
    .split("\n")
    .find((l) => l.startsWith("DATABASE_URL="))
    ?.substring("DATABASE_URL=".length)
    .trim();

const pool = new pg.Pool({
  connectionString: readUrl(ENV_FILE),
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
});
const q = (sql, args = []) => pool.query(sql, args);

console.log(`[team-member-mapping] env=${ENV_KEY} (${ENV_FILE}) mode=${APPLY ? "APPLY" : "DRY RUN"}\n`);

const rows = (
  await q(
    `SELECT crp.context, crp.role_key, crp.profile_id, ap.name AS profile_name,
            crp.is_active, crp.notes
       FROM context_role_profiles crp
       LEFT JOIN access_profiles ap ON ap.id = crp.profile_id
      WHERE crp.context = 'venture' ORDER BY crp.role_key`,
  )
).rows;
console.log("current venture mappings:");
for (const r of rows) console.log(`  ${r.role_key} → ${r.profile_id} "${r.profile_name}" (active=${r.is_active})`);

const target = (
  await q(`SELECT id, name, is_active FROM access_profiles WHERE name = 'Venture Member'`)
).rows[0];
const founderProfile = (
  await q(`SELECT id FROM access_profiles WHERE name = 'Founder'`)
).rows[0];

const wrong = rows.filter(
  (r) => r.role_key === "team_member" && founderProfile && r.profile_id === founderProfile.id,
);

console.log(`\n"Venture Member" profile: ${target ? `${target.id} (active=${target.is_active})` : "MISSING"}`);
if (target) {
  const caps = (
    await q(`SELECT module, capability, access_level FROM access_profile_capabilities WHERE profile_id = $1 ORDER BY module, capability`, [target.id])
  ).rows;
  console.log("its capabilities:", JSON.stringify(caps));
}
console.log(`\nrows to correct: ${wrong.length}`);
for (const r of wrong) console.log(`  ${r.role_key}: ${r.profile_id} "${r.profile_name}" → ${target?.id} "Venture Member"`);

// Anyone who already holds the Grants: team members whose grants came from the wrong profile.
const affected = (
  await q(
    `SELECT COUNT(DISTINCT contact_id)::int AS people FROM venture_members
      WHERE member_type = 'team_member' AND removed_at IS NULL`,
  )
).rows[0].people;
console.log(`\nexisting active team members whose grants would need a re-sync: ${affected}`);

if (!target) {
  console.log("\nABORT: the 'Venture Member' profile does not exist in this database.");
  await pool.end();
  process.exit(1);
}

if (!APPLY) {
  console.log("\n[dry run] nothing written. Re-run with --apply to execute.");
  await pool.end();
  process.exit(0);
}

try {
  mkdirSync("scratch", { recursive: true });
  const path = `scratch/team-member-mapping-before-image-${ENV_KEY}.json`;
  writeFileSync(path, JSON.stringify({ env: ENV_KEY, capturedAt: new Date().toISOString(), rows }, null, 2));
  console.log(`\nbefore-image → ${path}`);
} catch (e) {
  console.log(`\nbefore-image failed: ${e.message}`);
}

await q("BEGIN");
try {
  const res = await q(
    `UPDATE context_role_profiles
        SET profile_id = $1,
            notes = $2,
            updated_at = NOW()
      WHERE context = 'venture' AND role_key = 'team_member'`,
    [
      target.id,
      "Team members are members first (venture_members row), then given a team role — the Venture Member profile carries ventures.view; venture_own scope limits them to the Venture they were added to.",
    ],
  );
  await q(
    `INSERT INTO permission_audit_log (actor_cid, actor_name, target_cid, target_name, action, details)
     VALUES ('system','system','system','system','profile_updated',$1)`,
    [
      `Venture context mapping corrected (${ENV_KEY}): venture:team_member now resolves to the "Venture Member" profile (${target.id}, ventures.view) instead of "Founder" — team members could previously edit the Venture.`,
    ],
  );
  await q("COMMIT");
  console.log(`\napplied: ${res.rowCount} mapping row(s) corrected.`);
} catch (e) {
  await q("ROLLBACK");
  console.error(`\nFAILED (rolled back): ${e.message}`);
  await pool.end();
  process.exit(1);
}

const after = (
  await q(
    `SELECT crp.role_key, crp.profile_id, ap.name FROM context_role_profiles crp
      LEFT JOIN access_profiles ap ON ap.id = crp.profile_id
      WHERE crp.context='venture' ORDER BY crp.role_key`,
  )
).rows;
console.log("\nventure mappings now:");
for (const r of after) console.log(`  ${r.role_key} → ${r.profile_id} "${r.name}"`);

await pool.end();
console.log("\n[done]");
