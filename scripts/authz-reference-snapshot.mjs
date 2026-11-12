#!/usr/bin/env node
/**
 * AUTHZ — ÉTAPE 0 : photographie de référence des décisions ACTUELLES.
 *
 * READ ONLY. Aucune écriture, aucun seed, aucune migration. Le script lit les
 * tables que le moteur consulte déjà, puis rejoue les fonctions PURES du moteur
 * (fusion des droits, éligibilité, verdicts) pour produire la décision que
 * l'application rendrait aujourd'hui.
 *
 * Pourquoi ne pas appeler directement le résolveur applicatif : il déclenche des
 * seeds idempotents au premier appel. Une photographie de référence doit être
 * strictement en lecture. On utilise donc les mêmes fonctions de décision, mais
 * les lectures sont celles du script.
 *
 * Sorties :
 *   scratch/authz-reference/etape0-<base>-<date>.json   (détail, local, ignoré)
 *   docs/permissions/ETAPE0-SNAPSHOT.md                 (résumé agrégé, commité)
 *
 * Usage :
 *   node scripts/authz-reference-snapshot.mjs
 *   node scripts/authz-reference-snapshot.mjs --no-landing
 *   node scripts/authz-reference-snapshot.mjs --cid USER_123
 */

import { register } from "node:module";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

await register(new URL("./lib/import-loader.mjs", import.meta.url));

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(PROJECT_ROOT, "scratch", "authz-reference");
const DOCS_DIR = path.join(PROJECT_ROOT, "docs", "permissions");
const GENERATED_AT = new Date();
const ARGS = new Set(process.argv.slice(2));
const ONLY_CID = (() => {
  const index = process.argv.indexOf("--cid");
  return index >= 0 ? process.argv[index + 1] : null;
})();
const WITH_LANDING = !ARGS.has("--no-landing");
// Étape 2 — when set, the owner is resolved through the normal path (eligibility
// + account gate + profile rights) exactly as the application will after the
// flag is enabled. Default OFF = today's bypass.
const OWNER_THROUGH_ENGINE = process.env.AUTHZ_OWNER_THROUGH_ENGINE === "true";
const LANDING_FROM_RIGHTS = process.env.AUTHZ_LANDING_FROM_RIGHTS === "true";
const COMPARE_ARG_INDEX = process.argv.indexOf("--compare");
const COMPARE_WITH =
  COMPARE_ARG_INDEX >= 0 ? process.argv[COMPARE_ARG_INDEX + 1] : null;
// Une fiche peut porter une adresse e-mail comme identifiant : le relevé
// n'écrit donc qu'une empreinte stable, sauf demande explicite.
const INCLUDE_IDENTIFIERS = ARGS.has("--include-identifiers");

// ── Connexion : fichiers d'environnement autorisés (jamais la production) ───

const ENV_CANDIDATES = [
  ".env.audit-readonly",
  ".env.local",
  ".env.audit-staging",
  ".env.staging",
];

const ENV_ARG_INDEX = process.argv.indexOf("--env");
const EXPLICIT_ENV = ENV_ARG_INDEX >= 0 ? process.argv[ENV_ARG_INDEX + 1] : null;
const PRODUCTION_PROJECT_REF = "yakxdxdzuojafzdkqhjd";
const ALLOW_PRODUCTION = ARGS.has("--allow-production");

// Une photographie de production doit toujours être explicitement demandée.
// On désactive aussi la maintenance de schéma du processus : même si un module
// applicatif appelait `initDb`, aucune écriture de schéma ne partirait.
process.env.SKIP_RUNTIME_SCHEMA_MAINTENANCE = "true";

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
    "Refus : la cible est la production. Relancer avec --allow-production si c'est bien voulu (lecture seule).",
  );
  process.exit(1);
}

// Les modules qui lisent la base via `@/lib/db` doivent voir cette URL.
process.env.DATABASE_URL = databaseUrl;

