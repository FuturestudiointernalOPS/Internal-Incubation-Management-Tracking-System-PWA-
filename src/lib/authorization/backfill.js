/**
 * ImpactOS — Authorization Foundation: CAPABILITY BACKFILL
 *
 * When a role-only feature is migrated to the capability model, its current
 * role-based access must be reproduced as capability rows so no user loses
 * access (zero-loser principle). This module performs those idempotent
 * backfills once per process, mirroring the self-healing seed pattern used
 * elsewhere in the codebase.
 *
 * Policy: ON CONFLICT DO NOTHING — backfill only fills MISSING rows and never
 * overwrites an administrator's explicit settings (an admin who intentionally
 * lowers a level wins; missing capability fails closed).
 */

import db from "@/lib/db";
import { ensurePermissionsSchema } from "@/lib/auth";
import { runAuthzMigration } from "./migrations";
import { ensureMembershipBootstrap } from "./membership";

// Phase 2: Knowledge Base.
// /api/knowledge (GET/POST/PATCH/DELETE) previously allowed staff + super_admin
// via the role allowlist. Backfill the equivalent capability for staff into:
//   1. the "Staff Default" access profile  (normal staff path), and
//   2. the staff role_capabilities row     (fallback for profile-less staff).
// Super Admin needs no backfill (SA bypass covers all modules).
const KNOWLEDGE_CAPS = { view: 1, create: 2, edit: 3, delete: 4 };

let backfillsSeeded = false;
let backfillPromise = null;

/** Run all capability backfills once per process (idempotent, egress-safe). */
export function ensureCapabilityBackfills() {
  if (!backfillsSeeded) {
    if (!backfillPromise) {
      backfillPromise = (async () => {
        // Capability backfills — ONE-TIME per database (runAuthzMigration).
        // Previously these ran on every process boot with INSERT … ON CONFLICT
        // DO NOTHING, silently re-adding profile capabilities that an
        // administrator had removed through the Permissions Control Center.
        // Recording them as one-time migrations keeps administrator
        // configuration authoritative after the first boot following this
        // change (Phase A requirement: no boot-time policy overwrites).
        await runAuthzMigration("cap-backfill-knowledge", ensureKnowledgeBackfill);
        await runAuthzMigration("cap-backfill-reports", ensureReportsBackfill);
        await runAuthzMigration("cap-backfill-announcements", ensureAnnouncementsBackfill);
        await runAuthzMigration("cap-backfill-projects", ensureProjectsBackfill);
        await runAuthzMigration("cap-backfill-tasks", ensureTasksBackfill);
        await runAuthzMigration("cap-backfill-engineering", ensureEngineeringBackfill);
        await runAuthzMigration("cap-backfill-programs", ensureProgramsBackfill);
        await runAuthzMigration("cap-backfill-ventures", ensureVenturesBackfill);
        await runAuthzMigration("cap-backfill-investor", ensureInvestorBackfill);
        // One-time policy migrations — run once per database, then the
        // Permissions UI owns eligibility configuration (see migrations.js).
        await runAuthzMigration("messaging-mvp-internal-only", ensureMessagingPolicyBackfill);
        await runAuthzMigration("eligibility-policy-3", ensureFinalPolicyBackfill);
        // Phase 1: organizational membership bootstrap — existing group edges
        // become active, no-expiry memberships (zero behavior change at
        // cutover; see membership.js).
        await runAuthzMigration("membership-bootstrap-v1", ensureMembershipBootstrap);
        backfillsSeeded = true;
      })().finally(() => {
        backfillPromise = null;
      });
    }
  }
  return backfillsSeeded ? Promise.resolve() : backfillPromise;
}

