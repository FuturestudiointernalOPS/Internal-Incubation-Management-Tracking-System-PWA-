/**
 * PHASE 5 c3b — SHADOW SCOPE COLLECTION (READ-ONLY).
 *
 * Compares, for every person with a relationship, three PROGRAM perimeters and
 * the VENTURE perimeter, and reports what a switch to the PROFILE basis would
 * change:
 *
 *   program — ad-hoc   : `resolveContextAssignment` (v2_program_staff + contact_roles)
 *           — staffed  : `program_staffed` (v2_program_staff + assigned_pm_id)  ← guard TODAY
 *           — managed  : `program_managed` (active program_manager PROFILE)     ← TARGET
 *   venture — ad-hoc   : venture_members
 *           — own      : `venture_own` (venture_members + venture_staff_assignments)
 *
 * It performs SELECTs ONLY — no write, no migration, no configuration change.
 *
 * Run: node scripts/phase5-shadow-collect.mjs
 * Connection: DATABASE_URL from .env.local (this workstation = staging).
 */

import { readFileSync } from "node:fs";
import pg from "pg";

const ENV_FILES = [".env.local", ".env.staging", ".env.audit-staging"];

function readDatabaseUrl() {
  for (const file of ENV_FILES) {
    try {
      const line = readFileSync(file, "utf-8")
        .split("\n")
        .find((l) => l.startsWith("DATABASE_URL="));
      if (line) return line.slice("DATABASE_URL=".length).trim().replace(/^["']|["']$/g, "");
    } catch {
      /* file absent */
    }
  }
  return null;
}

const databaseUrl = readDatabaseUrl();
if (!databaseUrl) {
  console.error("No DATABASE_URL found (looked in " + ENV_FILES.join(", ") + ")");
  process.exit(2);
}

const pool = new pg.Pool({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000,
});

const q = async (sql, args = []) => (await pool.query(sql, args)).rows;
const toSet = (rows, key) =>
  new Set(rows.map((r) => String(r[key])).filter((v) => v && v !== "null"));
const diff = (a, b) => [...a].filter((x) => !b.has(x));

async function main() {
  console.log("[shadow] connected (read-only)\n");

  const candidateRows = await q(`
    SELECT DISTINCT who FROM (
      SELECT staff_id AS who FROM v2_program_staff
      UNION SELECT contact_cid FROM contact_roles WHERE context_type = 'program'
      UNION SELECT participant_id FROM participant_programs
      UNION SELECT contact_cid FROM profile_assignments
      UNION SELECT user_cid FROM venture_members WHERE removed_at IS NULL
      UNION SELECT contact_id FROM venture_members WHERE removed_at IS NULL
      UNION SELECT staff_contact_id FROM venture_staff_assignments WHERE status = 'active'
    ) t
    WHERE who IS NOT NULL AND who <> ''
  `);
  const candidates = candidateRows.map((r) => String(r.who));

  const contactRows = candidates.length
    ? await q("SELECT cid, email FROM contacts WHERE cid::text = ANY($1::text[])", [candidates])
    : [];
  const emailByCid = new Map(contactRows.map((r) => [String(r.cid), r.email || null]));

  const people = [];
  for (const who of candidates) {
    if (emailByCid.has(who)) people.push({ cid: who, email: emailByCid.get(who) || who });
    else if (who.includes("@")) people.push({ cid: who, email: who });
  }

  const findings = [];
  const byKey = {};
  const bump = (key, direction) => {
    byKey[key] = byKey[key] || { count: 0, legacyAllowEngineDeny: 0, legacyDenyEngineAllow: 0 };
    byKey[key].count += 1;
    byKey[key][direction] += 1;
  };
  const switchImpact = { programLosesWrite: [], programGainsWrite: [] };

  for (const { cid, email } of people) {
    // ---- PROGRAM : ad-hoc | staffed (guard) | managed (target profile) ----
    const adhocProgram = toSet(
      await q(
        `SELECT DISTINCT CAST(program_id AS TEXT) AS id FROM v2_program_staff
           WHERE staff_id = $1 OR LOWER(TRIM(staff_id)) = LOWER($2)
         UNION
         SELECT DISTINCT CAST(context_id AS TEXT) AS id FROM contact_roles
           WHERE context_type = 'program' AND is_current = true AND contact_cid = $1`,
        [cid, email],
      ),
      "id",
    );
    const staffedProgram = toSet(
      await q(
        `SELECT DISTINCT CAST(program_id AS TEXT) AS id FROM v2_program_staff
           WHERE staff_id = $1 OR LOWER(TRIM(staff_id)) = LOWER($2)
         UNION
         SELECT DISTINCT CAST(id AS TEXT) AS id FROM v2_programs
           WHERE CAST(assigned_pm_id AS TEXT) = $1`,
        [cid, email],
      ),
      "id",
    );
    const managedProgram = toSet(
      await q(
        `SELECT DISTINCT CAST(context_id AS TEXT) AS id FROM profile_assignments
           WHERE contact_cid = $1 AND context_type = 'program'
             AND profile_key = 'program_manager' AND status = 'active'
             AND (started_at IS NULL OR started_at <= NOW())
             AND (ends_at IS NULL OR ends_at > NOW())
             AND context_id IS NOT NULL`,
        [cid],
      ),
      "id",
    );

    // Shadow: legacy ad-hoc vs the TARGET policy (program_managed).
    for (const id of diff(adhocProgram, managedProgram)) {
      findings.push({ key: "program:ad_hoc_vs_managed", cid, contextId: id, legacyAllowed: true, engineAllowed: false });
      bump("program:ad_hoc_vs_managed", "legacyAllowEngineDeny");
    }
    for (const id of diff(managedProgram, adhocProgram)) {
      findings.push({ key: "program:ad_hoc_vs_managed", cid, contextId: id, legacyAllowed: false, engineAllowed: true });
      bump("program:ad_hoc_vs_managed", "legacyDenyEngineAllow");
    }
    // Switch impact: guard TODAY (program_staffed) vs TARGET (program_managed).
    for (const id of diff(staffedProgram, managedProgram)) switchImpact.programLosesWrite.push({ cid, contextId: id });
    for (const id of diff(managedProgram, staffedProgram)) switchImpact.programGainsWrite.push({ cid, contextId: id });

    // ---- VENTURE : ad-hoc | own ----
    const ventureMembers = toSet(
      await q(
        `SELECT DISTINCT CAST(venture_id AS TEXT) AS id FROM venture_members
           WHERE (user_cid = $1 OR contact_id = $1) AND removed_at IS NULL`,
        [cid],
      ),
      "id",
    );
    const ventureOwn = toSet(
      await q(
        `SELECT DISTINCT CAST(venture_id AS TEXT) AS id FROM venture_members
           WHERE (user_cid = $1 OR contact_id = $1) AND removed_at IS NULL
         UNION
         SELECT DISTINCT CAST(venture_id AS TEXT) AS id FROM venture_staff_assignments
           WHERE staff_contact_id = $1 AND status = 'active'`,
        [cid],
      ),
      "id",
    );
    for (const id of diff(ventureMembers, ventureOwn)) {
      findings.push({ key: "venture:venture_own", cid, contextId: id, legacyAllowed: true, engineAllowed: false });
      bump("venture:venture_own", "legacyAllowEngineDeny");
    }
    for (const id of diff(ventureOwn, ventureMembers)) {
      findings.push({ key: "venture:venture_own", cid, contextId: id, legacyAllowed: false, engineAllowed: true });
      bump("venture:venture_own", "legacyDenyEngineAllow");
    }
  }

  const report = {
    enabled: true,
    peopleProbed: people.length,
    total: findings.length,
    byKey,
    switchImpact: {
      programLosesWrite: switchImpact.programLosesWrite.length,
      programGainsWrite: switchImpact.programGainsWrite.length,
      detail: switchImpact,
    },
    recent: findings.slice(0, 100),
  };
  console.log(JSON.stringify(report, null, 2));
  await pool.end();
}

main().catch(async (error) => {
  console.error("[shadow] collection failed:", error.message);
  try {
    await pool.end();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
