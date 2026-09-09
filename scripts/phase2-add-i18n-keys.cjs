/* Add Phase-2 Permission Center keys to en/fr engineering.json (balanced). */
const fs = require("fs");

const EN = {
  tabUserMatrix: "User Matrix",
  tabCatalog: "Catalog",
  tabDefaultsMatrix: "Defaults Matrix",
  defaultsMatrixHint:
    "What each identity receives by default — rows expand Feature → Module. Module access is derived from capabilities; modules with zero capabilities stay visible. Editing opens a drawer; changes go to the pending tray for review before saving.",
  matrixFeature: "Feature",
  matrixClear: "Clear",
  matrixSaving: "Saving…",
  matrixLoadFailed: "Could not load the permission matrix.",
  moduleLocked: "SA locked",
  matrixNoDefaultProfile: "no default profile",
  matrixNoDefaultProfileHint:
    "This identity has no default access profile yet — set one in Access Profiles / Role Defaults before editing capabilities here.",
  pendingTray: "Pending changes",
  reviewAndApply: "Review & apply",
  matrixNoPendingChanges: "No pending changes for this module.",
  addedToTray: "Added to the pending tray.",
  saveFailed: "Save failed.",
  addToPendingTray: "Add to pending tray",
  userMatrixHint:
    "Why can this user do what they do? Pick a user to see every capability decomposed into its sources — Profile | Group | Grant | Restriction — with the Effective result. Scope is a separate column (engine arrives in a later phase).",
  superAdminBypass: "Super Admin bypass",
  eligibilityStrip: "Eligibility (feature wall)",
  userMatrixCapability: "Capability",
  userMatrixProfile: "Profile",
  userMatrixGroup: "Group",
  userMatrixGrant: "Grant",
  userMatrixRestriction: "Restriction",
  userMatrixEffective: "Effective",
  userMatrixScope: "Scope",
  userMatrixEmpty: "No capabilities found for this user.",
  userMatrixFootnote:
    "Sources: profile (base), groups, individual grants; restrictions remove the capability entirely (they beat grants). Effective = any source minus restrictions. Scope displays as All until the scope engine (P4) ships — the server remains authoritative.",
  catalogHint:
    "Read-only registry of every Feature → Module → Capability the enforcement layer understands. Locked modules (Super Admin-only decisions) and retired capabilities are marked, never hidden.",
  catalogNoModules: "No modules mapped to this feature yet.",
  scopePoliciesTitle: "Scope Policies",
  scopePoliciesHint: "Planned for a later phase (P4): which data each capability may operate on (assigned ventures, own venture…).",
  groupsTitle: "Groups",
  groupsHint: "Group capability editing lives in the governance screens; protected-organization rules are enforced by org_membership.",
  enforcementNoteTitle: "Enforcement",
  enforcementNoteHint: "This center manages configuration and visibility. Authorization is enforced server-side on every API; hiding a menu is never authorization.",
};

const FR = {
  tabUserMatrix: "Matrice utilisateur",
  tabCatalog: "Catalogue",
  tabDefaultsMatrix: "Matrice des défauts",
  defaultsMatrixHint:
    "Ce que chaque identité reçoit par défaut — les lignes se déplient de Fonctionnalité vers Module. L'accès aux modules est dérivé des capacités ; les modules sans capacité restent visibles. La modification ouvre un tiroir ; les changements passent par la file d'attente avant enregistrement.",
  matrixFeature: "Fonctionnalité",
  matrixClear: "Effacer",
  matrixSaving: "Enregistrement…",
  matrixLoadFailed: "Impossible de charger la matrice des permissions.",
  moduleLocked: "Verrouillé SA",
  matrixNoDefaultProfile: "aucun profil par défaut",
  matrixNoDefaultProfileHint:
    "Cette identité n'a pas encore de profil d'accès par défaut — définissez-en un dans Profils d'accès / Défauts de rôle avant de modifier les capacités ici.",
  pendingTray: "Modifications en attente",
  reviewAndApply: "Vérifier et appliquer",
  matrixNoPendingChanges: "Aucune modification en attente pour ce module.",
  addedToTray: "Ajouté à la file d'attente.",
  saveFailed: "Échec de l'enregistrement.",
  addToPendingTray: "Ajouter à la file d'attente",
  userMatrixHint:
    "Pourquoi cet utilisateur peut-il faire ce qu'il fait ? Choisissez un utilisateur pour voir chaque capacité décomposée par source — Profil | Groupe | Octroi | Restriction — avec le résultat Effectif. La portée est une colonne séparée (moteur dans une phase ultérieure).",
  superAdminBypass: "Contournement Super Admin",
  eligibilityStrip: "Éligibilité (mur de fonctionnalités)",
  userMatrixCapability: "Capacité",
  userMatrixProfile: "Profil",
  userMatrixGroup: "Groupe",
  userMatrixGrant: "Octroi",
  userMatrixRestriction: "Restriction",
  userMatrixEffective: "Effectif",
  userMatrixScope: "Portée",
  userMatrixEmpty: "Aucune capacité trouvée pour cet utilisateur.",
  userMatrixFootnote:
    "Sources : profil (base), groupes, octrois individuels ; les restrictions retirent entièrement la capacité (elles priment sur les octrois). Effectif = toute source moins les restrictions. La portée affiche All jusqu'au moteur de portée (P4) — le serveur reste l'autorité.",
  catalogHint:
    "Registre en lecture seule de chaque Fonctionnalité → Module → Capacité compris par la couche d'application. Les modules verrouillés (décisions Super Admin) et les capacités retirées sont marqués, jamais masqués.",
  catalogNoModules: "Aucun module rattaché à cette fonctionnalité pour l'instant.",
  scopePoliciesTitle: "Politiques de portée",
  scopePoliciesHint: "Prévu dans une phase ultérieure (P4) : sur quelles données chaque capacité peut opérer (ventures assignées, propre venture…).",
  groupsTitle: "Groupes",
  groupsHint: "La gestion des capacités de groupe se trouve dans les écrans de gouvernance ; les règles d'organisation protégée sont appliquées par org_membership.",
  enforcementNoteTitle: "Application",
  enforcementNoteHint: "Ce centre gère la configuration et la visibilité. L'autorisation est appliquée côté serveur sur chaque API ; masquer un menu n'est jamais une autorisation.",
};

for (const [loc, keys] of [["en", EN], ["fr", FR]]) {
  const file = `src/locales/${loc}/engineering.json`;
  const d = JSON.parse(fs.readFileSync(file, "utf8"));
  const perms = d.engineering.permissions;
  const missing = [];
  for (const [k, v] of Object.entries(keys)) {
    if (k in perms) {
      if (perms[k] !== v) throw new Error(`${loc}.${k} already exists with a different value`);
    } else {
      perms[k] = v;
      missing.push(k);
    }
  }
  fs.writeFileSync(file, JSON.stringify(d, null, 2) + "\n");
  console.log(loc, "added", missing.length, "keys");
}