async function ensureKnowledgeBackfill() {
  await ensurePermissionsSchema();

  // 1. "Staff Default" access profile (the profile staff resolve to by role
  //    default). Insert knowledge capabilities if they don't exist yet.
  const profile =
    (
      await db.execute({
        sql: "SELECT id FROM access_profiles WHERE name = 'Staff Default' AND is_active = 1",
        args: [],
      })
    ).rows[0] || null;

  if (profile) {
    for (const [capability, level] of Object.entries(KNOWLEDGE_CAPS)) {
      await db.execute({
        sql: `INSERT INTO access_profile_capabilities (profile_id, module, capability, access_level)
              VALUES (?, 'knowledge', ?, ?)
              ON CONFLICT (profile_id, module, capability) DO NOTHING`,
        args: [profile.id, capability, level],
      });
    }
  }

  // 2. staff role_capabilities — V2 legacy fallback for profile-less staff.
  for (const [capability, level] of Object.entries(KNOWLEDGE_CAPS)) {
    await db.execute({
      sql: `INSERT INTO role_capabilities (role, module, capability, access_level)
            VALUES ('staff', 'knowledge', ?, ?)
            ON CONFLICT (role, module, capability) DO NOTHING`,
      args: [capability, level],
    });
  }
}

// ─── Phase 3: Reports / Analytics ───────────────────────────────────────────
// Migrated routes: op-reports POST, standups/submit, retros/submit
// (reports.create) and run-export GET (reports.export).
//
// Route allowlists (verified):
//   op-reports/standups/retros submit → INTERNAL_OPS_ROLES
//     (super_admin, staff, program_manager, admin, developer)
//   run-export → super_admin, admin, program_manager, staff, teacher
//
// Backfill reproduces that access through the capability layer:
//   - developer gets reports.create (Developer profile already had view)
//   - staff gets reports.export (Staff Default profile already had view/create)
//   - teacher gets reports.export (Instructor profile had no reports caps)
//   - program_manager needs nothing (Program Manager profile already has
//     view/create/export)
//   - admin inherits export via the shared Staff Default profile — safe,
//     because admin is already allowed on run-export today
// NOTE (policy #3): the previous `reporting += admin` eligibility extra was
// removed — admin is no longer reporting-eligible, and the one-time
// eligibility-policy-3 migration deletes any leftover row. developer stays
// covered by the post-policy defaults (no extra needed).

const REPORTS_CAP_BACKFILL = {
  profiles: {
    Developer: [["reports", "create", 2]],
    "Staff Default": [["reports", "export", 3]],
    Instructor: [["reports", "export", 3]],
  },
  roles: {
    developer: [["reports", "create", 2]],
    staff: [["reports", "export", 3]],
    teacher: [["reports", "export", 3]],
  },
};

async function ensureReportsBackfill() {
  await ensurePermissionsSchema();

  // 1. Access profile capabilities (the base for profile-bearing users).
  for (const [profileName, rows] of Object.entries(REPORTS_CAP_BACKFILL.profiles)) {
    const profile =
      (
        await db.execute({
          sql: "SELECT id FROM access_profiles WHERE name = ? AND is_active = 1",
          args: [profileName],
        })
      ).rows[0] || null;
    if (!profile) continue;
    for (const [module, capability, level] of rows) {
      await db.execute({
        sql: `INSERT INTO access_profile_capabilities (profile_id, module, capability, access_level)
              VALUES (?, ?, ?, ?)
              ON CONFLICT (profile_id, module, capability) DO NOTHING`,
        args: [profile.id, module, capability, level],
      });
    }
  }

  // 3. role_capabilities (V2 legacy fallback for profile-less users).
  for (const [role, rows] of Object.entries(REPORTS_CAP_BACKFILL.roles)) {
    for (const [module, capability, level] of rows) {
      await db.execute({
        sql: `INSERT INTO role_capabilities (role, module, capability, access_level)
              VALUES (?, ?, ?, ?)
              ON CONFLICT (role, module, capability) DO NOTHING`,
        args: [role, module, capability, level],
      });
    }
  }
}

// ─── Phase 4: CRM / Contacts (eligibility superseded by policy #3) ──────────
// The contacts routes once admitted participant + founder on self-scoped
// reads; Phase 4 reproduced that population with crm eligibility rows. Policy
// #3 removes participant/founder from crm eligibility (self-service reads
// stay role-gated, zero decision impact — verified by the read-only dry-run).
// The previous ensureCrmBackfill() INSERT is therefore REMOVED: running it at
// boot would silently re-add rows the eligibility-policy-3 migration deletes.

