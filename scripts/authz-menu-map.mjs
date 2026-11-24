#!/usr/bin/env node
/**
 * AUTHZ — ÉTAPE 3 : proposition de mapping menu → droit.
 *
 * READ ONLY. Lit l'arbre de navigation maître, les droits déjà déclarés et les
 * tables de rôle actuelles, puis imprime (ou écrit) une proposition pour chaque
 * destination.
 *
 *   node scripts/authz-menu-map.mjs --dump
 *   node scripts/authz-menu-map.mjs --write
 */

import { register } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

await register(new URL("./lib/import-loader.mjs", import.meta.url));

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..");
const ARGS = new Set(process.argv.slice(2));

const { MASTER_NAVIGATION } = await import("../src/lib/masterNavigation/nodes.js");
const { NAV_CAPABILITY_REQUIREMENTS, ROLE_ACCESS } = await import(
  "../src/lib/masterNavigation/access.js"
);
const { CAPABILITY_CATALOG } = await import(
  "../src/models/authorization/constants/feature-module-capability.js"
);
const { NAV_CAPABILITY_PROPOSAL, NAV_CAPABILITY_NOTES } = await import(
  "../src/models/authorization/navData.js"
);

// ── Today's role visibility ────────────────────────────────────────────────

function rolesSeeing(nodeId) {
  const roles = [];
  for (const [role, access] of Object.entries(ROLE_ACCESS)) {
    const inTop = (access.top || []).includes(nodeId);
    const inChildren = Object.values(access.children || {}).some((list) =>
      (list || []).includes(nodeId),
    );
    if (inTop || inChildren) roles.push(role);
  }
  return roles;
}

function flatten(nodes, parent = null, depth = 0, out = []) {
  for (const node of nodes) {
    out.push({
      id: node.id,
      name: node.name,
      href: node.href || null,
      icon: node.icon || null,
      parent,
      depth,
      requirement: NAV_CAPABILITY_REQUIREMENTS[node.id] || null,
      roles: rolesSeeing(node.id),
    });
    if (node.children?.length) flatten(node.children, node.id, depth + 1, out);
  }
  return out;
}

const nodes = flatten(MASTER_NAVIGATION);

// ── Proposed requirement ────────────────────────────────────────────────────
//
// The proposal lives in the inert data module `authorization/navData.js`.
// A node already carrying a requirement keeps it.

function proposalFor(node) {
  if (node.requirement) {
    return { value: null, source: "existing", note: "déjà déclaré" };
  }
  const value = NAV_CAPABILITY_PROPOSAL[node.id];
  if (value) {
    return {
      value,
      source: "proposal",
      note: NAV_CAPABILITY_NOTES[node.id] || "",
    };
  }
  return { value: "public", source: "default", note: "non listé — ouvert par défaut ?" };
}

function alternatives(value) {
  if (!value) return [];
  return String(value)
    .split(" OR ")
    .map((part) => part.trim())
    .filter(Boolean);
}

function formatRequirement(requirement) {
  if (!requirement) return "—";
  if (Array.isArray(requirement.anyOf)) {
    return requirement.anyOf.map(formatRequirement).join(" OR ");
  }
  if (requirement.module && requirement.capability) {
    return `${requirement.module}.${requirement.capability}`;
  }
  return JSON.stringify(requirement);
}

function validate(value) {
  if (!value || value === "public") return [];
  const problems = [];
  for (const alternative of alternatives(value)) {
    // Split at the FIRST dot: a facilitator capability is itself dotted
    // (`facilitator` + `reviews.submit`).
    const index = alternative.indexOf(".");
    if (index < 0) {
      problems.push(`format invalide: ${alternative}`);
      continue;
    }
    const moduleKey = alternative.slice(0, index);
    const capability = alternative.slice(index + 1);
    const definition = CAPABILITY_CATALOG[moduleKey];
    if (!definition) {
      problems.push(`module inconnu: ${moduleKey}`);
      continue;
    }
    if (!definition.capabilities?.[capability]) {
      problems.push(`capacité inconnue: ${moduleKey}.${capability}`);
    }
  }
  return problems;
}

const rows = nodes.map((node) => {
  const proposal = proposalFor(node);
  return {
    ...node,
    proposed: proposal.value,
    proposalSource: proposal.source,
    proposalNote: proposal.note,
    problems: validate(proposal.value),
  };
});

