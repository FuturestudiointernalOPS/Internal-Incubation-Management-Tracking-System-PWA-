/**
 * ImpactOS — Authorization Foundation: CAPABILITY CATALOG (Phase 2)
 *
 * The single centralized source for human-readable capability metadata.
 * The UI must not hardcode capability labels in multiple places — it reads
 * this catalog (exposed via /api/engineering/permissions) for Eligibility,
 * Default Access, Individual Access, Restrictions and explanations.
 *
 * Structure: module → { name, risk, capabilities: { cap → { label, risk, description } } }
 */

export const CAPABILITY_CATALOG = {
  contacts: {
    name: "Contacts (CRM)",
    risk: "medium",
    capabilities: {
      view: { label: "View", risk: "low", description: "See people and contact records" },
      create: { label: "Create", risk: "medium", description: "Add new contacts" },
      edit: { label: "Edit", risk: "medium", description: "Modify contact records" },
      delete: { label: "Delete", risk: "high", description: "Remove contacts (soft delete)" },
      import: { label: "Import", risk: "high", description: "Bulk-import contacts" },
      export: { label: "Export", risk: "medium", description: "Export contact data" },
    },
  },
  programs: {
    name: "Programs",
    risk: "medium",
    capabilities: {
      view: { label: "View", risk: "low", description: "See programs" },
      create: { label: "Create", risk: "medium", description: "Create new programs" },
      edit: { label: "Edit", risk: "medium", description: "Edit program content and teams" },
      delete: { label: "Delete", risk: "high", description: "Delete programs" },
      publish: { label: "Publish", risk: "medium", description: "Publish program content" },
    },
  },
  reports: {
    name: "Reports",
    risk: "medium",
    capabilities: {
      view: { label: "View", risk: "low", description: "See reports" },
      create: { label: "Create", risk: "medium", description: "Submit standups, retros and op-reports" },
      export: { label: "Export", risk: "medium", description: "Export report data" },
      delete: { label: "Delete", risk: "high", description: "Delete reports" },
    },
  },
  messaging: {
    name: "Messaging",
    risk: "medium",
    capabilities: {
      view: { label: "View", risk: "low", description: "Read conversations" },
      send: { label: "Send", risk: "medium", description: "Send messages" },
      delete: { label: "Delete", risk: "high", description: "Delete messages (retention rule: never used)" },
    },
  },
  internal_comms: {
    name: "Internal Communication",
    risk: "medium",
    capabilities: {
      view: { label: "View", risk: "low", description: "See internal communication" },
      create_announcements: { label: "Create Announcements", risk: "medium", description: "Post announcements" },
      moderate: { label: "Moderate", risk: "high", description: "Edit/delete announcements" },
    },
  },
  projects: {
    name: "Projects",
    risk: "medium",
    capabilities: {
      view: { label: "View", risk: "low", description: "See projects" },
      create: { label: "Create", risk: "medium", description: "Create projects" },
      edit: { label: "Edit", risk: "medium", description: "Edit projects" },
      delete: { label: "Delete", risk: "high", description: "Delete projects" },
      archive: { label: "Archive", risk: "medium", description: "Archive projects" },
    },
  },
  users: {
    name: "Users",
    risk: "high",
    capabilities: {
      view: { label: "View", risk: "medium", description: "See user accounts" },
      create: { label: "Create", risk: "high", description: "Create user accounts" },
      edit: { label: "Edit", risk: "high", description: "Edit user accounts" },
      suspend: { label: "Suspend", risk: "high", description: "Suspend accounts" },
      delete: { label: "Delete", risk: "high", description: "Delete accounts" },
      assign_roles: { label: "Assign Roles", risk: "high", description: "Change user roles" },
    },
  },
  permissions: {
    name: "Permissions",
    risk: "high",
    capabilities: {
      view_matrix: { label: "View Matrix", risk: "medium", description: "See permission matrices" },
      grant: { label: "Grant", risk: "high", description: "Grant individual access" },
      revoke: { label: "Revoke", risk: "high", description: "Revoke individual access" },
      assign_capabilities: { label: "Assign Capabilities", risk: "high", description: "Assign capabilities to roles/groups" },
      assign_groups: { label: "Assign Groups", risk: "high", description: "Manage group membership" },
      assign_responsibilities: { label: "Assign Responsibilities", risk: "high", description: "Manage responsibilities" },
      promote_super_admin: { label: "Promote Super Admin", risk: "critical", description: "Grant Super Admin" },
      remove_super_admin: { label: "Remove Super Admin", risk: "critical", description: "Remove Super Admin" },
      configure_eligibility: { label: "Configure Eligibility", risk: "critical", description: "Define who may receive features" },
    },
  },
  engineering: {
    name: "Engineering Operations",
    risk: "medium",
    capabilities: {
      view: { label: "View", risk: "low", description: "See engineering dashboards" },
      manage_tasks: { label: "Manage Tasks", risk: "medium", description: "Manage engineering tasks" },
      manage_errors: { label: "Manage Errors", risk: "medium", description: "Manage error logs" },
      manage_developers: { label: "Manage Developers", risk: "high", description: "Manage developers and interns" },
    },
  },
  finance: {
    name: "Finance",
    risk: "high",
    capabilities: {
      view: { label: "View", risk: "medium", description: "See financial data" },
      create: { label: "Create", risk: "high", description: "Create transactions" },
      edit: { label: "Edit", risk: "high", description: "Edit financial records" },
      delete: { label: "Delete", risk: "critical", description: "Delete financial records" },
      export: { label: "Export", risk: "high", description: "Export financial data" },
    },
  },
  settings: {
    name: "System Settings",
    risk: "high",
    capabilities: {
      view: { label: "View", risk: "medium", description: "See system settings" },
      edit: { label: "Edit", risk: "high", description: "Modify system settings" },
    },
  },
  knowledge: {
    name: "Knowledge Base",
    risk: "low",
    capabilities: {
      view: { label: "View", risk: "low", description: "Read knowledge base" },
      create: { label: "Create", risk: "medium", description: "Add knowledge articles" },
      edit: { label: "Edit", risk: "medium", description: "Edit knowledge articles" },
      delete: { label: "Delete", risk: "medium", description: "Delete knowledge articles" },
    },
  },
  tasks: {
    name: "Tasks",
    risk: "low",
    capabilities: {
      view: { label: "View", risk: "low", description: "See tasks" },
      create: { label: "Create", risk: "low", description: "Create tasks" },
      edit: { label: "Edit", risk: "low", description: "Edit tasks" },
      delete: { label: "Delete", risk: "medium", description: "Delete tasks" },
    },
  },
  ventures: {
    name: "Ventures",
    risk: "medium",
    capabilities: {
      view: { label: "View", risk: "low", description: "See ventures" },
      create: { label: "Create", risk: "medium", description: "Register ventures" },
      edit: { label: "Edit", risk: "medium", description: "Edit ventures" },
      delete: { label: "Delete", risk: "high", description: "Delete ventures" },
    },
  },
  investor: {
    name: "Investor",
    risk: "medium",
    capabilities: {
      view: { label: "View", risk: "low", description: "See investor data" },
      create: { label: "Create", risk: "medium", description: "Create investor records" },
      edit: { label: "Edit", risk: "medium", description: "Edit investor records" },
      delete: { label: "Delete", risk: "high", description: "Delete investor records" },
    },
  },
  facilitator: {
    name: "Program Facilitator",
    risk: "medium",
    capabilities: {
      "participants.view": { label: "View Participants", risk: "medium", description: "See program participants" },
      "participants.manage": { label: "Manage Participants", risk: "high", description: "Manage program participants" },
      "attendance.view": { label: "View Attendance", risk: "low", description: "See attendance" },
      "attendance.record": { label: "Record Attendance", risk: "medium", description: "Record attendance" },
      "assignments.view": { label: "View Assignments", risk: "low", description: "See assignments" },
      "assignments.review": { label: "Review Assignments", risk: "medium", description: "Review submissions" },
      "assignments.grade": { label: "Grade Assignments", risk: "high", description: "Grade submissions" },
      "sessions.conduct": { label: "Conduct Sessions", risk: "medium", description: "Run sessions" },
      "sessions.record": { label: "Record Sessions", risk: "medium", description: "Record session data" },
      "progress.view": { label: "View Progress", risk: "low", description: "See participant progress" },
      "groups.view": { label: "View Groups", risk: "low", description: "See program groups" },
      "groups.manage": { label: "Manage Groups", risk: "medium", description: "Manage program groups" },
      "reviews.submit": { label: "Submit Reviews", risk: "medium", description: "Submit reviews" },
    },
  },
  org_membership: {
    name: "Organizational Membership",
    risk: "high",
    capabilities: {
      view: { label: "View", risk: "medium", description: "See organizational membership" },
      manage: { label: "Manage", risk: "critical", description: "Manage protected-group membership (e.g. FUTURE STUDIO)" },
    },
  },
};

/** Human label for a capability (falls back to the raw key). */
export function capabilityLabel(module, capability) {
  return CAPABILITY_CATALOG[module]?.capabilities?.[capability]?.label || capability;
}

/** Risk level for a capability (falls back to the module risk). */
export function capabilityRisk(module, capability) {
  return (
    CAPABILITY_CATALOG[module]?.capabilities?.[capability]?.risk ||
    CAPABILITY_CATALOG[module]?.risk ||
    "unknown"
  );
}