// ─── Phase 5: Announcements (Internal Comms) ────────────────────────────────
// Migrated routes:
//   announcements POST       → internal_comms.create_announcements
//   announcements PUT/DELETE → internal_comms.moderate
//     (the existing author-or-super_admin ownership check stays in the route)
//
// Route allowlist (verified): super_admin, program_manager, admin, staff.
// Backfills reproduce that population:
//   - create_announcements + moderate for staff / program_manager / admin
//     (Staff Default + Program Manager profiles and role_capabilities)
// NOTE (policy #3): the previous `internal_comms += admin` eligibility extra
// was removed — admin is no longer internal_comms-eligible, and the one-time
// eligibility-policy-3 migration deletes any leftover row.
//
// Deliberately NOT migrated in this phase:
//   - messaging/contacts GET — participant/founder-only self-scoped route,
//     but staff ALREADY holds messaging.view via the Staff Default profile;
//     migrating would grant staff the participant-scoped list (harmless but
//     a strict gain). Requires the staff-messaging-view profile decision.
//   - internal-comms (direct messaging), notifications, intents, responses —
//     manual ownership/scoping logic and no clean capability mapping; need
//     PO decisions on capability semantics first.

const ANNOUNCEMENTS_BACKFILL = {
  profiles: {
    "Staff Default": [
      ["internal_comms", "create_announcements", 2],
      ["internal_comms", "moderate", 3],
    ],
    "Program Manager": [
      ["internal_comms", "create_announcements", 2],
      ["internal_comms", "moderate", 3],
    ],
  },
  roles: {
    staff: [
      ["internal_comms", "create_announcements", 2],
      ["internal_comms", "moderate", 3],
    ],
    admin: [
      ["internal_comms", "create_announcements", 2],
      ["internal_comms", "moderate", 3],
    ],
    program_manager: [
      ["internal_comms", "create_announcements", 2],
      ["internal_comms", "moderate", 3],
    ],
  },
};

async function ensureAnnouncementsBackfill() {
  await ensurePermissionsSchema();

  for (const [profileName, rows] of Object.entries(ANNOUNCEMENTS_BACKFILL.profiles)) {
    const profile =
      (
        await db.execute({
          sql: "SELECT id FROM access_profiles WHERE name = ? AND is_active = 1",
          args: [profileName],
        })
      ).rows[0] || null;
    if (!profile) continue;
    for (const [module, capability, level] of rows) {
      await db.execute({
        sql: `INSERT INTO access_profile_capabilities (profile_id, module, capability, access_level)
              VALUES (?, ?, ?, ?)
              ON CONFLICT (profile_id, module, capability) DO NOTHING`,
        args: [profile.id, module, capability, level],
      });
    }
  }

  for (const [role, rows] of Object.entries(ANNOUNCEMENTS_BACKFILL.roles)) {
    for (const [module, capability, level] of rows) {
      await db.execute({
        sql: `INSERT INTO role_capabilities (role, module, capability, access_level)
              VALUES (?, ?, ?, ?)
              ON CONFLICT (role, module, capability) DO NOTHING`,
        args: [role, module, capability, level],
      });
    }
  }
}

// ─── Phase 6: Projects ──────────────────────────────────────────────────────
// Migrated routes (role-gated writes; scoped-guard reads stay as-is):
//   projects POST          → projects.create   (SA, staff, PM, teacher, developer)
//   projects DELETE        → projects.delete   (SA, staff, PM, teacher)
//   projects/members POST  → projects.edit     (SA, staff, PM, teacher)
//   projects/members DELETE → projects.edit    (SA, staff, PM, teacher)
//
// Backfills reproduce the route populations through the capability layer:
//   - program_manager + teacher need create/edit/delete (their profiles only
//     have projects.view)
//   - staff needs delete (Staff Default already has view/create/edit)
//   - admin inherits Staff Default delete but is NOT eligible for
//     project_ownership → no access change
//   - developer needs nothing for DELETE/members (not in those allowlists);
//     it already has create via the Developer profile
//
// Deliberately NOT migrated: projects GET/PUT, projects/members GET,
// projects/discuss, projects/invitations*, projects/assignments,
// admin/projects* — membership-scoped (requireProjectAccess) or
// super_admin-only lists; migrating them would either duplicate the scoped
// guard or grant projects.view holders the SA-only admin list.

