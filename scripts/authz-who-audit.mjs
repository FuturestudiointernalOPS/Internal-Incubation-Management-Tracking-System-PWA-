#!/usr/bin/env node
/**
 * AUTHZ — ÉTAPE 0 : inventaire des décisions « QUI » écrites dans le code.
 *
 * READ ONLY. Ce script ne modifie aucun fichier applicatif et ne se connecte à
 * aucune base. Il lit les tables de décision encore codées en dur, puis scanne
 * les sources pour classer chaque mention du propriétaire.
 *
 * Sorties :
 *   docs/permissions/ETAPE0-WHOAUDIT.md    (inventaire lisible)
 *   docs/permissions/ETAPE0-WHOAUDIT.json  (même contenu, exploitable)
 *
 * Usage :
 *   node scripts/authz-who-audit.mjs
 *   node scripts/authz-who-audit.mjs --json   (n'écrit pas les fichiers)
 */

import { register } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

await register(new URL("./lib/import-loader.mjs", import.meta.url));

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..");
const SRC = path.join(PROJECT_ROOT, "src");
const OUT_DIR = path.join(PROJECT_ROOT, "docs", "permissions");
const generatedAt = new Date().toISOString();

const { ROLE_ACCESS, NAV_CAPABILITY_REQUIREMENTS, NON_ADMIN_HREF_FALLBACKS } =
  await import("../src/lib/masterNavigation/access.js");
const { MASTER_NAVIGATION } = await import("../src/lib/masterNavigation/nodes.js");
const {
  SPACE_KEYS,
  SPACES,
  OPERATING_DENIED,
  spaceForRole,
} = await import("../src/spaces/registry.js");
const {
  ROLE_HOME,
  INTERNAL_OPS_ROLES,
  landingNeedsRelationships,
} = await import("../src/models/platform/roles.js");
const {
  PROFILE_CATALOG,
  PROFILE_BASELINE_ROLES,
  PROFILE_ROLE_ENFORCEMENT,
} = await import("../src/models/authorization/profile-catalog.js");
const {
  FEATURE_ELIGIBILITY_DEFAULTS,
  FEATURE_ELIGIBILITY_PROFILE_DEFAULTS,
  PROGRAM_ASSIGNMENT_ROWS,
} = await import("../src/models/authorization/constants/index.js");
const {
  RESPONSIBILITY_FEATURE_ROLES,
  ALL_FEATURE_IDENTITIES,
} = await import("../src/lib/featureAccess.js");

// ── Helpers ─────────────────────────────────────────────────────────────────

const toPosix = (p) => p.split(path.sep).join("/");
const relOf = (abs) => toPosix(path.relative(PROJECT_ROOT, abs));

function walk(dir, keep, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".next") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, keep, out);
    else if (keep(entry.name)) out.push(full);
  }
  return out;
}

const sourceFiles = walk(
  SRC,
  (name) => name.endsWith(".js") || name.endsWith(".jsx"),
).filter((file) => !file.startsWith(path.join(SRC, "__tests__") + path.sep));

function linesOf(file) {
  return fs.readFileSync(file, "utf8").split(/\r?\n/);
}

// ── 1. Tables de navigation par rôle (à supprimer à l'étape 3) ──────────────

const roleMenu = {};
for (const [role, access] of Object.entries(ROLE_ACCESS)) {
  roleMenu[role] = {
    top: access.top || [],
    children: Object.keys(access.children || {}),
    hrefOverrides: Object.keys(access.hrefs || {}),
    iconOverrides: Object.keys(access.icons || {}),
  };
}

function collectNodeIds(items, out = []) {
  for (const item of items || []) {
    out.push(item.id);
    if (item.children?.length) collectNodeIds(item.children, out);
  }
  return out;
}
const allNodeIds = [...new Set(collectNodeIds(MASTER_NAVIGATION))];
const nodesWithRequirement = allNodeIds.filter(
  (id) => NAV_CAPABILITY_REQUIREMENTS[id] != null,
);
const nodesWithoutRequirement = allNodeIds.filter(
  (id) => NAV_CAPABILITY_REQUIREMENTS[id] == null,
);

// ── 2. Espaces et arrivée par rôle (à supprimer aux étapes 4 et 5) ──────────

