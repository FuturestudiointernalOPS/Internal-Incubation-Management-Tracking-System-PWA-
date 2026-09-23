/**
 * server/authz — capabilities.
 *
 * The permission vocabulary: which module exposes which capability, the ordered
 * access levels, and the roles that hold program-wide management access.
 *
 * Pure data and pure predicates: no database, no session. Safe to import from
 * anywhere that needs to reason about "what could this account do".
 */


// =============================================================================
// AUTHORIZATION SYSTEM
// =============================================================================

export const PERMISSION_MODULES = {
  projects: {
    name: "Projects",
    capabilities: ["view", "create", "edit", "delete", "archive"],
  },
  programs: {
    name: "Programs",
    capabilities: ["view", "create", "edit", "delete", "publish"],
  },
  users: {
    name: "Users",
    capabilities: [
      "view",
      "create",
      "edit",
      "suspend",
      "delete",
      "assign_roles",
    ],
  },
  reports: {
    name: "Reports",
    capabilities: ["view", "create", "export", "delete"],
  },
  messaging: { name: "Messages", capabilities: ["view", "send", "delete"] },
  internal_comms: {
    name: "Announcements",
    capabilities: ["view", "create_announcements", "moderate"],
  },
  forms: { name: "Forms", capabilities: ["view", "create", "edit", "delete"] },
  // `review` is separate from `edit` on purpose: sending run messages, assigning
  // people and retrying emails must never imply the authority to admit or reject
  // an applicant. Granted to nobody by default.
  runs: { name: "Runs", capabilities: ["view", "create", "edit", "delete", "review"] },
  contacts: {
    name: "Contacts",
    capabilities: ["view", "create", "edit", "delete"],
  },
  permissions: {
    name: "Permissions",
    capabilities: [
      "view_matrix",
      "grant",
      "revoke",
      "assign_capabilities",
      "assign_groups",
      "assign_responsibilities",
      "promote_super_admin",
      "remove_super_admin",
      "configure_eligibility",
    ],
  },
  engineering: {
    name: "Engineering Operations",
    capabilities: [
      "view",
      "manage_tasks",
      "manage_errors",
    ],
  },
  finance: {
    name: "Finance",
    capabilities: ["view", "create", "edit", "delete", "export"],
  },
  settings: { name: "System Settings", capabilities: ["view", "edit"] },
  org_membership: {
    name: "Organizational Membership",
    capabilities: ["view", "manage"],
  },
  knowledge: {
    name: "Knowledge Base",
    capabilities: ["view", "create", "edit", "delete"],
  },
  lms: {
    name: "LMS",
    capabilities: ["view", "create", "edit", "delete"],
  },
  tasks: {
    name: "Tasks",
    capabilities: ["view", "create", "edit", "delete"],
  },
  ventures: {
    name: "Ventures",
    capabilities: ["view", "create", "edit", "delete"],
  },
  investor: {
    name: "Investor",
    capabilities: ["view", "create", "edit", "delete"],
  },
  facilitator: {
    name: "Program Facilitator",
    capabilities: [
      "participants.view",
      "participants.manage",
      "attendance.view",
      "attendance.record",
      "assignments.view",
      "assignments.review",
      "assignments.grade",
      "sessions.conduct",
      "sessions.record",
      "progress.view",
      "groups.view",
      "groups.manage",
      "reviews.submit",
    ],
  },
};

export const ACCESS_LEVELS = {
  NONE: 0,
  VIEW: 1,
  CREATE: 2,
  EDIT: 3,
  DELETE: 4,
  FULL: 5,
};

// =============================================================================
// PROGRAM FACILITATOR AUTHORIZATION
// -----------------------------------------------------------------------------
// External facilitators are assigned per program via v2_program_staff rows with
// role = 'facilitator'. They are NOT Future Studio staff (group_name stays
// 'Facilitators' / anything other than 'FUTURE STUDIO').
//
// Permission resolution per program:
//   1. Individual override (v2_program_staff.permissions JSON map) wins
//   2. Otherwise program default (v2_programs.facilitator_default_permissions)
//   3. Otherwise denied
//
// Participant scope:
//   v2_programs.facilitator_scope = 'all'  -> whole program
//   'assigned_groups' -> groups where the facilitator is the lead
//     (families.lead_facilitator_id)
// =============================================================================

export const FACILITATOR_BYPASS_ROLES = ["super_admin", "program_manager"];

// NOTE: this list MUST stay aligned with hasProgramManagementAccess() below.
// "staff" is deliberately NOT included: staff program-delivery access is
// assignment-derived (enforced through the assignment guard), matching the
// live routes' gate. Keeping staff in the bypass list here would silently
// expand staff access when requireAssignmentAccess() is used.

/**
 * Roles with system-defined, program-wide management access. These roles keep
 * their existing program-management workflows and are NOT subject to the
 * per-program facilitator assignment check on shared program-data APIs.
 */
export function hasProgramManagementAccess(role) {
  return ["super_admin", "program_manager"].includes(role);
}
