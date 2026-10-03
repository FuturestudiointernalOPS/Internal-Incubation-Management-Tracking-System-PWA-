import db from "@/lib/db";
import { ensurePermissionsSchema } from "@/models/authorization/bootstrap";

// Phase 2: Knowledge Base.
// /api/knowledge (GET/POST/PATCH/DELETE) previously allowed staff + super_admin
// via the role allowlist. Backfill the equivalent capability for staff into:
//   1. the "Staff Default" access profile  (normal staff path), and
//   2. the staff role_capabilities row     (fallback for profile-less staff).
// Super Admin needs no backfill (SA bypass covers all modules).
const KNOWLEDGE_CAPS = { view: 1, create: 2, edit: 3, delete: 4 };

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
//     (super_admin, staff, program_manager)
//   run-export → super_admin, program_manager, staff
//
// Backfill reproduces that access through the capability layer:
//   - staff gets reports.export (Staff Default profile already has view/create)
//   - program_manager needs nothing (Program Manager profile already has
//     view/create/export)
// NOTE (policy #3): reporting eligibility no longer includes the retired
// `admin` role; the one-time eligibility-policy-3 migration clears any leftover
// admin row left by an older seed.

const REPORTS_CAP_BACKFILL = {
  profiles: {
    "Staff Default": [["reports", "export", 3]],
    Instructor: [["reports", "export", 3]],
  },
  roles: {
    staff: [["reports", "export", 3]],
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
// Route allowlist (verified): super_admin, program_manager, staff.
// Backfills reproduce that population:
//   - create_announcements + moderate for staff / program_manager
//     (Staff Default + Program Manager profiles and role_capabilities)
// NOTE (policy #3): internal_comms eligibility no longer includes the
// retired `admin` role; the one-time eligibility-policy-3 migration clears any
// leftover admin row left by an older seed.
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

// ─── Communication: Forms module ─────────────────────────────────────────────
// The Forms builder (/platform/forms, /api/platform/forms) was guarded by a
// legacy role allowlist: reads allowed super_admin / staff, writes
// super_admin. The module is now capability-gated
// (forms.view/create/edit/delete) so it is configurable from the Permissions
// template. This backfill reproduces the READ population only — writes stay
// Super-Admin-by-default (SA bypasses) and become grantable per template.
const FORMS_BACKFILL = {
  profiles: {
    "Staff Default": [["forms", "view", 1]],
  },
  roles: {
    staff: [["forms", "view", 1]],
  },
};

async function ensureFormsBackfill() {
  await ensurePermissionsSchema();

  for (const [profileName, rows] of Object.entries(FORMS_BACKFILL.profiles)) {
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

  for (const [role, rows] of Object.entries(FORMS_BACKFILL.roles)) {
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

// ─── Communication: Runs module ──────────────────────────────────────────────
// Runs were gated by a legacy role allowlist on GET
// (super_admin / staff / program_manager) while the sidebar hard-coded
// `platform-runs` to super_admin — the mismatch behind "communication users".
// The module is now capability-gated (runs.view/create/edit/delete). This
// backfill reproduces the legacy READ population so the sidebar and the API
// finally agree; writes stay Super-Admin-by-default (SA bypass) and become
// grantable per template. Program-manager write actions (assign / unassign /
// send messages) were only reachable from a page PMs could not open, so no
// reachable workflow changes — grant runs.edit explicitly to restore them.
const RUNS_BACKFILL = {
  profiles: {
    "Staff Default": [["runs", "view", 1]],
    "Program Manager": [["runs", "view", 1]],
  },
  roles: {
    staff: [["runs", "view", 1]],
    program_manager: [["runs", "view", 1]],
  },
};

async function ensureRunsBackfill() {
  await ensurePermissionsSchema();

  for (const [profileName, rows] of Object.entries(RUNS_BACKFILL.profiles)) {
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

  for (const [role, rows] of Object.entries(RUNS_BACKFILL.roles)) {
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
//   projects POST          → projects.create   (SA, staff, PM)
//   projects DELETE        → projects.delete   (SA, staff, PM)
//   projects/members POST  → projects.edit     (SA, staff, PM)
//   projects/members DELETE → projects.edit    (SA, staff, PM)
//
// Backfills reproduce the route populations through the capability layer:
//   - program_manager needs create/edit/delete (its profile only
//     has projects.view)
//   - staff needs delete (Staff Default already has view/create/edit)
//
// (The retired `admin`/`developer` roles no longer appear in these
// allowlists, so they need no backfill.)
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
//
// The eligibility table was seeded in Phase 0 BEFORE the tasks feature
// existed, so existing databases have no tasks rows at all — the backfill
// inserts the full role set (not just extras).

const TASKS_BACKFILL = {
  eligibility: { operations: ["super_admin", "staff", "program_manager", "team"] },
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

// ─── Phase 9: Programs (pm/* writes) ────────────────────────────────────────
// Migrated routes — the V2-wired pm writes, with the legacy staff bypass
// REMOVED and replaced by an explicit capability (the roadmap's
// "give those roles an explicit capability instead of the implicit bypass"):
//   pm/curriculum POST/PUT/DELETE → programs.edit
//   pm/teams POST/PATCH/DELETE    → programs.edit
//   pm/export GET                 → reports.export (Phase 3 backfill already
//                                    covers staff export)
//   pm/programs DELETE            → programs.delete (no backfill: nobody but
//                                    SA holds delete — same as today's V2)
//
// Backfills: staff gets programs.edit (Staff Default profile and
// role_capabilities). Program Manager already holds edit via its
// profile. Zero gains: the only routes enforcing programs.edit are these,
// where staff were already allowed via the bypass.
//
// Deliberately NOT migrated (documented): pm/programs POST + templates POST
// (migrating would let PMs — who hold programs.create via profile — create
// programs; a policy decision, not a mechanical flip), pm/programs PUT
// (admin in allowlist but not in programs eligibility), programs
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
// venture workspace) and the broad read allowlists (participant/founder). Capability cannot express per-venture membership; the
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
//
// Deliberately NOT migrated (documented): the super_admin-only admin routes
// (admin-overview, executive-dashboard, approval, campaigns writes,
// relationships writes), the program_manager-inclusive reads (campaigns GET,
// pipeline GET, profile GET — migrating them would grant PM the whole portal
// via shared eligibility), approval GET and profile PUT ([SA, staff] —
// investor would gain via view/edit caps), and the public register/
// setup-password flows.

const INVESTOR_BACKFILL = {
  eligibility: { investors: ["super_admin", "staff", "investor"] },
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

export {
  ensureKnowledgeBackfill,
  ensureReportsBackfill,
  ensureAnnouncementsBackfill,
  ensureFormsBackfill,
  ensureRunsBackfill,
  ensureProjectsBackfill,
  ensureTasksBackfill,
  ensureProgramsBackfill,
  ensureVenturesBackfill,
  ensureInvestorBackfill,
};