const withoutRequirement = rows.filter((row) => !row.requirement);
const proposedPublic = withoutRequirement.filter((row) => row.proposed === "public");
const invalid = rows.filter((row) => row.problems.length > 0);

console.log("\n=== ÉTAPE 3 — MAPPING MENU → DROIT (proposition) ===");
console.log(`Destinations totales        : ${rows.length}`);
console.log(`Déjà déclarées              : ${rows.length - withoutRequirement.length}`);
console.log(`À décider                   : ${withoutRequirement.length}`);
console.log(`  dont proposées publiques  : ${proposedPublic.length}`);
console.log(`Propositions invalides      : ${invalid.length}`);
if (invalid.length > 0) {
  for (const row of invalid) console.log(`  - ${row.id}: ${row.problems.join(", ")}`);
}

if (ARGS.has("--dump")) {
  console.log("\n--- ARBRE ---");
  for (const row of rows) {
    console.log(
      JSON.stringify({
        id: row.id,
        name: row.name,
        href: row.href,
        parent: row.parent,
        depth: row.depth,
        requirement: row.requirement,
        proposed: row.proposed,
        roles: row.roles,
      }),
    );
  }
}

if (ARGS.has("--write")) {
  const outDir = path.join(PROJECT_ROOT, "docs", "permissions");
  fs.mkdirSync(outDir, { recursive: true });

  const md = [];
  md.push("# Étape 3 — proposition de mapping menu → droit");
  md.push("");
  md.push("Généré en lecture seule à partir de l'arbre de navigation, des droits");
  md.push("déjà déclarés et des tables de rôle actuelles. **Aucun code n'est modifié.**");
  md.push("");
  md.push("Une destination est soit `public` (aucun droit), soit un ou plusieurs");
  md.push("droits séparés par ` OR ` (un seul suffit).");
  md.push("");
  md.push("| Destination | Nom | Section parente | Droit actuel | Droit proposé | Rôles qui la voient aujourd'hui | Note |");
  md.push("|---|---|---|---|---|---|---|");
  for (const row of rows) {
    md.push(
      `| \`${row.id}\` | ${row.name} | ${row.parent ? `\`${row.parent}\`` : "—"} | ${
        row.requirement ? `\`${formatRequirement(row.requirement)}\`` : "—"
      } | ${row.proposed ? `\`${row.proposed}\`` : "—"} | ${row.roles.join(", ") || "—"} | ${row.proposalNote || ""} |`,
    );
  }
  md.push("");
  md.push("## Constats");
  md.push("");
  md.push("- `my_projects` apparaît **deux fois** dans l'arbre maître (une fois sous `reports`, une fois à la racine). C'est un point à corriger avant de dériver le menu.");
  md.push("- La section `security` porte déjà `settings.view`, plus large que la fonctionnalité sécurité ; à revoir.");
  md.push("- `pending_users` porte déjà `permissions.view_matrix` ; les approbations pourraient relever de `users.view`.");
  md.push("- Les 31 destinations déjà déclarées le sont dans le code (`NAV_CAPABILITY_REQUIREMENTS`), pas en base. L'étape 3 devra aussi les déplacer en données.");
  md.push("");
  md.push("## Points à valider");
  md.push("");
  md.push("- Les destinations `public` sont accessibles sans droit ; elles doivent");
  md.push("  réellement être personnelles ou neutres.");
  md.push("- Les propositions `OR` ouvrent la porte à plusieurs droits ; vérifier");
  md.push("  qu'aucune ne mélange deux publics différents.");
  md.push("- Les rôles listés sont l'état ACTUEL, pas la cible : ils servent à");
  md.push("  repérer une éventuelle perte de porte lors de la bascule.");
  md.push("");

  const mdPath = path.join(outDir, "ETAPE3-MENU-MAPPING-PROPOSAL.md");
  const jsonPath = path.join(outDir, "ETAPE3-MENU-MAPPING-PROPOSAL.json");
  fs.writeFileSync(mdPath, md.join("\n"), "utf8");
  fs.writeFileSync(
    jsonPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        counts: {
          total: rows.length,
          existing: rows.length - withoutRequirement.length,
          toDecide: withoutRequirement.length,
          proposedPublic: proposedPublic.length,
          invalid: invalid.length,
        },
        rows,
      },
      null,
      2,
    ),
    "utf8",
  );
  console.log(`\nProposition : ${path.relative(PROJECT_ROOT, mdPath)}`);
  console.log(`JSON        : ${path.relative(PROJECT_ROOT, jsonPath)}`);
}
