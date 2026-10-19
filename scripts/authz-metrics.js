#!/usr/bin/env node
/**
 * AUTHZ METRICS — Lot 0 dashboard (READ ONLY).
 *
 *   node scripts/authz-metrics.js             human dashboard
 *   node scripts/authz-metrics.js --json      machine-readable snapshot
 *   node scripts/authz-metrics.js --list      the actions without capability
 *   node scripts/authz-metrics.js --check     fail when the ratchet regresses
 *
 * The shared calculation lives in scripts/lib/authzMetrics.js, so the CLI and
 * the Jest ratchet can never disagree.
 */

const fs = require("node:fs");
const path = require("node:path");
const { ROOT, collectMetrics, compareToBaseline } = require("./lib/authzMetrics");

const args = new Set(process.argv.slice(2));
const metrics = collectMetrics();

const categoryLabels = {
  a_proteger: "À protéger",
  a_verifier_decision_deleguee: "À vérifier — décision déléguée",
  personnelle_legitime: "Personnelle légitime",
  ouverte_assumee: "Ouverte assumée",
};

if (args.has("--json")) {
  console.log(JSON.stringify(metrics, null, 2));
  process.exit(0);
}

function buildMarkdown(snapshot) {
  const lines = [];
  lines.push("# Lot 0 — actions serveur sans capacité (liste exacte)");
  lines.push("");
  lines.push(`Mesuré le ${snapshot.generatedAt}.`);
  lines.push("");
  lines.push(
    "Définition : une action est « sans capacité » quand aucun contrôle de fichier ne vérifie une capacité. Les catégories distinguent les trous des déclarations légitimes.",
  );
  lines.push("");
  lines.push("| Catégorie | Nombre | Sens |");
  lines.push("|---|---:|---|");
  lines.push(`| À protéger | ${snapshot.routes.withoutCapabilityByCategory.a_proteger} | Trou de décision à corriger |`);
  lines.push(`| À vérifier — décision déléguée | ${snapshot.routes.withoutCapabilityByCategory.a_verifier_decision_deleguee} | Périmètre présent, capacité absente |`);
  lines.push(`| Personnelle légitime | ${snapshot.routes.withoutCapabilityByCategory.personnelle_legitime} | Déclarée « soi-même » |`);
  lines.push(`| Ouverte assumée | ${snapshot.routes.withoutCapabilityByCategory.ouverte_assumee} | Déclarée publique / hub / stub |`);
  lines.push("");
  lines.push(
    `Le compteur d'audit « requireAuth sans contrôle central » est de **${snapshot.routes.strictRequireAuthOnlyNoCapability}** fichiers. La liste ci-dessous en contient **${snapshot.routes.withoutCapabilityWorklist}** parce qu'elle inclut aussi les enveloppes d'action et les lectures de session manuelles.`,
  );
  lines.push("");

  const strictEntries = snapshot.routes.strictRequireAuthOnlyList
    .slice()
    .sort((left, right) => left.file.localeCompare(right.file));
  lines.push(`## Compteur d'audit strict (${strictEntries.length})`);
  lines.push("");
  lines.push(
    "Ces fichiers appellent la garde de session mais jamais le contrôle central de capacité. Une capacité peut toutefois être vérifiée par une garde composée : la colonne le dit.",
  );
  lines.push("");
  lines.push("| Fichier | Capacité composée | Périmètre |");
  lines.push("|---|---|---|");
  for (const entry of strictEntries) {
    lines.push(
      `| \`${entry.file}\` | ${entry.composedCapability ? "oui" : "non"} | ${entry.scoped ? "oui" : "non"} |`,
    );
  }
  lines.push("");

  for (const [key, label] of Object.entries(categoryLabels)) {
    const entries = snapshot.routes.withoutCapabilityList
      .filter((entry) => entry.category === key)
      .sort((left, right) => left.file.localeCompare(right.file));
    lines.push(`## ${label} (${entries.length})`);
    lines.push("");
    if (entries.length === 0) {
      lines.push("Aucune action.");
      lines.push("");
      continue;
    }
    lines.push("| Fichier | Garde présente | Périmètre | Compteur d'audit strict |");
    lines.push("|---|---|---|---|");
    for (const entry of entries) {
      lines.push(
        `| \`${entry.file}\` | ${entry.auth} | ${entry.scoped ? "oui" : "non"} | ${entry.strictAudit ? "oui" : "non"} |`,
      );
    }
    lines.push("");
  }
  return lines.join("\n");
}