const spaces = Object.fromEntries(
  SPACE_KEYS.map((key) => [
    key,
    {
      home: SPACES[key].home,
      identities: SPACES[key].identities,
      spaceForIdentity: Object.fromEntries(
        SPACES[key].identities.map((identity) => [identity, spaceForRole(identity)]),
      ),
    },
  ]),
);

const landing = {
  roleHome: { ...ROLE_HOME },
  internalOpsRoles: [...INTERNAL_OPS_ROLES],
  needsRelationships: Object.fromEntries(
    Object.keys(ROLE_HOME).map((role) => [role, landingNeedsRelationships(role)]),
  ),
};

// ── 3. Valeurs d'accès fournies par le code (à déplacer à l'étape 1) ────────

const codeDefaults = {
  eligibilityRoleDefaults: FEATURE_ELIGIBILITY_DEFAULTS,
  eligibilityProfileDefaults: FEATURE_ELIGIBILITY_PROFILE_DEFAULTS,
  programAssignmentRows: PROGRAM_ASSIGNMENT_ROWS,
  responsibilityFeatureRoles: {
    aliasedToEligibilityDefaults:
      RESPONSIBILITY_FEATURE_ROLES === FEATURE_ELIGIBILITY_DEFAULTS,
    entries: RESPONSIBILITY_FEATURE_ROLES,
  },
  profileCatalogueSeed: PROFILE_CATALOG.map((profile) => ({
    key: profile.key,
    context: profile.context,
    allowedRoles: profile.allowedRoles,
  })),
  profileBaselineRoles: [...PROFILE_BASELINE_ROLES],
  profileRoleEnforcement: PROFILE_ROLE_ENFORCEMENT,
  allFeatureIdentities: [...ALL_FEATURE_IDENTITIES],
};

