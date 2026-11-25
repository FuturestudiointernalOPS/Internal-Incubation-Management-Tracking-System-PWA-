/**
 * The address catalogue — the admin venture hub — its screens and record views (agent B owns this file).
 *
 * Generated from the page tree for P0. Each row is one screen: where it must
 * live (`path`, plus `tab`/`query` when the view sits behind a parameter),
 * the addresses that still answer to it (`legacy`), and the role/context/
 * feature it belongs to. See docs/ADDRESS_CONTRACT.md.
 *
 * `pending: true` means the move has not happened yet: the first legacy
 * address still serves its own page and NOTHING redirects. Removing the flag is
 * the last step of a move — the check then requires `path` to exist and turns
 * every legacy address into a redirect.
 *
 * Do not invent rows: every `path` here must exist as a page.
 */

export const ADMIN_VENTURE_SCREENS = [
  { id: "admin.ventures", role: "admin", context: "ventures", feature: null, path: "/admin/ventures" },
  { id: "admin.ventures.detail", role: "admin", context: "ventures", feature: null, path: "/admin/ventures/[id]" },
  { id: "admin.ventures.detail.analytics", role: "admin", context: "ventures", feature: null, path: "/admin/ventures/[id]", tab: "analytics", legacy: ["/admin/ventures/[id]/analytics"], pending: true },
  { id: "admin.ventures.detail.coaches", role: "admin", context: "ventures", feature: null, path: "/admin/ventures/[id]", tab: "coaches", legacy: ["/admin/ventures/[id]/coaches"], pending: true },
  { id: "admin.ventures.detail.dashboard", role: "admin", context: "ventures", feature: null, path: "/admin/ventures/[id]", tab: "dashboard", legacy: ["/admin/ventures/[id]/dashboard"], pending: true },
  { id: "admin.ventures.detail.document-types", role: "admin", context: "ventures", feature: null, path: "/admin/ventures/[id]", tab: "document-types", legacy: ["/admin/ventures/[id]/document-types"], pending: true },
  { id: "admin.ventures.detail.documents", role: "admin", context: "ventures", feature: null, path: "/admin/ventures/[id]", tab: "dataRoom", legacy: ["/admin/ventures/[id]/documents"], pending: true },
  { id: "admin.ventures.detail.edit", role: "admin", context: "ventures", feature: null, path: "/admin/ventures/[id]", tab: "edit", legacy: ["/admin/ventures/[id]/edit"], pending: true },
  { id: "admin.ventures.detail.feedback", role: "admin", context: "ventures", feature: null, path: "/admin/ventures/[id]", tab: "feedback", legacy: ["/admin/ventures/[id]/feedback"], pending: true },
  { id: "admin.ventures.detail.founders", role: "admin", context: "ventures", feature: null, path: "/admin/ventures/[id]", tab: "founders", legacy: ["/admin/ventures/[id]/founders"], pending: true },
  { id: "admin.ventures.detail.fundraising", role: "admin", context: "ventures", feature: null, path: "/admin/ventures/[id]", tab: "fundraising", legacy: ["/admin/ventures/[id]/fundraising"], pending: true },
  { id: "admin.ventures.detail.history", role: "admin", context: "ventures", feature: null, path: "/admin/ventures/[id]", tab: "history", legacy: ["/admin/ventures/[id]/history"], pending: true },
  { id: "admin.ventures.detail.investment", role: "admin", context: "ventures", feature: null, path: "/admin/ventures/[id]", tab: "investment", legacy: ["/admin/ventures/[id]/investment"], pending: true },
  { id: "admin.ventures.detail.investors", role: "admin", context: "ventures", feature: null, path: "/admin/ventures/[id]", tab: "investors", legacy: ["/admin/ventures/[id]/investors"], pending: true },
  { id: "admin.ventures.detail.journey", role: "admin", context: "ventures", feature: null, path: "/admin/ventures/[id]", tab: "journey", legacy: ["/admin/ventures/[id]/journey"], pending: true },
  { id: "admin.ventures.detail.knowledge", role: "admin", context: "ventures", feature: null, path: "/admin/ventures/[id]", tab: "knowledge", legacy: ["/admin/ventures/[id]/knowledge"], pending: true },
  { id: "admin.ventures.detail.milestones", role: "admin", context: "ventures", feature: null, path: "/admin/ventures/[id]", tab: "milestones", legacy: ["/admin/ventures/[id]/milestones"], pending: true },
  { id: "admin.ventures.detail.notes", role: "admin", context: "ventures", feature: null, path: "/admin/ventures/[id]", tab: "notes", legacy: ["/admin/ventures/[id]/notes"], pending: true },
  { id: "admin.ventures.detail.permissions", role: "admin", context: "ventures", feature: null, path: "/admin/ventures/[id]", tab: "permissions", legacy: ["/admin/ventures/[id]/permissions"], pending: true },
  { id: "admin.ventures.detail.projects", role: "admin", context: "ventures", feature: null, path: "/admin/ventures/[id]", tab: "projects", legacy: ["/admin/ventures/[id]/projects"], pending: true },
  { id: "admin.ventures.detail.projects.emails", role: "admin", context: "ventures", feature: null, path: "/admin/ventures/[id]", tab: "projects", query: "view=emails", legacy: ["/admin/ventures/[id]/projects/emails"], pending: true },
  { id: "admin.ventures.detail.reporting", role: "admin", context: "ventures", feature: null, path: "/admin/ventures/[id]", tab: "reporting", legacy: ["/admin/ventures/[id]/reporting"], pending: true },
  { id: "admin.ventures.detail.reporting.dashboard", role: "admin", context: "ventures", feature: null, path: "/admin/ventures/[id]", tab: "reporting", query: "view=dashboard", legacy: ["/admin/ventures/[id]/reporting/dashboard"], pending: true },
  { id: "admin.ventures.detail.reporting.quarterly", role: "admin", context: "ventures", feature: null, path: "/admin/ventures/[id]", tab: "reporting", query: "period=quarterly", legacy: ["/admin/ventures/[id]/reporting/quarterly"], pending: true },
  { id: "admin.ventures.detail.reports", role: "admin", context: "ventures", feature: null, path: "/admin/ventures/[id]", tab: "reports", legacy: ["/admin/ventures/[id]/reports"], pending: true },
  { id: "admin.ventures.detail.sessions", role: "admin", context: "ventures", feature: null, path: "/admin/ventures/[id]", tab: "sessions", legacy: ["/admin/ventures/[id]/sessions"], pending: true },
  { id: "admin.ventures.detail.tasks", role: "admin", context: "ventures", feature: null, path: "/admin/ventures/[id]", tab: "tasks", legacy: ["/admin/ventures/[id]/tasks"], pending: true },
  { id: "admin.ventures.detail.timeline", role: "admin", context: "ventures", feature: null, path: "/admin/ventures/[id]", tab: "timeline", legacy: ["/admin/ventures/[id]/timeline"], pending: true },
  { id: "admin.ventures.detail.verification", role: "admin", context: "ventures", feature: null, path: "/admin/ventures/[id]", tab: "verification", legacy: ["/admin/ventures/[id]/verification"], pending: true },
  { id: "admin.ventures.admin", role: "admin", context: "ventures", feature: "admin", path: "/admin/ventures/admin" },
  { id: "admin.ventures.document-types", role: "admin", context: "ventures", feature: "document-types", path: "/admin/ventures/document-types" },
  { id: "admin.ventures.permissions", role: "admin", context: "ventures", feature: "permissions", path: "/admin/ventures/permissions" },
  { id: "admin.ventures.portfolio", role: "admin", context: "ventures", feature: "portfolio", path: "/admin/ventures/portfolio" },
  { id: "admin.ventures.projects", role: "admin", context: "ventures", feature: "projects", path: "/admin/ventures/projects" },
  { id: "admin.ventures.projects.detail", role: "admin", context: "ventures", feature: "projects", path: "/admin/ventures/projects/[id]" },
  { id: "admin.ventures.projects.detail.emails", role: "admin", context: "ventures", feature: "projects", path: "/admin/ventures/projects/[id]/emails" },
  { id: "admin.ventures.reporting-settings", role: "admin", context: "ventures", feature: "reporting-settings", path: "/admin/ventures/reporting-settings" },
];
