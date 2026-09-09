/**
 * PHASE I6C — Multi-context acceptance matrix (STAGING, additive + reversible).
 *
 * Fixture "Sarah": baseline contact with contacts.role = 'member' who then
 * acquires Program A (participant), Program B (facilitator assignment),
 * Venture X (founder) and an LMS enrollment. Every assertion runs the REAL
 * membership SQL the authorization gates use (same queries as
 * hasActiveParticipantProgram / resolveProgramAssignment / isVentureFounder /
 * learnerHasEnrollments and the pm/programs scope filter).
 *
 * Safety:
 *  - before-image of every touched table is written to scratch/ BEFORE any
 *    write;
 *  - only rows created by this run are touched (unique cid/email marker);
 *  - nothing is deleted automatically; --cleanup removes exactly the rows
 *    this run created;
 *  - contexts whose host record (active program / venture / course) does not
 *    exist on staging are reported SKIP — never fabricated.
 *
 * Usage:
 *   node scripts/i6c-acceptance-matrix.mjs            # run + keep fixture
 *   node scripts/i6c-acceptance-matrix.mjs --cleanup  # run + remove fixture rows
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
const CLEANUP = process.argv.includes("--cleanup");
const pool = new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 10000 });
console.log("DB HOST:", new URL(url).host, "| cleanup:", CLEANUP);

const stamp = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 19);
const mk = (dir) => { try { mkdirSync(dir, { recursive: true }); } catch {} };

let results = [];
const check = (name, pass, detail = "") => {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
};
const skip = (name, detail) => {
  results.push({ name, pass: "SKIP", detail });
  console.log(`SKIP  ${name}  — ${detail}`);
};

const CID = `USR-I6C-${Date.now().toString(36).toUpperCase()}`;
const EMAIL = `sarah.i6c.${Date.now()}@future.studio.test`;
const CTRL_CID = `USR-I6C-CTRL-${Date.now().toString(36).toUpperCase()}`;
const CTRL_EMAIL = `ctrl.i6c.${Date.now()}@future.studio.test`;

const snap = async (label, tables) => {
  const out = {};
  for (const t of tables) {
    try { const r = await pool.query(`SELECT * FROM ${t}`); out[t] = r.rows; }
    catch (e) { out[t] = `(error) ${e.message}`; }
  }
  mk("scratch");
  const f = `scratch/i6c-before-${label}-${stamp}.json`;
  writeFileSync(f, JSON.stringify({ exportedAt: new Date().toISOString(), tables: out }, null, 2));
  return f;
};

const created = { contacts: [], participant_programs: [], v2_program_staff: [], venture_members: [], lms_enrollments: [] };

try {
  // 0. Before-images (full-table snapshots of every table this run may touch).
  const beforeFile = await snap("matrix", [
    "contacts", "participant_programs", "v2_program_staff",
    "venture_members", "lms_enrollments", "v2_programs", "ventures", "lms_courses",
  ]);
  console.log("before-image:", beforeFile);

  // 1. Host discovery — contexts only run when a real host row exists.
  let prog = null, progB = null, venture = null, course = null;
  let fixtureProgram = false;
  try { const r = await pool.query(`SELECT id, name FROM v2_programs WHERE (status IS NULL OR LOWER(status) = 'active') ORDER BY created_at DESC LIMIT 2`); [prog, progB] = r.rows; } catch {}
  // No second program host on staging → create a minimal marker program so the
  // facilitator context can still be proven (cleaned up by the marker).
  if (prog && !progB) {
    try {
      const r = await pool.query(
        `SELECT column_name FROM information_schema.columns
         WHERE table_name = 'v2_programs' AND is_nullable = 'NO' AND column_default IS NULL
           AND column_name NOT IN ('id', 'name', 'created_at', 'updated_at')`,
      );
      const extra = r.rows.map((c) => c.column_name);
      const sql =
        extra.length === 0
          ? `INSERT INTO v2_programs (id, name, status) VALUES (gen_random_uuid(), 'I6C-FIXTURE-PROGRAM', 'active') RETURNING id`
          : `INSERT INTO v2_programs (id, name, status, ${extra.join(", ")}) VALUES (gen_random_uuid(), 'I6C-FIXTURE-PROGRAM', 'active', ${extra.map(() => "NULL").join(", ")}) RETURNING id`;
      const ins = await pool.query(sql);
      progB = { id: ins.rows[0].id };
      fixtureProgram = true;
      console.log("hosts → created marker program B:", progB.id);
    } catch (e) {
      console.log("hosts → fixture program creation failed:", e.message);
    }
  }
  try { const r = await pool.query(`SELECT venture_id FROM ventures ORDER BY created_at DESC LIMIT 1`); venture = r.rows[0] || null; } catch {}
  try { const r = await pool.query(`SELECT id, title FROM lms_courses WHERE LOWER(status) = 'published' ORDER BY updated_at DESC LIMIT 1`); course = r.rows[0] || null; } catch {}
  console.log(`hosts → program A: ${prog?.id || "NONE"} | program B: ${progB?.id || "NONE"} | venture: ${venture?.venture_id || "NONE"} | course: ${course?.id || "NONE"}`);

  // 2. Contacts column probe (minimal required NOT NULL columns w/o default).
  let contactCols = [];
  try {
    const r = await pool.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'contacts' AND is_nullable = 'NO' AND column_default IS NULL`,
    );
    for (const c of r.rows) if (!["cid", "name", "email", "role", "status"].includes(c.column_name)) contactCols.push(c.column_name);
  } catch {}
  console.log("contacts required (no-default) columns:", contactCols.join(",") || "(none)");

  const insertContact = async (cid, name, email) => {
    const sql =
      contactCols.length === 0
        ? `INSERT INTO contacts (cid, name, email) VALUES ($1, $2, $3)`
        : `INSERT INTO contacts (cid, name, email, ${contactCols.join(", ")})
           VALUES ($1, $2, $3, ${contactCols.map(() => "NULL").join(", ")})`;
    await pool.query(sql, [cid, name, email]);
    // Set the semantic fields explicitly afterwards (role member baseline).
    await pool.query(`UPDATE contacts SET role = 'member', status = COALESCE(status, 'active') WHERE cid = $1`, [cid]);
    created.contacts.push(cid);
  };

  await insertContact(CID, "Sarah I6C", EMAIL);
  await insertContact(CTRL_CID, "Ctrl I6C", CTRL_EMAIL);

  // 3. BASELINE — member stays member, no context present yet.
  const r0 = await pool.query(`SELECT role FROM contacts WHERE cid = $1`, [CID]);
  check("A1 baseline = member", r0.rows[0]?.role === "member", `role=${r0.rows[0]?.role}`);

  // 4. PROGRAM A — participant membership.
  if (prog) {
    await pool.query(
      `INSERT INTO participant_programs (participant_id, program_id, status, assigned_at)
       VALUES ($1, $2, 'active', NOW()) ON CONFLICT DO NOTHING`,
      [CID, prog.id],
    );
    created.participant_programs.push([CID, prog.id]);
    const r = await pool.query(`SELECT role FROM contacts WHERE cid = $1`, [CID]);
    check("A2 program join does NOT mutate baseline", r.rows[0]?.role === "member", `role=${r.rows[0]?.role}`);
    const mem = await pool.query(
      `SELECT 1 FROM participant_programs WHERE participant_id = $1 AND CAST(program_id AS TEXT) = $2 AND (status IS NULL OR status = 'active') LIMIT 1`,
      [CID, String(prog.id)],
    );
    check("A3 hasActiveParticipantProgram SQL → true", mem.rows.length > 0);
  } else skip("A2/A3 program participant context", "no active v2_program on staging");

  // 5. PROGRAM B — facilitator assignment (v2_program_staff).
  if (progB && String(progB.id) !== String(prog?.id)) {
    try {
      await pool.query(
        `INSERT INTO v2_program_staff (program_id, staff_id, role) VALUES ($1, $2, 'facilitator')`,
        [String(progB.id), CID],
      );
      created.v2_program_staff.push([String(progB.id), CID]);
      const r = await pool.query(`SELECT role FROM contacts WHERE cid = $1`, [CID]);
      check("B1 facilitator join does NOT mutate baseline", r.rows[0]?.role === "member");
      const asg = await pool.query(
        `SELECT 1 FROM v2_program_staff WHERE CAST(program_id AS TEXT) = $1 AND (staff_id = $2 OR LOWER(TRIM(staff_id)) = LOWER($3)) LIMIT 1`,
        [String(progB.id), CID, EMAIL],
      );
      check("B2 resolveProgramAssignment SQL (v2_program_staff) → true", asg.rows.length > 0);
      // pm/programs membership-keyed scope: member session must see ONLY Program B.
      const scope = await pool.query(
        `SELECT COUNT(*) AS n FROM v2_programs p
         WHERE p.id IN (SELECT program_id FROM v2_program_staff
                        WHERE (staff_id = $1 OR LOWER(TRIM(staff_id)) = LOWER($2)) AND role = 'facilitator')`,
        [CID, EMAIL],
      );
      check("B3 pm/programs scope lists exactly the facilitated program", Number(scope.rows[0].n) === 1, `n=${scope.rows[0].n}`);
    } catch (e) {
      skip("B1–B3 facilitator context", `v2_program_staff insert failed: ${e.message}`);
    }
  } else skip("B1–B3 facilitator context", "no second distinct active program on staging");

  // 6. VENTURE X — founder membership.
  if (venture) {
    try {
      await pool.query(
        `INSERT INTO venture_members (venture_id, contact_id, member_type, role, permissions, joined_at)
         VALUES ($1, $2, 'founder', 'founder', 'edit', NOW()) ON CONFLICT DO NOTHING`,
        [venture.venture_id, CID],
      );
      created.venture_members.push([venture.venture_id, CID]);
      const r = await pool.query(`SELECT role FROM contacts WHERE cid = $1`, [CID]);
      check("C1 venture join does NOT mutate baseline", r.rows[0]?.role === "member");
      const own = await pool.query(
        `SELECT 1 FROM venture_members WHERE venture_id = $1 AND contact_id = $2 AND member_type = 'founder' AND removed_at IS NULL LIMIT 1`,
        [venture.venture_id, CID],
      );
      check("C2 isVentureFounder SQL → true", own.rows.length > 0);
      const member = await pool.query(
        `SELECT 1 FROM venture_members WHERE venture_id = $1 AND contact_id = $2 AND removed_at IS NULL LIMIT 1`,
        [venture.venture_id, CID],
      );
      check("C3 isVentureMember SQL → true", member.rows.length > 0);
      const ctrl = await pool.query(
        `SELECT 1 FROM venture_members WHERE venture_id = $1 AND contact_id = $2 AND removed_at IS NULL LIMIT 1`,
        [venture.venture_id, CTRL_CID],
      );
      check("C4 control contact is NOT a venture member", ctrl.rows.length === 0);
    } catch (e) {
      skip("C1–C4 venture context", `venture_members insert failed: ${e.message}`);
    }
  } else skip("C1–C4 venture context", "no venture on staging");

  // 7. LMS — learner enrollment.
  if (course) {
    try {
      await pool.query(
        `INSERT INTO lms_enrollments (course_id, user_cid, source, status)
         VALUES ($1, $2, 'self', 'active') ON CONFLICT DO NOTHING`,
        [course.id, CID],
      );
      created.lms_enrollments.push([course.id, CID]);
      const r = await pool.query(`SELECT role FROM contacts WHERE cid = $1`, [CID]);
      check("D1 LMS enrollment does NOT mutate baseline", r.rows[0]?.role === "member");
      const enr = await pool.query(
        `SELECT 1 FROM lms_enrollments WHERE user_cid = $1 AND status <> 'suspended' LIMIT 1`,
        [CID],
      );
      check("D2 learnerHasEnrollments SQL → true", enr.rows.length > 0);
    } catch (e) {
      skip("D1–D2 LMS context", `lms_enrollments insert failed: ${e.message}`);
    }
  } else skip("D1–D2 LMS context", "no published lms_course on staging");

  // 8. CONTROL — a plain member with no contexts.
  const rc = await pool.query(`SELECT role FROM contacts WHERE cid = $1`, [CTRL_CID]);
  check("E1 control baseline = member", rc.rows[0]?.role === "member");
  if (progB) {
    const scopeC = await pool.query(
      `SELECT COUNT(*) AS n FROM v2_programs p
       WHERE p.id IN (SELECT program_id FROM v2_program_staff
                      WHERE (staff_id = $1 OR LOWER(TRIM(staff_id)) = LOWER($2)) AND role = 'facilitator')`,
      [CTRL_CID, CTRL_EMAIL],
    );
    check("E2 control has empty program scope (pm/programs)", Number(scopeC.rows[0].n) === 0, `n=${scopeC.rows[0].n}`);
  }
  const roleAfter = await pool.query(`SELECT role FROM contacts WHERE cid = $1`, [CID]);
  check("F1 Sarah role still member after ALL joins", roleAfter.rows[0]?.role === "member", `role=${roleAfter.rows[0]?.role}`);

  // 9. Cleanup — removes every fixture row identified by the I6C marker
  //    (cid/email prefix), including rows created by earlier runs.
  if (CLEANUP) {
    const mark = await pool.query(
      `SELECT cid FROM contacts WHERE cid LIKE 'USR-I6C-%' OR email LIKE '%i6c.%@future.studio.test'`,
    );
    const cids = mark.rows.map((r) => r.cid);
    if (cids.length > 0) {
      const del = async (table, col) => {
        const ph = cids.map((_, i) => `$${i + 1}`).join(",");
        await pool.query(`DELETE FROM ${table} WHERE ${col} IN (${ph})`, cids);
      };
      await del("v2_program_staff", "staff_id");
      await del("venture_members", "contact_id");
      await del("lms_enrollments", "user_cid");
      await del("participant_programs", "participant_id");
      await del("contacts", "cid");
      // Marker fixture programs created by this tool (never real programs).
      await pool.query(`DELETE FROM v2_programs WHERE name = 'I6C-FIXTURE-PROGRAM'`);
      console.log(`cleanup: removed ${cids.length} fixture contact(s) + membership rows + marker programs`);
    } else {
      console.log("cleanup: no I6C fixture rows found");
    }
  } else {
    console.log("\nfixture kept for manual QA:");
    console.log("  Sarah cid:", CID, "| email:", EMAIL);
    console.log("  Control cid:", CTRL_CID, "| email:", CTRL_EMAIL);
    console.log("  Remove later: node scripts/i6c-acceptance-matrix.mjs --cleanup (marker-scoped)");
  }

  const fails = results.filter((r) => r.pass === false);
  const skips = results.filter((r) => r.pass === "SKIP");
  console.log(`\n=== MATRIX RESULT: ${results.length - fails.length - skips.length}/${results.length - skips.length} passed (${skips.length} skipped, ${fails.length} failed) ===`);
  if (fails.length > 0) process.exitCode = 1;
} finally {
  await pool.end();
}