if (args.has("--write-docs")) {
  const target = path.join(ROOT, "docs", "permissions", "LOT0-ACTIONS-SANS-CAPACITE.md");
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, buildMarkdown(metrics), "utf8");
  console.log(`Liste écrite: ${target}`);
  process.exit(0);
}

function line(label, value, target, direction) {
  return {
    indicateur: label,
    mesure: String(value),
    cible: String(target),
    sens: direction === "down" ? "↓" : direction === "up" ? "↑" : "=",
  };
}

const rows = [
  line("Fichiers d'actions serveur", metrics.routes.routeFiles, "—", "stable"),
  line(
    "Fichiers d'actions avec le contrôle central (compteur d'audit)",
    metrics.routes.centralCapabilityFiles,
    "tous",
    "up",
  ),
  line(
    "  dont fichiers d'action serveur (route.js)",
    metrics.routes.centralCapabilityRouteFiles,
    "tous",
    "up",
  ),
  line(
    "Fichiers d'action avec une capacité (tous fichiers, gardes composées incluses)",
    metrics.routes.capabilityFiles,
    "tous",
    "up",
  ),
  line(
    "  dont fichiers d'action serveur (route.js)",
    metrics.routes.capabilityRouteFiles,
    "tous",
    "up",
  ),
  line(
    "Actions avec un contrôle de session/rôle",
    metrics.routes.requireAuthRouteFiles,
    "0 sans capacité",
    "down",
  ),
  line(
    "Actions cumulant session et capacité",
    metrics.routes.bothRouteFiles,
    "—",
    "stable",
  ),
  line(
    "Actions « requireAuth » sans capacité (compteur d'audit)",
    metrics.routes.strictRequireAuthOnlyNoCapability,
    "0",
    "down",
  ),
  line(
    "Actions sans capacité (liste de travail)",
    metrics.routes.withoutCapabilityWorklist,
    "0",
    "down",
  ),
  ...Object.entries(metrics.routes.withoutCapabilityByCategory).map(([key, value]) =>
    line(`  dont ${categoryLabels[key]}`, value, key === "a_proteger" ? "0" : "—", "down"),
  ),
  line(
    "Listes de rôles en dur dans les actions",
    metrics.roleGates.hardcodedRoleListsInActions,
    "0",
    "down",
  ),
  line(
    "Comparaisons de rôle hors moteur (lignes)",
    metrics.roleGates.roleMotifLineTotal,
    "0 hors identité",
    "down",
  ),
  line(
    "Exceptions figées du garde-fou rôles",
    metrics.roleGates.staticGuardExceptions,
    "0",
    "down",
  ),
  line(
    "Exceptions figées du garde-fou étendu",
    metrics.roleGates.extendedGuardExceptions,
    "0",
    "down",
  ),
  line(
    "Nouvelles occurrences non listées (doit être 0)",
    metrics.roleGates.staticGuardUnexpected,
    "0",
    "down",
  ),
  line(
    "Exceptions périmées (doit être 0)",
    metrics.roleGates.staticGuardStale,
    "0",
    "down",
  ),
  line(
    "Actions réservées au gestionnaire de programme sans personnel",
    metrics.roleGates.pmOnlyRoleGates,
    "0",
    "down",
  ),
  line(
    "Décisions qui lisent encore le rôle « gestionnaire de programme »",
    metrics.roleVocabulary.pmRoleDecisions,
    "0",
    "down",
  ),
  line(
    "Mentions du libellé « gestionnaire de programme » (info)",
    metrics.roleVocabulary.pmOccurrences,
    "profil seulement",
    "stable",
  ),
  line(
    "Rôles proposés par l'écran d'accès historique",
    metrics.roleVocabulary.historicalRoles.length,
    "3 identités + profils",
    "down",
  ),
  line(
    "Valeurs produites par le calcul de connexion (session)",
    metrics.roleVocabulary.sessionLoginValues.length,
    "3 identités",
    "down",
  ),
  line(
    "Valeurs produites par l'autre calcul de connexion",
    metrics.roleVocabulary.loginResolverValues.length,
    "3 identités",
    "down",
  ),
  line(
    "Union des valeurs de rôle à la connexion",
    metrics.roleVocabulary.loginRoleValuesUnion.length,
    "3 identités",
    "down",
  ),
  line(
    "Fonctions du catalogue de profils",
    metrics.roleVocabulary.profileFunctions.length,
    "profils contextuels",
    "stable",
  ),
  line(
    "Politiques de périmètre déclarées",
    metrics.scope.policies.length,
    "jeu cohérent",
    "down",
  ),
  line(
    "Appels de périmètre programme",
    metrics.scope.programScopeCalls,
    "—",
    "stable",
  ),
  line(
    "  dont vérifiant aussi la capacité",
    metrics.scope.programScopeWithCapability,
    `${metrics.scope.programScopeCalls} (mesuré, audit disait 50)`,
    "up",
  ),
  line(
    "Appels au contrôle venture complet",
    metrics.scope.ventureFullCalls,
    "tous",
    "up",
  ),
  line(
    "Appels à l'ancien contrôle d'appartenance venture",
    metrics.scope.legacyVentureCalls,
    "0",
    "down",
  ),
  line(
    "Actions utilisant le point d'entrée unifié capacité+périmètre",
    metrics.scope.unifiedScopedCalls,
    "toutes ou remplacé",
    "up",
  ),
];

