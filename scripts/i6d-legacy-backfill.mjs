/**
 * PHASE I6D — Legacy contextual-role backfill (STAGING, before-imaged, rollback-ready).
 *
 * Reclassifies legacy stored contextual values in contacts.role to the
 * member baseline, per decision D3 executed only after the I6C zero-
 * dependency proof. Only roles on the documented contextual map are touched:
 *
 *   participant | founder | facilitator | investor | teacher | team  →  member
 *
 * super_admin / staff / member (baselines) and developer / program_manager /
 * admin (staff-family profiles) are NEVER touched by this tool.
 *
 * Modes:
 *   node scripts/i6d-legacy-backfill.mjs             # inventory + before-image (no writes)
 *   node scripts/i6d-legacy-backfill.mjs --apply     # perform the backfill
 *   node scripts/i6d-legacy-backfill.mjs --verify    # post-state + context resolution check
 *
 * Outputs (scratch/): before-image JSON, per-row rollback SQL, audit of what
 * changed. Nothing is deleted — only the single role column is reclassified.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import pg from "pg";

const files = [".env.audit-staging", ".env.staging"];
let url = null;
for (const f of files) {
  try {
    const u = readFileSync(f, "utf-8").split("\n").find((l) => l.startsWith("DATABASE_URL="))?.substring("DATABASE_URL=".length).trim();
    if (u) { url = u; break; }
  } catch { /* next */ }
}
if (!url) { console.error("NO STAGING URL"); process.exit(1); }
const APPLY = process.argv.includes("--apply");
const VERIFY = process.argv.includes("--verify");
const pool = new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 10000 });
console.log("DB HOST:", new URL(url).host);

// Documented contextual → member map (identity migration map §B). Staff-family
// and baseline roles are excluded above all: never touched.
const CONTEXTUAL_TO_MEMBER = ["participant", "founder", "facilitator", "investor", "teacher", "team"];

const stamp = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 19);
const mk = () => { try { mkdirSync("scratch", { recursive: true }); } catch {} };

try {
  mk();
  const cand = await pool.query(
    `SELECT cid, name, email, role, status, group_name, created_at
     FROM contacts
     WHERE role = ANY($1)
     ORDER BY role, name`,
    [CONTEXTUAL_TO_MEMBER],
  );

  if (!APPLY && !VERIFY) {
    // ── INVENTORY mode (default, read-only) ────────────────────────────────
    const beforeFile = `scratch/i6d-before-${stamp}.json`;
    writeFileSync(beforeFile, JSON.stringify({ exportedAt: new Date().toISOString(), candidates: cand.rows }, null, 2));
    console.log(`candidates: ${cand.rowCount} contextual-role rows`);
    for (const r of cand.rows) console.log(`  [${r.role}] ${r.cid}  ${r.name} <${r.email}> (${r.status || "?"})`);
    if (cand.rowCount > 0) {
      const ph = cand.rows.map((_, i) => `$${i + 1}`).join(",");
      console.log("\nwould run:");
      console.log(`  UPDATE contacts SET role = 'member' WHERE role IN (${CONTEXTUAL_TO_MEMBER.map((r) => `'${r}'`).join(", ")});`);
      console.log("  (only the role column; sessions re-derive at next login)");
    }
    console.log("before-image:", beforeFile);
    console.log('apply with: node scripts/i6d-legacy-backfill.mjs --apply');
    await pool.end();
    process.exit(cand.rowCount === 0 ? 0 : 2); // 2 = actionable inventory
  }

  if (APPLY) {
    // ── APPLY mode ─────────────────────────────────────────────────────────
    const beforeFile = `scratch/i6d-before-${stamp}.json`;
    writeFileSync(beforeFile, JSON.stringify({ exportedAt: new Date().toISOString(), candidates: cand.rows }, null, 2));
    const rollbackFile = `scratch/i6d-rollback-${stamp}.sql`;
    const rollback = cand.rows
      .map((r) => `UPDATE contacts SET role = '${r.role}' WHERE cid = '${r.cid.replace(/'/g, "''")}';`)
      .join("\n");
    writeFileSync(rollbackFile, `-- I6D rollback ${stamp}\nBEGIN;\n${rollback}\nCOMMIT;\n`);
    console.log("before-image:", beforeFile);
    console.log("rollback file:", rollbackFile);

    const res = await pool.query(
      `UPDATE contacts SET role = 'member' WHERE cid = ANY($1) RETURNING cid, role`,
      [cand.rows.map((r) => r.cid)],
    );
    const audit = `scratch/i6d-applied-${stamp}.json`;
    writeFileSync(audit, JSON.stringify({ appliedAt: new Date().toISOString(), count: res.rowCount, before: beforeFile, rollback: rollbackFile }, null, 2));
    console.log(`applied: ${res.rowCount} row(s) reclassified to member (audit: ${audit})`);
  }

  if (VERIFY || APPLY) {
    // ── POST-STATE check ───────────────────────────────────────────────────
    const left = await pool.query(
      `SELECT role, COUNT(*) AS n FROM contacts WHERE role = ANY($1) GROUP BY role ORDER BY role`,
      [CONTEXTUAL_TO_MEMBER],
    );
    console.log(`\nremaining contextual roles: ${left.rowCount === 0 ? "0 ✅" : left.rows.map((r) => `${r.role}×${r.n}`).join(", ")}`);
    // Context resolution for the backfilled contacts — memberships must be
    // untouched and their legacy-role derivation must still resolve.
    const ctx = await pool.query(
      `SELECT c.cid, c.role,
              (SELECT COUNT(*) FROM participant_programs pp
                WHERE pp.participant_id = c.cid AND (pp.status IS NULL OR pp.status = 'active')) AS programs,
              (SELECT COUNT(*) FROM v2_program_staff ps
                WHERE ps.staff_id = c.cid) AS staff_rows,
              (SELECT COUNT(*) FROM venture_members vm
                WHERE vm.contact_id = c.cid AND vm.removed_at IS NULL AND vm.member_type = 'founder') AS ventures
       FROM contacts c
       WHERE c.cid = ANY($1) ORDER BY c.cid`,
      [cand.rows.map((r) => r.cid)],
    );
    for (const r of ctx.rows) {
      const derived = r.programs > 0 ? "participant" : r.ventures > 0 ? "founder" : r.role;
      console.log(`  ${r.cid}: role=${r.role} | programs=${r.programs} staff=${r.staff_rows} ventures=${r.ventures} → derived legacy role: ${derived}`);
    }
  }
} finally {
  await pool.end();
}