const PROJECTS_BACKFILL = {
  profiles: {
    "Program Manager": [
      ["projects", "create", 2],
      ["projects", "edit", 3],
      ["projects", "delete", 4],
    ],
    Instructor: [
      ["projects", "create", 2],
      ["projects", "edit", 3],
      ["projects", "delete", 4],
    ],
    "Staff Default": [["projects", "delete", 4]],
  },
  roles: {
    program_manager: [
      ["projects", "create", 2],
      ["projects", "edit", 3],
      ["projects", "delete", 4],
    ],
    teacher: [
      ["projects", "create", 2],
      ["projects", "edit", 3],
      ["projects", "delete", 4],
    ],
    staff: [["projects", "delete", 4]],
  },
};

async function ensureProjectsBackfill() {
  await ensurePermissionsSchema();

  for (const [profileName, rows] of Object.entries(PROJECTS_BACKFILL.profiles)) {
    const profile =
      (
        await db.execute({
          sql: "SELECT id FROM access_profiles WHERE name = ? AND is_active = 1",
          args: [profileName],
        })
      ).rows[0] || null;
    if (!profile) continue;
    for (const [module, capability, level] of rows) {
      await db.execute({
        sql: `INSERT INTO access_profile_capabilities (profile_id, module, capability, access_level)
              VALUES (?, ?, ?, ?)
              ON CONFLICT (profile_id, module, capability) DO NOTHING`,
        args: [profile.id, module, capability, level],
      });
    }
  }

  for (const [role, rows] of Object.entries(PROJECTS_BACKFILL.roles)) {
    for (const [module, capability, level] of rows) {
      await db.execute({
        sql: `INSERT INTO role_capabilities (role, module, capability, access_level)
              VALUES (?, ?, ?, ?)
              ON CONFLICT (role, module, capability) DO NOTHING`,
        args: [role, module, capability, level],
      });
    }
  }
}

// ─── Phase 7: Tasks (team-tasks board) ──────────────────────────────────────
// A `tasks` capability module is introduced (view/create/edit/delete) and the
// team-tasks board is migrated. The main tasks/* routes are OWNERSHIP-based
// (owner/assignee/supervisor checks), not role-based, so they stay as-is —
// the capability model complements, not replaces, task ownership.
//
// Route allowlist (verified): super_admin, staff, program_manager, team.
// Backfills reproduce it:
//   - staff: tasks caps via Staff Default profile + role_capabilities
//   - program_manager: tasks caps via Program Manager profile + role_capabilities
//   - team: tasks caps via role_capabilities (team has no default profile)
//   - admin inherits Staff Default tasks caps but is NOT eligible for the
//     tasks feature → no access change
//
// The eligibility table was seeded in Phase 0 BEFORE the tasks feature
// existed, so existing databases have no tasks rows at all — the backfill
// inserts the full role set (not just extras).

const TASKS_BACKFILL = {
  eligibility: { tasks: ["super_admin", "staff", "program_manager", "team"] },
  profiles: {
    "Staff Default": [
      ["tasks", "view", 1],
      ["tasks", "create", 2],
      ["tasks", "edit", 3],
      ["tasks", "delete", 4],
    ],
    "Program Manager": [
      ["tasks", "view", 1],
      ["tasks", "create", 2],
      ["tasks", "edit", 3],
      ["tasks", "delete", 4],
    ],
  },
  roles: {
    staff: [
      ["tasks", "view", 1],
      ["tasks", "create", 2],
      ["tasks", "edit", 3],
      ["tasks", "delete", 4],
    ],
    program_manager: [
      ["tasks", "view", 1],
      ["tasks", "create", 2],
      ["tasks", "edit", 3],
      ["tasks", "delete", 4],
    ],
    team: [
      ["tasks", "view", 1],
      ["tasks", "create", 2],
      ["tasks", "edit", 3],
      ["tasks", "delete", 4],
    ],
  },
};

