/**
 * PHASE 5 c3b — SHADOW SCOPE COLLECTION (READ-ONLY).
 *
 * Compares, for every person with a relationship, the AD-HOC scope verdict
 * (`resolveContextAssignment`, used by `decide`) with the ENGINE scope policy
 * (`isWithinScope` : program_assigned / venture_own), and reports the
 * divergences that a shadow deployment is meant to surface.
 *
 * It performs SELECTs ONLY — no write, no migration, no configuration change.
 *
 * The statements are byte-faithful to the two verdicts:
 *   - engine side   : src/models/authorization/scopeReads.js
 *                     (getProgramAssignedScopeIds, getVentureOwnScopeIds)
 *   - ad-hoc side   : src/models/authorization/contextAssignmentReads.js
 *                     (getProgramStaffAssignmentRows, getContactRoleAssignmentRows,
 *                      getVentureMembershipRows)
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

const isEmail = (value) => typeof value === "string" && value.includes("@");

async function main() {
  console.log("[shadow] connected (read-only)\n");

  // 1. Candidate people — every identity that appears in a relationship source.
  const candidateRows = await q(`
    SELECT DISTINCT who FROM (
      SELECT staff_id AS who FROM v2_program_staff
      UNION SELECT contact_cid FROM contact_roles WHERE context_type = 'program'
      UNION SELECT participant_id FROM participant_programs
      UNION SELECT user_cid FROM venture_members WHERE removed_at IS NULL
      UNION SELECT contact_id FROM venture_members WHERE removed_at IS NULL
      UNION SELECT staff_contact_id FROM venture_staff_assignments WHERE status = 'active'
    ) t
    WHERE who IS NOT NULL AND who <> ''
  `);
  const candidates = candidateRows.map((r) => String(r.who));

  // Resolve cid -> email so the email branch of every statement is exercised.
  const contactRows = candidates.length
    ? await q("SELECT cid, email FROM contacts WHERE cid::text = ANY($1::text[])", [candidates])
    : [];
  const emailByCid = new Map(contactRows.map((r) => [String(r.cid), r.email || null]));

  const people = [];
  for (const who of candidates) {
    if (emailByCid.has(who)) {
      people.push({ cid: who, email: emailByCid.get(who) || who });
    } else if (isEmail(who)) {
      // A raw email with no contact row: the email branch is the only match.
      people.push({ cid: who, email: who });
    }
  }

  const findings = [];
  const byKey = {};
  const bump = (key, direction) => {
    byKey[key] = byKey[key] || { count: 0, legacyAllowEngineDeny: 0, legacyDenyEngineAllow: 0 };
    byKey[key].count += 1;
    byKey[key][direction] += 1;
  };

  for (const { cid, email } of people) {
    // ---- PROGRAM ----
    const engineProgram = toSet(
      await q(
        `SELECT DISTINCT CAST(program_id AS TEXT) AS id FROM v2_program_staff
           WHERE staff_id = $1 OR LOWER(TRIM(staff_id)) = LOWER($2)
         UNION
         SELECT DISTINCT CAST(program_id AS TEXT) AS id FROM participant_programs
           WHERE participant_id = $1`,
        [cid, email],
      ),
      "id",
    );
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
    for (const id of diff(adhocProgram, engineProgram)) {
      findings.push({ key: "program:program_assigned", cid, contextId: id, legacyAllowed: true, engineAllowed: false });
      bump("program:program_assigned", "legacyAllowEngineDeny");
    }
    for (const id of diff(engineProgram, adhocProgram)) {
      findings.push({ key: "program:program_assigned", cid, contextId: id, legacyAllowed: false, engineAllowed: true });
      bump("program:program_assigned", "legacyDenyEngineAllow");
    }

    // ---- VENTURE ----
    const engineVenture = toSet(
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
    const adhocVenture = toSet(
      await q(
        `SELECT DISTINCT CAST(venture_id AS TEXT) AS id FROM venture_members
           WHERE (user_cid = $1 OR contact_id = $1) AND removed_at IS NULL`,
        [cid],
      ),
      "id",
    );
    for (const id of diff(adhocVenture, engineVenture)) {
      findings.push({ key: "venture:venture_own", cid, contextId: id, legacyAllowed: true, engineAllowed: false });
      bump("venture:venture_own", "legacyAllowEngineDeny");
    }
    for (const id of diff(engineVenture, adhocVenture)) {
      findings.push({ key: "venture:venture_own", cid, contextId: id, legacyAllowed: false, engineAllowed: true });
      bump("venture:venture_own", "legacyDenyEngineAllow");
    }
  }

  const report = {
    enabled: true, // the collection IS the measurement
    peopleProbed: people.length,
    total: findings.length,
    byKey,
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
