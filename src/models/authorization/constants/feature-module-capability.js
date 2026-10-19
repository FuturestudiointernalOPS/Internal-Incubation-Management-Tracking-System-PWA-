/**
 * ImpactOS — Authorization Foundation: the ONE capability source.
 *
 * Feature → Module → Capability. This is where the capability vocabulary is
 * assembled; everything else is derived from it:
 *
 *   - FEATURE_MODULE_CAPABILITY — this registry, grouped by FEATURE (the
 *     dashboard sections). Features follow FEATURE_ORDER; a feature's modules
 *     follow MODULE_TO_FEATURE.
 *   - CAPABILITY_CATALOG        — the same registry keyed by MODULE, in the
 *     shape the UI reads (human labels, risk, families, locked modules).
 *   - PERMISSION_MODULES        — the flat, write-validated vocabulary the
 *     resolver enumerates and the engine seeds, as { name, capabilities[] }.
 *
 * Each module carries its display `name`, an overall `risk`, and — when it has
 * one — `locked` (role-locked to Super Admin: `duplicates`). A module flagged
 * `registryOnly` is declared and enforced at the route layer but deliberately
 * stays OUT of PERMISSION_MODULES: `duplicates` and `bulk_upload` are not part
 * of the resolver's enumerable vocabulary.
 *
 * Each capability carries { label, risk, description } and, optionally,
 * `parent` when it belongs to a capability family (a presentation grouping: the
 * parent is itself a grantable capability, and a child is an independent grant).
 *
 * ONE module is declared in its own file and imported here: `facilitator`.
 * Its vocabulary is also the one written into program assignments and read by
 * the facilitator guard, so it has a dedicated source
 * (`./facilitator-capabilities`) and this registry references that same object.
 * Everything else stays in this file.
 *
 * Pure data and pure builders: no database, no session, no side effects — safe
 * to import from anywhere that reasons about "what could this account do". The
 * UI must not hardcode capability labels; it reads CAPABILITY_CATALOG (exposed
 * via /api/engineering/permissions) for Eligibility, Default Access, Individual
 * Access, Restrictions and explanations.
 */

import { FACILITATOR_MODULE } from "./facilitator-capabilities";

