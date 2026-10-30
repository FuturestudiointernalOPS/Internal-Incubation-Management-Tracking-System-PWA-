/**
 * PERMISSIONS — STATIC GUARDS (Phase 9)
 * Établi le 2026-10-10.
 *
 * Trois gardes statiques, toutes en lecture seule (aucun fichier applicatif
 * modifié) :
 *
 *   GARDE 1 — contrôle « par nom de rôle » hors moteur (ratchet daté).
 *     Détecte quatre motifs de décision par rôle hors du moteur central
 *     (`src/server/authz/**`, `src/models/authorization/**`,
 *     `src/services/authorization/**`). Toute occurrence non listée fait
 *     échouer le test ; toute exception qui n'existe plus fait aussi échouer
 *     (entrée périmée à retirer). La liste ne peut que diminuer.
 *
 *     Motifs mesurés le 2026-10-19 après le Lot 1.1 (production, hors moteur,
 *     hors tests) :
 *       M1 requireAuth([...])          :  80 lignes
 *       M2 roles: [...]                : 107 lignes
 *       M3 role === / role !==         : 202 lignes
 *       M4 .includes(... role ...)     :  73 lignes
 *       total occurrences              : 462
 *       paires fichier#motif distinctes : 282
 *
 *   GARDE 2 — toute route API porte une décision de permission OU est
 *     déclarée publique dans `src/proxy.js` (ou est un hub de ré-export, ou
 *     une exception documentée ci-dessous).
 *
 *   GARDE 3 — le catalogue est synchronisé et les libellés ne sont pas
 *     corrompus. Le brief vise un libellé `tasks` corrompu ; sur l'arbre de
 *     travail actuel (2026-10-10) ce libellé est DÉJÀ corrigé (`"Tasks"`), et
 *     le module `crm` a été ajouté. Le test des libellés reste donc, ici, un
 *     test normal qui passe ; s'il redevient corrompu, il se marque tout seul
 *     `test.failing` (dette suivie, CI verte tant qu'elle est ouverte). Un test
 *     supplémentaire PROUVE que le détecteur rejette bien le libellé documenté
 *     `Tasksengineering.permissions.center.sections.people`. Le test des
 *     capacités orphelines passe.
 */

const fs = require("node:fs");
const path = require("node:path");

const { proxy } = require("@/proxy");
const {
  ROUTE_HUBS,
  NO_GUARD_ALLOWED,
} = require("@/services/authorization/actionDeclarations");

const ROOT = path.join(__dirname, "..", "..");
const SRC = path.join(ROOT, "src");

const toPosix = (p) => p.split(path.sep).join("/");
const relOf = (abs) => toPosix(path.relative(ROOT, abs));

/** Every file under `dir` matching `keep` (recursive), skipping heavy dirs. */
function walkFiles(dir, keep) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".next") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkFiles(full, keep));
    else if (keep(entry.name)) out.push(full);
  }
  return out;
}

// =============================================================================
// GARDE 1 — contrôle par nom de rôle hors moteur
// =============================================================================

const ENGINE_PREFIXES = [
  path.join(SRC, "server", "authz") + path.sep,
  path.join(SRC, "models", "authorization") + path.sep,
  path.join(SRC, "services", "authorization") + path.sep,
];
const EXCLUDED_PREFIXES = [path.join(SRC, "__tests__") + path.sep];

