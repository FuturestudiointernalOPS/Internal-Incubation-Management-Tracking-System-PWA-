import db from "@/lib/db";
import { ensurePermissionsSchema } from "@/models/authorization/bootstrap";

/**
 * Authorization backfills — content and communications modules (knowledge,
 * reports, announcements, forms).
 *
 * Split verbatim out of `models/authorization/backfill/moduleBackfills.js` — see
 * docs/LAYER_SPLIT.md. Each backfill is idempotent (ON CONFLICT DO NOTHING) and
 * runs once per process.
 */

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

export {
  ensureKnowledgeBackfill,
  ensureReportsBackfill,
  ensureAnnouncementsBackfill,
  ensureFormsBackfill,
};