// ── Imports du moteur (uniquement des modules purs, sauf le service de
//    participation, qui ne fait que des SELECT) ──────────────────────────────

const { rowsToCaps, rowsToRestrictions, mergeEffectiveCapabilities } =
  await import("../src/services/authorization/capabilityMerge.js");
const { explainEligibility } =
  await import("../src/services/authorization/eligibility.js");
const { explainAuthorization } =
  await import("../src/services/authorization/contextDecisions.js");
const {
  CAPABILITY_CATALOG,
  PERMISSION_MODULES,
  MODULE_TO_FEATURE,
  FEATURE_ORDER,
} = await import("../src/models/authorization/constants/index.js");
const { ACCESS_LEVELS } = await import("../src/server/authz/capabilities.js");
const { selectEffectiveGroups } =
  await import("../src/services/authorization/membership.js");
const { buildAccessNav } = await import("../src/lib/masterNavigation.js");
const {
  resolveLanding,
  resolveLandingFromAccess,
  resolveEffectiveRole,
  landingNeedsRelationships,
  isFounderMembership,
} = await import("../src/models/platform/roles.js");
const { spaceForRole } = await import("../src/spaces/registry.js");
const { resolveParticipantParticipation } =
  await import("../src/services/participant/participation.js");

// ── Connexion ───────────────────────────────────────────────────────────────

