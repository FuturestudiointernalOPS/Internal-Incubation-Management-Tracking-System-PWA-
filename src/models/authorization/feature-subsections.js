/**
 * ImpactOS — Authorization: FEATURE SUB-SECTIONS (Access-Profile template)
 *
 * The Access-Profile template ("Templates") lists, under each FEATURE (a
 * dashboard section), the SAME sub-sections the sidebar shows, in the same
 * order. Each sub-section optionally names the permission MODULE that backs it:
 *
 *   - `module` set   → an editable row: its capabilities are the module's.
 *   - `module` unset → an INFORMATIONAL row: the screen has no capability of its
 *                      own (it is governed by the feature's `view`, or by the
 *                      role) — shown without checkboxes.
 *
 * A module may be named by several sub-sections (reports → Program reports /
 * Internal reports / Program health). Only the FIRST occurrence is editable;
 * later ones are kept as informational aliases (they are the same stored caps).
 *
 * Sub-sections whose backing module belongs to ANOTHER feature are shown under
 * that module's feature (e.g. Pending approvals → `users`, under Security) —
 * never duplicated here.
 *
 * Modules of a feature that have no sub-section (facilitator, users) are
 * appended by `buildSubsectionRows` so no capability is ever hidden.
 *
 * Pure module (no db / React import) — safe for client components and tests.
 */
export const FEATURE_SUBSECTIONS = {
  crm: [
    { id: "crm_dashboard", labelKey: "navigation.crmDashboard" },
    { id: "all_contacts", labelKey: "navigation.contacts", module: "contacts" },
    { id: "crm_membership", labelKey: "navigation.membership" },
    { id: "crm_timeline", labelKey: "navigation.crmTimeline" },
    { id: "crm_duplicates", labelKey: "navigation.crmDuplicates", module: "duplicates" },
    { id: "bulk_upload", labelKey: "navigation.bulkUpload", module: "bulk_upload" },
  ],
  communication: [
    { id: "messages", labelKey: "navigation.messages", module: "messaging" },
    { id: "announcements", labelKey: "navigation.announcements", module: "internal_comms" },
    { id: "forms", labelKey: "navigation.forms" },
    { id: "groups", labelKey: "navigation.groups" },
  ],
  programs: [
    { id: "all_programs", labelKey: "navigation.allPrograms", module: "programs" },
    { id: "create_program", labelKey: "navigation.createProgram" },
    { id: "progress", labelKey: "navigation.progress" },
  ],
  ventures: [
    { id: "all_ventures", labelKey: "navigation.allVentures", module: "ventures" },
    { id: "register_venture", labelKey: "navigation.registerVenture" },
  ],
  investors: [
    { id: "investors_manage", labelKey: "navigation.investorsManage", module: "investor" },
    { id: "investors_dashboard", labelKey: "navigation.investorsDashboard" },
    { id: "investors_review", labelKey: "navigation.investorsReview" },
    { id: "investors_overview", labelKey: "navigation.investorsOverview" },
    { id: "investors_campaigns", labelKey: "navigation.investorsCampaigns" },
    { id: "investors_relationships", labelKey: "navigation.investorsRelationships" },
  ],
  finance: [],
  operations: [
    { id: "internal_ops_board", labelKey: "navigation.internalOpsBoard" },
    { id: "all_projects", labelKey: "navigation.allProjects", module: "projects" },
    { id: "create_project", labelKey: "navigation.createProject" },
    { id: "tasks", labelKey: "navigation.tasks", module: "tasks" },
    { id: "blockers", labelKey: "navigation.blockers" },
    { id: "standup", labelKey: "navigation.standup" },
    { id: "retro", labelKey: "navigation.retro" },
    // Backed by `projects` (already editable above) — informational alias.
    { id: "my_projects", labelKey: "navigation.myProjects" },
  ],
  reports: [
    { id: "program_reports", labelKey: "navigation.programReports", module: "reports" },
    { id: "internal_reports", labelKey: "navigation.internalReports" },
    { id: "metrics", labelKey: "navigation.metrics" },
  ],
  knowledge: [
    { id: "knowledge_base", labelKey: "navigation.knowledgeBase", module: "knowledge" },
    { id: "intelligence", labelKey: "navigation.intelligence" },
  ],
  lms: [{ id: "lms_courses", labelKey: "navigation.lmsCourses", module: "lms" }],
  security: [
    { id: "security", labelKey: "navigation.security" },
    { id: "audit_logs", labelKey: "navigation.auditLogs" },
    { id: "access_summary", labelKey: "navigation.accessSummary" },
    { id: "permissions", labelKey: "navigation.permissions", module: "permissions" },
  ],
  settings: [
    { id: "integrations", labelKey: "navigation.integrations" },
    { id: "engineering_dashboard", labelKey: "navigation.engineering", module: "engineering" },
    { id: "system", labelKey: "navigation.system", module: "settings" },
  ],
};
