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


import { runAuthzMigration, oneTimeMigrationsEnabled } from "./migrations";
import { ensureMembershipBootstrap } from "./membership";
import { backfillContextRoleProfileMappings } from "./contextRoleProfiles";
import { seedProfiles } from "./profilesStore";
import {
  backfillFacilitatorTickLists,
} from "./programAssignmentBackfill";
import {
  ensureProfileCatalogueSeed,
  ensureFacilitatorProfileSeed,
  ensureVentureMemberEditBackfill,
  ensureDelegatedCapabilityDefaults,
} from "./profileCatalogueSeed";
import { backfillFacilitatorProfileKeys } from "./programAssignmentProfileKey";
import { dropAccessProfileTables } from "./profileTakeoverDrop";
// The feature-key alignment RULE lives in the service layer (audit A1, finding
// #8); its statements live in `./featureKeyAlignmentStore`. Importing it here is
// a deliberate model→service edge, like `programAssignmentBackfill`.
import { ensureFeatureKeyAlignment } from "@/services/authorization/featureKeyAlignment";
import {
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
  ensureInvestorCreationDelegation,
} from "./backfill/moduleBackfills";
import {
  ensureLmsViewBackfill,
  ensureLmsCapabilityRetirement,
  ensureLmsAuthoringDelegation,
  ensureMessagingPolicyBackfill,
  ensureFinalPolicyBackfill,
  ensureCommunicationFeatureBackfill,
} from "./backfill/policies";


let backfillsSeeded = false;
let backfillPromise = null;

/**
 * Report the migrations that did not apply.
 *
 * `runAuthzMigration` deliberately rejects — and records nothing — when its work
 * throws (see migrations.js), so that the migration retries on the next boot.
 * Inside this batch that must not decide the batch's outcome: the migrations are
 * independent of one another, and they are DATA work. The authorization gate
 * awaits this call, so letting one failure through would turn a single missing
 * column into a 500 on every gated request.
 */
function reportFailedMigrations(results) {
  for (const result of results) {
    if (result.status === "rejected") {
      console.error(
        "[Authz] one-time migration failed (not recorded, retried on the next boot):",
        result.reason?.message || result.reason,
      );
    }
  }
}

/** Run all capability backfills once per process (idempotent, egress-safe).
 *
 * Does NOTHING unless `AUTHZ_RUN_MIGRATIONS=true`: these are one-time migrations,
 * already applied on every deployed database, and the authorization gate awaits
 * this call — so an applied migration may cost a ledger read, never a retry.
 */
