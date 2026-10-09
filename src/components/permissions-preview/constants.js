/**
 * CENTRE DE PERMISSIONS — PRÉVISUALISATION : vocabulaire et algèbre (pur).
 *
 * Aucune donnée ici : seulement les niveaux, les libellés français des
 * fonctionnalités, et l'arithmétique des droits (4 sources → niveau le plus
 * élevé → moins les restrictions). Tout est réel ou dérivé à l'affichage.
 */

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

export const FEATURE_LABELS = {
  crm: "CRM",
  communication: "Communication",
  programs: "Programmes",
  programmes: "Programmes",
  ventures: "Ventures",
  investors: "Investisseurs",
  finance: "Finance",
  operations: "Opérations",
  reports: "Rapports",
  rapports: "Rapports",
  knowledge: "Connaissances",
  lms: "LMS",
  security: "Sécurité",
  securite: "Sécurité",
  settings: "Paramètres",
  parametres: "Paramètres",
};
export const featureLabel = (key) => FEATURE_LABELS[key] || key;

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
};
export const capLabel = (cap) => CAP_LABELS[cap] || String(cap);

// ─── Algèbre des droits ─────────────────────────────────────────────────────
export function effectiveOf(sources, mod, capability) {
  if (sources?.restrictions?.[mod]?.[capability]) return 0;
  return Math.max(
    sources?.profile?.[mod]?.[capability] ?? 0,
    sources?.groups?.[mod]?.[capability] ?? 0,
    sources?.grants?.[mod]?.[capability] ?? 0,
  );
}

export function sourceOf(sources, mod, capability) {
  if (sources?.restrictions?.[mod]?.[capability]) return "Restriction";
  const grant = sources?.grants?.[mod]?.[capability] ?? 0;
  const group = sources?.groups?.[mod]?.[capability] ?? 0;
  const profile = sources?.profile?.[mod]?.[capability] ?? 0;
  const max = Math.max(profile, group, grant);
  if (max === 0) return null;
  if (grant === max) return "Direct";
  if (group === max) return "Groupe";
  return "Profil";
}

export function explainCap(person, mod, capability) {
  const sources = person.sources || {};
  return {
    layers: [
      { key: "profile", label: "Profil", level: sources.profile?.[mod]?.[capability] ?? 0 },
      { key: "groups", label: "Groupe", level: sources.groups?.[mod]?.[capability] ?? 0 },
      { key: "grants", label: "Droit direct", level: sources.grants?.[mod]?.[capability] ?? 0 },
      { key: "restrictions", label: "Restriction", restricted: Boolean(sources.restrictions?.[mod]?.[capability]) },
    ],
    effective: effectiveOf(sources, mod, capability),
    source: sourceOf(sources, mod, capability),
  };
}

export function riskOf(action) {
  if (action === "Restreindre" || action === "Forcer un profil") return "élevé";
  if (action === "Accorder") return "critique";
  return "normal";
}

/** Les trois portes, à partir de verdicts déjà calculés. */
export function buildGates({ isSuperAdmin, eligible, level, restricted, required }) {
  return [
    {
      key: "eligibility",
      tone: eligible ? "open" : "closed",
      label: isSuperAdmin ? "Contournée (super admin)" : eligible ? "Ouverte" : "Non éligible",
    },
    {
      key: "capability",
      tone: restricted ? "closed" : level >= required ? "open" : "closed",
      label: restricted
        ? "Restreinte"
        : level > 0
          ? `${LEVELS[level].label} (${level})`
          : "Non détenue",
    },
    { key: "scope", tone: "neutral", label: "Non évaluée ici" },
  ];
}
