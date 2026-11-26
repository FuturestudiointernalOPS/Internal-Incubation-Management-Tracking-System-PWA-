#!/usr/bin/env node
/**
 * AUTHZ DOCTOR — contrôle de complétude de la configuration d'accès.
 *
 * READ ONLY. Vérifie qu'une base contient bien TOUTE la configuration que le
 * moteur attend, et signale clairement une base incomplète. C'est le contrôle
 * à lancer avant un déploiement, après une migration, ou quand un écran de
 * permissions paraît vide.
 *
 *   node scripts/authz-doctor.mjs
 *   node scripts/authz-doctor.mjs --strict
 *   node scripts/authz-doctor.mjs --json
 *   node scripts/authz-doctor.mjs --env .env.prod-verify --allow-production
 *
 * Sortie 1 si la base est CRITIQUE (ou si --strict et des avertissements).
 */

import { register } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

await register(new URL("./lib/import-loader.mjs", import.meta.url));

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..");
const ARGS = new Set(process.argv.slice(2));

const ENV_ARG_INDEX = process.argv.indexOf("--env");
const EXPLICIT_ENV = ENV_ARG_INDEX >= 0 ? process.argv[ENV_ARG_INDEX + 1] : null;
const PRODUCTION_PROJECT_REF = "yakxdxdzuojafzdkqhjd";
const ALLOW_PRODUCTION = ARGS.has("--allow-production");
const STRICT = ARGS.has("--strict");
const JSON_OUTPUT = ARGS.has("--json");

const ENV_CANDIDATES = [
  ".env.audit-readonly",
  ".env.local",
  ".env.audit-staging",
  ".env.staging",
];

process.env.SKIP_RUNTIME_SCHEMA_MAINTENANCE = "true";

const { CAPABILITY_CATALOG } = await import(
  "../src/models/authorization/constants/feature-module-capability.js"
);
const { FEATURE_ORDER } = await import(
  "../src/models/authorization/constants/features.js"
);
const { BASELINE_IDENTITIES } = await import("../src/lib/identity.js");

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
    "Refus : la cible est la production. Relancer avec --allow-production (lecture seule).",
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