console.log("\n=== TABLEAU DE BORD — AUTORISATION (Lots 0–1) ===");
console.log(`Mesuré le ${metrics.generatedAt}`);
console.table(rows);

console.log("\n=== FAITS À VÉRIFIER (point 3) ===");
const facts = metrics.facts;
console.log(
  `- Les deux chemins de connexion partagent le résolveur : ${
    facts.loginRoutesShareResolver ? "OUI" : "NON"
  } (session-login sans branche propre : ${
    facts.sessionLoginHasNoOwnProgramManagerBranch ? "OUI" : "NON"
  })`,
);
console.log(
  `- Mode d'identité du gestionnaire de programme : ${facts.programManagerIdentityMode.toUpperCase()} ` +
    `(AUTHZ_PM_IDENTITY=staff active la cible D-1)`,
);
console.log(
  `- Le commentaire de la liste des membres venture correspond au code : ${
    facts.ventureRosterCommentMatchesCode ? "OUI" : "NON"
  }`,
);
console.log(
  `- Droits facilitateur lus par deux portes : ${
    facts.facilitatorGuardReadsAssignmentJson && facts.facilitatorGrantsWritePersonalRights
      ? "CONFIRMÉ (cases de l'affectation d'un côté, droits personnels recopiés de l'autre)"
      : "NON CONFIRMÉ"
  }`,
);
console.log(
  `- Refus anglais en dur : ${
    facts.hardcodedEnglishRefusalSites.length > 0
      ? `${facts.hardcodedEnglishRefusalSites.length} fichier(s) — ${facts.hardcodedEnglishRefusalSites
          .map((site) => site.file)
          .join(", ")}`
      : "aucun trouvé"
  }`,
);

if (args.has("--list")) {
  console.log("\n=== ACTIONS SANS CAPACITÉ, PAR CATÉGORIE ===");
  for (const [key, label] of Object.entries(categoryLabels)) {
    const entries = metrics.routes.withoutCapabilityList.filter(
      (entry) => entry.category === key,
    );
    console.log(`\n— ${label} (${entries.length}) —`);
    for (const entry of entries.sort((left, right) => left.file.localeCompare(right.file))) {
      console.log(`  ${entry.file}  [${entry.auth}${entry.scoped ? " + périmètre" : ""}]`);
    }
  }
}

if (args.has("--check")) {
  const baselinePath = path.join(__dirname, "lib", "authzMetricsBaseline.json");
  if (!fs.existsSync(baselinePath)) {
    console.error(`\n[check] baseline absente: ${baselinePath}`);
    process.exit(2);
  }
  const baseline = JSON.parse(fs.readFileSync(baselinePath, "utf8"));
  const problems = compareToBaseline(metrics, baseline);
  if (problems.length > 0) {
    console.error("\n[check] RÉGRESSION DU CLIQUET :");
    for (const problem of problems) console.error(`  - ${problem}`);
    process.exit(1);
  }
  console.log("\n[check] Cliquet respecté.");
}