const ROLE_MOTIFS = {
  M1: { label: "requireAuth([...])", re: /requireAuth\(\s*\[/ },
  M2: { label: "roles: [...]", re: /roles\s*:\s*\[/ },
  M3: { label: "role === / role !==", re: /role\s*===|role\s*!==/ },
  M4: { label: ".includes(...role...)", re: /\.includes\(.*role/ },
};

/**
 * Liste d'exceptions DATÉE (2026-10-10), décroissante.
 * Format : `fichier#motif` (fichier relatif à la racine du projet + motif
 * M1..M4). Chaque entrée correspond à une occurrence RÉELLE mesurée. Pour
 * retirer une ligne de code, il faut retirer l'entrée ; pour en ajouter une,
 * la marche à suivre est de sortir du modèle « par rôle » (capacité) — jamais
 * d'ajouter ici sans revue.
 */
const ROLE_MOTIF_EXCEPTIONS = new Set([
  "src/app/admin/communications/contacts/BulkProgramModal.js#M3",

  "src/app/api/admin/projects/[id]/reports/generate/route.js#M1",
  "src/app/api/attendance/route.js#M3",
  "src/app/api/auth/invite-family/route.js#M3",
  "src/app/api/auth/invite/route.js#M1",

  "src/app/api/contacts/full-state/route.js#M4",

  "src/app/api/deliverables/route.js#M2",

  "src/app/api/engineering/permissions/profile-role-defaults/route.js#M4",
  "src/app/api/engineering/permissions/route.js#M3",

  "src/app/api/facilitator-reviews/route.js#M1",
  "src/app/api/facilitators/invite-bulk/route.js#M1",
  "src/app/api/facilitators/invite-bulk/route.js#M3",
  "src/app/api/families/route.js#M1",
  "src/app/api/families/route.js#M3",

  "src/app/api/forensic/user-role/route.js#M3",
  "src/app/api/group-members/route.js#M1",
  "src/app/api/groups/route.js#M1",

  "src/app/api/investor/approval/route.js#M1",
  "src/app/api/investor/profile/route.js#M1",
  "src/app/api/investor/relationships/meetings/route.js#M1",
  "src/app/api/investor/relationships/route.js#M1",
  "src/app/api/invites/route.js#M2",
  "src/app/api/participant-programs/bulk/route.js#M1",
  "src/app/api/participants/route.js#M1",
  "src/app/api/platform/form-runs/handlers/get.js#M3",

  "src/app/api/pm/programs/[id]/manager/route.js#M3",
  "src/app/api/pm/programs/[id]/route.js#M2",
  "src/app/api/pm/programs/route.js#M1",
  "src/app/api/pm/programs/templates/route.js#M1",
  "src/app/api/program-staff/route.js#M3",
  "src/app/api/programs/route.js#M1",

  "src/app/api/retros/submit/route.js#M3",
  "src/app/api/sessions/route.js#M2",
  "src/app/api/standups/submit/route.js#M3",
  "src/app/api/system/database/route.js#M1",
  "src/app/api/teams/route.js#M1",
  "src/app/api/teams/route.js#M3",

  "src/app/api/user-groups/route.js#M3",

  "src/app/api/v2/program-staff/route.js#M1",
  "src/app/api/ventures/[id]/blockers/route.js#M4",
  "src/app/api/ventures/[id]/dashboard/route.js#M4",
  "src/app/api/ventures/[id]/documents/[docId]/permissions/route.js#M4",
  "src/app/api/ventures/[id]/documents/[docId]/transition/route.js#M4",
  "src/app/api/ventures/[id]/founders/[founderId]/route.js#M3",
  "src/app/api/ventures/[id]/founders/route.js#M4",
  "src/app/api/ventures/[id]/members/route.js#M3",
  "src/app/api/ventures/[id]/notes/route.js#M4",
  "src/app/api/ventures/[id]/tasks/[taskId]/submissions/route.js#M4",
  "src/app/api/ventures/[id]/tasks/route.js#M4",
  "src/app/api/ventures/[id]/verification/documents/[docId]/versions/route.js#M3",
  "src/app/api/ventures/[id]/verification/route.js#M4",
  "src/app/api/ventures/assigned/route.js#M4",
  "src/app/api/ventures/lead-manager/home/route.js#M3",
  "src/app/api/ventures/route.js#M4",
  "src/app/investor/organizations/page.js#M3",
  "src/app/staff/dashboard/page.js#M3",
  "src/components/crm/useMembershipState.js#M3",
  "src/components/dashboard/ProfileView.js#M3",
  "src/components/dashboard/unified-dashboard/MyProjectsCard.js#M3",
  "src/components/pm/program-workspace/DeployTeamModal.js#M3",
  "src/components/pm/programs/programTabs.js#M2",
  "src/components/pm/programs/programWorkspaceSelectors.js#M4",
  "src/components/staff/ProjectsView.js#M3",
  "src/components/staff/op-report/SummaryOwnerCard.js#M3",
  "src/components/staff/project-detail/TeamTab.js#M3",
  "src/lib/api/createHandler.js#M2",
  "src/lib/featureAccess.js#M4",
  "src/lib/identity.js#M4",
  "src/lib/masterNavigation/builders.js#M3",
  "src/lib/notificationLinks.js#M4",

  "src/lib/ventureDeliverables.js#M3",

  "src/models/investor/diligenceAndPipeline/pipeline.js#M3",
  "src/models/platform/registry.js#M4",
  "src/models/programs/core/programList.js#M4",
  "src/server/auth/guards.js#M1",
  "src/server/auth/guards.js#M4",
  "src/server/auth/session.js#M3",
  "src/services/communications/announcements.js#M3",
  "src/services/communications/inboxNotifications.js#M4",
  "src/services/communications/internal-comms/inbox.js#M3",
  "src/services/communications/internal-comms/read.js#M3",
  "src/services/communications/internal-comms/scope.js#M3",
  "src/services/communications/internal-comms/scope.js#M4",
  "src/services/communications/internal-comms/send.js#M3",
  "src/services/communications/ventureNotifications.js#M3",
  "src/services/contacts/alternativeEmails.js#M3",
  "src/services/contacts/alternativeEmails.js#M4",
  "src/services/contacts/registration.js#M3",
  "src/services/contacts/registryRead.js#M3",
  "src/services/contacts/update.js#M4",
  "src/services/dashboard/opReports.js#M3",
  "src/services/dashboard/overview/build.js#M3",
  "src/services/dashboard/userAdmin.js#M3",
  "src/services/investor/campaigns.js#M4",
  "src/services/investor/diligence/requestActions.js#M3",
  "src/services/investor/organizations.js#M3",
  "src/services/investor/pipeline.js#M3",
  "src/services/investor/pipeline.js#M4",

  "src/services/participant/fullState.js#M4",
  "src/services/participant/submissions.js#M3",
  "src/services/participant/submissions.js#M4",
  "src/services/platform/intents/delete.js#M3",
  "src/services/platform/intents/detail.js#M3",
  "src/services/platform/intents/list.js#M3",
  "src/services/platform/intents/tasks.js#M3",
  "src/services/platform/intents/update.js#M3",
  "src/services/programs/participantPrograms.js#M1",
  "src/services/programs/programStaff.js#M3",
  "src/services/projects/collaboration.js#M3",
  "src/services/tasks/assignments.js#M3",
  "src/services/tasks/blockers.js#M3",
  "src/services/tasks/comments.js#M3",
  "src/services/tasks/create.js#M3",
  "src/services/tasks/create.js#M4",
  "src/services/tasks/query.js#M3",
  "src/services/tasks/remove.js#M3",
  "src/services/tasks/teamBoard.js#M3",
  "src/services/tasks/updateEffects.js#M3",
  "src/services/tasks/updateFields/assignment.js#M3",
  "src/services/tasks/updateGuards.js#M3",
  "src/services/ventures/founders.js#M3",
  "src/services/ventures/founders.js#M4",
  "src/services/ventures/memberRoster.js#M3",

  "src/services/ventures/operatingPlans.js#M4",

  "src/services/ventures/scope.js#M4",
  "src/services/ventures/submissions/createSubmission.js#M3",
  "src/services/ventures/submissions/review.js#M4",
  "src/services/ventures/submissions/scope.js#M3",
  "src/services/ventures/ventureDocumentTypes.js#M3",
  "src/services/ventures/verification/categories.js#M3",
  "src/services/workspace/calendar.js#M4",
  "src/services/workspace/navigation.js#M3",
  // White-label boundary: client actor kinds are admitted only by the
  // organisation-scoped policy, never as a role-based internal bypass.
  "src/services/organizations/programAccess.js#M4",
  // Relevé lors du nettoyage des écrans (2026-10-19). Les trois entrées du
  // centre actif sont de l'affichage/validation (liste des rôles d'un profil),
  // jamais une décision d'accès. Les sept autres préexistaient à ce lot et
  // restent à traiter séparément.
  "src/components/permissions/center/drawers/CreateProfileDrawer.js#M2",
  "src/components/permissions/center/drawers/CreateProfileDrawer.js#M4",
  "src/components/permissions/center/personAccess.js#M4",
  "src/services/programs/teams.js#M3",
  "src/services/ventures/people.js#M2",
]);

/** (fichier#motif) → occurrences réelles, hors moteur, hors tests. */
function collectRoleMotifOccurrences() {
  const found = new Map(); // pair → line count
  const files = walkFiles(SRC, (name) => name.endsWith(".js") || name.endsWith(".jsx"));
  for (const file of files) {
    if (EXCLUDED_PREFIXES.some((p) => file.startsWith(p))) continue;
    if (ENGINE_PREFIXES.some((p) => file.startsWith(p))) continue;
    const rel = relOf(file);
    const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
    lines.forEach((line) => {
      for (const [key, { re }] of Object.entries(ROLE_MOTIFS)) {
        if (re.test(line)) {
          const pair = `${rel}#${key}`;
          found.set(pair, (found.get(pair) || 0) + 1);
        }
      }
    });
  }
  return found;
}

describe("Garde 1 — décisions par nom de rôle hors moteur (ratchet daté)", () => {
  test("aucune occurrence nouvelle, aucune exception périmée", () => {
    const found = collectRoleMotifOccurrences();
    const measured = new Set(found.keys());

    const unexpected = [...measured].filter((pair) => !ROLE_MOTIF_EXCEPTIONS.has(pair)).sort();
    const stale = [...ROLE_MOTIF_EXCEPTIONS].filter((pair) => !measured.has(pair)).sort();

    expect({ unexpected, stale }).toEqual({ unexpected: [], stale: [] });
  });
});

// =============================================================================
// GARDE 2 — toute route a une décision de permission ou une déclaration publique
// =============================================================================

const API_ROOT = path.join(SRC, "app", "api");

/**
 * Mécanismes acceptés dans le fichier de route.
 * Liste de la mission + deux ajouts justifiés :
 *   - `createHandler(` — l'enveloppe de route du projet, qui applique
 *     l'authentification et, quand `roles` est fourni, l'allowlist de rôles
 *     (c'est la décision de la majorité des 43 routes concernées).
 *   - `requireInvestorSelfServiceAuthorization(` — le seam investisseur qui
 *     enveloppe `requireAuthorization("investor", …)` (déjà compté comme usage
 *     littéral par `route-catalog-contract.test.js`).
 *   - `organizationHandler(` — the private organisation boundary authenticates
 *     through its dedicated session lookup; the called service must still
 *     enforce active membership, organisation scope and capability.
 *   - `organizationProgramManagementRoute(` — a route factory that applies the
 *     same private session boundary and delegates each action to the
 *     organisation-scoped management service.
 */
const ROUTE_MECHANISMS = [
  "requireAuthorization(",
  "requireScopedAccess(",
  "requireAuth(",
  "requireVenture",
  "requireProgramScope",
  "requireAssignmentAccess",
  "requireProjectAccess",
  "requireProgramFacilitator",
  "requireProgramManagerAccess",
  "x-cron-secret",
  "verifyWebhookSignature",
  "getSession(",
  "createHandler(",
  "requireInvestorSelfServiceAuthorization(",
  "organizationHandler(",
  "organizationProgramManagementRoute(",
];

/**
 * Routes qui ne sont qu'un hub de ré-export : les décisions vivent dans les
 * handlers pointés. Notées explicitement (et vérifiées : toute route qui
 * devient un hub doit être ajoutée ici).
 *
 * Les deux ensembles vivent désormais dans le registre
 * (`@/services/authorization/actionDeclarations`), importé ci-dessus, pour
 * qu'un seul endroit réponde de la politique.
 */

/** L'appel middleware anonyme laisse-t-il passer ce chemin API ? */
function declaredPublic(url) {
  const res = proxy({
    nextUrl: { pathname: url },
    url: `https://app.example${url}`,
    cookies: { get: () => undefined },
  });
  return res.status === 200;
}

function routeFiles() {
  return walkFiles(API_ROOT, (name) => name === "route.js");
}

function routeUrl(file) {
  const rel = toPosix(path.relative(API_ROOT, file)).replace(/route\.js$/, "");
  return `/api/${rel}`.replace(/\/$/, "");
}


describe("Garde 2 — chaque route API a une décision ou une déclaration publique", () => {
  test("aucune route sans décision ni déclaration", () => {
    const uncovered = [];
    for (const file of routeFiles()) {
      const rel = relOf(file);
      const src = fs.readFileSync(file, "utf8");
      if (ROUTE_MECHANISMS.some((m) => src.includes(m))) continue;
      if (declaredPublic(routeUrl(file))) continue;
      if (ROUTE_HUBS.has(rel)) continue;
      if (NO_GUARD_ALLOWED.has(rel)) continue;
      uncovered.push(rel);
    }
    expect(uncovered.sort()).toEqual([]);
  });

  test("les exceptions (hubs / sans-garde) ne sont ni périmées ni devenues gardées", () => {
    const existing = new Set(routeFiles().map(relOf));
    const problems = [];
    for (const rel of [...ROUTE_HUBS, ...NO_GUARD_ALLOWED]) {
      if (!existing.has(rel)) {
        problems.push(`entrée périmée (fichier absent): ${rel}`);
        continue;
      }
      const src = fs.readFileSync(path.join(ROOT, rel), "utf8");
      if (ROUTE_MECHANISMS.some((m) => src.includes(m))) {
        problems.push(`entrée périmée (route désormais gardée): ${rel}`);
        continue;
      }
      const url = routeUrl(path.join(ROOT, rel));
      if (declaredPublic(url)) {
        problems.push(`entrée périmée (chemin désormais public): ${rel}`);
      }
    }
    expect(problems).toEqual([]);
  });
});
