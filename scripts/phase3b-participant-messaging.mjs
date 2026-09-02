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

const readUrl = (f) =>
  readFileSync(f, "utf-8")
    .split("\n")
    .find((l) => l.startsWith("DATABASE_URL="))
    ?.substring("DATABASE_URL=".length)
    .trim();

const ENVS = [
  { label: "PROD", url: readUrl(".env.local") },
  { label: "STAGE", url: readUrl(".env.audit-staging") },
];

for (const env of ENVS) {
  const pool = new pg.Pool({ connectionString: env.url, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 10000 });
  console.log(`\n=== ${env.label} ===`);

  const prof = await pool.query("SELECT id FROM access_profiles WHERE name = 'Participant Default'");
  const id = prof.rows[0]?.id;
  if (!id) {
    console.log("  Participant Default not found — skipped");
    await pool.end();
    continue;
  }

  for (const cap of ["view", "send"]) {
    const r = await pool.query(
      "DELETE FROM access_profile_capabilities WHERE profile_id = $1 AND module = 'messaging' AND capability = $2",
      [id, cap],
    );
    console.log(`  participant messaging.${cap}: ${r.rowCount} row(s) removed`);
  }

  const fin = await pool.query(
    "SELECT module, capability, access_level FROM access_profile_capabilities WHERE profile_id = $1 ORDER BY module, capability",
    [id],
  );
  console.log("  Participant Default now:", JSON.stringify(fin.rows));

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
