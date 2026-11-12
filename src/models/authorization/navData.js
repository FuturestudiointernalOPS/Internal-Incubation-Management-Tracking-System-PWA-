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
  groups: "programs.groups",

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
  intelligence: "knowledge.view",
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
  learning: "public",
  certificates: "public",
  reviews: "public",
  portfolio: "public",
};

/** Why a proposal is uncertain — shown beside it in the review document. */
export const NAV_CAPABILITY_NOTES = {
  announcements:
    "DÉCIDÉ : le propriétaire seul. L'écran d'administration reste réservé à internal_comms.view, détenu par le profil du propriétaire ; publication = create_announcements ; modération = moderate. Aucun autre profil ne reçoit ces droits.",
  groups:
    "Page PM en LECTURE (groupes, équipes, staff du programme) ; les API /api/pm/* scopent au PM. Le droit de porte est programs.groups.",
  reviews:
    "Page personnelle : /api/facilitator-reviews exige seulement une session et renvoie les avis du facilitateur.",
  learning:
    "Surface personnelle : /api/lms/my-learning exige seulement une session et scope au participant.",
  certificates:
    "Surface personnelle : /api/participant/certificates exige seulement une session.",
  portfolio:
    "Surface personnelle investisseur : l'API self-service admet un membre avec un profil investisseur, même sans investor.view.",
  timeline:
    "Surface personnelle : /api/participant/timeline exige seulement une session.",
  activity:
    "Surface personnelle : /api/investor/decisions self-service, scopée à l'investisseur.",
  intelligence:
    "L'API /api/intelligence/metrics exige knowledge.view (section knowledge), pas reports.view.",
  internal_ops_board:
    "Board ops : tasks.view ou projects.view, selon le contenu réel du board.",
};
