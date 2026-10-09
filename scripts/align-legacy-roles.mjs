/**
 * Phase H — align legacy `contacts.role` values onto the baseline identity.
 *
 * The global identity column may only hold one of the three BASELINE values
 * (super_admin / staff / member); every other value the survey finds is
 * contextual and already described by a relationship row and a profile card.
 * This script performs the "opération de données" of the legacy-role cleanup:
 *
 *   node scripts/align-legacy-roles.mjs            # dry run — the "relevé"
 *   node scripts/align-legacy-roles.mjs --apply    # rewrite role values to member
 *
 * It is additive: it only rewrites the role COLUMN, guarded by the exact legacy
 * value, and deletes nothing. Re-running after an apply matches no row.
 */
import { readFileSync } from "node:fs";
import pg from "pg";
import { BASELINE_IDENTITIES } from "../src/lib/identity.js";

const readDatabaseUrl = (file) => {
  try {
    return readFileSync(file, "utf-8")
      .split("\n")
      .find((envLine) => envLine.startsWith("DATABASE_URL="))
      ?.substring("DATABASE_URL=".length)
      .trim();
  } catch {
    return null;
  }
};

const databaseUrl =
  process.env.DATABASE_URL ||
  readDatabaseUrl(".env.local") ||
  readDatabaseUrl(".env.staging") ||
  readDatabaseUrl(".env.audit-staging");

if (!databaseUrl) {
  console.error("Missing DATABASE_URL (env or an .env* file)");
  process.exit(2);
}

const apply = process.argv.includes("--apply");

const parseAllowedRoles = (raw) => {
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
};

const pool = new pg.Pool({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000,
});

try {
  await pool.query("SELECT 1");

  // The profiles come from the DATABASE, so a profile added/renamed/removed from
  // the profiles screen is recognised without any hardcoded list.
  const { rows: profileRows } = await pool.query("SELECT key, allowed_roles FROM profiles");
  const profileRoleMap = new Map(
    profileRows.map((row) => [String(row.key), parseAllowedRoles(row.allowed_roles)]),
  );

  const classify = (role) => {
    const value = String(role ?? "").trim();
    if (!value) return "empty";
    if (BASELINE_IDENTITIES.includes(value)) return "baseline";
    return profileRoleMap.has(value) ? "profile" : "retired";
  };

  // A staff-only profile (program_manager, venture_manager) must become baseline
  // `staff` so the profile rule keeps it open to the person; everything else
  // becomes the member default.
  const targetFor = (role) => {
    const allowed = profileRoleMap.get(String(role ?? "")) || [];
    if (allowed.includes("member")) return "member";
    if (allowed.includes("staff")) return "staff";
    return "member";
  };

  const { rows } = await pool.query(
    `SELECT role, COUNT(*)::int AS count
       FROM contacts
      GROUP BY role
      ORDER BY count DESC, role`,
  );

  const baseline = rows.filter((row) => classify(row.role) === "baseline");
  const legacy = rows.filter((row) => classify(row.role) !== "baseline");

  console.log("=== contacts.role survey ===");
  for (const row of baseline) console.log(`  baseline  ${row.role}: ${row.count}`);
  for (const row of legacy)
    console.log(`  LEGACY    ${row.role} (${classify(row.role)}) → ${targetFor(row.role)}: ${row.count}`);
  const totalLegacy = legacy.reduce((sum, row) => sum + Number(row.count), 0);
  console.log(`  → ${totalLegacy} account(s) carry a legacy value`);

  if (totalLegacy === 0) {
    console.log("\n[safe] no legacy role value — nothing to align.");
    process.exit(0);
  }

  if (!apply) {
    console.log("\n[dry run] re-run with --apply to align these values onto their baseline.");
    process.exit(0);
  }

  const aligned = [];
  for (const row of legacy) {
    const toRole = targetFor(row.role);
    const result = await pool.query("UPDATE contacts SET role = $1 WHERE role = $2", [
      toRole,
      row.role,
    ]);
    aligned.push(`${row.role}→${toRole}(${result.rowCount})`);
  }

  await pool.query(
    `INSERT INTO permission_audit_log
       (actor_cid, actor_name, target_cid, target_name, action, details)
     VALUES ('system', 'system', 'system', 'legacy-role-cleanup', 'legacy_roles_aligned', $1)`,
    `Aligned legacy contacts.role onto the baseline: ${aligned.join(", ")}`,
  );

  console.log(`\n[applied] aligned: ${aligned.join(", ")}`);
  process.exit(0);
} catch (error) {
  console.error("[error]", error.message);
  process.exit(1);
} finally {
  await pool.end();
}
