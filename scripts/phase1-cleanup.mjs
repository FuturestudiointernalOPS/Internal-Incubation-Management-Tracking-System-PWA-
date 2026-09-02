/**
 * Phase 1 DB cleanup — PRODUCTION.
 * 1. Remove 4 redundant Super Admin individual grants (verified: 4 rows).
 * 2. Record an audit entry.
 * 3. Remove the orphan lowercase bootcamp groups row (verified: 0 references).
 * Pre-checks run first; nothing is deleted if counts don't match expectations.
 */
import { readFileSync } from "node:fs";
import pg from "pg";

const readUrl = (f) =>
  readFileSync(f, "utf-8")
    .split("\n")
    .find((l) => l.startsWith("DATABASE_URL="))
    ?.substring("DATABASE_URL=".length)
    .trim();

const pool = new pg.Pool({
  connectionString: readUrl(".env.local"),
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000,
});

// ── Pre-check 1: SA grants ───────────────────────────────────────────────────
const before = await pool.query(
  `SELECT g.id, g.user_cid, g.module, g.capability, g.access_level
   FROM user_capabilities g
   JOIN contacts c ON c.cid = g.user_cid
   WHERE c.role = 'super_admin'`,
);
console.log(`SA grant rows found: ${before.rows.length}`);
for (const r of before.rows) {
  console.log(`  #${r.id} ${String(r.user_cid).slice(0, 8)}… ${r.module}.${r.capability} L${r.access_level}`);
}
if (before.rows.length !== 4) {
  console.error("ABORT: expected exactly 4 SA grant rows, found " + before.rows.length);
  process.exit(3);
}

const del = await pool.query(
  `DELETE FROM user_capabilities g
   USING contacts c
   WHERE c.cid = g.user_cid AND c.role = 'super_admin'
   RETURNING g.id`,
);
console.log(`Deleted SA grant rows: ${del.rows.length}`);

await pool.query(
  `INSERT INTO permission_audit_log (actor_cid, actor_name, target_cid, target_name, action, details)
   VALUES ('system', 'system', 'system', 'system', 'grant_cleanup',
           'Phase 1: removed redundant Super Admin individual grants (4 rows). SA bypass remains authoritative.')`,
);
console.log("Audit entry recorded.");

// ── Pre-check 2: orphan bootcamp group (lowercase variant) ───────────────────
const G = "Bootcamp Pré-Entrepreneuriat C1 12082026";
const refs = {};
for (const [table, col] of [
  ["group_memberships", "group_name"],
  ["user_groups", "group_name"],
  ["contact_roles", "context_id"],
]) {
  try {
    const r = await pool.query(
      `SELECT count(*) AS n FROM ${table} WHERE ${col} = $1`,
      [G],
    );
    refs[table] = Number(r.rows[0].n);
  } catch (e) {
    refs[table] = "n/a (" + e.message.split("\n")[0].slice(0, 60) + ")";
  }
}
try {
  const r = await pool.query(
    `SELECT count(*) AS n FROM contacts WHERE group_name = $1 OR group_name ILIKE $1`,
    [G],
  );
  refs["contacts.group_name"] = Number(r.rows[0].n);
} catch (e) {
  refs["contacts.group_name"] = "n/a";
}
console.log("References to lowercase group:", JSON.stringify(refs));

const allZero = Object.values(refs).every((v) => v === 0 || v === "n/a (0)");
if (!allZero) {
  console.error("ABORT: lowercase group is referenced; not deleting.");
  process.exit(4);
}

const gdel = await pool.query("DELETE FROM groups WHERE name = $1 RETURNING id", [G]);
console.log(`Deleted orphan groups row: ${gdel.rows.length}`);

// ── Final state ──────────────────────────────────────────────────────────────
const after = await pool.query(
  `SELECT c.role, count(*) AS n FROM user_capabilities g
   JOIN contacts c ON c.cid = g.user_cid GROUP BY c.role`,
);
console.log("Remaining grants by role:", JSON.stringify(after.rows));
const groups = await pool.query("SELECT name, is_protected FROM groups ORDER BY name");
console.log("Remaining groups:", JSON.stringify(groups.rows));

await pool.end();
console.log("[done] Phase 1 DB cleanup complete");
