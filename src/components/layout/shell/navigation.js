// Map legacy sidebar keys to new namespaced i18n keys
const NAV_KEY_MAP = {
  dashboard: "navigation.dashboard",
  programs: "navigation.programs",
  all_programs: "navigation.allPrograms",
  create_program: "navigation.createProgram",
  create_project: "navigation.createProject",
  progress_hub: "navigation.progress",
  progress: "navigation.progress",
  internal_ops: "navigation.internalOps",
  internal_ops_board: "navigation.internalOpsBoard",
  messages: "navigation.messages",
  communication: "navigation.communication",
  administration: "navigation.administration",

  forms: "navigation.forms",
  all_contacts: "navigation.contacts",
  knowledge: "navigation.knowledgeBase",
  knowledge_base: "navigation.knowledgeBase",
  intelligence: "navigation.intelligence",
  reports: "navigation.reports",
  report_responses: "navigation.reportResponses",
  internal_reports: "navigation.internalReports",
  settings: "navigation.settings",
  profile: "navigation.profile",
  logout: "navigation.logout",
  projects: "navigation.projects",
  all_projects: "navigation.allProjects",
  my_projects: "navigation.myProjects",
  sessions: "navigation.sessions",
  reviews: "navigation.reviews",
  assignments: "navigation.assignments",
  tasks: "reports.tasks",
  blockers: "reports.blockers",
  no_new_intel: "navigation.noNewIntel",
  intel_feed: "navigation.intelFeed",
  announcements: "navigation.announcements",
  followups: "navigation.followups",
  notifications: "navigation.notifications",
  timeline: "navigation.timeline",
  certificates: "navigation.certificates",
  activity: "navigation.activity",
  portfolio: "navigation.portfolio",
  watchlist: "navigation.watchlist",
  ventures: "navigation.ventures",
  all_ventures: "navigation.allVentures",
  journey_reports: "navigation.journeyReports",
  document_types: "navigation.documentTypes",
  investors: "navigation.investors",
  investor: "navigation.investor",
  investors_manage: "navigation.investorsManage",
  investors_dashboard: "navigation.investorsDashboard",
  investors_review: "navigation.investorsReview",
  investors_campaigns: "navigation.investorsCampaigns",
  investors_relationships: "navigation.investorsRelationships",
  operations: "navigation.operations",
  standup: "navigation.standup",
  retro: "navigation.retro",
  standups_retros: "navigation.standupsRetros",
  weekly_ops: "navigation.weeklyOps",
  finance: "navigation.finance",
  metrics: "navigation.metrics",
  program_reports: "navigation.programReports",
  audit_logs: "navigation.auditLogs",
  security: "navigation.security",
  integrations: "navigation.integrations",
  access_summary: "navigation.accessSummary",
  crm_membership: "navigation.membership",
  permissions: "navigation.permissions",
  system: "navigation.system",
  personnel: "navigation.personnel",
  logs: "navigation.logs",
  groups: "navigation.groups",
  crm: "navigation.crm",
  crm_dashboard: "navigation.crmDashboard",
  crm_timeline: "navigation.crmTimeline",
  crm_duplicates: "navigation.crmDuplicates",
  pending_users: "navigation.pendingUsers",
  bulk_upload: "navigation.bulkUpload",
  lms: "navigation.lms",
  lms_courses: "navigation.lmsCourses",
  learning: "navigation.learning",
  rituals: "navigation.rituals",
};

function tnav(key) {
  const mapped = NAV_KEY_MAP[key];
  if (mapped) return mapped;
  return key;
}

