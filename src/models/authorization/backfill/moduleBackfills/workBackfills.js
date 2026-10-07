import db from "@/lib/db";
import { ensurePermissionsSchema } from "@/models/authorization/bootstrap";
import { profileKeyForAccessProfileName } from "@/models/authorization/profileTakeoverBackfill";

/**
 * Authorization backfills — internal-operations modules (runs, projects, tasks).
 *
 * Split verbatim out of `models/authorization/backfill/moduleBackfills.js` — see
 * docs/LAYER_SPLIT.md. Each backfill is idempotent (ON CONFLICT DO NOTHING) and
 * runs once per process.
 */

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
    const key = profileKeyForAccessProfileName(profileName);
    if (!key) continue;
    for (const [module, capability, level] of rows) {
      await db.execute({
        sql: `INSERT INTO profile_capabilities (profile_key, module, capability, access_level)
              VALUES (?, ?, ?, ?)
              ON CONFLICT (profile_key, module, capability) DO NOTHING`,
        args: [key, module, capability, level],
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
    const key = profileKeyForAccessProfileName(profileName);
    if (!key) continue;
    for (const [module, capability, level] of rows) {
      await db.execute({
        sql: `INSERT INTO profile_capabilities (profile_key, module, capability, access_level)
              VALUES (?, ?, ?, ?)
              ON CONFLICT (profile_key, module, capability) DO NOTHING`,
        args: [key, module, capability, level],
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
    const key = profileKeyForAccessProfileName(profileName);
    if (!key) continue;
    for (const [module, capability, level] of rows) {
      await db.execute({
        sql: `INSERT INTO profile_capabilities (profile_key, module, capability, access_level)
              VALUES (?, ?, ?, ?)
              ON CONFLICT (profile_key, module, capability) DO NOTHING`,
        args: [key, module, capability, level],
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

export {
  ensureRunsBackfill,
  ensureProjectsBackfill,
  ensureTasksBackfill,
};
