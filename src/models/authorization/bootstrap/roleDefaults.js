import db, { initDb } from "@/lib/db";
import { PERMISSION_MODULES } from "@/server/authz/capabilities";

/**
 * Authorization bootstrap — default grants (REPOSITORY layer).
 *
 * The catalogue every environment starts from: the baseline role capabilities
 * and the named Access Profiles with their capability templates and role
 * bindings. All upserts, so running them again is a no-op. Split verbatim out
 * of `models/authorization/bootstrap.js` — see docs/LAYER_SPLIT.md.
 */

export async function seedDefaultRoleCapabilities() {
  try {
    await initDb();
    const defaults = {
      super_admin: Object.fromEntries(
        Object.entries(PERMISSION_MODULES).map(([moduleKey, module]) => [
          moduleKey,
          Object.fromEntries(module.capabilities.map((capability) => [capability, 5])),
        ]),
      ),
      staff: {
        projects: { view: 1, create: 2, edit: 3 },
        programs: { view: 1 },
        reports: { view: 1, create: 2 },
        messaging: { view: 1, send: 2 },
        contacts: { view: 1 },
      },
      participant: {
        projects: { view: 1 },
        messaging: { view: 1, send: 2 },
      },
    };
    for (const [role, modules] of Object.entries(defaults)) {
      for (const [module, caps] of Object.entries(modules)) {
        for (const [capability, level] of Object.entries(caps)) {
          await db.execute({
            sql: `INSERT INTO role_capabilities (role, module, capability, access_level) VALUES (?, ?, ?, ?) ON CONFLICT (role, module, capability) DO UPDATE SET access_level = ?`,
            args: [role, module, capability, level, level],
          });
        }
      }
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Seed default access profiles and their capabilities.
 * Creates profiles for all common roles plus additional staff profiles.
 * Run once after migrations. Safe to re-run (upserts).
 */
export async function seedDefaultAccessProfiles() {
  try {
    await initDb();

    // ── Define profile definitions ──
    const profileDefs = {
      "Super Admin Default": {
        description: "Full system access — all modules, all capabilities",
        capabilities: Object.fromEntries(
          Object.entries(PERMISSION_MODULES).map(([moduleKey, module]) => [
            moduleKey,
            Object.fromEntries(module.capabilities.map((capability) => [capability, 5])),
          ]),
        ),
      },
      "Staff Default": {
        description: "Standard staff access — projects, messaging, reports",
        capabilities: {
          projects: { view: 1, create: 2, edit: 3 },
          programs: { view: 1 },
          ventures: { view: 1, edit: 3 },
          reports: { view: 1, create: 2 },
          messaging: { view: 1, send: 2 },
          contacts: { view: 1 },
        },
      },
      "Participant Default": {
        description:
          "Participant access — own programs, assignments, messaging",
        capabilities: {
          projects: { view: 1 },
          messaging: { view: 1, send: 2 },
        },
      },
      "Program Manager": {
        description: "Program management — programs, participants, reports",
        capabilities: {
          programs: { view: 1, create: 2, edit: 3, publish: 4 },
          projects: { view: 1 },
          ventures: { view: 1, edit: 3 },
          reports: { view: 1, create: 2, export: 3 },
          messaging: { view: 1, send: 2 },
          contacts: { view: 1, create: 2 },
          // D1 (production promotion decision): a Program Manager MAY keep
          // publishing courses and enrolling people. The retired
          // `lms.publish` / `lms.enroll` / `lms.assign` capabilities were folded
          // into `lms.edit`, which no seeded profile held — so the answer is to
          // grant it here. Level 3 matches `programs.edit` in this same block.
          lms: { view: 1, edit: 3 },
        },
      },
      // ASSIGNMENT-DERIVED program management.
      //
      // A person assigned as the manager of ONE program must get what managing
      // THAT program needs — not the whole portfolio template above, which also
      // carries venture editing, reporting and CRM access. This profile is what
      // the Context Roles registry points `program:program_manager` at, and it
      // is deliberately limited to the program module: no `create` (bringing a
      // program into existence is not a property of an existing assignment) and
      // no `delete` (destructive, and the highest risk in the catalog).
      //
      // It does NOT replace the "Program Manager" role default above: a person
      // whose platform role is program_manager keeps that template exactly as
      // before. This one is about the assignment.
      "Assigned Program Manager": {
        description:
          "Assignment-derived program management — the program you are assigned to",
        capabilities: {
          programs: { view: 1, edit: 3, publish: 4 },
        },
      },
      "Project Owner": {
        description: "Project management — own projects, tasks, team reporting",
        capabilities: {
          projects: { view: 1, create: 2, edit: 3, delete: 4 },
          engineering: { view: 1, manage_tasks: 2 },
          reports: { view: 1, create: 2 },
          messaging: { view: 1, send: 2 },
        },
      },
      "Operations Manager": {
        description: "Operations — programs, finance, CRM, reports",
        capabilities: {
          programs: { view: 1, edit: 3 },
          projects: { view: 1 },
          finance: { view: 1, create: 2, edit: 3, export: 4 },
          contacts: { view: 1, create: 2, edit: 3 },
          reports: { view: 1, create: 2, export: 3 },
          messaging: { view: 1, send: 2 },
        },
      },
      Instructor: {
        description: "Program delivery — programs, grading, communication",
        capabilities: {
          programs: { view: 1, edit: 3 },
          projects: { view: 1 },
          messaging: { view: 1, send: 2 },
          contacts: { view: 1 },
        },
      },
      "Finance Assistant": {
        description: "Finance operations — view/create/edit finance data",
        capabilities: {
          finance: { view: 1, create: 2, edit: 3 },
          reports: { view: 1 },
        },
      },
      Mentor: {
        description: "Mentor access — participant progress, messaging",
        capabilities: {
          programs: { view: 1 },
          projects: { view: 1 },
          messaging: { view: 1, send: 2 },
        },
      },
      // P1/Phase 5b: Founder is an official identity (Member + venture
      // membership), NOT a Staff profile. Phase 5c: view + edit, both scoped by
      // venture_own — a founder writes only inside their own ventures.
      Founder: {
        description: "Venture founder — own venture workspace (venture_own scope)",
        capabilities: {
          ventures: { view: 1, edit: 3 },
        },
      },
      // Team members are Venture PEOPLE, not staff: they hold a
      // venture_members row (member_type 'team_member') on a baseline Member
      // identity, so they get the read side of their own Venture and nothing
      // more. The venture_own scope is what confines them to the Venture they
      // were actually added to.
      "Venture Member": {
        description: "Venture team member — read access to their own venture",
        capabilities: {
          ventures: { view: 1 },
        },
      },
      // Phase E — the templates the newly activated couples resolve to. The
      // canonical creation runs in the one-time migration
      // (contextProfilesBackfill.js); these entries keep the admin seed in sync
      // for a database seeded from this endpoint.
      Learner: {
        description: "Course learner — read access to the courses they are enrolled in",
        capabilities: {
          lms: { view: 1 },
        },
      },
      "Venture Manager": {
        description: "Venture lead manager — manage the venture they lead",
        capabilities: {
          ventures: { view: 1, edit: 3 },
        },
      },
    };

    // ── Create/update profiles and capabilities ──
    for (const [name, def] of Object.entries(profileDefs)) {
      // Upsert profile
      await db.execute({
        sql: `INSERT INTO access_profiles (name, description, is_active)
              VALUES (?, ?, 1)
              ON CONFLICT (name) DO UPDATE SET description = ?, is_active = 1`,
        args: [name, def.description, def.description],
      });

      // Get profile id
      const profile = await db.execute({
        sql: "SELECT id FROM access_profiles WHERE name = ?",
        args: [name],
      });
      if (profile.rows.length === 0) continue;
      const profileId = profile.rows[0].id;

      // Upsert capabilities
      for (const [module, caps] of Object.entries(def.capabilities)) {
        for (const [capability, level] of Object.entries(caps)) {
          await db.execute({
            sql: `INSERT INTO access_profile_capabilities (profile_id, module, capability, access_level)
                  VALUES (?, ?, ?, ?)
                  ON CONFLICT (profile_id, module, capability) DO UPDATE SET access_level = ?`,
            args: [profileId, module, capability, level, level],
          });
        }
      }
    }

    // ── Map roles to default profiles ──
    const roleDefaults = {
      super_admin: "Super Admin Default",
      staff: "Staff Default",
      participant: "Participant Default",
      program_manager: "Program Manager",
      investor: "Mentor",
      mentor: "Mentor",
      // Phase 5b: founder-role users resolve to the Founder profile. There is
      // no role_capabilities('founder') seed, so this mapping only ADDS
      // ventures.view (it never narrows a legacy fallback).
      founder: "Founder",
      // Venture team members are added as members FIRST (venture_members row),
      // then given a team role — so the baseline `member` role is what has to
      // carry the read capability. There is no role_capabilities('member')
      // seed, so this mapping only ADDS ventures.view (it never narrows a
      // legacy fallback). View only: scope still decides WHICH venture.
      member: "Venture Member",
    };

    for (const [role, profileName] of Object.entries(roleDefaults)) {
      const profile = await db.execute({
        sql: "SELECT id FROM access_profiles WHERE name = ?",
        args: [profileName],
      });
      if (profile.rows.length > 0) {
        await db.execute({
          sql: `INSERT INTO role_access_profile_defaults (role_name, access_profile_id)
                VALUES (?, ?)
                ON CONFLICT (role_name) DO UPDATE SET access_profile_id = ?`,
          args: [role, profile.rows[0].id, profile.rows[0].id],
        });
      }
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
