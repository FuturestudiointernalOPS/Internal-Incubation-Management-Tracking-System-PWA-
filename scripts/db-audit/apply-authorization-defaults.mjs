#!/usr/bin/env node
/**
 * APPLY AUTHORIZATION DEFAULTS — the versioned seed data, written deliberately.
 *
 * The initial access configuration lives in ONE inert data module
 * (`src/models/authorization/seedData.js`). This script copies it into a
 * database, insert-only: an existing row (including an administrator's edit) is
 * never overwritten.
 *
 * DRY-RUN BY DEFAULT. The whole batch runs inside a transaction that is rolled
 * back, so the printed counts are exactly what would be written:
 *
 *   node scripts/db-audit/apply-authorization-defaults.mjs
 *   node scripts/db-audit/apply-authorization-defaults.mjs --apply
 *   node scripts/db-audit/apply-authorization-defaults.mjs --env .env.local
 *   node scripts/db-audit/apply-authorization-defaults.mjs --env .env.prod-verify --allow-production
 *
 * The script never creates the schema: run the app once (its self-healing
 * helpers create the tables) or apply the authorization schema first.
 */

import { register } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

await register(new URL("../lib/import-loader.mjs", import.meta.url));

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..", "..");
const ARGS = new Set(process.argv.slice(2));
const APPLY = ARGS.has("--apply");
const DETAILS = ARGS.has("--details");
const ENV_ARG_INDEX = process.argv.indexOf("--env");
const EXPLICIT_ENV = ENV_ARG_INDEX >= 0 ? process.argv[ENV_ARG_INDEX + 1] : null;
const PRODUCTION_PROJECT_REF = "yakxdxdzuojafzdkqhjd";
const ALLOW_PRODUCTION = ARGS.has("--allow-production");

const ENV_CANDIDATES = [
  ".env.audit-readonly",
  ".env.local",
  ".env.audit-staging",
  ".env.staging",
];

process.env.SKIP_RUNTIME_SCHEMA_MAINTENANCE = "true";

const { CAPABILITY_CATALOG } = await import(
  "../../src/models/authorization/constants/feature-module-capability.js"
);
const { ACCESS_LEVELS } = await import("../../src/server/authz/capabilities.js");
const {
  FEATURE_ELIGIBILITY_DEFAULTS,
  FEATURE_ELIGIBILITY_PROFILE_DEFAULTS,
  PROGRAM_ASSIGNMENT_ROWS,
  PROFILE_CATALOGUE_SEED,
  ROLE_PROFILE_DEFAULTS_SEED,
  RESPONSIBILITY_DEFINITIONS,
  RESPONSIBILITY_FEATURE_ROLES,
  DELEGATED_PROFILE_CAPABILITY_ROWS,
  VENTURE_PORTFOLIO_CAPABILITY_ROWS,
  VENTURE_MEMBER_EDIT_CAPABILITY,
} = await import("../../src/models/authorization/seedData.js");