/** One-time seed markers found in the bootstrap service (runtime writes). */
const seedMarkers = [];
{
  const file = path.join(SRC, "services", "authorization", "contextBootstrap.js");
  if (fs.existsSync(file)) {
    const text = fs.readFileSync(file, "utf8");
    const re = /runAuthzMigration\(\s*["']([^"']+)["']/g;
    let match;
    while ((match = re.exec(text))) seedMarkers.push(match[1]);
  }
}

// ── 4. Classification des mentions du propriétaire ──────────────────────────

const OWNER_PATTERN = /super_admin/i;

function classifyLine(rawLine, file) {
  const line = rawLine.trim();
  if (!line) return null;
  if (/^(\/\/|\*|\/\*|#)/.test(line)) return "comment";
  if (
    /(isSuperAdmin|isPlatformOwnerRole|roleIsPrivileged|PRIVILEGED_ROLES|FACILITATOR_BYPASS_ROLES|WARNING_BYPASS_ROLES)/.test(
      line,
    )
  ) {
    return "decision";
  }
  if (
    /(role|roles|\.role)\s*(===|!==|==|!=)\s*["']super_admin["']/i.test(line) ||
    /["']super_admin["']\s*(===|!==|==|!=)/i.test(line)
  ) {
    return "decision";
  }
  if (/(\.includes\(|roles\s*:|requireAuth\(\s*\[)/.test(line) && OWNER_PATTERN.test(line)) {
    return "decision";
  }
  const rel = relOf(file);
  if (
    /(FEATURE_ELIGIBILITY|PROFILE_CATALOG|allowedRoles|allowed_roles|DEFAULT|seed|bootstrap)/i.test(
      line,
    ) ||
    rel.includes("constants/") ||
    rel.includes("migrations")
  ) {
    return "default";
  }
  if (/(ROLE_HOME|href|redirect|router\.push|\/admin|\/staff|\/member)/i.test(line)) {
    return "routing";
  }
  if (/["'`][^"'`]*super[ _-]?admin[^"'`]*["'`]/i.test(line)) return "label";
  return "other";
}

const ownerMentions = [];
for (const file of sourceFiles) {
  linesOf(file).forEach((line, index) => {
    if (!OWNER_PATTERN.test(line)) return;
    const category = classifyLine(line, file);
    if (!category) return;
    ownerMentions.push({
      file: relOf(file),
      line: index + 1,
      category,
      snippet: line.trim().slice(0, 220),
    });
  });
}

const ownerByCategory = ownerMentions.reduce((acc, entry) => {
  acc[entry.category] = (acc[entry.category] || 0) + 1;
  return acc;
}, {});
const ownerDecisionLines = ownerMentions.filter(
  (entry) => entry.category === "decision",
);
const ownerBypassFiles = [...new Set(ownerDecisionLines.map((entry) => entry.file))].sort();

// ── 5. Comparaisons de rôle hors moteur (mêmes motifs que la garde) ─────────

const ENGINE_PREFIXES = [
  path.join(SRC, "server", "authz") + path.sep,
  path.join(SRC, "models", "authorization") + path.sep,
  path.join(SRC, "services", "authorization") + path.sep,
];

const ROLE_MOTIFS = {
  M1: { label: "requireAuth([...])", re: /requireAuth\(\s*\[/ },
  M2: { label: "roles: [...]", re: /roles\s*:\s*\[/ },
  M3: { label: "role === / role !==", re: /role\s*===|role\s*!==/ },
  M4: { label: ".includes(...role...)", re: /\.includes\(.*role/ },
};

const adHocEntries = [];
for (const file of sourceFiles) {
  if (ENGINE_PREFIXES.some((prefix) => file.startsWith(prefix))) continue;
  linesOf(file).forEach((line, index) => {
    for (const [key, motif] of Object.entries(ROLE_MOTIFS)) {
      if (!motif.re.test(line)) continue;
      adHocEntries.push({
        file: relOf(file),
        line: index + 1,
        motif: key,
        snippet: line.trim().slice(0, 220),
      });
    }
  });
}
const adHocByMotif = adHocEntries.reduce((acc, entry) => {
  acc[entry.motif] = (acc[entry.motif] || 0) + 1;
  return acc;
}, {});
const adHocByFile = adHocEntries.reduce((acc, entry) => {
  acc[entry.file] = (acc[entry.file] || 0) + 1;
  return acc;
}, {});

// ── 6. Rapport ──────────────────────────────────────────────────────────────

const report = {
  generatedAt,
  scope: {
    note: "Inventaire statique des décisions « qui » encore écrites dans le code. Aucun accès n'est modifié.",
    sourceFilesScanned: sourceFiles.length,
    engineExcluded: ENGINE_PREFIXES.map(relOf),
  },
  counts: {
    rolesInMenuTable: Object.keys(ROLE_ACCESS).length,
    menuNodes: allNodeIds.length,
    menuNodesWithoutRequirement: nodesWithoutRequirement.length,
    spaces: SPACE_KEYS.length,
    landingEntries: Object.keys(ROLE_HOME).length,
    ownerMentions: ownerMentions.length,
    ownerDecisionLines: ownerDecisionLines.length,
    ownerBypassFiles: ownerBypassFiles.length,
    adHocRoleComparisons: adHocEntries.length,
    adHocFiles: Object.keys(adHocByFile).length,
    seedMarkers: seedMarkers.length,
  },
  menu: {
    byRole: roleMenu,
    nodesWithRequirement,
    nodesWithoutRequirement,
    nonAdminHrefFallbacks: Object.keys(NON_ADMIN_HREF_FALLBACKS),
  },
  spaces: {
    operatingDenied: [...OPERATING_DENIED],
    byKey: spaces,
  },
  landing,
  codeDefaults,
  seedMarkers,
  owner: {
    byCategory: ownerByCategory,
    bypassFiles: ownerBypassFiles,
    decisionLines: ownerDecisionLines,
  },
  adHocRoleComparisons: {
    byMotif: adHocByMotif,
    byFile: adHocByFile,
    entries: adHocEntries,
  },
};

function mdTable(headers, rows) {
  const out = [`| ${headers.join(" | ")} |`, `|${headers.map(() => "---").join("|")}|`];
  for (const row of rows) out.push(`| ${row.join(" | ")} |`);
  return out.join("\n");
}

function escapeCell(value) {
  return String(value ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function buildMarkdown(data) {
  const lines = [];
  lines.push("# Étape 0 — inventaire des décisions « qui » encore dans le code");
  lines.push("");
  lines.push(`Généré le ${data.generatedAt}. **Aucun accès n'a été modifié.**`);
  lines.push("");
  lines.push("Ce document est la liste de travail des étapes 1 à 6 : chaque");
  lines.push("section indique ce qui doit cesser de décider dans le code.");
  lines.push("");
  lines.push("## Résumé");
  lines.push("");
  lines.push(
    mdTable(
      ["Indicateur", "Valeur"],
      [
        ["Rôles dans la table de menu", data.counts.rolesInMenuTable],
        ["Destinations du menu", data.counts.menuNodes],
        [
          "Destinations sans droit déclaré",
          data.counts.menuNodesWithoutRequirement,
        ],
        ["Espaces", data.counts.spaces],
        ["Entrées de la table d'arrivée", data.counts.landingEntries],
        ["Mentions du propriétaire", data.counts.ownerMentions],
        ["  dont décisions probables", data.counts.ownerDecisionLines],
        ["Fichiers avec une décision « propriétaire »", data.counts.ownerBypassFiles],
        ["Comparaisons de rôle hors moteur (lignes)", data.counts.adHocRoleComparisons],
        ["Fichiers concernés", data.counts.adHocFiles],
        ["Marqueurs de seed à l'exécution", data.counts.seedMarkers],
      ],
    ),
  );
  lines.push("");
  lines.push(
    "> La classification des mentions du propriétaire est **heuristique**.",
  );
  lines.push(
    "> Chaque ligne est listée avec son extrait : la colonne « catégorie » propose, elle ne tranche pas.",
  );
  lines.push("");

  lines.push("## 1. Table de menu par rôle (à supprimer — étape 3)");
  lines.push("");
  for (const [role, access] of Object.entries(data.menu.byRole)) {
    lines.push(`### \`${role}\``);
    lines.push("");
    lines.push(`- Sections : ${access.top.join(", ") || "—"}`);
    lines.push(`- Enfants surchargés : ${access.children.length}`);
    lines.push(`- Adresses surchargées : ${access.hrefOverrides.join(", ") || "—"}`);
    lines.push(`- Icônes surchargées : ${access.iconOverrides.join(", ") || "—"}`);
    lines.push("");
  }

  lines.push("## 2. Destinations du menu sans droit déclaré");
  lines.push("");
  lines.push(
    "Ces destinations ne peuvent pas encore être dérivées des droits : il faut leur associer un droit, ou les déclarer ouvertes à tous.",
  );
  lines.push("");
  const withoutRows = data.menu.nodesWithoutRequirement.map((id) => [`\`${id}\``, "aucun"]);
  lines.push(mdTable(["Destination", "Droit exigé"], withoutRows));
  lines.push("");
  lines.push(
    `${data.menu.nodesWithRequirement.length} destinations ont déjà un droit déclaré (détail dans le JSON).`,
  );
  lines.push("");

  lines.push("## 3. Espaces (à trancher — étape 5)");
  lines.push("");
  lines.push(
    mdTable(
      ["Espace", "Accueil", "Identités"],
      Object.entries(data.spaces.byKey).map(([key, value]) => [
        `\`${key}\``,
        `\`${value.home}\``,
        value.identities.join(", "),
      ]),
    ),
  );
  lines.push("");
  lines.push(`Identités refusées dans un espace d'exploitation : ${data.spaces.operatingDenied.join(", ") || "—"}`);
  lines.push("");

  lines.push("## 4. Arrivée après connexion (à supprimer — étape 4)");
  lines.push("");
  lines.push(
    mdTable(
      ["Rôle", "Adresse codée", "Dépend des relations"],
      Object.entries(data.landing.roleHome).map(([role, home]) => [
        `\`${role}\``,
        `\`${home}\``,
        data.landing.needsRelationships[role] ? "oui" : "non",
      ]),
    ),
  );
  lines.push("");
  lines.push(`Rôles internes autorisés aux rapports opérationnels : ${data.landing.internalOpsRoles.join(", ")}`);
  lines.push("");

  lines.push("## 5. Valeurs d'accès fournies par le code (à déplacer — étape 1)");
  lines.push("");
  lines.push("### Éligibilité par rôle de base");
  lines.push("");
  lines.push(
    mdTable(
      ["Fonctionnalité", "Identités éligibles"],
      Object.entries(data.codeDefaults.eligibilityRoleDefaults).map(([key, values]) => [
        `\`${key}\``,
        values.join(", ") || "aucune",
      ]),
    ),
  );
  lines.push("");
  lines.push("### Éligibilité par profil");
  lines.push("");
  lines.push(
    mdTable(
      ["Fonctionnalité", "Profils éligibles"],
      Object.entries(data.codeDefaults.eligibilityProfileDefaults).map(([key, values]) => [
        `\`${key}\``,
        values.join(", ") || "aucun",
      ]),
    ),
  );
  lines.push("");
  lines.push("### Rôle → profil par défaut et catalogue de profils");
  lines.push("");
  lines.push(
    mdTable(
      ["Profil", "Contexte", "Rôles de base autorisés"],
      data.codeDefaults.profileCatalogueSeed.map((profile) => [
        `\`${profile.key}\``,
        profile.context,
        profile.allowedRoles.join(", ") || "aucun",
      ]),
    ),
  );
  lines.push("");
  lines.push(`Rôles de base acceptés : ${data.codeDefaults.profileBaselineRoles.join(", ")}`);
  lines.push("");
  lines.push(`Règle profil ↔ rôle : \`${data.codeDefaults.profileRoleEnforcement}\``);
  lines.push("");
  lines.push(`Marqueurs de seed à l'exécution : ${data.seedMarkers.map((marker) => `\`${marker}\``).join(", ") || "—"}`);
  lines.push("");

  lines.push("## 6. Mentions du propriétaire, par catégorie");
  lines.push("");
  lines.push(
    mdTable(
      ["Catégorie", "Nombre"],
      Object.entries(data.owner.byCategory)
        .sort((left, right) => right[1] - left[1])
        .map(([category, count]) => [category, count]),
    ),
  );
  lines.push("");
  lines.push("### Décisions probables — lignes à traiter");
  lines.push("");
  const decisionRows = data.owner.decisionLines.map((entry) => [
    `\`${entry.file}:${entry.line}\``,
    escapeCell(entry.snippet),
  ]);
  lines.push(mdTable(["Fichier", "Extrait"], decisionRows));
  lines.push("");

  lines.push("## 7. Comparaisons de rôle hors du moteur");
  lines.push("");
  lines.push(
    mdTable(
      ["Motif", "Lignes"],
      Object.entries(data.adHocRoleComparisons.byMotif).map(([motif, count]) => [
        `${motif} — ${ROLE_MOTIFS[motif].label}`,
        count,
      ]),
    ),
  );
  lines.push("");
  lines.push("### Par fichier");
  lines.push("");
  lines.push(
    mdTable(
      ["Fichier", "Lignes"],
      Object.entries(data.adHocRoleComparisons.byFile)
        .sort((left, right) => right[1] - left[1])
        .map(([file, count]) => [`\`${file}\``, count]),
    ),
  );
  lines.push("");
  lines.push("Le détail ligne par ligne est dans le JSON.");
  lines.push("");

  return lines.join("\n");
}

const markdown = buildMarkdown(report);

if (process.argv.includes("--json")) {
  console.log(JSON.stringify(report, null, 2));
  process.exit(0);
}

fs.mkdirSync(OUT_DIR, { recursive: true });
const mdPath = path.join(OUT_DIR, "ETAPE0-WHOAUDIT.md");
const jsonPath = path.join(OUT_DIR, "ETAPE0-WHOAUDIT.json");
fs.writeFileSync(mdPath, markdown, "utf8");
fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), "utf8");

console.log("\n=== ÉTAPE 0 — INVENTAIRE STATIQUE (lecture seule) ===");
console.log(`Fichiers sources scannés : ${report.scope.sourceFilesScanned}`);
console.log(`Rôles dans la table de menu : ${report.counts.rolesInMenuTable}`);
console.log(`Destinations sans droit déclaré : ${report.counts.menuNodesWithoutRequirement} / ${report.counts.menuNodes}`);
console.log(`Mentions du propriétaire : ${report.counts.ownerMentions} (dont ${report.counts.ownerDecisionLines} décisions probables dans ${report.counts.ownerBypassFiles} fichiers)`);
console.log(`Comparaisons de rôle hors moteur : ${report.counts.adHocRoleComparisons} lignes dans ${report.counts.adHocFiles} fichiers`);
console.log(`\nRapport : ${relOf(mdPath)}`);
console.log(`JSON    : ${relOf(jsonPath)}`);
