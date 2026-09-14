// READ-ONLY post-migration verification — FEATURE ↔ DASHBOARD-SECTION ALIGNMENT.
//
// Run AFTER deploying the build that includes the one-time migration
// `feature-key-alignment-v1`. Confirms nothing was lost while the feature keys
// were renamed/merged so that FEATURES = the dashboard sections
// (crm, communication, programs, ventures, investors, finance, operations,
// reports, knowledge, lms, security, settings).
//
// Prints only facts; never writes. Exit 0 = aligned, 1 = drift, 2 = no DB.
//
//   node scripts/verify-feature-alignment.mjs
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";

const { FEATURE_ELIGIBILITY_DEFAULTS } = await import(
  "../src/models/authorization/eligibility-defaults.js"
);

const CANONICAL = Object.keys(FEATURE_ELIGIBILITY_DEFAULTS);

// Feature (and responsibility) keys that must NOT survive the migration.
const LEGACY = [
  "program_management",
  "project_ownership",
  "knowledge_base",
  "user_management",
  "system_settings",
  "reporting",
  "intelligence",
  "engineering",
  "tasks",
  "investor",
  "messaging",
  "internal_comms",
];

// ── connection (same .env discovery order as verify-deployment.mjs) ──────────
const readUrl = (file) => {
  try {
    for (const line of readFileSync(resolve(process.cwd(), file), "utf-8").split("\n")) {
      if (line.startsWith("DATABASE_URL=")) {
        return line.substring("DATABASE_URL=".length).trim();
      }
    }
  } catch {}
  return null;
};

let pool = null;
let via = null;
for (const file of [".env.local", ".env.prod-verify", ".env.audit-staging"]) {
  const url = readUrl(file);
  if (!url) continue;
  try {
    const p = new pg.Pool({
      connectionString: url,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 12000,
    });
    await p.query("SELECT 1");
    pool = p;
    via = file;
    break;
  } catch {}
}
if (!pool) {
  console.error("No working DB connection");
  process.exit(2);
}
console.log(`[verify-alignment] connected via ${via}\n`);

const failures = [];
const warnings = [];
const ok = (label) => console.log(`  ✓ ${label}`);
const fail = (label) => {
  failures.push(label);
  console.log(`  ✗ ${label}`);
};
const warn = (label) => {
  warnings.push(label);
  console.log(`  ⚠ ${label}`);
};

// ── 1. feature_eligibility ───────────────────────────────────────────────────
console.log("feature_eligibility");
const elig = (
  await pool.query(
    "SELECT feature_key, identity_type, identity_value, eligible FROM feature_eligibility",
  )
).rows;

const byFeature = new Map();
for (const r of elig) byFeature.set(r.feature_key, (byFeature.get(r.feature_key) || 0) + 1);
for (const f of [...byFeature.keys()].sort()) console.log(`    ${f}: ${byFeature.get(f)} row(s)`);

const legacyElig = [...new Set(elig.map((r) => r.feature_key))].filter((k) => LEGACY.includes(k));
if (legacyElig.length === 0) ok("no legacy feature key remains");
else fail(`legacy feature keys still present: ${legacyElig.join(", ")}`);

const missingFeatures = CANONICAL.filter((f) => !byFeature.has(f));
if (missingFeatures.length === 0) ok(`all ${CANONICAL.length} canonical features have rows`);
else fail(`canonical features with no rows: ${missingFeatures.join(", ")}`);

// Default role allowlists — SOFT check: an administrator may have edited these
// on purpose (the migration never overwrites admin configuration).
const have = new Set(
  elig
    .filter((r) => r.identity_type === "role" && Number(r.eligible) === 1)
    .map((r) => `${r.feature_key}|${r.identity_value}`),
);
const missingDefaults = [];
for (const [feature, roles] of Object.entries(FEATURE_ELIGIBILITY_DEFAULTS)) {
  for (const role of roles) {
    if (!have.has(`${feature}|${role}`)) missingDefaults.push(`${feature}→${role}`);
  }
}
if (missingDefaults.length === 0) ok("every default role allowlist is satisfied");
else
  warn(
    `${missingDefaults.length} default row(s) absent (lost OR intentionally edited): ` +
      missingDefaults.join(", "),
  );

// ── 2. responsibilities ──────────────────────────────────────────────────────
console.log("\nresponsibilities");
const resp = (await pool.query("SELECT id, key FROM responsibilities")).rows;
for (const r of [...resp].sort((a, b) => String(a.key).localeCompare(String(b.key)))) {
  console.log(`    ${r.key}`);
}

const legacyResp = resp.map((r) => r.key).filter((k) => LEGACY.includes(k));
if (legacyResp.length === 0) ok("no legacy responsibility key remains");
else fail(`legacy responsibility keys still present: ${legacyResp.join(", ")}`);

const orphan = (
  await pool.query(
    `SELECT COUNT(*)::int AS n
       FROM user_responsibilities ur
       LEFT JOIN responsibilities r ON r.id = ur.responsibility_id
      WHERE r.id IS NULL`,
  )
).rows[0].n;
if (orphan === 0) ok("no orphaned user_responsibilities (assignments preserved)");
else fail(`${orphan} orphaned user_responsibilities row(s)`);

const assignments = (
  await pool.query("SELECT COUNT(*)::int AS n FROM user_responsibilities")
).rows[0].n;
console.log(`    ${assignments} user assignment(s) total`);

// ── summary ──────────────────────────────────────────────────────────────────
console.log("\n" + "=".repeat(60));
if (failures.length === 0) {
  console.log(`ALIGNED — ${warnings.length} warning(s)`);
} else {
  console.log(`DRIFT — ${failures.length} failure(s), ${warnings.length} warning(s)`);
  for (const f of failures) console.log(`  ✗ ${f}`);
}

await pool.end();
process.exit(failures.length === 0 ? 0 : 1);