async function ensureTasksBackfill() {
  await ensurePermissionsSchema();

  for (const [featureKey, roles] of Object.entries(TASKS_BACKFILL.eligibility)) {
    for (const role of roles) {
      await db.execute({
        sql: `INSERT INTO feature_eligibility
                (feature_key, identity_type, identity_value, eligible)
              VALUES (?, 'role', ?, 1)
              ON CONFLICT (feature_key, identity_type, identity_value)
              DO NOTHING`,
        args: [featureKey, role],
      });
    }
  }

  for (const [profileName, rows] of Object.entries(TASKS_BACKFILL.profiles)) {
    const profile =
      (
        await db.execute({
          sql: "SELECT id FROM access_profiles WHERE name = ? AND is_active = 1",
          args: [profileName],
        })
      ).rows[0] || null;
    if (!profile) continue;
    for (const [module, capability, level] of rows) {
      await db.execute({
        sql: `INSERT INTO access_profile_capabilities (profile_id, module, capability, access_level)
              VALUES (?, ?, ?, ?)
              ON CONFLICT (profile_id, module, capability) DO NOTHING`,
        args: [profile.id, module, capability, level],
      });
    }
  }

  for (const [role, rows] of Object.entries(TASKS_BACKFILL.roles)) {
    for (const [module, capability, level] of rows) {
      await db.execute({
        sql: `INSERT INTO role_capabilities (role, module, capability, access_level)
              VALUES (?, ?, ?, ?)
              ON CONFLICT (role, module, capability) DO NOTHING`,
        args: [role, module, capability, level],
      });
    }
  }
}

// ─── Phase 8: Engineering ops + errors gap ──────────────────────────────────
// Migrated routes (allowlist super_admin, developer — matches the existing
// `engineering` eligibility seed exactly):
//   engineering/dashboard GET         → engineering.view
//   engineering/developers GET        → engineering.view
//   engineering/developers PATCH      → engineering.manage_developers
//   engineering/errors/create-task POST → engineering.manage_errors
//   engineering/reports GET           → engineering.view
//   errors GET / PATCH                → engineering.manage_errors
//     (closes the PUBLIC log-read/resolve gap; POST stays public — it is
//      intentional client-side error ingestion, write-only)
//
// Backfills: developer needs manage_developers (its profile already has
// view/manage_tasks/manage_errors). Zero gains: the only roles holding
// engineering capabilities are developer (eligible) and intern/Project-Owner
// profile holders (NOT eligible — engineering eligibility is super_admin +
// developer only).
//
// Deliberately NOT migrated: engineering/permissions*, audit — super_admin-
// only admin tooling; developer holds engineering.view and would gain the
// SA-only permission-management surface. Deferred for the final phase.

const ENGINEERING_BACKFILL = {
  profiles: {
    Developer: [["engineering", "manage_developers", 2]],
  },
  roles: {
    developer: [["engineering", "manage_developers", 2]],
  },
};

async function ensureEngineeringBackfill() {
  await ensurePermissionsSchema();

  for (const [profileName, rows] of Object.entries(ENGINEERING_BACKFILL.profiles)) {
    const profile =
      (
        await db.execute({
          sql: "SELECT id FROM access_profiles WHERE name = ? AND is_active = 1",
          args: [profileName],
        })
      ).rows[0] || null;
    if (!profile) continue;
    for (const [module, capability, level] of rows) {
      await db.execute({
        sql: `INSERT INTO access_profile_capabilities (profile_id, module, capability, access_level)
              VALUES (?, ?, ?, ?)
              ON CONFLICT (profile_id, module, capability) DO NOTHING`,
        args: [profile.id, module, capability, level],
      });
    }
  }

  for (const [role, rows] of Object.entries(ENGINEERING_BACKFILL.roles)) {
    for (const [module, capability, level] of rows) {
      await db.execute({
        sql: `INSERT INTO role_capabilities (role, module, capability, access_level)
              VALUES (?, ?, ?, ?)
              ON CONFLICT (role, module, capability) DO NOTHING`,
        args: [role, module, capability, level],
      });
    }
  }
}

