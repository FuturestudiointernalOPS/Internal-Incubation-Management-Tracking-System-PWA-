import db from "@/lib/db";
import { ensurePermissionsSchema } from "@/models/authorization/bootstrap";

// ─── Messaging: FINAL MVP POLICY (internal-only) ────────────────────────────
// Decision: Messaging is a Future Studio internal-operations feature.
// Only the internal staff roles keep it: super_admin, staff, program_manager.
// Participant, founder and member are REMOVED from messaging
// eligibility.
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

// Phase 12 — LMS retirement of publish/enroll/assign (product decision: LMS
// is now a feature granted through view/create/edit/delete only). Remove every
// persisted row for the retired capabilities so they can never be granted or
// evaluated again. Super Admin keeps working through the bypass.
async function ensureLmsCapabilityRetirement() {
  const retired = ["publish", "enroll", "assign"];
  const placeholders = retired.map(() => "?").join(",");
  for (const table of [
    "access_profile_capabilities",
    "role_capabilities",
    "group_capabilities",
    "user_capabilities",
    "user_capability_restrictions",
  ]) {
    await db.execute({
      sql: `DELETE FROM ${table} WHERE module = ? AND capability IN (${placeholders})`,
      args: ["lms", ...retired],
    });
  }
  return { success: true };
}

// ─── Phase 12b: LMS view for the Program Manager profile ─────────────────────
// The LMS section was promoted to a capability-grantable feature: every course
// and program-learning route is gated on `lms.view` (the PM surface lives at
// /pm/lms/courses, and the program workspace renders a learning section per
// session). `seedDefaultAccessProfiles` adds `lms: { view: 1 }` to the
// "Program Manager" profile, but seeds only ever CREATE — a database seeded
// before the promotion keeps a Program Manager profile with no `lms` row, so
// every PM learning surface answers 403 for a capability the role is supposed
// to hold. Reproduce the seed's grant (missing rows only; an administrator's
// explicit configuration is never overwritten).
const LMS_VIEW_BACKFILL = {
  profiles: {
    "Program Manager": [["lms", "view", 1]],
  },
  // Fallback for profile-less program managers (the resolver reads
  // role_capabilities when no access profile resolves).
  roles: {
    program_manager: [["lms", "view", 1]],
  },
};

