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
let databaseUrl = null;
for (const envFile of files) {
  try {
    const candidateUrl = readFileSync(envFile, "utf-8").split("\n").find((envLine) => envLine.startsWith("DATABASE_URL="))?.substring("DATABASE_URL=".length).trim();
    if (candidateUrl) { databaseUrl = candidateUrl; break; }
  } catch { /* next */ }
}
if (!databaseUrl) { console.error("NO STAGING URL"); process.exit(1); }
const APPLY = process.argv.includes("--apply");
const VERIFY = process.argv.includes("--verify");
const pool = new pg.Pool({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 10000 });
console.log("DB HOST:", new URL(databaseUrl).host);

// Documented contextual → member map (identity migration map §B). Staff-family
// and baseline roles are excluded above all: never touched.
const CONTEXTUAL_TO_MEMBER = ["participant", "founder", "facilitator", "investor", "teacher", "team"];

const timestamp = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 19);
const ensureScratchDir = () => { try { mkdirSync("scratch", { recursive: true }); } catch {} };

try {
  ensureScratchDir();
  const candidatesResult = await pool.query(
    `SELECT cid, name, email, role, status, group_name, created_at
     FROM contacts
     WHERE role = ANY($1)
     ORDER BY role, name`,
    [CONTEXTUAL_TO_MEMBER],
  );

  if (!APPLY && !VERIFY) {
    // ── INVENTORY mode (default, read-only) ─────────────────────
    const beforeFile = `scratch/i6d-before-${timestamp}.json`;
    writeFileSync(beforeFile, JSON.stringify({ exportedAt: new Date().toISOString(), candidates: candidatesResult.rows }, null, 2));
    console.log(`candidates: ${candidatesResult.rowCount} contextual-role rows`);
    for (const candidate of candidatesResult.rows) console.log(`  [${candidate.role}] ${candidate.cid}  ${candidate.name} <${candidate.email}> (${candidate.status || "?"})`);
    if (candidatesResult.rowCount > 0) {
      console.log("\nwould run:");
      console.log(`  UPDATE contacts SET role = 'member' WHERE role IN (${CONTEXTUAL_TO_MEMBER.map((role) => `'${role}'`).join(", ")});`);
      console.log("  (only the role column; sessions re-derive at next login)");
    }
    console.log("before-image:", beforeFile);
    console.log('apply with: node scripts/i6d-legacy-backfill.mjs --apply');
    await pool.end();
    process.exit(candidatesResult.rowCount === 0 ? 0 : 2); // 2 = actionable inventory
  }

  if (APPLY) {
    // ── APPLY mode ──────────────────────────────────────────
    const beforeFile = `scratch/i6d-before-${timestamp}.json`;
    writeFileSync(beforeFile, JSON.stringify({ exportedAt: new Date().toISOString(), candidates: candidatesResult.rows }, null, 2));
    const rollbackFile = `scratch/i6d-rollback-${timestamp}.sql`;
    const rollback = candidatesResult.rows
      .map((candidate) => `UPDATE contacts SET role = '${candidate.role}' WHERE cid = '${candidate.cid.replace(/'/g, "''")}';`)
      .join("\n");
    writeFileSync(rollbackFile, `-- I6D rollback ${timestamp}\nBEGIN;\n${rollback}\nCOMMIT;\n`);
    console.log("before-image:", beforeFile);
    console.log("rollback file:", rollbackFile);

    const updateResult = await pool.query(
      `UPDATE contacts SET role = 'member' WHERE cid = ANY($1) RETURNING cid, role`,
      [candidatesResult.rows.map((candidate) => candidate.cid)],
    );
    const auditFile = `scratch/i6d-applied-${timestamp}.json`;
    writeFileSync(auditFile, JSON.stringify({ appliedAt: new Date().toISOString(), count: updateResult.rowCount, before: beforeFile, rollback: rollbackFile }, null, 2));
    console.log(`applied: ${updateResult.rowCount} row(s) reclassified to member (audit: ${auditFile})`);
  }

  if (VERIFY || APPLY) {
    // ── POST-STATE check ──────────────────────────────────
    const remainingResult = await pool.query(
      `SELECT role, COUNT(*) AS n FROM contacts WHERE role = ANY($1) GROUP BY role ORDER BY role`,
      [CONTEXTUAL_TO_MEMBER],
    );
    console.log(`\nremaining contextual roles: ${remainingResult.rowCount === 0 ? "0 ✅" : remainingResult.rows.map((remaining) => `${remaining.role}×${remaining.n}`).join(", ")}`);
    // Context resolution for the backfilled contacts — memberships must be
    // untouched and their legacy-role derivation must still resolve.
    const contextRows = await pool.query(
      `SELECT c.cid, c.role,
              (SELECT COUNT(*) FROM participant_programs pp
                WHERE pp.participant_id = c.cid AND (pp.status IS NULL OR pp.status = 'active')) AS programs,
              (SELECT COUNT(*) FROM v2_program_staff ps
                WHERE ps.staff_id = c.cid) AS staff_rows,
              (SELECT COUNT(*) FROM venture_members vm
                WHERE vm.contact_id = c.cid AND vm.removed_at IS NULL AND vm.member_type = 'founder') AS ventures
       FROM contacts c
       WHERE c.cid = ANY($1) ORDER BY c.cid`,
      [candidatesResult.rows.map((candidate) => candidate.cid)],
    );
    for (const contact of contextRows.rows) {
      const derived = contact.programs > 0 ? "participant" : contact.ventures > 0 ? "founder" : contact.role;
      console.log(`  ${contact.cid}: role=${contact.role} | programs=${contact.programs} staff=${contact.staff_rows} ventures=${contact.ventures} → derived legacy role: ${derived}`);
    }
  }
} finally {
  await pool.end();
}
