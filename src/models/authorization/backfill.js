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


import { runAuthzMigration } from "./migrations";
import { ensureMembershipBootstrap } from "./membership";
import { backfillContextRoleProfileMappings } from "./contextRoleProfiles";
import { seedProfiles } from "./profilesStore";
import {
  ensureAssignedProgramManagerProfile,
  ensurePortfolioProgramManagerProfile,
  backfillFacilitatorTickLists,
} from "./programAssignmentBackfill";
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
} from "./backfill/moduleBackfills";
import {
  ensureLmsViewBackfill,
  ensureLmsCapabilityRetirement,
  ensureMessagingPolicyBackfill,
  ensureFinalPolicyBackfill,
  ensureCommunicationFeatureBackfill,
  ensureRetiredRoleCleanup,
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
          // LMS became a capability-grantable feature behind `lms.view` with a
          // Program Manager surface — existing DBs need the PM grant (the seed
          // only applies to profiles created after the change).
          runAuthzMigration("cap-backfill-lms-view", ensureLmsViewBackfill),
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
          // (a) Create the narrow "Assigned Program Manager" template and point
          //     the registry's program:program_manager row at it — only while it
          //     still points at the seeded profile, so an administrator's own
          //     choice is never overwritten.
          // (b) Fill the missing entries of every facilitator assignment's
          //     tick list at the level today's resolution already produces, so
          //     turning on per-program enforcement cannot deny a facilitator
          //     who is already working. Never rewrites an existing entry.
          runAuthzMigration(
            "assigned-program-manager-profile-v1",
            ensureAssignedProgramManagerProfile,
          ),
          // (c) Create the PORTFOLIO template — the trimmed replacement for the
          //     role bundle that mixes programme management with venture
          //     editing and people creation. ADDITIVE AND INERT: nothing
          //     resolves to it until an administrator repoints the role default
          //     from the permission console, after reading the impact report.
          //     Nothing is repointed at boot, on purpose.
          runAuthzMigration(
            "portfolio-program-manager-profile-v1",
            ensurePortfolioProgramManagerProfile,
          ),
          runAuthzMigration(
            "facilitator-tick-list-backfill-v1",
            backfillFacilitatorTickLists,
          ),
        ]);
        reportFailedMigrations(results);

        // Feature-key alignment (FEATURES = dashboard sections) runs AFTER the
        // parallel backfills so it never races the rows they touch. It gets the
        // same treatment: a failure is reported, never propagated.
        //
        // The retired-role cleanup (developer / admin) runs here too: it removes
        // the rows earlier seeds may have left for roles the product no longer
        // has, after every backfill has had its say.
        const alignment = await Promise.allSettled([
          runAuthzMigration("feature-key-alignment-v1", ensureFeatureKeyAlignment),
          runAuthzMigration(
            "retire-developer-admin-roles-v1",
            ensureRetiredRoleCleanup,
          ),
        ]);
        reportFailedMigrations(alignment);

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
  ensureRetiredRoleCleanup,
};