export function ensureCapabilityBackfills() {
  if (!oneTimeMigrationsEnabled()) return Promise.resolve();
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
        //
        // All migrations are idempotent, write disjoint rows and record only
        // their own name — running the checks in parallel avoids ~13
        // sequential round-trips on every cold serverless instance (timeout
        // risk on slow databases).
        const results = await Promise.allSettled([
          runAuthzMigration("cap-backfill-knowledge", ensureKnowledgeBackfill),
          runAuthzMigration("cap-backfill-reports", ensureReportsBackfill),
          runAuthzMigration("cap-backfill-announcements", ensureAnnouncementsBackfill),
          runAuthzMigration("cap-backfill-forms", ensureFormsBackfill),
          runAuthzMigration("cap-backfill-runs", ensureRunsBackfill),
          runAuthzMigration("cap-backfill-projects", ensureProjectsBackfill),
          runAuthzMigration("cap-backfill-tasks", ensureTasksBackfill),
          runAuthzMigration("cap-backfill-programs", ensureProgramsBackfill),
          runAuthzMigration("cap-backfill-ventures", ensureVenturesBackfill),
          runAuthzMigration("cap-backfill-investor", ensureInvestorBackfill),
          // Delegate record creation to any identity the administrator chooses:
          // the investor feature's ceiling gains `member` (programs and ventures
          // already have it). Insert-only, so an admin's removal wins.
          runAuthzMigration(
            "creation-delegation-investor-v1",
            ensureInvestorCreationDelegation,
          ),
          // LMS became a capability-grantable feature behind `lms.view` with a
          // Program Manager surface — existing DBs need the PM grant (the seed
          // only applies to profiles created after the change).
          runAuthzMigration("cap-backfill-lms-view", ensureLmsViewBackfill),
          // Delegated course authoring: the LMS feature's ceiling gains `staff`
          // so `lms.create` (and its siblings) can be granted to a chosen staff
          // member. Insert-only, so an admin's removal wins.
          runAuthzMigration(
            "lms-authoring-delegation-v1",
            ensureLmsAuthoringDelegation,
          ),
          runAuthzMigration("lms-capability-retirement-v1", ensureLmsCapabilityRetirement),
          // One-time policy migrations — run once per database, then the
          // Permissions UI owns eligibility configuration (see migrations.js).
          runAuthzMigration("messaging-mvp-internal-only", ensureMessagingPolicyBackfill),
          runAuthzMigration("eligibility-policy-3", ensureFinalPolicyBackfill),
          // Communication is the consolidated feature behind the messaging +
          // internal_comms modules (Messages / Announcements). Existing DBs
          // carry legacy messaging/internal_comms rows — leave them untouched
          // (harmless, no longer evaluated) and add the new feature rows.
          runAuthzMigration("communication-feature-v1", ensureCommunicationFeatureBackfill),
          // Phase 1: organizational membership bootstrap — existing group edges
          // become active, no-expiry memberships (zero behavior change at
          // cutover; see membership.js).
          runAuthzMigration("membership-bootstrap-v1", ensureMembershipBootstrap),
          // Phase A (ROADMAP_ROLES_PROFILES_ACCESS): seed the profile catalogue
          // once per database. Insert-only, so an administrator's edit of
          // allowed_roles / is_active / notes is never overwritten.
          runAuthzMigration("profiles-catalog-v1", seedProfiles),
          // Phase 6: registry rows seeded before their mapped profile existed
          // carry profile_id NULL (the Founder profile post-dates the
          // venture:founder seed). Fill NULLs only — admin mappings win.
          runAuthzMigration(
            "context-role-profile-mappings-v1",
            backfillContextRoleProfileMappings,
          ),
          // ASSIGNMENT-DERIVED PROGRAM ACCESS.
          //
          // Fill the missing entries of every facilitator assignment's tick list
          // at the level today's resolution already produces, so turning on
          // per-program enforcement cannot deny a facilitator who is already
          // working. Never rewrites an existing entry.
          runAuthzMigration(
            "facilitator-tick-list-backfill-v1",
            backfillFacilitatorTickLists,
          ),
        ]);
        reportFailedMigrations(results);

        // Feature-key alignment (FEATURES = dashboard sections) runs AFTER the
        // parallel backfills so it never races the rows they touch. It gets the
        // same treatment: a failure is reported, never propagated.
        const alignment = await Promise.allSettled([
          runAuthzMigration("feature-key-alignment-v1", ensureFeatureKeyAlignment),
          // DIRECT profile seed: so a FRESH database gets the catalogue even
          // with no `access_profiles` at all — the retired layer is gone.
          runAuthzMigration("profile-catalogue-seed-v1", ensureProfileCatalogueSeed),
          // Lot 3.4 / D-5 — the facilitator PROFILE. The catalogue seed above is
          // recorded once per database, so an existing one never receives a
          // profile added later; this key seeds it (insert-only).
          runAuthzMigration("facilitator-profile-seed-v1", ensureFacilitatorProfileSeed),
          // Lot 5 / D-7 — the Venture Member profile gains `ventures.edit`, so
          // the canonical write gate preserves the access the legacy
          // membership gate gave every active member.
          runAuthzMigration("venture-member-edit-v1", ensureVentureMemberEditBackfill),
          // Lot 4.8 — the capabilities that replace a role list are granted to
          // the profiles that already held the access (staff, program manager).
          // Insert-only; without this an existing database would deny them at
          // the route switch.
          runAuthzMigration(
            "profile-capability-defaults-v1",
            ensureDelegatedCapabilityDefaults,
          ),
          // The per-assignment profile override moved from an access-profile id
          // (`v2_program_staff.access_profile_id`) to a profile KEY. That
          // one-time data move is RETIRED: the column it read was dropped by the
          // takeover, so on an already-migrated database it could only fail —
          // and retried on every boot. The keys are in place; do not re-add it.

          // Lot 3.4 / D-5 — give every facilitator assignment the facilitator
          // PROFILE. Inert until the checkboxes lose precedence; it removes the
          // data gap that would otherwise deny every facilitator at the switch.
          runAuthzMigration(
            "facilitator-profile-key-v1",
            backfillFacilitatorProfileKeys,
          ),
        ]);
        reportFailedMigrations(alignment);

        // PROFILES TAKE OVER — the FINAL step: drop the retired template layer.
        // Runs strictly AFTER the batch above, which is the last thing that reads
        // it. Recorded once per database (2026-10-15).
        const drop = await Promise.allSettled([
          runAuthzMigration("drop-access-profiles-v1", dropAccessProfileTables),
        ]);
        reportFailedMigrations(drop);

        // Attempted once per process, whatever the outcome. A migration that
        // failed is still not recorded, so it does retry on the next boot — but
        // leaving this flag false would re-run every migration AND its marker
        // check on EVERY REQUEST, which is what turned one failure into a storm
        // of slow queries and an exhausted connection pool.
        backfillsSeeded = true;
      })().finally(() => {
        backfillPromise = null;
      });
    }
  }
  return backfillsSeeded ? Promise.resolve() : backfillPromise;
}


export {
  ensureLmsViewBackfill,
  ensureFinalPolicyBackfill,
  ensureCommunicationFeatureBackfill,
};