// Exported for the migration tests (see authorization-resolver.test.js).
export async function ensureLmsViewBackfill() {
  await ensurePermissionsSchema();

  for (const [profileName, rows] of Object.entries(LMS_VIEW_BACKFILL.profiles)) {
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

  for (const [role, rows] of Object.entries(LMS_VIEW_BACKFILL.roles)) {
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

const MESSAGING_INTERNAL_ROLES = [
  "super_admin",
  "staff",
  "program_manager",
];

const MESSAGING_REMOVED_ROLES = ["teacher", "participant", "founder", "member"];

async function ensureMessagingPolicyBackfill() {
  await ensurePermissionsSchema();

  // 1. Remove external roles from messaging eligibility (existing DBs seeded
  //    before this policy had them eligible).
  for (const role of MESSAGING_REMOVED_ROLES) {
    await db.execute({
      sql: `DELETE FROM feature_eligibility
            WHERE feature_key = 'communication' AND identity_type = 'role' AND identity_value = ?`,
      args: [role],
    });
  }

  // 2. Ensure the internal roles are present (idempotent; fresh DBs get the
  //    updated seed, existing DBs already have these rows).
  for (const role of MESSAGING_INTERNAL_ROLES) {
    await db.execute({
      sql: `INSERT INTO feature_eligibility
              (feature_key, identity_type, identity_value, eligible)
            VALUES ('communication', 'role', ?, 1)
            ON CONFLICT (feature_key, identity_type, identity_value)
            DO NOTHING`,
      args: [role],
    });
  }
}

// ─── Final eligibility policy (#3) ──────────────────────────
// Product Owner-approved final eligibility values:
//   - `participant` / `founder` are NOT eligible for crm. Removal is
//     zero-impact: they hold no contacts capabilities — self-service reads are
//     role-gated, not eligibility-gated (verified by the read-only dry-run,
//     scripts/dryrun-eligibility-policy.mjs: zero decision changes for every
//     user in the production database).
//   - the retired `admin` role no longer carries internal_comms/reporting rows;
//     older seeds that added them are cleared here.
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
              (feature_key = 'crm' AND identity_value IN ('participant', 'founder'))
            )`,
    args: [],
  });
}

// ─── Communication feature (consolidated) ───────────────────────────────────
// The `communication` feature is the single eligibility feature behind the
// Messages (messaging) and Announcements (internal_comms) modules — mirroring
// how `crm` is the feature behind the Contacts module. It replaces the legacy
// messaging + internal_comms feature keys in the UI while the legacy rows stay
// in the database untouched (never evaluated after the MODULE_TO_FEATURE
// remap). Runs ONCE per database via
// runAuthzMigration("communication-feature-v1"): fresh DBs seed these roles
// through FEATURE_ELIGIBILITY_DEFAULTS; existing DBs converge here. After
// that, the Permissions UI owns eligibility.

const COMMUNICATION_ELIGIBLE_ROLES = [
  "super_admin",
  "staff",
  "program_manager",
];

export async function ensureCommunicationFeatureBackfill() {
  await ensurePermissionsSchema();
  for (const role of COMMUNICATION_ELIGIBLE_ROLES) {
    await db.execute({
      sql: `INSERT INTO feature_eligibility
              (feature_key, identity_type, identity_value, eligible)
            VALUES ('communication', 'role', ?, 1)
            ON CONFLICT (feature_key, identity_type, identity_value)
            DO NOTHING`,
      args: [role],
    });
  }
}

// ─── Retired roles cleanup: `developer` / `admin` ───────────────────────────
// The `developer` role (with its "Developer"/"Developer Intern" templates) and
// the retired `admin` role were removed from the product: no session resolves to
// them any more, their dashboards are gone, and `engineering.manage_developers`
// left the capability catalog. Their rows are therefore inert — this ONE-TIME
// migration removes them so the Permissions UI and the catalog stop advertising
// control nobody can hold.
//
// Safety:
//   - Only rows keyed by the retired identities, their templates, or the retired
//     `engineering.manage_developers` capability are touched.
//   - GROUP eligibility rows are NEVER deleted (sacred, like eligibility-policy-3).
//   - Per-user profile assignments to the retired templates are cleared FIRST, so
//     no contact keeps a dangling `access_profile_id`.
//   - The audit write is best-effort: a missing audit table never blocks it (and
//     never leaves the migration un-recorded, which would retry forever).

const RETIRED_ROLE_NAMES = ["developer", "admin"];
const RETIRED_PROFILE_NAMES = ["Developer", "Developer Intern"];

// Every table that can carry a (module, capability) row. The retired
// `manage_developers` capability is stripped from all of them; the retired roles
// are stripped from the role-keyed ones only (per-user and per-group grants on
// OTHER capabilities are never touched).
const CAPABILITY_TABLES = [
  "role_capabilities",
  "group_capabilities",
  "user_capabilities",
  "user_capability_restrictions",
  "access_profile_capabilities",
  "responsibility_capability_grants",
];

const sqlList = (values) => values.map((value) => `'${value}'`).join(", ");

export async function ensureRetiredRoleCleanup() {
  await ensurePermissionsSchema();

  // 1. No contact may keep pointing at a template that is about to disappear.
  await db.execute(
    `UPDATE contacts SET access_profile_id = NULL
      WHERE access_profile_id IN (
        SELECT id FROM access_profiles WHERE name IN (${sqlList(RETIRED_PROFILE_NAMES)})
      )`,
  );

  // 2. The retired templates and their capabilities.
  await db.execute(
    `DELETE FROM access_profile_capabilities
      WHERE profile_id IN (
        SELECT id FROM access_profiles WHERE name IN (${sqlList(RETIRED_PROFILE_NAMES)})
      )`,
  );
  await db.execute(
    `DELETE FROM access_profiles WHERE name IN (${sqlList(RETIRED_PROFILE_NAMES)})`,
  );

  // 3. The retired roles' profile defaults, legacy fallback rows and eligibility
  //    rows (role rows only — group rows stay untouched).
  await db.execute(
    `DELETE FROM role_access_profile_defaults
      WHERE role_name IN (${sqlList(RETIRED_ROLE_NAMES)})`,
  );
  await db.execute(
    `DELETE FROM role_capabilities WHERE role IN (${sqlList(RETIRED_ROLE_NAMES)})`,
  );
  await db.execute(
    `DELETE FROM feature_eligibility
      WHERE identity_type = 'role' AND identity_value IN (${sqlList(RETIRED_ROLE_NAMES)})`,
  );

  // 4. The retired `engineering.manage_developers` capability, everywhere it may
  //    have been granted (profiles, roles, groups, people, restrictions).
  for (const table of CAPABILITY_TABLES) {
    await db.execute(
      `DELETE FROM ${table} WHERE module = 'engineering' AND capability = 'manage_developers'`,
    );
  }

  // 5. Best-effort audit trail.
  try {
    await db.execute({
      sql: `INSERT INTO permission_audit_log
              (actor_cid, actor_name, target_cid, target_name, action, details)
            VALUES ('system','system','system','system','eligibility_changed',?)`,
      args: [
        "Retired roles cleanup: removed the `developer`/`admin` roles and the " +
          "`Developer`/`Developer Intern` templates (their capabilities, role " +
          "defaults, eligibility rows, per-user profile assignments and the " +
          "`engineering.manage_developers` capability).",
      ],
    });
  } catch (error) {
    console.warn(
      "[Authz] retired-role cleanup audit write skipped:",
      error.message,
    );
  }
}

export { ensureLmsCapabilityRetirement, ensureMessagingPolicyBackfill };