// ─── Phase 9: Programs (pm/* writes) ────────────────────────────────────────
// Migrated routes — the V2-wired pm writes, with the legacy staff/teacher
// bypass REMOVED and replaced by an explicit capability (the roadmap's
// "give those roles an explicit capability instead of the implicit bypass"):
//   pm/curriculum POST/PUT/DELETE → programs.edit
//   pm/teams POST/PATCH/DELETE    → programs.edit
//   pm/export GET                 → reports.export (Phase 3 backfill already
//                                    covers staff/teacher export)
//   pm/programs DELETE            → programs.delete (no backfill: nobody but
//                                    SA holds delete — same as today's V2)
//
// Backfills: staff + teacher get programs.edit (Staff Default + Instructor
// profiles and role_capabilities). Program Manager already holds edit via its
// profile. Zero gains: the only routes enforcing programs.edit are these,
// where staff/teacher were already allowed via the bypass.
//
// Deliberately NOT migrated (documented): pm/programs POST + templates POST
// (migrating would let PMs — who hold programs.create via profile — create
// programs; a policy decision, not a mechanical flip), pm/programs PUT
// (admin in allowlist but not in program_management eligibility), programs
// POST/PUT (role-gated main route), and the facilitator-scoped surface
// (participants/sessions/submissions/attendance/followups/facilitator-reviews
// — requireAssignmentAccess + dotted capabilities are their own system).

const PROGRAMS_BACKFILL = {
  profiles: {
    "Staff Default": [["programs", "edit", 3]],
    Instructor: [["programs", "edit", 3]],
  },
  roles: {
    staff: [["programs", "edit", 3]],
    teacher: [["programs", "edit", 3]],
  },
};

async function ensureProgramsBackfill() {
  await ensurePermissionsSchema();

  for (const [profileName, rows] of Object.entries(PROGRAMS_BACKFILL.profiles)) {
    const profile =
      (
        await db.execute({
          sql: "SELECT id FROM access_profiles WHERE name = ? AND is_active = 1",
          args: [profileName],
        })
      ).rows[0] || null;
    if (!profile) continue;
    for (const [module, capability, level] of rows) {
      await db.execute({
        sql: `INSERT INTO access_profile_capabilities (profile_id, module, capability, access_level)
              VALUES (?, ?, ?, ?)
              ON CONFLICT (profile_id, module, capability) DO NOTHING`,
        args: [profile.id, module, capability, level],
      });
    }
  }

  for (const [role, rows] of Object.entries(PROGRAMS_BACKFILL.roles)) {
    for (const [module, capability, level] of rows) {
      await db.execute({
        sql: `INSERT INTO role_capabilities (role, module, capability, access_level)
              VALUES (?, ?, ?, ?)
              ON CONFLICT (role, module, capability) DO NOTHING`,
        args: [role, module, capability, level],
      });
    }
  }
}

// ─── Phase 10: Ventures (CRUD only) ─────────────────────────────────────────
// A `ventures` capability module is introduced and the role-gated venture CRUD
// is migrated:
//   ventures POST       → ventures.create (allowlist: super_admin, staff, PM)
//   ventures PUT        → ventures.edit   (allowlist: super_admin — SA-only
//                          preserved, no backfill)
//   ventures/[id] PATCH → ventures.edit   (allowlist: super_admin — same)
//
// Backfills: staff + program_manager get ventures.create (Staff Default +
// Program Manager profiles and role_capabilities). Zero gains: the only
// ventures.create-enforced route is POST, where both roles are already
// allowed; ventures/register stays role-gated (staff would gain it via
// create — a separate decision).
//
// Deliberately NOT migrated: the ~55 membership-scoped sub-routes
// (requireVentureAccess — founders and venture members working in their own
// venture workspace) and the broad read allowlists (participant/founder/
// teacher/developer). Capability cannot express per-venture membership; the
// scoped guard is the real gate there, exactly like projects GET/PUT and the
// facilitator routes.

const VENTURES_BACKFILL = {
  eligibility: { ventures: ["super_admin", "staff", "program_manager"] },
  profiles: {
    "Staff Default": [["ventures", "create", 2]],
    "Program Manager": [["ventures", "create", 2]],
  },
  roles: {
    staff: [["ventures", "create", 2]],
    program_manager: [["ventures", "create", 2]],
  },
};

