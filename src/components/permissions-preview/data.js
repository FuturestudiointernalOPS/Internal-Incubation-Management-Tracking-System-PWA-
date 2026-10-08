/**
 * CENTRE DE PERMISSIONS — PRÉVISUALISATION (données fictives).
 *
 * Ce module est un BANC D'ESSAI DE DESIGN, isolé du centre en production :
 * il porte les données réalistes qui peuplent l'écran et la petite algèbre qui
 * les rend vraies (4 sources → niveau le plus élevé → moins les restrictions),
 * exactement la règle du moteur.
 *
 * Rien ici ne parle à la base ni à l'API : c'est un jeu de données témoin.
 * L'interface est en français en dur, volontairement : c'est une maquette
 * navigable, pas un écran livré. À l'adoption, ces libellés passent dans le
 * système de traduction du projet (voir les notes de design).
 */

// ─── Niveaux ────────────────────────────────────────────────────────────────
export const LEVELS = {
  0: { label: "Aucun", short: "—" },
  1: { label: "Lire", short: "L" },
  2: { label: "Créer", short: "C" },
  3: { label: "Modifier", short: "M" },
  4: { label: "Supprimer", short: "S" },
  5: { label: "Complet", short: "A" },
};
export const LEVEL_KEYS = [0, 1, 2, 3, 4, 5];
export const GRANT_KEYS = [1, 2, 3, 4, 5];

// ─── Fonctionnalités (les sections) et leurs sous-sections ──────────────────
export const FEATURES = [
  {
    key: "communication",
    label: "Communication",
    modules: [
      { key: "messages", label: "Messages", caps: ["view", "send", "moderate"] },
      { key: "annonces", label: "Annonces", caps: ["view", "create", "moderate"] },
    ],
  },
  {
    key: "programmes",
    label: "Programmes",
    modules: [
      { key: "programmes", label: "Programmes", caps: ["view", "create", "edit", "delete", "publish"] },
      { key: "ateliers", label: "Ateliers", caps: ["view", "conduct", "record"] },
    ],
  },
  {
    key: "operations",
    label: "Opérations",
    modules: [
      { key: "projets", label: "Projets", caps: ["view", "create", "edit", "delete"] },
      { key: "taches", label: "Tâches", caps: ["view", "create", "edit", "delete"] },
    ],
  },
  {
    key: "rapports",
    label: "Rapports",
    modules: [{ key: "rapports", label: "Rapports", caps: ["view", "create", "export", "delete"] }],
  },
  {
    key: "finance",
    label: "Finance",
    modules: [{ key: "finance", label: "Finance", caps: ["view", "create", "edit", "export"] }],
  },
  {
    key: "ventures",
    label: "Ventures",
    modules: [{ key: "ventures", label: "Ventures", caps: ["view", "create", "edit", "delete"] }],
  },
  {
    key: "securite",
    label: "Sécurité",
    modules: [
      { key: "utilisateurs", label: "Utilisateurs", caps: ["view", "create", "edit", "delete", "assign_roles"] },
      { key: "permissions", label: "Permissions", caps: ["view_matrix", "grant", "configure_eligibility"] },
    ],
  },
  {
    key: "parametres",
    label: "Paramètres",
    modules: [{ key: "parametres", label: "Paramètres", caps: ["view", "edit"] }],
  },
];

export const CAP_LABELS = {
  view: "Lire",
  create: "Créer",
  edit: "Modifier",
  delete: "Supprimer",
  publish: "Publier",
  send: "Envoyer",
  moderate: "Modérer",
  export: "Exporter",
  assign_roles: "Attribuer des rôles",
  view_matrix: "Voir la matrice",
  grant: "Accorder",
  configure_eligibility: "Configurer l'éligibilité",
  conduct: "Animer",
  record: "Consigner",
};

