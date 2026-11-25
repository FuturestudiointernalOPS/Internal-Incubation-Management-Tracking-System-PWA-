/**
 * The address catalogue — the staff space — core screens and its contexts.
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

export const STAFF_SCREENS = [
  { id: "staff.home", role: "staff", context: null, feature: null, path: "/staff" },
  { id: "staff.create.investor", role: "staff", context: "create", feature: "investor", path: "/staff/create/investor" },
  { id: "staff.create.program", role: "staff", context: "create", feature: "program", path: "/staff/create/program" },
  { id: "staff.create.venture", role: "staff", context: "create", feature: "venture", path: "/staff/create/venture" },
  { id: "staff.crm", role: "staff", context: "crm", feature: null, path: "/staff/crm" },
  { id: "staff.crm.activities", role: "staff", context: "crm", feature: "activities", path: "/staff/crm/activities" },
  { id: "staff.crm.automations", role: "staff", context: "crm", feature: "automations", path: "/staff/crm/automations" },
  { id: "staff.crm.contacts", role: "staff", context: "crm", feature: "contacts", path: "/staff/crm/contacts" },
  { id: "staff.crm.duplicates", role: "staff", context: "crm", feature: "duplicates", path: "/staff/crm/duplicates" },
  { id: "staff.crm.leads", role: "staff", context: "crm", feature: "leads", path: "/staff/crm/leads" },
  { id: "staff.crm.leads.detail", role: "staff", context: "crm", feature: "leads", path: "/staff/crm/leads/[id]" },
  { id: "staff.crm.membership", role: "staff", context: "crm", feature: "membership", path: "/staff/crm/membership" },
  { id: "staff.crm.opportunities", role: "staff", context: "crm", feature: "opportunities", path: "/staff/crm/opportunities" },
  { id: "staff.crm.opportunities.detail", role: "staff", context: "crm", feature: "opportunities", path: "/staff/crm/opportunities/[id]" },
  { id: "staff.crm.organizations", role: "staff", context: "crm", feature: "organizations", path: "/staff/crm/organizations" },
  { id: "staff.crm.people.detail", role: "staff", context: "crm", feature: "people", path: "/staff/crm/people/[cid]" },
  { id: "staff.crm.pipelines", role: "staff", context: "crm", feature: "pipelines", path: "/staff/crm/pipelines" },
  { id: "staff.crm.segments", role: "staff", context: "crm", feature: "segments", path: "/staff/crm/segments" },
  { id: "staff.crm.timeline", role: "staff", context: "crm", feature: "timeline", path: "/staff/crm/timeline" },
  { id: "staff.dashboard", role: "staff", context: null, feature: "dashboard", path: "/staff/dashboard" },
  { id: "staff.finance", role: "staff", context: "finance", feature: null, path: "/staff/finance" },
  { id: "staff.me", role: "staff", context: null, feature: "me", path: "/staff/me" },
  { id: "staff.messages", role: "staff", context: null, feature: "messages", path: "/staff/messages" },
  { id: "staff.op-report", role: "staff", context: null, feature: "op-report", path: "/staff/op-report" },
  { id: "staff.program-manager", role: "staff", context: "program-manager", feature: null, path: "/staff/program-manager" },
  { id: "staff.program-manager.communications.contacts", role: "staff", context: "program-manager", feature: "communications", path: "/staff/program-manager/communications/contacts" },
  { id: "staff.program-manager.dashboard", role: "staff", context: "program-manager", feature: "dashboard", path: "/staff/program-manager/dashboard" },
  { id: "staff.program-manager.lms.courses", role: "staff", context: "program-manager", feature: "lms", path: "/staff/program-manager/lms/courses" },
  { id: "staff.program-manager.lms.courses.detail", role: "staff", context: "program-manager", feature: "lms", path: "/staff/program-manager/lms/courses/[id]" },
  { id: "staff.program-manager.lms.courses.new", role: "staff", context: "program-manager", feature: "lms", path: "/staff/program-manager/lms/courses/new" },
  { id: "staff.program-manager.messages", role: "staff", context: "program-manager", feature: "messages", path: "/staff/program-manager/messages" },
  { id: "staff.program-manager.profile", role: "staff", context: "program-manager", feature: "profile", path: "/staff/program-manager/profile" },
  { id: "staff.program-manager.programs", role: "staff", context: "program-manager", feature: "programs", path: "/staff/program-manager/programs" },
  { id: "staff.program-manager.programs.detail", role: "staff", context: "program-manager", feature: "programs", path: "/staff/program-manager/programs/[id]" },
  { id: "staff.program-manager.programs.detail.facilitators", role: "staff", context: "program-manager", feature: "programs", path: "/staff/program-manager/programs/[id]/facilitators" },
  { id: "staff.program-manager.progress", role: "staff", context: "program-manager", feature: "progress", path: "/staff/program-manager/progress" },
  { id: "staff.program-manager.submissions", role: "staff", context: "program-manager", feature: "submissions", path: "/staff/program-manager/submissions" },
  { id: "staff.projects", role: "staff", context: null, feature: "projects", path: "/staff/projects" },
  { id: "staff.projects.detail", role: "staff", context: null, feature: "projects", path: "/staff/projects/[id]" },
  { id: "staff.tasks", role: "staff", context: null, feature: "tasks", path: "/staff/tasks" },
  { id: "staff.venture-admin", role: "staff", context: "venture-admin", feature: null, path: "/staff/venture-admin" },
  { id: "staff.venture-admin.portfolio", role: "staff", context: "venture-admin", feature: "portfolio", path: "/staff/venture-admin/portfolio", legacy: ["/staff/ventures/portfolio"] },
  { id: "staff.venture-admin.reporting-settings", role: "staff", context: "venture-admin", feature: "reporting-settings", path: "/staff/venture-admin/reporting-settings", legacy: ["/staff/ventures/reporting-settings"] },
  { id: "staff.venture-admin.ventures", role: "staff", context: "venture-admin", feature: "ventures", path: "/staff/venture-admin/ventures", legacy: ["/staff/ventures/all"] },
  { id: "staff.ventures", role: "staff", context: "lead-manager", feature: "ventures", path: "/staff/lead-manager/ventures", legacy: ["/staff/ventures"] },
  { id: "staff.ventures.detail", role: "staff", context: "lead-manager", feature: "ventures", path: "/staff/lead-manager/ventures/[id]", legacy: ["/staff/ventures/[id]"] },
  // A5 — carried along the rename in the SAME shape so the addresses keep
  // serving until B6 renders them as `?tab=` views of the hub above.
  { id: "staff.ventures.detail.document-types", role: "staff", context: "lead-manager", feature: "ventures", path: "/staff/lead-manager/ventures/[id]/document-types", legacy: ["/staff/ventures/[id]/document-types"] },
  { id: "staff.ventures.detail.emails", role: "staff", context: "lead-manager", feature: "ventures", path: "/staff/lead-manager/ventures/[id]/emails", legacy: ["/staff/ventures/[id]/emails"] },
  { id: "staff.ventures.document-types", role: "staff", context: "lead-manager", feature: "ventures", path: "/staff/lead-manager/ventures/document-types", legacy: ["/staff/ventures/document-types"] },
];
