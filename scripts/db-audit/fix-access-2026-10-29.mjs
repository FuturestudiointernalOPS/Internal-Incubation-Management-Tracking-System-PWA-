/**
 * Access corrections from the 2026-10-29 audit of the People screen.
 *
 *   node scripts/db-audit/fix-access-2026-10-29.mjs           # SIMULATION: runs, reports, rolls back
 *   node scripts/db-audit/fix-access-2026-10-29.mjs --apply   # commits
 *
 * One transaction. Every write is guarded by the exact value the audit found and
 * checked by row count; each change is recorded in permission_audit_log. Anything
 * unexpected rolls everything back. Reads DATABASE_URL from .env.local.
 *
 *  1. Alexis ASSOGBA and Christelle FAGBEHOURO (epitech): role applicant → member
 *     (their active learner/participant/facilitator/investor profiles need member).
 *  2. Christelle: remove her 13 expired direct facilitator grants.
 *  3. Chris (founder): remove the direct messaging.send/view=3 and ventures.view=1
 *     grants — above / duplicating the founder profile, which applies on its own.
 *
 * NOT touched (decisions for you): the duplicate Christelle (aert.com), Alexis
 * (inactive), Aïchath's lms.create grant, Chris's messaging.delete=4 (it comes
 * from the founder profile itself).
 */
import { readFileSync } from "node:fs";
import pg from "pg";

const APPLY = process.argv.includes("--apply");
const url = readFileSync(".env.local", "utf-8")
  .split("\n").find((l) => l.startsWith("DATABASE_URL="))?.substring("DATABASE_URL=".length).trim();
const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });

const ACTOR = ["system", "Access audit 2026-10-29 (requested by chris-mael)"];
const audit = (c, target, name, action, module, capability, prev, next, details) =>
  c.query(
    `INSERT INTO permission_audit_log (actor_cid, actor_name, target_cid, target_name, action, module, capability, previous_value, new_value, details)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [...ACTOR, target, name, action, module, capability, prev, next, details],
  );
const expectRows = (label, result, count) => {
  if (result.rowCount !== count) throw new Error(`${label}: expected ${count} row(s), got ${result.rowCount} — rolling back`);
  console.log(`ok  ${label}: ${result.rowCount}`);
};

await client.connect();
try {
  await client.query("BEGIN");

  // 1. applicants that already hold an active relationship → baseline role `member`
  for (const [cid, name] of [
    ["alexisassogba53@gmail.com", "Alexis ASSOGBA"],
    ["christelle.fagbehouro@epitech.eu", "Christelle FAGBEHOURO"],
  ]) {
    const r = await client.query("UPDATE contacts SET role='member' WHERE cid=$1 AND role='applicant'", [cid]);
    expectRows(`role applicant→member ${cid}`, r, 1);
    await audit(client, cid, name, "role_changed", null, null, "applicant", "member", "Aligned on the baseline identity: active context profiles require member");
  }

  // 2. Christelle (epitech): the expired direct facilitator grants
  const expired = await client.query(
    "DELETE FROM user_capabilities WHERE user_cid=$1 AND expires_at IS NOT NULL AND expires_at < NOW() RETURNING module, capability",
    ["christelle.fagbehouro@epitech.eu"],
  );
  expectRows("expired direct grants removed (christelle)", expired, 13);
  await audit(client, "christelle.fagbehouro@epitech.eu", "Christelle FAGBEHOURO", "revoked", "facilitator", "*", "13 expired grants", null, "Expired 2026-10-29 — cleaned up");

  // 3. Chris (founder): direct grants above / duplicating the founder profile
  const chris = await client.query(
    `DELETE FROM user_capabilities WHERE user_cid=$1 AND (
        (module='messaging' AND capability IN ('send','view') AND access_level=3)
     OR (module='ventures' AND capability='view' AND access_level=1)) RETURNING module, capability, access_level`,
    ["USR_CHZJSXKY"],
  );
  expectRows("direct grants removed (chris)", chris, 3);
  for (const row of chris.rows) {
    await audit(client, "USR_CHZJSXKY", "Chris", "revoked", row.module, row.capability, String(row.access_level), null, "Direct grant above/duplicating the founder profile — the profile applies");
  }

  if (APPLY) {
    await client.query("COMMIT");
    console.log("COMMITTED");
  } else {
    await client.query("ROLLBACK");
    console.log("SIMULATION ONLY — everything above was rolled back. Re-run with --apply to commit.");
  }
} catch (error) {
  await client.query("ROLLBACK");
  console.error("ROLLED BACK:", error.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
