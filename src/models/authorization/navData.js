/**
 * NAVIGATION CAPABILITY PROPOSAL — DATA ONLY.
 *
 * The 43 master-navigation destinations that still have no declared right.
 * Each value is either:
 *   "public"          — no right required (personal / home / own records);
 *   "<module>.<cap>"  — one catalogue capability;
 *   "a OR b"          — any one of several capabilities.
 *
 * This is a PROPOSAL for step 3, not enforced yet. The 31 destinations that
 * already carry a right in `masterNavigation/access.js` are not repeated here.
 *
 * The decision engine must never read this file. A test checks that every
 * undecided destination is covered and that every capability exists.
 */

export const NAV_CAPABILITY_PROPOSAL = {
  // Home / neutral
  dashboard: "public",

  // Communication
  announcements: "internal_comms.view",
  forms: "forms.view",
  groups: "org_membership.view",

  // Programs
  all_programs: "programs.view",
  create_program: "programs.create",
  progress: "programs.view",

  // Ventures
  all_ventures: "ventures.view",

  // Investors
  investors_manage: "investor.view",
  investors_dashboard: "investor.view",
  investors_review: "investor.view",
  investors_campaigns: "investor.view",
  investors_relationships: "investor.view",
  investors_portfolio: "investor.view",
  investors_deal_flow: "investor.view",
  investors_introductions: "investor.view",
  investors_metrics: "investor.view",

  // Operations
  internal_ops_board: "tasks.view OR projects.view",
  all_projects: "projects.view",
  create_project: "projects.create",
  tasks: "tasks.view",
  blockers: "tasks.view",
  standup: "reports.create",
  retro: "reports.create",

  // Intelligence / Reports
  intelligence: "reports.view",
  program_reports: "reports.view",
  internal_reports: "reports.view",
  metrics: "reports.view",

  // Knowledge
  knowledge_base: "knowledge.view",

  // LMS
  lms_courses: "lms.view OR lms.create OR lms.edit",
  lms_registrations: "lms.edit",

  // Settings / security
  system: "settings.view",
  audit_logs: "settings.view",
  access_summary: "permissions.view_matrix",
  permissions: "permissions.view_matrix",

  // Personal surfaces
  my_programs: "public",
  profile: "public",
  timeline: "public",
  activity: "public",
  learning: "lms.view",
  certificates: "lms.view",
  reviews: "facilitator.reviews.submit",
  portfolio: "investor.view OR ventures.view",
};

/** Why a proposal is uncertain — shown beside it in the review document. */
export const NAV_CAPABILITY_NOTES = {
  announcements:
    "Le profil staff par défaut ne contient pas internal_comms.view : vérifier qui doit voir les annonces.",
  groups:
    "Page de gestion des groupes : view ou manage ? Le droit de lecture suffit pour la porte ; les actions re-vérifient.",
  reviews:
    "Vérifier si la page lit les avis reçus ou permet d'en soumettre ; le droit est le même aujourd'hui.",
  learning:
    "Vérifier que le profil learner est actif pour les participants ; sinon la porte disparaîtrait.",
  certificates:
    "Même question que learning : dépend du profil learner.",
  portfolio:
    "Le profil de base d'un investisseur est venture_member : investor.view peut ne pas être détenu.",
  timeline:
    "Surface personnelle (profil) : public, le serveur vérifie la propriété.",
  activity:
    "Surface personnelle : public, le serveur vérifie la propriété.",
  intelligence:
    "Aucune capacité dédiée : reports.view proposé comme droit le plus proche.",
  internal_ops_board:
    "Board ops : tasks.view ou projects.view, selon le contenu réel du board.",
};
