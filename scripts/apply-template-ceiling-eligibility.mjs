/**
 * Reconcile feature_eligibility with the seeded default templates.
 *
 * WHY THIS EXISTS
 * ---------------
 * `seedDefaultAccessProfiles()` creates the Participant Default and Mentor
 * templates with messaging + `projects.view` caps, but the eligibility bootstrap
 * ran BEFORE those roles were listed for the `communication` / `operations`
 * features. The ceiling check validates the WHOLE template, so those
 * role-default templates could never be saved from the Permissions UI:
 *
 *   "Template contains capabilities the identity is not eligible for."
 *
 * This applies the exact rows a fresh database now gets from
 * FEATURE_ELIGIBILITY_DEFAULTS (the code catch-up
 * `eligibility-template-ceiling-v1` does the same on the next boot of this
 * build). Insert-only: an administrator's decision is never overwritten.
 *
 * It also removes the retired `admin` role from the legacy `role_capabilities`
 * fallback table (the role has no people, no dashboard and no eligibility rows;
 * its `role_access_profile_defaults` mapping is removed separately/by hand —
 * re-adding it is what made Staff Default unsavable).
 *
 * USAGE
 *   node scripts/apply-template-ceiling-eligibility.mjs              # dry run
 *   node scripts/apply-template-ceiling-eligibility.mjs --apply      # write
 *   node scripts/apply-template-ceiling-eligibility.mjs --apply --env=local
 *
 * Default target is STAGING (.env.audit-staging). `--env=local` targets
 * .env.local — only do that when that database also runs this build.
 *
 * Rollback: the before-image printed (and written to scratch/) restores every
 * row this script changes.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import pg from "pg";

const APPLY = process.argv.includes("--apply");
const ENV_KEY = (process.argv.find((arg) => arg.startsWith("--env=")) || "").split("=")[1] || "staging";
const ENV_FILE = ENV_KEY === "local" ? ".env.local" : ".env.audit-staging";

// Mirrors TEMPLATE_CEILING_ROWS in src/models/authorization/eligibility.js
const TEMPLATE_CEILING_ROWS = {
  communication: ["participant", "mentor", "investor"],
  operations: ["participant", "mentor", "investor"],
  programs: ["mentor", "investor"],
};

const readUrl = (file) =>
  readFileSync(file, "utf-8")
    .split("\n")
    .find((line) => line.startsWith("DATABASE_URL="))
    ?.substring("DATABASE_URL=".length)
    .trim();

const pool = new pg.Pool({
  connectionString: readUrl(ENV_FILE),
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
});

const runQuery = (sql, args = []) => pool.query(sql, args);

console.log(`[template-ceiling] env=${ENV_KEY} (${ENV_FILE}) mode=${APPLY ? "APPLY" : "DRY RUN"}\n`);

// ── 1. Before-image ──────────────────────────────────────────────────────────
const featureKeys = Object.keys(TEMPLATE_CEILING_ROWS);
const existing = (
  await runQuery(
    `SELECT feature_key, identity_type, identity_value, eligible
       FROM feature_eligibility
      WHERE identity_type = 'role' AND feature_key = ANY($1::text[])`,
    [featureKeys],
  )
).rows;

const toInsert = [];
for (const [featureKey, roles] of Object.entries(TEMPLATE_CEILING_ROWS)) {
  for (const role of roles) {
    const alreadyPresent = existing.some(
      (existingRow) => existingRow.feature_key === featureKey && existingRow.identity_value === role,
    );
    if (!alreadyPresent) toInsert.push({ feature_key: featureKey, identity_value: role });
  }
}

const adminFallback = (
  await runQuery(`SELECT role, module, capability FROM role_capabilities WHERE role = 'admin'`)
).rows;

console.log("feature_eligibility rows to ADD:", toInsert.length);
for (const rowToInsert of toInsert) console.log(`  + ${rowToInsert.feature_key} → role:${rowToInsert.identity_value}`);
console.log(
  `\nlegacy role_capabilities for 'admin' to DELETE: ${adminFallback.length}`,
);
for (const fallbackRow of adminFallback) console.log(`  - ${fallbackRow.role}.${fallbackRow.module}.${fallbackRow.capability}`);

if (!APPLY) {
  console.log("\n[dry run] nothing written. Re-run with --apply to execute.");
  await pool.end();
  process.exit(0);
}

// ── 2. Before-image file (rollback) ──────────────────────────────────────────
const beforeImage = {
  env: ENV_KEY,
  capturedAt: new Date().toISOString(),
  feature_eligibility: existing,
  role_capabilities_admin: adminFallback,
};
try {
  mkdirSync("scratch", { recursive: true });
  const path = `scratch/template-ceiling-before-image-${ENV_KEY}.json`;
  writeFileSync(path, JSON.stringify(beforeImage, null, 2));
  console.log(`\nbefore-image → ${path}`);
} catch (error) {
  console.log(`\nbefore-image file failed (${error.message}) — printed above instead`);
}

// ── 3. Apply ─────────────────────────────────────────────────────────────────
await runQuery("BEGIN");
try {
  let inserted = 0;
  for (const rowToInsert of toInsert) {
    const insertResult = await runQuery(
      `INSERT INTO feature_eligibility (feature_key, identity_type, identity_value, eligible)
       VALUES ($1, 'role', $2, 1)
       ON CONFLICT (feature_key, identity_type, identity_value) DO NOTHING`,
      [rowToInsert.feature_key, rowToInsert.identity_value],
    );
    inserted += insertResult.rowCount;
  }
  const deleted = await runQuery(`DELETE FROM role_capabilities WHERE role = 'admin'`);

  await runQuery(
    `INSERT INTO permission_audit_log (actor_cid, actor_name, target_cid, target_name, action, details)
     VALUES ('system','system','system','system','eligibility_changed',$1)`,
    [
      `Template ceiling reconciliation (${ENV_KEY}): added ${inserted} feature_eligibility row(s) ` +
        `for the seeded default templates (${toInsert.map((rowToInsert) => `${rowToInsert.feature_key}→${rowToInsert.identity_value}`).join(", ") || "none"}); ` +
        `removed ${deleted.rowCount} legacy role_capabilities row(s) for the retired 'admin' role.`,
    ],
  );

  await runQuery("COMMIT");
  console.log(`\napplied: ${inserted} eligibility row(s) inserted, ${deleted.rowCount} admin fallback row(s) deleted.`);
} catch (error) {
  await runQuery("ROLLBACK");
  console.error(`\nFAILED (rolled back): ${error.message}`);
  await pool.end();
  process.exit(1);
}

// ── 4. After-state ───────────────────────────────────────────────────────────
const after = (
  await runQuery(
    `SELECT feature_key, identity_value FROM feature_eligibility
      WHERE identity_type = 'role' AND feature_key = ANY($1::text[])
      ORDER BY feature_key, identity_value`,
    [featureKeys],
  )
).rows;
console.log("\nfeature_eligibility now:");
for (const key of featureKeys) {
  console.log(
    `  ${key}: ${after.filter((eligibilityRow) => eligibilityRow.feature_key === key).map((eligibilityRow) => eligibilityRow.identity_value).join(", ")}`,
  );
}
console.log(
  `  admin fallback rows left: ${(await runQuery(`SELECT COUNT(*)::int AS n FROM role_capabilities WHERE role = 'admin'`)).rows[0].n}`,
);

await pool.end();
console.log("\n[done]");