async function ensureVenturesBackfill() {
  await ensurePermissionsSchema();

  for (const [featureKey, roles] of Object.entries(VENTURES_BACKFILL.eligibility)) {
    for (const role of roles) {
      await db.execute({
        sql: `INSERT INTO feature_eligibility
                (feature_key, identity_type, identity_value, eligible)
              VALUES (?, 'role', ?, 1)
              ON CONFLICT (feature_key, identity_type, identity_value)
              DO NOTHING`,
        args: [featureKey, role],
      });
    }
  }

  for (const [profileName, rows] of Object.entries(VENTURES_BACKFILL.profiles)) {
    const profile =
      (
        await db.execute({
          sql: "SELECT id FROM access_profiles WHERE name = ? AND is_active = 1",
          args: [profileName],
        })
      ).rows[0] || null;
    if (!profile) continue;
    for (const [module, capability, level] of rows) {
      await db.execute({
        sql: `INSERT INTO access_profile_capabilities (profile_id, module, capability, access_level)
              VALUES (?, ?, ?, ?)
              ON CONFLICT (profile_id, module, capability) DO NOTHING`,
        args: [profile.id, module, capability, level],
      });
    }
  }

  for (const [role, rows] of Object.entries(VENTURES_BACKFILL.roles)) {
    for (const [module, capability, level] of rows) {
      await db.execute({
        sql: `INSERT INTO role_capabilities (role, module, capability, access_level)
              VALUES (?, ?, ?, ?)
              ON CONFLICT (role, module, capability) DO NOTHING`,
        args: [role, module, capability, level],
      });
    }
  }
}

// ─── Phase 11: Investor portal ──────────────────────────────────────────────
// An `investor` capability module is introduced and the uniform
// [super_admin, staff, investor] routes are migrated (24 methods across 17
// files): GET → investor.view, POST → investor.create, PUT → investor.edit.
//
// Backfills:
//   - staff: investor caps via Staff Default profile + role_capabilities
//   - investor role: investor caps via the Mentor profile (the investor role's
//     default profile per role_access_profile_defaults) + role_capabilities
//   - mentor role inherits the Mentor profile caps but is NOT eligible for
//     the investor feature → no access change
//   - admin inherits Staff Default caps but is NOT eligible → no access change
//
// Deliberately NOT migrated (documented): the super_admin-only admin routes
// (admin-overview, executive-dashboard, approval, campaigns writes,
// relationships writes), the program_manager-inclusive reads (campaigns GET,
// pipeline GET, profile GET — migrating them would grant PM the whole portal
// via shared eligibility), approval GET and profile PUT ([SA, staff] —
// investor would gain via view/edit caps), and the public register/
// setup-password flows.

const INVESTOR_BACKFILL = {
  eligibility: { investor: ["super_admin", "staff", "investor"] },
  profiles: {
    "Staff Default": [
      ["investor", "view", 1],
      ["investor", "create", 2],
      ["investor", "edit", 3],
    ],
    Mentor: [
      ["investor", "view", 1],
      ["investor", "create", 2],
      ["investor", "edit", 3],
    ],
  },
  roles: {
    staff: [
      ["investor", "view", 1],
      ["investor", "create", 2],
      ["investor", "edit", 3],
    ],
    investor: [
      ["investor", "view", 1],
      ["investor", "create", 2],
      ["investor", "edit", 3],
    ],
  },
};

async function ensureInvestorBackfill() {
  await ensurePermissionsSchema();

  for (const [featureKey, roles] of Object.entries(INVESTOR_BACKFILL.eligibility)) {
    for (const role of roles) {
      await db.execute({
        sql: `INSERT INTO feature_eligibility
                (feature_key, identity_type, identity_value, eligible)
              VALUES (?, 'role', ?, 1)
              ON CONFLICT (feature_key, identity_type, identity_value)
              DO NOTHING`,
        args: [featureKey, role],
      });
    }
  }

  for (const [profileName, rows] of Object.entries(INVESTOR_BACKFILL.profiles)) {
    const profile =
      (
        await db.execute({
          sql: "SELECT id FROM access_profiles WHERE name = ? AND is_active = 1",
          args: [profileName],
        })
      ).rows[0] || null;
    if (!profile) continue;
    for (const [module, capability, level] of rows) {
      await db.execute({
        sql: `INSERT INTO access_profile_capabilities (profile_id, module, capability, access_level)
              VALUES (?, ?, ?, ?)
              ON CONFLICT (profile_id, module, capability) DO NOTHING`,
        args: [profile.id, module, capability, level],
      });
    }
  }

  for (const [role, rows] of Object.entries(INVESTOR_BACKFILL.roles)) {
    for (const [module, capability, level] of rows) {
      await db.execute({
        sql: `INSERT INTO role_capabilities (role, module, capability, access_level)
              VALUES (?, ?, ?, ?)
              ON CONFLICT (role, module, capability) DO NOTHING`,
        args: [role, module, capability, level],
      });
    }
  }
}