export const FEATURE_MODULE_CAPABILITY = {
  crm: {
    contacts: {
      name: "Contacts",
      risk: "medium",
      capabilities: {
        view: { label: "View", risk: "low", description: "See people and contact records" },
        create: { label: "Create", risk: "medium", description: "Add new contacts" },
        edit: { label: "Edit", risk: "medium", description: "Modify contact records" },
        delete: { label: "Delete", risk: "high", description: "Remove contacts (soft delete)" },
      },
    },
    // P1 MODULE DECISION — duplicates is a genuine MODULE, not a Contacts view:
    // it owns a distinct workflow (flag → review → resolve) with its own
    // lifecycle. Routes remain super-admin role-locked until a later phase opens
    // the module, so it is `locked` AND `registryOnly` (not resolvable).
    duplicates: {
      name: "Duplicates",
      risk: "medium",
      locked: true,
      registryOnly: true,
      capabilities: {
        view: { label: "View", risk: "low", description: "See duplicate contact flags" },
        resolve: { label: "Resolve", risk: "high", description: "Resolve duplicate contact pairs" },
      },
    },
    // P1 MODULE DECISION — bulk upload is a genuine MODULE (distinct import
    // workflow with its own validation pipeline). Its gate replaces the legacy
    // permissions.assign_capabilities requirement, and it stays registry-only.
    bulk_upload: {
      name: "Bulk Upload",
      risk: "high",
      registryOnly: true,
      capabilities: {
        execute: { label: "Execute", risk: "high", description: "Run bulk contact/people imports" },
      },
    },
    crm: {
      name: "CRM",
      risk: "medium",
      capabilities: {
        view: { label: "View", risk: "low", description: "Access CRM workspace, people directory, organizations, and timeline" },
        create: { label: "Create", risk: "medium", description: "Create CRM organizations and contact-organization relationships" },
        edit: { label: "Edit", risk: "medium", description: "Modify CRM organizations and relationships" },
        delete: { label: "Delete", risk: "high", description: "Remove CRM organizations and relationships (soft delete)" },
        assign: { label: "Assign", risk: "medium", description: "Assign ownership of CRM records" },
        manage: { label: "Manage", risk: "high", description: "Administer CRM configuration, module capabilities, and pipeline (Phase 2+)" },
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
  },
  communication: {
    messaging: {
      name: "Messages",
      risk: "medium",
      capabilities: {
        view: { label: "View", risk: "low", description: "Read conversations" },
        send: { label: "Send", risk: "medium", description: "Send messages" },
        delete: { label: "Delete", risk: "high", description: "Delete messages (retention rule: never used)" },
      },
    },
    internal_comms: {
      name: "Announcements",
      risk: "medium",
      capabilities: {
        view: { label: "View", risk: "low", description: "See internal communication" },
        create_announcements: { label: "Create Announcements", risk: "medium", description: "Post announcements" },
        moderate: { label: "Moderate", risk: "high", description: "Edit/delete announcements" },
      },
    },
    forms: {
      name: "Forms",
      risk: "medium",
      capabilities: {
        view: { label: "View", risk: "low", description: "See forms" },
        create: { label: "Create", risk: "medium", description: "Create forms" },
        edit: { label: "Edit", risk: "medium", description: "Edit forms and publish versions" },
        delete: { label: "Delete", risk: "high", description: "Archive or permanently delete forms" },
      },
    },
    runs: {
      name: "Runs",
      risk: "medium",
      capabilities: {
        view: { label: "View", risk: "low", description: "See runs, assignments and submissions" },
        create: { label: "Create", risk: "medium", description: "Create, launch and change the status of runs" },
        edit: { label: "Edit", risk: "high", description: "Assign people and send run emails" },
        delete: { label: "Delete", risk: "high", description: "Delete runs and submissions" },
        // `review` is separate from `edit` on purpose: sending run messages,
        // assigning people and retrying emails must never imply the authority to
        // admit or reject an applicant. Granted to nobody by default.
        review: { label: "Review", risk: "high", description: "Approve or reject an applicant (decides admission and sends the decision email)" },
      },
    },
  },
  programs: {
    programs: {
      name: "Programs",
      risk: "medium",
      capabilities: {
        view: { label: "View", risk: "low", description: "See programs" },
        create: { label: "Create", risk: "medium", description: "Create new programs" },
        edit: { label: "Edit", risk: "medium", description: "Edit program content and teams" },
        delete: { label: "Delete", risk: "high", description: "Delete programs" },
        // Family child: `publish` is a refinement of `edit` (independent grant).
        publish: { label: "Publish", risk: "medium", parent: "edit", description: "Publish program content" },
      },
    },
    // Declared in ./facilitator-capabilities.js and imported here, so the PM
    // assignment vocabulary and the capability catalogue share ONE object.
    facilitator: FACILITATOR_MODULE,
  },
  ventures: {
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
  },
  investors: {
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
  },
  finance: {
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
  },
  operations: {
    projects: {
      name: "Projects",
      risk: "medium",
      capabilities: {
        view: { label: "View", risk: "low", description: "See projects" },
        create: { label: "Create", risk: "medium", description: "Create projects" },
        edit: { label: "Edit", risk: "medium", description: "Edit projects" },
        delete: { label: "Delete", risk: "high", description: "Delete projects" },
        archive: { label: "Archive", risk: "medium", parent: "edit", description: "Archive projects" },
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
  },
  reports: {
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
  },
  knowledge: {
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
  },
  lms: {
    lms: {
      name: "LMS",
      risk: "medium",
      capabilities: {
        view: { label: "View", risk: "low", description: "See courses and learning materials" },
        create: { label: "Create", risk: "medium", description: "Create courses" },
        edit: { label: "Edit", risk: "medium", description: "Edit courses and sections" },
        delete: { label: "Delete", risk: "high", description: "Delete courses" },
      },
    },
  },
  security: {
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
  },
  settings: {
    settings: {
      name: "System Settings",
      risk: "high",
      capabilities: {
        view: { label: "View", risk: "medium", description: "See system settings" },
        edit: { label: "Edit", risk: "high", description: "Modify system settings" },
      },
    },
    engineering: {
      name: "Engineering Operations",
      risk: "medium",
      capabilities: {
        view: { label: "View", risk: "low", description: "See engineering dashboards" },
        manage_tasks: { label: "Manage Tasks", risk: "medium", description: "Manage engineering tasks" },
        manage_errors: { label: "Manage Errors", risk: "medium", description: "Manage error logs" },
      },
    },
  },
};

// =============================================================================
// DERIVED VIEWS
// =============================================================================

/**
 * Module → { name, risk, locked?, capabilities } — the annotated registry keyed
 * by module, exactly as the UI and the catalog-sync guards read it. `registryOnly`
 * is a source-only marker and is not carried here.
 */
export const CAPABILITY_CATALOG = (() => {
  const catalog = {};
  for (const feature of Object.values(FEATURE_MODULE_CAPABILITY)) {
    for (const [moduleKey, definition] of Object.entries(feature)) {
      catalog[moduleKey] = {
        name: definition.name,
        risk: definition.risk,
        ...(definition.locked ? { locked: true } : {}),
        capabilities: definition.capabilities,
      };
    }
  }
  return catalog;
})();

/**
 * Module → { name, capabilities: string[] } — the flat vocabulary the resolver
 * enumerates and the write path validates against. Every module of the registry
 * except the `registryOnly` ones (`duplicates`, `bulk_upload`).
 */
export const PERMISSION_MODULES = (() => {
  const modules = {};
  for (const feature of Object.values(FEATURE_MODULE_CAPABILITY)) {
    for (const [moduleKey, definition] of Object.entries(feature)) {
      if (definition.registryOnly) continue;
      modules[moduleKey] = {
        name: definition.name,
        capabilities: Object.keys(definition.capabilities),
      };
    }
  }
  return modules;
})();

// =============================================================================
// CAPABILITY LOOKUPS
// =============================================================================

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

// =============================================================================
// CAPABILITY FAMILIES (parent → children)
// =============================================================================
//
// A capability may declare `parent` to place it in a FAMILY. A family is a
// PRESENTATION grouping: the parent (e.g. `edit`) is itself a real, grantable
// capability, and each child (e.g. `archive`, `publish`) stays an INDEPENDENT
// grant stored under its own name.
//
// Design rules (locked by src/__tests__/permission-matrix-helpers.test.js):
//   - A parent NEVER implies its children. Granting `edit` does not grant
//     `archive` — the UI only enforces the reverse dependency (a child requires
//     its parent, so checking a child also checks the parent).
//   - Families are ONE level deep: a child is never itself a parent.
//   - `parent` is metadata only; it never changes stored capability names, so
//     no data migration is implied and existing grants are untouched.
//   - Authority capabilities (permissions.*, users.suspend, org_membership
//     .manage, …) are deliberately left top-level, never folded into a family.

/** Parent (family head) of a capability, or null when it is top-level. */
export function capabilityParent(module, capability) {
  return CAPABILITY_CATALOG[module]?.capabilities?.[capability]?.parent || null;
}

/** Child capabilities attached to a parent, in catalog order. */
export function capabilityChildren(module, parentCapability) {
  const capabilities = CAPABILITY_CATALOG[module]?.capabilities || {};
  return Object.keys(capabilities).filter((capability) => capabilities[capability]?.parent === parentCapability);
}

/**
 * { childCapability → parentCapability } map for one module ({} when the module
 * has no families). This is the shape matrixHelpers.toggleCapability consumes.
 */
export function moduleCapabilityParents(module) {
  const capabilities = CAPABILITY_CATALOG[module]?.capabilities || {};
  const parents = {};
  for (const [capability, definition] of Object.entries(capabilities)) {
    if (definition?.parent) parents[capability] = definition.parent;
  }
  return parents;
}

/** True when the capability is the head of a family (it has ≥1 child). */
export function isCapabilityParent(module, capability) {
  return capabilityChildren(module, capability).length > 0;
}