// Map last path segment -> translation key for the topbar breadcrumb.
// Keys must be unique: a duplicated key silently wins over the earlier one.
// When one segment means different things under different parents (e.g.
// /admin/reports/responses vs /platform/responses) disambiguate in
// CRUMB_FULL_PATH_MAP below instead of adding a second entry here.
const CRUMB_PATH_MAP = {
  admin: "navigation.dashboard",
  crm: "navigation.crm",
  timeline: "navigation.crmTimeline",
  duplicates: "navigation.crmDuplicates",
  contacts: "navigation.contacts",
  communications: "navigation.communication",
  pending_users: "navigation.pendingUsers",
  "pending-users": "navigation.pendingUsers",
  bulk_upload: "navigation.bulkUpload",
  "bulk-upload": "navigation.bulkUpload",
  forms: "navigation.forms",
  announcements: "navigation.announcements",
  programs: "navigation.programs",
  progress: "navigation.progress",
  ventures: "navigation.ventures",
  investors: "navigation.investors",
  campaigns: "navigation.investorsCampaigns",
  relationships: "navigation.investorsRelationships",
  review: "navigation.investorsReview",
  overview: "navigation.investorsOverview",
  dashboard: "navigation.dashboard",
  work: "navigation.internalOpsBoard",
  projects: "navigation.projects",
  tasks: "navigation.tasks",
  blockers: "navigation.blockers",
  standup: "navigation.standup",
  retro: "navigation.retro",
  knowledge: "navigation.knowledgeBase",
  intelligence: "navigation.intelligence",
  finance: "navigation.finance",
  reports: "navigation.reports",
  metrics: "navigation.metrics",
  settings: "navigation.settings",
  security: "navigation.security",
  integrations: "navigation.integrations",
  access: "navigation.accessSummary",
  membership: "navigation.groups",
  permissions: "navigation.permissions",
  system: "navigation.system",
  profile: "navigation.profile",
  messages: "navigation.messages",
  notifications: "navigation.notifications",
  sessions: "navigation.sessions",
  reviews: "navigation.reviews",
  assignments: "navigation.assignments",
  followups: "navigation.followups",
  certificates: "navigation.certificates",
  portfolio: "navigation.portfolio",
  history: "navigation.activity",
  teams: "navigation.manageTeams",
  submit: "navigation.forms",
  runs: "navigation.forms",
  collections: "navigation.collections",
  modules: "navigation.modules",
  groups: "navigation.groups",
  submissions: "navigation.submissions",
};

// Exact-path overrides, checked before CRUMB_PATH_MAP so a segment that means
// different things in different sections still resolves to the right crumb.
const CRUMB_FULL_PATH_MAP = {
  "/admin/reports/responses": "navigation.reportResponses",
  "/platform/responses": "navigation.forms",
};

function navCrumb(pathname) {
  const clean = (pathname || "")
    .split("?")[0]
    .split("#")[0]
    .replace(/\/+$/, "");
  if (CRUMB_FULL_PATH_MAP[clean]) return CRUMB_FULL_PATH_MAP[clean];
  const segment = clean.split("/").filter(Boolean).pop() || "";
  return CRUMB_PATH_MAP[segment] || (NAV_KEY_MAP[segment] ? NAV_KEY_MAP[segment] : segment);
}

/**
 * Resolve the active navigation path for the current route.
 * Walks the nav tree and returns the set of node ids on the single most
 * specific matching branch: an exact href match wins, otherwise the longest
 * segment-boundary prefix (so /admin/engineering matches
 * /admin/engineering/error-logs but never /admin/engineer-x). Hrefs that
 * contain a query string are skipped — they cannot be resolved from the
 * pathname alone (e.g. /staff/op-report?tab=standup keeps current behavior).
 */
function getActivePathIds(navItems, pathname) {
  if (!pathname) return new Set();
  let best = null; // { score, ids }
  const visit = (items, chain) => {
    (items || []).forEach((item) => {
      const nextChain = chain.concat(item.id);
      const childItems = item.children || item.subItems;
      if (childItems && childItems.length > 0) {
        visit(childItems, nextChain);
        return;
      }
      if (!item.href || item.href.includes("?")) return;
      let score = 0;
      if (pathname === item.href) score = 1000;
      else if (
        item.href.split("/").filter(Boolean).length >= 2 &&
        pathname.startsWith(item.href + "/")
      ) {
        score = item.href.length;
      }
      if (score > 0 && (!best || score > best.score)) {
        best = { score, ids: nextChain };
      }
    });
  };
  visit(navItems, []);
  return best ? new Set(best.ids) : new Set();
}

/**
 * IMPACTOS OPERATIONAL CONTROL ÔÇö GLOBAL LAYOUT
 * Simplified, high-performance frame with i18n and theme support.
 */

export { tnav, navCrumb, getActivePathIds };