export const ALL_MODULES = FEATURES.flatMap((feature) =>
  feature.modules.map((mod) => ({ ...mod, feature: feature.key, featureLabel: feature.label })),
);
export const MODULE_BY_KEY = Object.fromEntries(ALL_MODULES.map((mod) => [mod.key, mod]));

// ─── Personnes ──────────────────────────────────────────────────────────────
export const PEOPLE = [
  {
    id: "awa",
    name: "Awa K.",
    email: "awa.k@exemple.io",
    role: "Mentor",
    roleLabel: "Mentor",
    profile: "Mentor",
    group: "Mentorat",
    isSuperAdmin: false,
    sources: {
      profile: { communication: { view: 1 }, programmes: { view: 1 } },
      groups: { rapports: { view: 1 } },
      grants: { programmes: { edit: 3 } },
      restrictions: { finance: { view: true } },
    },
    contexts: [{ kind: "Programme", name: "Programme Alpha", role: "Mentor", profile: "Mentor", status: "Actif" }],
    responsibilities: ["Animer un atelier"],
  },
  {
    id: "koffi",
    name: "Koffi D.",
    email: "koffi.d@exemple.io",
    role: "Participant",
    roleLabel: "Participant",
    profile: "Participant",
    group: "Cohorte A",
    isSuperAdmin: false,
    sources: {
      profile: { communication: { view: 1 }, programmes: { view: 1 } },
      groups: { operations: { view: 1 } },
      grants: {},
      restrictions: {},
    },
    contexts: [{ kind: "Programme", name: "Programme Alpha", role: "Participant", profile: "Participant", status: "Actif" }],
    responsibilities: [],
  },
  {
    id: "marie",
    name: "Marie L.",
    email: "marie.l@exemple.io",
    role: "Super administrateur",
    roleLabel: "Super administrateur",
    profile: "—",
    group: "Équipe studio",
    isSuperAdmin: true,
    sources: { profile: {}, groups: {}, grants: {}, restrictions: {} },
    contexts: [],
    responsibilities: ["Valider les budgets"],
  },
  {
    id: "yao",
    name: "Yao T.",
    email: "yao.t@exemple.io",
    role: "Personnel studio",
    roleLabel: "Personnel studio",
    profile: "Staff studio",
    group: "Équipe studio",
    isSuperAdmin: false,
    sources: {
      profile: { communication: { view: 1, send: 2 }, operations: { view: 1, edit: 3 } },
      groups: {},
      grants: { rapports: { view: 1, export: 4 } },
      restrictions: { operations: { delete: true } },
    },
    contexts: [],
    responsibilities: [],
  },
  {
    id: "fatou",
    name: "Fatou B.",
    email: "fatou.b@exemple.io",
    role: "Membre",
    roleLabel: "Membre",
    profile: "Fondateur",
    group: "Venture Z",
    isSuperAdmin: false,
    sources: {
      profile: { ventures: { view: 3, create: 2, edit: 3 }, finance: { view: 1 }, rapports: { view: 1 } },
      groups: {},
      grants: {},
      restrictions: {},
    },
    contexts: [{ kind: "Venture", name: "Venture Z", role: "Fondateur", profile: "Fondateur", status: "Actif" }],
    responsibilities: ["Valider les budgets"],
  },
];

export const PERSON_BY_ID = Object.fromEntries(PEOPLE.map((person) => [person.id, person]));

