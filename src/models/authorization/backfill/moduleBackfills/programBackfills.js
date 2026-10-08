import db from "@/lib/db";
import { ensurePermissionsSchema } from "@/models/authorization/bootstrap";

/**
 * Authorization backfills — programs and ventures CRUD.
 *
 * Split verbatim out of `models/authorization/backfill/moduleBackfills.js` — see
 * docs/LAYER_SPLIT.md. Each backfill is idempotent (ON CONFLICT DO NOTHING) and
 * runs once per process.
 */

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

export {
  ensureProgramsBackfill,
  ensureVenturesBackfill,
};
