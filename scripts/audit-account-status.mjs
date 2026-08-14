/**
 * READ-ONLY account status audit.
 *
 * Reports the true account lifecycle for every contact WITHOUT changing any
 * data, so the team can review the existing Approved vs Active population
 * before deciding whether any records need correction.
 *
 * Run:
 *   node scripts/audit-account-status.mjs
 *
 * It self-heals the additive tracking columns (activated_at, last_login_at,
 * login_count) so the query is safe even before a login has ever happened.
 */

import db, { initDb } from "../src/lib/db.js";

await initDb();

// Idempotent, additive, non-destructive — safe to run repeatedly.
await db.execute("ALTER TABLE contacts ADD COLUMN IF NOT EXISTS activated_at TIMESTAMPTZ");
await db.execute("ALTER TABLE contacts ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ");
await db.execute("ALTER TABLE contacts ADD COLUMN IF NOT EXISTS login_count INTEGER NOT NULL DEFAULT 0");

const result = await db.execute({
  sql: `
    SELECT
      c.cid,
      c.name,
      c.email,
      c.status,
      (c.password IS NOT NULL AND TRIM(c.password) <> '') AS has_password,
      c.activated_at,
      c.invited_at,
      c.last_login_at,
      COALESCE(c.login_count, 0) AS login_count,
      c.archived_at,
      c.deleted,
      c.deleted_at,
      (SELECT COUNT(*) FROM password_setup_tokens t WHERE t.contact_cid = c.cid) AS token_count,
      (SELECT COUNT(*) FROM password_setup_tokens t WHERE t.contact_cid = c.cid AND t.used = 1) AS tokens_used
    FROM contacts c
    ORDER BY c.status, c.name
  `,
  args: [],
});

const rows = result.rows;

function derivedAccountState(r) {
  if (Number(r.deleted) === 1 || r.deleted_at) return "Deleted";
  if (r.archived_at) return "Archived";
  const st = String(r.status || "").toLowerCase();
  if (st === "inactive") return "Inactive";
  if (st === "active") return "Active";
  if (st === "approved") return "Approved (activation pending)";
  if (st === "pending") return "Pending approval";
  return "Pending approval";
}

function derivedLoginState(r) {
  if (r.last_login_at) return `Last login ${new Date(r.last_login_at).toLocaleString()}`;
  if (Number(r.login_count) > 0) return `Logged in ${r.login_count}x (no timestamp)`;
  return "Never logged in";
}

// ── Summary by raw status ──
const byStatus = {};
for (const r of rows) {
  const key = String(r.status || "(null)").toLowerCase();
  byStatus[key] = (byStatus[key] || 0) + 1;
}

console.log("\n===== ACCOUNT STATUS AUDIT (read-only) =====\n");
console.log("Summary by raw contacts.status:");
for (const [k, v] of Object.entries(byStatus).sort()) {
  console.log(`  ${k.padEnd(16)} ${v}`);
}
console.log(`  ${"TOTAL".padEnd(16)} ${rows.length}`);

console.log("\n===== DETAIL =====");
console.log(
  [
    "cid",
    "name",
    "email",
    "status",
    "has_pw",
    "tokens",
    "used",
    "activated_at",
    "last_login_at",
    "login_count",
    "derived_state",
    "derived_login",
  ].join("\t")
);

for (const r of rows) {
  console.log(
    [
      r.cid || "",
      (r.name || "").replace(/\t/g, " "),
      r.email || "",
      r.status || "",
      r.has_password ? "yes" : "no",
      r.token_count ?? 0,
      r.tokens_used ?? 0,
      r.activated_at ? new Date(r.activated_at).toISOString() : "",
      r.last_login_at ? new Date(r.last_login_at).toISOString() : "",
      r.login_count ?? 0,
      derivedAccountState(r),
      derivedLoginState(r),
    ].join("\t")
  );
}

console.log("\nDone. No data was modified.");
process.exit(0);