// ─── Messaging: FINAL MVP POLICY (internal-only) ────────────────────────────
// Decision: Messaging is a Future Studio internal-operations feature.
// Only the internal staff roles keep it: super_admin, staff, program_manager,
// developer. Teacher (external "Active Teammate"), participant, founder and
// member are REMOVED from messaging eligibility.
//
// This is a configuration change (DELETE of eligibility rows) — messaging
// conversation DATA is untouched. Enforcement is server-side:
//   - /api/internal-comms now gates through requireAuthorization("messaging")
//   - the DELETE /api/internal-comms handler is removed (messages are never
//     deleted; retention rule)
//   - the participant/founder /api/messaging/contacts route is removed
//   - navigation entries removed for external roles
//   - direct URL access is blocked by server-side layout guards on the
//     messages pages

const MESSAGING_INTERNAL_ROLES = [
  "super_admin",
  "staff",
  "program_manager",
  "developer",
];

const MESSAGING_REMOVED_ROLES = ["teacher", "participant", "founder", "member"];

async function ensureMessagingPolicyBackfill() {
  await ensurePermissionsSchema();

  // 1. Remove external roles from messaging eligibility (existing DBs seeded
  //    before this policy had them eligible).
  for (const role of MESSAGING_REMOVED_ROLES) {
    await db.execute({
      sql: `DELETE FROM feature_eligibility
            WHERE feature_key = 'messaging' AND identity_type = 'role' AND identity_value = ?`,
      args: [role],
    });
  }

  // 2. Ensure the internal roles are present (idempotent; fresh DBs get the
  //    updated seed, existing DBs already have these rows).
  for (const role of MESSAGING_INTERNAL_ROLES) {
    await db.execute({
      sql: `INSERT INTO feature_eligibility
              (feature_key, identity_type, identity_value, eligible)
            VALUES ('messaging', 'role', ?, 1)
            ON CONFLICT (feature_key, identity_type, identity_value)
            DO NOTHING`,
      args: [role],
    });
  }
}

// ─── Final eligibility policy (#3) ──────────────────────────────────────────
// Product Owner-approved final eligibility values:
//   - `admin` is NOT eligible for internal_comms (announcements) or reporting
//     (op-reports / standups / retros / run-export / pm-export). The previous
//     seed included admin; existing DBs must have those rows removed.
//   - `participant` / `founder` are NOT eligible for crm. Removal is
//     zero-impact: they hold no contacts capabilities — self-service reads are
//     role-gated, not eligibility-gated (verified by the read-only dry-run,
//     scripts/dryrun-eligibility-policy.mjs: zero decision changes for every
//     user in the production database).
//
// DELETES ROLE ROWS ONLY — group eligibility rows are sacred and untouched.
// Runs ONCE per database via runAuthzMigration("eligibility-policy-3"): fresh
// DBs seed the updated FEATURE_ELIGIBILITY_DEFAULTS and have nothing to
// delete; existing DBs converge on the first boot after deploy. After that,
// the Permissions UI owns eligibility — this never runs again, so an
// administrator's configuration is never overwritten.

export async function ensureFinalPolicyBackfill() {
  await ensurePermissionsSchema();
  await db.execute({
    sql: `DELETE FROM feature_eligibility
          WHERE identity_type = 'role'
            AND (
              (feature_key = 'internal_comms' AND identity_value = 'admin')
              OR (feature_key = 'reporting' AND identity_value = 'admin')
              OR (feature_key = 'crm' AND identity_value IN ('participant', 'founder'))
            )`,
    args: [],
  });
}
