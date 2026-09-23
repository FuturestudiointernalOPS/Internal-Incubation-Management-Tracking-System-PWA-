/**
 * Phase 3b — Participant messaging scope (Item 2 of the pending register).
 * Participants are NOT eligible for messaging (feature_eligibility has no
 * participant row; internal-comms is resolver-gated). The profile rows were
 * inert dead config — remove them so the configuration matches the matrix
 * (Participant messaging default = 0 / not available).
 * PROD + STAGE, idempotent, audited in PROD.
 */
import { readFileSync } from "node:fs";
import pg from "pg";

const readDatabaseUrl = (file) =>
  readFileSync(file, "utf-8")
    .split("\n")
    .find((envLine) => envLine.startsWith("DATABASE_URL="))
    ?.substring("DATABASE_URL=".length)
    .trim();

const ENVS = [
  { label: "PROD", url: readDatabaseUrl(".env.local") },
  { label: "STAGE", url: readDatabaseUrl(".env.audit-staging") },
];

for (const env of ENVS) {
  const pool = new pg.Pool({ connectionString: env.url, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 10000 });
  console.log(`\n=== ${env.label} ===`);

  const profileResult = await pool.query("SELECT id FROM access_profiles WHERE name = 'Participant Default'");
  const profileId = profileResult.rows[0]?.id;
  if (!profileId) {
    console.log("  Participant Default not found — skipped");
    await pool.end();
    continue;
  }

  for (const capability of ["view", "send"]) {
    const deleteResult = await pool.query(
      "DELETE FROM access_profile_capabilities WHERE profile_id = $1 AND module = 'messaging' AND capability = $2",
      [profileId, capability],
    );
    console.log(`  participant messaging.${capability}: ${deleteResult.rowCount} row(s) removed`);
  }

  const finalCapabilities = await pool.query(
    "SELECT module, capability, access_level FROM access_profile_capabilities WHERE profile_id = $1 ORDER BY module, capability",
    [profileId],
  );
  console.log("  Participant Default now:", JSON.stringify(finalCapabilities.rows));

  if (env.label === "PROD") {
    await pool.query(
      `INSERT INTO permission_audit_log (actor_cid, actor_name, target_cid, target_name, action, details)
       VALUES ('system','system','system','system','profile_updated',
               'Phase 3b: removed messaging.view/send from Participant Default (participants are not eligible for global messaging; matrix default = 0).')`,
    );
    console.log("  audit entry recorded");
  }

  await pool.end();
}
console.log("\n[done] Participant messaging cleanup complete");