// ─── Éligibilité (plafonds) : identité × fonctionnalité ─────────────────────
// E = éligible · D = refusé · N = non configuré (traité comme refusé)
export const ELIGIBILITY_IDENTITIES = ["Mentor", "Participant", "Fondateur", "Facilitateur", "Staff studio", "admin", "mentor"];
export const ELIGIBILITY = {
  Mentor: { communication: "E", programmes: "E", operations: "E", rapports: "E", finance: "D", ventures: "D", securite: "D", parametres: "N" },
  Participant: { communication: "E", programmes: "E", operations: "N", rapports: "N", finance: "N", ventures: "N", securite: "N", parametres: "N" },
  Fondateur: { communication: "E", programmes: "E", operations: "E", rapports: "E", finance: "E", ventures: "E", securite: "D", parametres: "N" },
  Facilitateur: { communication: "E", programmes: "E", operations: "E", rapports: "E", finance: "N", ventures: "N", securite: "N", parametres: "N" },
  "Staff studio": { communication: "E", programmes: "E", operations: "E", rapports: "E", finance: "D", ventures: "E", securite: "E", parametres: "E" },
  admin: { communication: "E", programmes: "E", operations: "E", rapports: "E", finance: "D", ventures: "E", securite: "E", parametres: "E" },
  mentor: { communication: "E", programmes: "E", operations: "N", rapports: "E", finance: "N", ventures: "N", securite: "N", parametres: "N" },
};

// ─── Profils ────────────────────────────────────────────────────────────────
export const PROFILES = [
  { key: "mentor", label: "Mentor", context: "Programme", allowedRoles: ["Membre"], active: true, usages: 12, capabilities: { communication: { view: 1 }, programmes: { view: 1 }, rapports: { view: 1 } } },
  { key: "participant", label: "Participant", context: "Programme", allowedRoles: ["Membre"], active: true, usages: 48, capabilities: { communication: { view: 1 }, programmes: { view: 1 } } },
  { key: "fondateur", label: "Fondateur", context: "Venture", allowedRoles: ["Membre"], active: true, usages: 6, capabilities: { ventures: { view: 3, create: 2, edit: 3 }, finance: { view: 1 }, rapports: { view: 1 } } },
  { key: "facilitateur", label: "Facilitateur", context: "Programme", allowedRoles: ["Personnel studio"], active: true, usages: 4, capabilities: { programmes: { view: 3, edit: 3 }, ateliers: { view: 2, conduct: 2, record: 1 } } },
  { key: "staff", label: "Staff studio", context: "Global", allowedRoles: ["Personnel studio"], active: false, usages: 0, capabilities: {} },
];

export function profileUses(profileKey) {
  const profile = PROFILES.find((candidate) => candidate.key === profileKey);
  return [
    { kind: "Rôle par défaut", label: "Personnel studio", href: "profiles" },
    { kind: "Attributions", label: `${profile?.usages ?? 0} personne(s)`, href: "people" },
    { kind: "Contextes", label: "Programme Alpha", href: "profiles" },
  ];
}

// ─── Rôles contextuels : relation → profil ──────────────────────────────────
export const CONTEXT_ROLES = [
  { context: "Programme", role: "Mentor", profile: "Mentor", active: true },
  { context: "Programme", role: "Participant", profile: "Participant", active: true },
  { context: "Venture", role: "Fondateur", profile: "Fondateur", active: true },
  { context: "Cours", role: "Facilitateur", profile: "—", active: false },
];

// ─── Responsabilités : rôles autorisés, bornés par les plafonds ─────────────
export const RESPONSIBILITIES = [
  { key: "budgets", label: "Valider les budgets", feature: "finance", roles: ["Complet", "Fondateur"] },
  { key: "atelier", label: "Animer un atelier", feature: "programmes", roles: ["Mentor", "Facilitateur"] },
  { key: "communiques", label: "Publier des annonces", feature: "communication", roles: ["Personnel studio"] },
];
export const RESPONSIBILITY_ROLE_CHOICES = ["Complet", "Fondateur", "Mentor", "Facilitateur", "Personnel studio", "Participant"];

// ─── Politiques de portée ───────────────────────────────────────────────────
export const SCOPE_POLICIES = [
  { key: "mes-programmes", label: "Mes programmes", resource: "Programme", implemented: true },
  { key: "mes-ventures", label: "Mes ventures", resource: "Venture", implemented: true },
  { key: "mes-cours", label: "Mes cours", resource: "Cours", implemented: true },
  { key: "mon-portefeuille", label: "Tout mon portefeuille", resource: "Portefeuille", implemented: false },
  { key: "mon-equipe", label: "Mon équipe", resource: "Équipe", implemented: false },
];