function readDatabaseUrl(envFile) {
  try {
    for (const line of fs.readFileSync(path.join(PROJECT_ROOT, envFile), "utf8").split(/\r?\n/)) {
      if (!line.startsWith("DATABASE_URL=")) continue;
      return line.slice("DATABASE_URL=".length).trim().replace(/^["']|["']$/g, "");
    }
  } catch {
    return null;
  }
  return null;
}

let databaseUrl = null;
let sourceEnvFile = null;
for (const candidate of EXPLICIT_ENV ? [EXPLICIT_ENV] : ENV_CANDIDATES) {
  const value = readDatabaseUrl(candidate);
  if (!value) continue;
  databaseUrl = value;
  sourceEnvFile = candidate;
  break;
}

if (!databaseUrl) {
  console.error(
    "Aucun DATABASE_URL trouvé. Fichiers essayés : " +
      (EXPLICIT_ENV ? EXPLICIT_ENV : ENV_CANDIDATES.join(", ")),
  );
  process.exit(1);
}

const IS_PRODUCTION_TARGET =
  databaseUrl.includes(PRODUCTION_PROJECT_REF) || /prod/i.test(sourceEnvFile);
if (IS_PRODUCTION_TARGET && !ALLOW_PRODUCTION) {
  console.error(
    "Refus : la cible est la production. Relancer avec --allow-production si c'est bien voulu.",
  );
  process.exit(1);
}

const projectRef = (() => {
  try {
    return new URL(databaseUrl).username;
  } catch {
    return "?";
  }
})();
const host = (() => {
  try {
    return new URL(databaseUrl).host;
  } catch {
    return "?";
  }
})();

function fullMatrix() {
  const matrix = {};
  for (const [module, definition] of Object.entries(CAPABILITY_CATALOG)) {
    matrix[module] = {};
    for (const capability of Object.keys(definition.capabilities || {})) {
      matrix[module][capability] = ACCESS_LEVELS.FULL;
    }
  }
  return matrix;
}

const client = new pg.Client({
  connectionString: databaseUrl,
  ssl: /sslmode=/.test(databaseUrl) ? undefined : { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
});

await client.connect();
await client.query("SET statement_timeout = '120s'");

const who = await client.query("SELECT current_database() AS db, current_user AS usr");
console.log(`\n=== APPLY AUTHORIZATION DEFAULTS (${APPLY ? "APPLY" : "DRY-RUN"}) ===`);
console.log(`Base      : ${who.rows[0]?.db} @ ${host}`);
console.log(`Projet    : ${projectRef}`);
console.log(`Source    : ${sourceEnvFile}`);
console.log("");

const REQUIRED_TABLES = [
  "profiles",
  "profile_capabilities",
  "role_profile_defaults",
  "feature_eligibility",
  "responsibilities",
];
const existing = await client.query(
  `SELECT ${REQUIRED_TABLES.map((table) => `to_regclass('public.${table}') AS ${table}`).join(", ")}`,
);
const missing = REQUIRED_TABLES.filter((table) => !existing.rows[0]?.[table]);
if (missing.length > 0) {
  console.error(
    `Schéma incomplet : table(s) absente(s) — ${missing.join(", ")}.\n` +
      "Démarrez l'application une fois (auto-réparation) ou appliquez le schéma d'autorisation.",
  );
  await client.end();
  process.exit(1);
}

const counts = {};
const details = [];
const bump = (key, value) => {
  counts[key] = (counts[key] || 0) + (value || 0);
};

async function insert(sql, args, label) {
  const result = await client.query(sql, args);
  const written = result.rowCount || 0;
  if (written > 0 && DETAILS && label) details.push(label);
  return written;
}

await client.query("BEGIN");
try {
  // 1. Feature eligibility — role ceilings.
  for (const [featureKey, roles] of Object.entries(FEATURE_ELIGIBILITY_DEFAULTS)) {
    for (const role of roles) {
      bump(
        "feature_eligibility.role",
        await insert(
          `INSERT INTO feature_eligibility (feature_key, identity_type, identity_value, eligible)
           VALUES ($1, 'role', $2, 1)
           ON CONFLICT (feature_key, identity_type, identity_value) DO NOTHING`,
          [featureKey, role],
          `eligibility role ${featureKey}:${role}`,
        ),
      );
    }
  }

  // 2. Feature eligibility — profile ceilings.
  for (const [featureKey, profiles] of Object.entries(FEATURE_ELIGIBILITY_PROFILE_DEFAULTS)) {
    for (const profile of profiles) {
      bump(
        "feature_eligibility.profile",
        await insert(
          `INSERT INTO feature_eligibility (feature_key, identity_type, identity_value, eligible)
           VALUES ($1, 'profile', $2, 1)
           ON CONFLICT (feature_key, identity_type, identity_value) DO NOTHING`,
          [featureKey, profile],
          `eligibility profile ${featureKey}:${profile}`,
        ),
      );
    }
  }

  // 3. Assignment-derived program access.
  for (const [featureKey, roles] of Object.entries(PROGRAM_ASSIGNMENT_ROWS)) {
    for (const role of roles) {
      bump(
        "feature_eligibility.assignment",
        await insert(
          `INSERT INTO feature_eligibility (feature_key, identity_type, identity_value, eligible)
           VALUES ($1, 'role', $2, 1)
           ON CONFLICT (feature_key, identity_type, identity_value) DO NOTHING`,
          [featureKey, role],
          `eligibility assignment ${featureKey}:${role}`,
        ),
      );
    }
  }

  // 4. Profiles and their capabilities.
  const matrix = fullMatrix();
  for (const definition of PROFILE_CATALOGUE_SEED) {
    bump(
      "profiles",
      await insert(
        `INSERT INTO profiles (key, context, allowed_roles, is_active, label)
         VALUES ($1, $2, $3, 1, $4)
         ON CONFLICT (key) DO NOTHING`,
        [
          definition.key,
          definition.context,
          JSON.stringify(definition.allowedRoles || []),
          definition.label,
        ],
        `profile ${definition.key}`,
      ),
    );

    const capabilities = definition.allCapabilities
      ? matrix
      : definition.capabilities || {};
    for (const [module, capabilitiesForModule] of Object.entries(capabilities)) {
      for (const [capability, level] of Object.entries(capabilitiesForModule)) {
        bump(
          "profile_capabilities",
          await insert(
            `INSERT INTO profile_capabilities (profile_key, module, capability, access_level)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (profile_key, module, capability) DO NOTHING`,
            [definition.key, module, capability, level],
            `capability ${definition.key}.${module}.${capability}`,
          ),
        );
      }
    }
  }

  // 5. Role → profile defaults.
  for (const [roleName, profileKey] of Object.entries(ROLE_PROFILE_DEFAULTS_SEED)) {
    bump(
      "role_profile_defaults",
      await insert(
        `INSERT INTO role_profile_defaults (role_name, profile_key)
         VALUES ($1, $2)
         ON CONFLICT (role_name) DO NOTHING`,
        [roleName, profileKey],
        `role default ${roleName} -> ${profileKey}`,
      ),
    );
  }

  // 6. Responsibilities catalogue and its default allowed_roles.
  for (const definition of RESPONSIBILITY_DEFINITIONS) {
    const allowed = JSON.stringify(
      RESPONSIBILITY_FEATURE_ROLES[definition.key] || [],
    );
    const result = await client.query(
      `INSERT INTO responsibilities (name, key, description, icon, allowed_roles, is_active)
       VALUES ($1, $2, $3, $4, $5, 1)
       ON CONFLICT (key) DO UPDATE SET
         name = EXCLUDED.name,
         description = EXCLUDED.description,
         icon = EXCLUDED.icon
       RETURNING (xmax = 0) AS inserted`,
      [definition.name, definition.key, definition.description, definition.icon, allowed],
    );
    bump(
      result.rows[0]?.inserted ? "responsibilities.inserted" : "responsibilities.updated",
      1,
    );
  }
  for (const definition of RESPONSIBILITY_DEFINITIONS) {
    const allowed = JSON.stringify(
      RESPONSIBILITY_FEATURE_ROLES[definition.key] || [],
    );
    const result = await client.query(
      `UPDATE responsibilities
          SET allowed_roles = $2
        WHERE key = $1
          AND (allowed_roles IS NULL OR TRIM(allowed_roles) = '')`,
      [definition.key, allowed],
    );
    bump("responsibilities.backfilled", result.rowCount || 0);
  }

  // 7. Capabilities that must reach databases seeded before them.
  for (const row of DELEGATED_PROFILE_CAPABILITY_ROWS) {
    bump(
      "profile_capabilities.delegated",
      await insert(
        `INSERT INTO profile_capabilities (profile_key, module, capability, access_level)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (profile_key, module, capability) DO NOTHING`,
        row,
        `delegated ${row.join(".")}`,
      ),
    );
  }
  for (const row of VENTURE_PORTFOLIO_CAPABILITY_ROWS) {
    bump(
      "profile_capabilities.portfolio",
      await insert(
        `INSERT INTO profile_capabilities (profile_key, module, capability, access_level)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (profile_key, module, capability) DO NOTHING`,
        row,
        `portfolio ${row.join(".")}`,
      ),
    );
  }
  bump(
    "profile_capabilities.venture_member_edit",
    await insert(
      `INSERT INTO profile_capabilities (profile_key, module, capability, access_level)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (profile_key, module, capability) DO NOTHING`,
      VENTURE_MEMBER_EDIT_CAPABILITY,
      `venture member edit ${VENTURE_MEMBER_EDIT_CAPABILITY.join(".")}`,
    ),
  );

  if (APPLY) {
    await client.query("COMMIT");
  } else {
    await client.query("ROLLBACK");
  }
} catch (error) {
  await client.query("ROLLBACK").catch(() => {});
  console.error(`\nÉchec : ${error.message}`);
  await client.end();
  process.exit(1);
}

await client.end();

console.log("Écritures " + (APPLY ? "effectuées" : "simulées (rollback)") + " :");
for (const [key, value] of Object.entries(counts)) {
  console.log(`  ${key.padEnd(36)} ${value}`);
}
console.log(
  `\nTotal : ${Object.values(counts).reduce((sum, value) => sum + value, 0)} ligne(s).`,
);
if (DETAILS && details.length > 0) {
  console.log("\nDétail des lignes " + (APPLY ? "écrites" : "à écrire") + " :");
  for (const detail of details) console.log(`  - ${detail}`);
}
if (!APPLY) {
  console.log("\nAucune modification. Relancer avec --apply pour écrire.");
}