const client = new pg.Client({
  connectionString: databaseUrl,
  ssl: /sslmode=/.test(databaseUrl) ? undefined : { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
});

const warnings = [];
const critical = [];
const info = [];
const facts = {};

async function scalar(sql, fallback = null) {
  try {
    const result = await client.query(sql);
    return result.rows[0]?.n ?? fallback;
  } catch (error) {
    return { error: error.message.split("\n")[0] };
  }
}

async function rows(sql) {
  try {
    return (await client.query(sql)).rows;
  } catch {
    return [];
  }
}

await client.connect();
await client.query("SET statement_timeout = '60s'");

try {
  const who = await client.query("SELECT current_database() AS db, current_user AS usr");
  facts.database = who.rows[0]?.db;
  facts.user = who.rows[0]?.usr;
} catch (error) {
  console.error(`Connexion impossible : ${error.message}`);
  process.exit(1);
}

const counts = {
  profiles: await scalar("SELECT count(*)::int AS n FROM profiles"),
  profile_capabilities: await scalar("SELECT count(*)::int AS n FROM profile_capabilities"),
  role_profile_defaults: await scalar("SELECT count(*)::int AS n FROM role_profile_defaults"),
  feature_eligibility: await scalar("SELECT count(*)::int AS n FROM feature_eligibility"),
  responsibilities: await scalar("SELECT count(*)::int AS n FROM responsibilities"),
  responsibility_unconfigured: await scalar(
    "SELECT count(*)::int AS n FROM responsibilities WHERE allowed_roles IS NULL OR TRIM(allowed_roles) = ''",
  ),
};

for (const [name, value] of Object.entries(counts)) {
  if (value && typeof value === "object" && value.error) {
    critical.push(`table ou colonne inaccessible : ${name} (${value.error})`);
  }
}

if (counts.profiles === 0) critical.push("aucun profil en base");
if (counts.profile_capabilities === 0) critical.push("aucun droit de profil en base");
if (counts.role_profile_defaults === 0) critical.push("aucun profil par défaut de rôle");
if (counts.feature_eligibility === 0) critical.push("aucune éligibilité en base");

const eligibilityByFeature = await rows(
  "SELECT feature_key, count(*)::int AS n FROM feature_eligibility GROUP BY feature_key",
);
const eligibilityMap = Object.fromEntries(
  eligibilityByFeature.map((row) => [row.feature_key, row.n]),
);
const featuresWithoutRows = FEATURE_ORDER.filter((feature) => !eligibilityMap[feature]);
if (featuresWithoutRows.length > 0) {
  warnings.push(
    `fonctionnalités sans aucune ligne d'éligibilité : ${featuresWithoutRows.join(", ")}`,
  );
}

const ownerCaps = await rows(
  "SELECT module, capability FROM profile_capabilities WHERE profile_key = 'super_admin_default'",
);
const ownerKeys = new Set(ownerCaps.map((row) => `${row.module}.${row.capability}`));
const ownerMissing = [];
for (const [module, definition] of Object.entries(CAPABILITY_CATALOG)) {
  for (const capability of Object.keys(definition.capabilities || {})) {
    const key = `${module}.${capability}`;
    if (!ownerKeys.has(key)) ownerMissing.push(key);
  }
}
if (ownerMissing.length > 0) {
  warnings.push(
    `le profil du propriétaire ne contient pas ${ownerMissing.length} droit(s) du catalogue`,
  );
}

const roles = await rows(
  "SELECT role, count(*)::int AS n FROM contacts GROUP BY role ORDER BY n DESC",
);
const legacyRoles = roles
  .map((row) => row.role)
  .filter((role) => role && !BASELINE_IDENTITIES.includes(role));
if (legacyRoles.length > 0) {
  // Informationnel : ces valeurs sont normalisées à la connexion et ne
  // participent à aucune décision. Elles ne doivent pas faire échouer --strict.
  info.push(
    `rôles stockés hors vocabulaire de base (normalisés à la connexion) : ${legacyRoles.join(", ")}`,
  );
}

const responsibilitiesNull = Number(counts.responsibility_unconfigured) || 0;
if (responsibilitiesNull > 0) {
  warnings.push(
    `${responsibilitiesNull} responsabilité(s) sans allowed_roles : aucun avertissement d'incompatibilité ne sera affiché`,
  );
}

const verdict =
  critical.length > 0 ? "CRITIQUE" : warnings.length > 0 ? "AVERTISSEMENTS" : "OK";

const report = {
  generatedAt: new Date().toISOString(),
  target: { database: facts.database, user: facts.user, host, projectRef, sourceEnvFile },
  counts,
  featuresWithoutRows,
  ownerMissing,
  legacyRoles,
  responsibilitiesNull,
  warnings,
  critical,
  info,
  verdict,
};

if (JSON_OUTPUT) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log("\n=== AUTHZ DOCTOR ===");
  console.log(`Base      : ${facts.database} @ ${host}`);
  console.log(`Projet    : ${projectRef}`);
  console.log(`Source    : ${sourceEnvFile}`);
  console.log("");
  console.log("Complétude :");
  for (const [name, value] of Object.entries(counts)) {
    console.log(`  ${name.padEnd(30)} ${value?.error ? `ERREUR (${value.error})` : value}`);
  }
  console.log("");
  console.log(`Fonctionnalités sans éligibilité : ${featuresWithoutRows.length === 0 ? "aucune" : featuresWithoutRows.join(", ")}`);
  console.log(`Droits manquants du propriétaire : ${ownerMissing.length}`);
  for (const key of ownerMissing) console.log(`  - ${key}`);
  console.log(`Responsabilités non configurées  : ${responsibilitiesNull}`);
  console.log(`Rôles stockés hors base         : ${legacyRoles.length === 0 ? "aucun" : legacyRoles.join(", ")}`);
  console.log("");
  if (info.length > 0) {
    console.log(`Information (${info.length}) :`);
    for (const entry of info) console.log(`  - ${entry}`);
  }
  if (warnings.length > 0) {
    console.log(`Avertissements (${warnings.length}) :`);
    for (const warning of warnings) console.log(`  - ${warning}`);
  }
  if (critical.length > 0) {
    console.log(`Critique (${critical.length}) :`);
    for (const problem of critical) console.log(`  - ${problem}`);
  }
  console.log(`\nVerdict : ${verdict}`);
}

await client.end();

if (critical.length > 0 || (STRICT && warnings.length > 0)) {
  process.exit(1);
}