// Ce que chaque politique résout pour une personne donnée (banc de test).
export function scopeResolves(personId, policyKey) {
  const map = {
    awa: { "mes-programmes": ["Programme Alpha"], "mes-ventures": [], "mes-cours": [], "mon-portefeuille": [], "mon-equipe": [] },
    koffi: { "mes-programmes": ["Programme Alpha"], "mes-ventures": [], "mes-cours": ["UX Avancé"], "mon-portefeuille": [], "mon-equipe": [] },
    marie: { "mes-programmes": ["Programme Alpha", "Programme Beta"], "mes-ventures": ["Venture Z"], "mes-cours": [], "mon-portefeuille": [], "mon-equipe": ["Équipe studio"] },
    yao: { "mes-programmes": [], "mes-ventures": [], "mes-cours": [], "mon-portefeuille": [], "mon-equipe": ["Équipe studio"] },
    fatou: { "mes-programmes": [], "mes-ventures": ["Venture Z"], "mes-cours": [], "mon-portefeuille": [], "mon-equipe": [] },
  };
  return map[personId]?.[policyKey] ?? [];
}

// ─── Journal d'audit ────────────────────────────────────────────────────────
export const AUDIT = [
  { id: 1, date: "08/10/2026 09:12", actor: "Marie L.", target: "Awa K.", action: "Accorder", module: "programmes", capability: "edit", from: "Lire", to: "Modifier", reason: "Co-animation du programme" },
  { id: 2, date: "07/10/2026 16:40", actor: "Marie L.", target: "Koffi D.", action: "Restreindre", module: "rapports", capability: "view", from: "Lire", to: "Retiré", reason: "Accès retiré après audit" },
  { id: 3, date: "07/10/2026 11:03", actor: "Marie L.", target: "Fatou B.", action: "Forcer un profil", module: "—", capability: "—", from: "Participant", to: "Fondateur", reason: "Reprise de la venture Z" },
  { id: 4, date: "06/10/2026 15:22", actor: "Marie L.", target: "Yao T.", action: "Accorder", module: "rapports", capability: "export", from: "Lire", to: "Supprimer", reason: "Export de fin de trimestre" },
  { id: 5, date: "05/10/2026 10:15", actor: "Marie L.", target: "Awa K.", action: "Retirer", module: "programmes", capability: "publish", from: "Publier", to: "—", reason: "Fin de mission" },
  { id: 6, date: "04/10/2026 08:50", actor: "Marie L.", target: "Fatou B.", action: "Promouvoir", module: "—", capability: "—", from: "—", to: "Super admin", reason: "" },
];

// ─── Contexte (par programme / venture / cours) ─────────────────────────────
export const CONTEXT_GROUPS = [
  {
    key: "alpha",
    kind: "Programme",
    name: "Programme Alpha",
    holders: [
      { personId: "awa", functionName: "Mentor", profile: "Mentor", status: "Actif" },
      { personId: "koffi", functionName: "Participant", profile: "Participant", status: "Actif" },
      { personId: "yao", functionName: "Animateur", profile: "Facilitateur", status: "Expire dans 5 j" },
    ],
  },
  {
    key: "z",
    kind: "Venture",
    name: "Venture Z",
    holders: [{ personId: "fatou", functionName: "Fondateur", profile: "Fondateur", status: "Actif" }],
  },
  {
    key: "ux",
    kind: "Cours",
    name: "UX Avancé",
    holders: [{ personId: "koffi", functionName: "Apprenant", profile: "Participant", status: "Actif" }],
  },
];

