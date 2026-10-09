import db from "@/lib/db";
import { ensurePermissionsSchema } from "@/models/authorization/bootstrap";
import { profileKeyForAccessProfileName } from "@/models/authorization/profileTakeoverBackfill";

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
    "role_capabilities",
    "group_capabilities",
    "user_capabilities",
    "user_capability_restrictions",
    "profile_capabilities",
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

export { ensureLmsCapabilityRetirement, ensureMessagingPolicyBackfill };