const client = new pg.Client({
  connectionString: databaseUrl,
  ssl: /sslmode=/.test(databaseUrl) ? undefined : { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
});

const warnings = [];

async function query(label, sql) {
  try {
    const result = await client.query(sql);
    return result.rows;
  } catch (error) {
    warnings.push(`${label}: ${error.message.split("\n")[0]}`);
    return [];
  }
}

function groupBy(rows, key) {
  const map = new Map();
  for (const row of rows) {
    const value = row[key];
    if (!map.has(value)) map.set(value, []);
    map.get(value).push(row);
  }
  return map;
}

function buildSuperAdminMatrix() {
  const matrix = {};
  for (const [module, definition] of Object.entries(CAPABILITY_CATALOG)) {
    matrix[module] = {};
    for (const capability of Object.keys(definition.capabilities || {})) {
      matrix[module][capability] = ACCESS_LEVELS.FULL;
    }
  }
  return matrix;
}

function serializeMenu(items) {
  return (items || []).map((item) => ({
    id: item.id,
    href: item.href || null,
    subItems: item.subItems ? serializeMenu(item.subItems) : undefined,
  }));
}

await client.connect();
await client.query("SET statement_timeout = '120s'");

const who = await client.query("SELECT current_database() AS db, current_user AS usr");
const databaseName = who.rows[0]?.db || "unknown";
const databaseUser = who.rows[0]?.usr || "unknown";
const host = (() => {
  try {
    return new URL(databaseUrl).host;
  } catch {
    return "?";
  }
})();
// `postgres.<ref>` identifie le projet Supabase sans jamais exposer le mot de
// passe. C'est la seule façon de confirmer la cible sans lire les identifiants.
const projectRef = (() => {
  try {
    return new URL(databaseUrl).username;
  } catch {
    return "?";
  }
})();

console.log(`\n=== ÉTAPE 0 — PHOTOGRAPHIE (LECTURE SEULE) ===`);
console.log(`Base      : ${databaseName} @ ${host}`);
console.log(`Projet    : ${projectRef}`);
console.log(`Rôle SQL  : ${databaseUser}`);
console.log(`Source    : ${sourceEnvFile}`);
console.log(`Mode      : ${ONLY_CID ? `une personne (${ONLY_CID})` : "toutes les personnes"}${WITH_LANDING ? "" : ", sans arrivée"}`);
console.log("");

if (IS_PRODUCTION_TARGET) {
  console.warn("⚠ Cible de PRODUCTION — lecture seule, maintenance de schéma désactivée.");
}

// ── Lectures ────────────────────────────────────────────────────────────────

const cidFilter = ONLY_CID ? ` WHERE cid = '${String(ONLY_CID).replace(/'/g, "''")}'` : "";

const contacts = await query(
  "contacts",
  `SELECT cid, role, status, profile_key, group_name, email FROM contacts${cidFilter} ORDER BY cid`,
);
const assignments = await query(
  "profile_assignments",
  `SELECT contact_cid AS cid, profile_key
     FROM profile_assignments
    WHERE status = 'active'
      AND (ends_at IS NULL OR ends_at > NOW())
      AND (started_at IS NULL OR started_at <= NOW())`,
);
const profiles = await query("profiles", "SELECT key, is_active FROM profiles");
const roleDefaults = await query(
  "role_profile_defaults",
  "SELECT role_name, profile_key FROM role_profile_defaults",
);
const profileCaps = await query(
  "profile_capabilities",
  "SELECT profile_key, module, capability, access_level FROM profile_capabilities",
);
const groupCaps = await query(
  "group_capabilities",
  "SELECT group_name, module, capability, access_level FROM group_capabilities",
);
const memberships = await query(
  "group_memberships",
  "SELECT user_cid AS cid, group_name, status, expires_at FROM group_memberships",
);
const userGroups = await query(
  "user_groups",
  "SELECT user_cid AS cid, group_name FROM user_groups",
);
const grants = await query(
  "user_capabilities",
  `SELECT user_cid AS cid, module, capability, access_level
     FROM user_capabilities
    WHERE (expires_at IS NULL OR expires_at > NOW())`,
);
const restrictions = await query(
  "user_capability_restrictions",
  `SELECT user_cid AS cid, module, capability
     FROM user_capability_restrictions
    WHERE (expires_at IS NULL OR expires_at > NOW())`,
);
const eligibilityRows = await query(
  "feature_eligibility",
  "SELECT feature_key, identity_type, identity_value, eligible FROM feature_eligibility",
);
const ventureMembers = WITH_LANDING
  ? await query(
      "venture_members",
      `SELECT vm.user_cid, vm.contact_id, v.venture_id, v.status,
              vm.member_type, COALESCE(vm.is_owner, false) AS is_owner
         FROM venture_members vm
         LEFT JOIN ventures v ON vm.venture_id::text = v.id::text
        WHERE vm.removed_at IS NULL`,
    )
  : [];
const approvedInvestors = WITH_LANDING
  ? await query(
      "investor_profiles",
      "SELECT user_id FROM investor_profiles WHERE approval_status = 'approved'",
    )
  : [];

// ── Index ───────────────────────────────────────────────────────────────────

const activeProfileKeys = new Set(
  profiles.filter((row) => Number(row.is_active) === 1).map((row) => row.key),
);
const roleDefaultByRole = new Map(
  roleDefaults
    .filter((row) => activeProfileKeys.has(row.profile_key))
    .map((row) => [row.role_name, row.profile_key]),
);
const capsByProfile = groupBy(profileCaps, "profile_key");
const capsByGroup = groupBy(groupCaps, "group_name");
const assignmentsByCid = groupBy(assignments, "cid");
const membershipsByCid = groupBy(memberships, "cid");
const legacyGroupsByCid = groupBy(userGroups, "cid");
const grantsByCid = groupBy(grants, "cid");
const restrictionsByCid = groupBy(restrictions, "cid");
const approvedInvestorCids = new Set(approvedInvestors.map((row) => row.user_id));

const eligibilityByRole = groupBy(
  eligibilityRows.filter((row) => row.identity_type === "role"),
  "identity_value",
);
const eligibilityByGroup = groupBy(
  eligibilityRows.filter((row) => row.identity_type === "group"),
  "identity_value",
);
const eligibilityByProfile = groupBy(
  eligibilityRows.filter((row) => row.identity_type === "profile"),
  "identity_value",
);

const ownedVenturesByCid = new Map();
for (const row of ventureMembers) {
  for (const cid of [row.user_cid, row.contact_id]) {
    if (!cid) continue;
    if (!ownedVenturesByCid.has(cid)) ownedVenturesByCid.set(cid, []);
    ownedVenturesByCid.get(cid).push(row);
  }
}

const featureKeys = [...new Set(Object.values(MODULE_TO_FEATURE))];

// ── Calcul par personne ─────────────────────────────────────────────────────

const people = [];
for (const contact of contacts) {
  const cid = String(contact.cid);
  const storedRole = contact.role || "member";

  const personAssignments = assignmentsByCid.get(cid) || [];
  const activeProfiles = [
    ...new Set(personAssignments.map((row) => String(row.profile_key))),
  ];

  const personMemberships = membershipsByCid.get(cid) || [];
  const membershipGroupNames = new Set(personMemberships.map((row) => row.group_name));
  const legacyRows = (legacyGroupsByCid.get(cid) || []).filter(
    (row) => !membershipGroupNames.has(row.group_name),
  );
  const loginGroups = selectEffectiveGroups(personMemberships, legacyRows);
  // Le rôle que le moteur reçoit est celui résolu à la connexion, pas la valeur
  // brute de la fiche : un ancien libellé (`applicant`, `investor`, …) devient
  // `member`, et une appartenance interne devient `staff`.
  const role = resolveEffectiveRole({
    role: storedRole,
    groups: loginGroups,
    group_name: contact.group_name,
    isTeam: false,
    isFamily: false,
    legacySa: false,
  });
  // Le résolveur retombe sur le groupe stocké sur le contact quand la couche
  // d'appartenance ne répond rien. On reproduit ce repli.
  const groups =
    loginGroups.length > 0
      ? loginGroups
      : contact.group_name
        ? [String(contact.group_name)]
        : [];

  // Profil de base : surcharge de la personne, puis profil par défaut du rôle.
  let profileKey = null;
  let profileSource = "none";
  if (contact.profile_key && activeProfileKeys.has(contact.profile_key)) {
    profileKey = contact.profile_key;
    profileSource = "user";
  } else if (roleDefaultByRole.has(role)) {
    profileKey = roleDefaultByRole.get(role);
    profileSource = "role";
  }

  const baseCaps = rowsToCaps(
    profileKey ? capsByProfile.get(profileKey) || [] : [],
  );
  const personGroupCaps = rowsToCaps(
    groups.flatMap((group) => capsByGroup.get(group) || []),
  );
  const personGrants = rowsToCaps(grantsByCid.get(cid) || []);
  const personRestrictions = rowsToRestrictions(restrictionsByCid.get(cid) || []);

  const isSuperAdmin = role === "super_admin";
  let effective;
  let eligibility = null;
  let accountStatus = null;

  if (isSuperAdmin && !OWNER_THROUGH_ENGINE) {
    // Comportement ACTUEL : le propriétaire contourne l'éligibilité. Ses droits
    // viennent du profil par défaut s'il existe, sinon de la matrice complète.
    const ownerBase = profileKey ? baseCaps : buildSuperAdminMatrix();
    effective = mergeEffectiveCapabilities(
      ownerBase,
      {},
      personGrants,
      personRestrictions,
    );
  } else {
    const identityRows = [
      ...(eligibilityByRole.get(role) || []),
      ...groups.flatMap((group) => eligibilityByGroup.get(group) || []),
      ...activeProfiles.flatMap(
        (profile) => eligibilityByProfile.get(profile) || [],
      ),
    ];
    eligibility = {};
    for (const feature of featureKeys) {
      eligibility[feature] = explainEligibility(identityRows, feature).eligible;
    }
    effective = mergeEffectiveCapabilities(
      baseCaps,
      personGroupCaps,
      personGrants,
      personRestrictions,
    );
    accountStatus = contact.status ?? null;
  }

  const ctx = {
    isSuperAdmin,
    ownerThroughEngine: isSuperAdmin && OWNER_THROUGH_ENGINE,
    role,
    effective,
    restrictions: personRestrictions,
    eligibility,
    accountStatus,
  };
  // Le catalogue COMPLET, modules `registryOnly` inclus : la garde de route les
  // applique aussi, donc la photographie doit les contenir.
  const decisions = {};
  for (const [module, definition] of Object.entries(CAPABILITY_CATALOG)) {
    decisions[module] = {};
    for (const capability of Object.keys(definition.capabilities || {})) {
      const decision = explainAuthorization(ctx, module, capability, 1);
      decisions[module][capability] = {
        allowed: decision.allowed,
        reason: decision.reason,
      };
    }
  }
  const menu = serializeMenu(buildAccessNav(role, effective));

  let landing = null;
  let landingFacts = null;
  if (WITH_LANDING && role !== "team") {
    let ventures = [];
    let isInvestor = false;
    let isProgramParticipant = false;
    if (landingNeedsRelationships(role)) {
      ventures = ownedVenturesByCid.get(cid) || [];
      isInvestor = approvedInvestorCids.has(cid);
      try {
        const participation = await resolveParticipantParticipation({
          cid,
          email: contact.email || "",
        });
        isProgramParticipant = participation.isProgramParticipant === true;
      } catch (error) {
        warnings.push(`participation ${cid}: ${error.message.split("\n")[0]}`);
      }
    }
    landingFacts = {
      ownedVentures: ventures
        .filter((row) => row.is_owner === true || Number(row.is_owner) === 1)
        .map((row) => row.venture_id),
      isInvestor,
      isProgramParticipant,
    };
    landing = LANDING_FROM_RIGHTS
      ? resolveLandingFromAccess({
          role,
          teamId: null,
          ventures,
          isInvestor,
          isProgramParticipant,
          isFounder: ventures.some((venture) => isFounderMembership(venture)),
          profiles: activeProfiles,
          effective,
        })
      : resolveLanding({
          role,
          teamId: null,
          ventures,
          isInvestor,
          isProgramParticipant,
          profiles: activeProfiles,
        });
  }

  const personKey = INCLUDE_IDENTIFIERS
    ? cid
    : crypto.createHash("sha256").update(cid).digest("hex").slice(0, 16);

  people.push({
    ...(INCLUDE_IDENTIFIERS ? { cid } : {}),
    key: personKey,
    storedRole,
    role,
    status: contact.status ?? null,
    space: spaceForRole(role),
    isSuperAdmin,
    profile: { key: profileKey, source: profileSource },
    profiles: activeProfiles,
    groups,
    eligibility,
    effective,
    decisions,
    menu,
    landing,
    landingFacts,
  });
}

// ── Agrégats ────────────────────────────────────────────────────────────────

const countBy = (list, key) => {
  const out = {};
  for (const entry of list) {
    const value = String(entry[key] ?? "—");
    out[value] = (out[value] || 0) + 1;
  }
  return out;
};

const moduleCapabilityCounts = {};
for (const [module, definition] of Object.entries(CAPABILITY_CATALOG)) {
  moduleCapabilityCounts[module] = {};
  for (const capability of Object.keys(definition.capabilities || {})) {
    moduleCapabilityCounts[module][capability] = people.filter(
      (person) => person.decisions?.[module]?.[capability]?.allowed === true,
    ).length;
  }
}

const eligibilityCounts = {};
for (const feature of featureKeys) {
  eligibilityCounts[feature] = {
    eligible: people.filter((person) => person.eligibility?.[feature] === true).length,
    notEligible: people.filter((person) => person.eligibility?.[feature] === false).length,
    bypassed: people.filter((person) => person.eligibility === null).length,
  };
}

const snapshot = {
  generatedAt: GENERATED_AT.toISOString(),
  sourceEnvFile,
  database: { name: databaseName, user: databaseUser, host, projectRef },
  mode: {
    onlyCid: ONLY_CID,
    withLanding: WITH_LANDING,
    ownerThroughEngine: OWNER_THROUGH_ENGINE,
    landingFromRights: LANDING_FROM_RIGHTS,
  },
  catalogue: {
    featureOrder: FEATURE_ORDER,
    moduleToFeature: MODULE_TO_FEATURE,
    moduleCapabilities: Object.fromEntries(
      Object.entries(CAPABILITY_CATALOG).map(([module, definition]) => [
        module,
        Object.keys(definition.capabilities || {}),
      ]),
    ),
    enumerableModules: PERMISSION_MODULES,
    accessLevels: ACCESS_LEVELS,
  },
  warnings,
  summary: {
    people: people.length,
    identifiers: INCLUDE_IDENTIFIERS ? "raw" : "sha256-16",
    byRole: countBy(people, "role"),
    byStoredRole: countBy(people, "storedRole"),
    byStatus: countBy(people, "status"),
    bySpace: countBy(people, "space"),
    superAdmins: people.filter((person) => person.isSuperAdmin).length,
    profileSources: countBy(
      people.map((person) => ({ source: person.profile.source })),
      "source",
    ),
    landing: countBy(
      people.map((person) => ({ landing: person.landing ?? "—" })),
      "landing",
    ),
    eligibility: eligibilityCounts,
    allowedByModuleCapability: moduleCapabilityCounts,
  },
  people,
};

// ── Écriture ────────────────────────────────────────────────────────────────

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.mkdirSync(DOCS_DIR, { recursive: true });

const safeDatabase = String(databaseName).replace(/[^a-z0-9_-]/gi, "_");
const stamp = GENERATED_AT.toISOString().replace(/[:.]/g, "-");
const jsonPath = path.join(OUT_DIR, `etape0-${safeDatabase}-${stamp}.json`);
fs.writeFileSync(jsonPath, JSON.stringify(snapshot, null, 2), "utf8");

const md = [];
md.push("# Étape 0 — photographie de référence des décisions actuelles");
md.push("");
md.push(`Générée le ${snapshot.generatedAt}. **Lecture seule : aucun accès n'a été modifié.**`);
md.push("");
md.push(`- Base : \`${databaseName}\` (${host})`);
md.push(`- Projet : \`${projectRef}\``);
md.push(`- Rôle SQL : \`${databaseUser}\``);
md.push(`- Fichier d'environnement : \`${sourceEnvFile}\``);
md.push(`- Personnes photographiées : **${snapshot.summary.people}**`);
md.push(
  `- Mode propriétaire : ${snapshot.mode.ownerThroughEngine ? "même chemin que tout le monde (étape 2)" : "contournement actuel"}`,
);
md.push(
  `- Arrivée : ${snapshot.mode.landingFromRights ? "calculée depuis les droits et profils (étape 4)" : "table rôle → adresse actuelle"}`,
);
md.push("");
md.push("> Le détail reste local, dans `scratch/authz-reference/`. Les identifiants y sont remplacés par une empreinte stable par défaut (option `--include-identifiers` pour les garder).");
md.push("");
md.push("## Par rôle");
md.push("");
md.push("| Rôle | Personnes |");
md.push("|---|---:|");
for (const [role, count] of Object.entries(snapshot.summary.byRole).sort((a, b) => b[1] - a[1])) {
  md.push(`| \`${role}\` | ${count} |`);
}
md.push("");
md.push("## Rôles stockés (avant résolution de connexion)");
md.push("");
md.push("| Rôle stocké | Personnes |");
md.push("|---|---:|");
for (const [role, count] of Object.entries(snapshot.summary.byStoredRole).sort((a, b) => b[1] - a[1])) {
  md.push(`| \`${role}\` | ${count} |`);
}
md.push("");
md.push("## Par espace");
md.push("");
md.push("| Espace | Personnes |");
md.push("|---|---:|");
for (const [space, count] of Object.entries(snapshot.summary.bySpace)) {
  md.push(`| \`${space ?? "—"}\` | ${count} |`);
}
md.push("");
md.push("## Éligibilité par fonctionnalité");
md.push("");
md.push("| Fonctionnalité | Éligibles | Non éligibles | Propriétaire (contournement) |");
md.push("|---|---:|---:|---:|");
for (const feature of FEATURE_ORDER) {
  const entry = snapshot.summary.eligibility[feature] || {
    eligible: 0,
    notEligible: 0,
    bypassed: 0,
  };
  md.push(`| \`${feature}\` | ${entry.eligible} | ${entry.notEligible} | ${entry.bypassed} |`);
}
md.push("");
md.push("## Droits accordés, par module et action");
md.push("");
md.push("| Module | Action | Personnes autorisées |");
md.push("|---|---|---:|");
for (const [module, capabilities] of Object.entries(moduleCapabilityCounts)) {
  for (const [capability, count] of Object.entries(capabilities)) {
    md.push(`| \`${module}\` | \`${capability}\` | ${count} |`);
  }
}
md.push("");
md.push("## Arrivée après connexion");
md.push("");
md.push("| Adresse | Personnes |");
md.push("|---|---:|");
for (const [landing, count] of Object.entries(snapshot.summary.landing).sort((a, b) => b[1] - a[1])) {
  md.push(`| \`${landing}\` | ${count} |`);
}
md.push("");
if (warnings.length > 0) {
  md.push("## Avertissements de lecture");
  md.push("");
  for (const warning of warnings) md.push(`- ${warning}`);
  md.push("");
}
md.push("---");
md.push("");
md.push("### Comment utiliser cette photographie");
md.push("");
md.push("1. C'est la **référence** : toute étape suivante doit reproduire ces verdicts, sauf décision explicite de retirer un droit.");
md.push("2. Le propriétaire apparaît encore avec `eligibility: null` : c'est le contournement actuel, pas la cible.");
md.push("3. Les adresses d'arrivée sont celles d'aujourd'hui ; l'étape 4 les remplacera par un calcul fondé sur les droits.");
md.push("4. Pour comparer après une étape, relancer ce script et diffuser les deux JSON.");

const mdPath = path.join(DOCS_DIR, "ETAPE0-SNAPSHOT.md");
fs.writeFileSync(mdPath, md.join("\n"), "utf8");

// ── Comparaison avec une photographie précédente (parité des étapes) ──────

function flattenMenu(items, out = []) {
  for (const item of items || []) {
    out.push(item.id);
    flattenMenu(item.subItems, out);
  }
  return out;
}

let diff = null;
if (COMPARE_WITH) {
  const previousPath = path.isAbsolute(COMPARE_WITH)
    ? COMPARE_WITH
    : path.join(PROJECT_ROOT, COMPARE_WITH);
  const previous = JSON.parse(fs.readFileSync(previousPath, "utf8"));
  const previousByKey = new Map((previous.people || []).map((person) => [person.key, person]));
  const currentByKey = new Map(people.map((person) => [person.key, person]));

  const changes = [];
  for (const [key, current] of currentByKey) {
    const before = previousByKey.get(key);
    if (!before) {
      changes.push({ key, kind: "person-added", role: current.role });
      continue;
    }

    const features = new Set([
      ...Object.keys(before.eligibility || {}),
      ...Object.keys(current.eligibility || {}),
    ]);
    for (const feature of features) {
      const from = before.eligibility ? before.eligibility[feature] : null;
      const to = current.eligibility ? current.eligibility[feature] : null;
      if (from !== to) {
        changes.push({ key, kind: "eligibility", feature, from, to });
      }
    }

    for (const [module, capabilities] of Object.entries(current.decisions || {})) {
      for (const [capability, decision] of Object.entries(capabilities)) {
        const prior = before.decisions?.[module]?.[capability];
        if (!prior) continue;
        if (prior.allowed !== decision.allowed) {
          changes.push({
            key,
            kind: "decision",
            module,
            capability,
            from: prior.allowed,
            to: decision.allowed,
            reason: decision.reason,
          });
        }
      }
    }

    const beforeMenu = new Set(flattenMenu(before.menu));
    const currentMenu = new Set(flattenMenu(current.menu));
    for (const id of beforeMenu) {
      if (!currentMenu.has(id)) changes.push({ key, kind: "menu-lost", id });
    }
    for (const id of currentMenu) {
      if (!beforeMenu.has(id)) changes.push({ key, kind: "menu-added", id });
    }

    if ((before.landing ?? null) !== (current.landing ?? null)) {
      changes.push({
        key,
        kind: "landing",
        from: before.landing ?? null,
        to: current.landing ?? null,
      });
    }
  }
  for (const key of previousByKey.keys()) {
    if (!currentByKey.has(key)) changes.push({ key, kind: "person-removed" });
  }

  const regressions = changes.filter(
    (change) =>
      (change.kind === "decision" && change.from === true && change.to === false) ||
      change.kind === "menu-lost",
  );
  const widenings = changes.filter(
    (change) => change.kind === "decision" && change.from === false && change.to === true,
  );

  diff = {
    comparedWith: path.relative(PROJECT_ROOT, previousPath),
    generatedAt: GENERATED_AT.toISOString(),
    previousGeneratedAt: previous.generatedAt || null,
    counts: {
      changes: changes.length,
      regressions: regressions.length,
      widenings: widenings.length,
      peopleAdded: changes.filter((change) => change.kind === "person-added").length,
      peopleRemoved: changes.filter((change) => change.kind === "person-removed").length,
    },
    regressions,
    widenings,
    changes,
  };

  const diffPath = path.join(OUT_DIR, `diff-${safeDatabase}-${stamp}.json`);
  fs.writeFileSync(diffPath, JSON.stringify(diff, null, 2), "utf8");
  console.log(`\n=== COMPARAISON AVEC ${diff.comparedWith} ===`);
  console.log(`Changements : ${diff.counts.changes}`);
  console.log(`Régressions (droit retiré) : ${diff.counts.regressions}`);
  console.log(`Ouvertures (droit ajouté)  : ${diff.counts.widenings}`);
  if (diff.counts.regressions > 0) {
    console.log("\nRégressions :");
    for (const change of regressions.slice(0, 40)) {
      if (change.kind === "menu-lost") {
        console.log(`  - ${change.key} : menu perdu \`${change.id}\``);
      } else {
        console.log(
          `  - ${change.key} : ${change.module}.${change.capability} ${change.from} → ${change.to} (${change.reason})`,
        );
      }
    }
    if (regressions.length > 40) console.log(`  … ${regressions.length - 40} de plus`);
  }
  console.log(`Différentiel (local) : ${path.relative(PROJECT_ROOT, diffPath)}`);
}

await client.end();

console.log("=== RÉSUMÉ ===");
console.log(`Personnes : ${snapshot.summary.people}`);
console.log(`Par rôle  : ${JSON.stringify(snapshot.summary.byRole)}`);
console.log(`Propriétaire (contournement actuel) : ${snapshot.summary.superAdmins}`);
console.log(`Éligibilité : ${JSON.stringify(eligibilityCounts)}`);
if (warnings.length) {
  console.log(`\nAvertissements (${warnings.length}) :`);
  for (const warning of warnings.slice(0, 20)) console.log(`  - ${warning}`);
  if (warnings.length > 20) console.log(`  … ${warnings.length - 20} de plus`);
}
console.log(`\nDétail (local) : ${path.relative(PROJECT_ROOT, jsonPath)}`);
console.log(`Résumé (docs)  : ${path.relative(PROJECT_ROOT, mdPath)}`);