// ─── Algèbre des droits ─────────────────────────────────────────────────────
export function effectiveOf(sources, mod, capability) {
  if (sources.restrictions?.[mod]?.[capability]) return 0;
  return Math.max(
    sources.profile?.[mod]?.[capability] ?? 0,
    sources.groups?.[mod]?.[capability] ?? 0,
    sources.grants?.[mod]?.[capability] ?? 0,
  );
}

export function sourceOf(sources, mod, capability) {
  if (sources.restrictions?.[mod]?.[capability]) return "Restriction";
  const grant = sources.grants?.[mod]?.[capability] ?? 0;
  const group = sources.groups?.[mod]?.[capability] ?? 0;
  const profile = sources.profile?.[mod]?.[capability] ?? 0;
  const max = Math.max(profile, group, grant);
  if (max === 0) return null;
  if (grant === max) return "Direct";
  if (group === max) return "Groupe";
  return "Profil";
}

/** Le plafond d'une personne : super admin = toujours ouvert. */
export function eligibleOf(person, featureKey) {
  if (person.isSuperAdmin) return true;
  const row = ELIGIBILITY[person.profile] || ELIGIBILITY[person.roleLabel] || {};
  return row[featureKey] === "E";
}

/** Les trois portes pour un droit donné. La portée n'est pas devinée ici. */
export function gatesFor(person, moduleKey, capability, required = 1) {
  const meta = MODULE_BY_KEY[moduleKey];
  const eligible = person.isSuperAdmin || eligibleOf(person, meta?.feature);
  const level = person.isSuperAdmin ? 5 : effectiveOf(person.sources, moduleKey, capability);
  const restriction = sourceOf(person.sources, moduleKey, capability) === "Restriction";
  return [
    {
      key: "eligibility",
      tone: eligible ? "open" : "closed",
      label: person.isSuperAdmin ? "Contournée (super admin)" : eligible ? "Ouverte" : "Non éligible",
    },
    {
      key: "capability",
      tone: restriction ? "closed" : level >= required ? "open" : "closed",
      label: restriction ? "Restreinte" : level > 0 ? `${LEVELS[level].label} (${level})` : "Non détenue",
    },
    { key: "scope", tone: "neutral", label: "Non évaluée ici" },
  ];
}

export function riskOf(action) {
  if (action === "Restreindre" || action === "Forcer un profil") return "élevé";
  if (action === "Accorder") return "critique";
  return "normal";
}

export function explainCap(person, moduleKey, capability) {
  const meta = MODULE_BY_KEY[moduleKey];
  const sources = person.sources;
  return {
    featureLabel: meta?.featureLabel,
    feature: meta?.feature,
    eligibility: eligibleOf(person, module?.feature),
    layers: [
      { key: "profile", label: "Profil", level: sources.profile?.[moduleKey]?.[capability] ?? 0 },
      { key: "groups", label: "Groupe", level: sources.groups?.[moduleKey]?.[capability] ?? 0 },
      { key: "grants", label: "Droit direct", level: sources.grants?.[moduleKey]?.[capability] ?? 0 },
      { key: "restrictions", label: "Restriction", restricted: Boolean(sources.restrictions?.[moduleKey]?.[capability]) },
    ],
    effective: effectiveOf(sources, moduleKey, capability),
    source: sourceOf(sources, moduleKey, capability),
  };
}

// ─── Alertes du journal (calculées des données ci-dessus) ───────────────────
export function healthAlerts() {
  const deadRights = [{ profile: "Fondateur", feature: "Sécurité", name: "Fatou B." }];
  const pending = SCOPE_POLICIES.filter((policy) => !policy.implemented);
  const missingProfiles = CONTEXT_ROLES.filter((row) => row.profile === "—");
  const expiring = CONTEXT_GROUPS.flatMap((group) =>
    group.holders
      .filter((holder) => holder.status.startsWith("Expire"))
      .map((holder) => ({ group: group.name, ...holder })),
  );
  return { deadRights, pending, missingProfiles, expiring };
}
