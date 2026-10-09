/**
 * ELIGIBILITY BOOTSTRAP (SERVICE layer).
 *
 * The one-time, per-process seed of the eligibility table, extracted from
 * `context.js` because it is DATA work, not a decision: it was sitting in the
 * middle of the module that resolves a person's access, 70 lines of migrations
 * away from the function that answers "may they?".
 *
 * The contract that matters here is failure handling, and it is deliberate:
 *
 *   - A failing seed is CAUGHT AND LOGGED, never propagated. A single missing
 *     column must not turn every gated request into a 500.
 *   - The seed is still marked ATTEMPTED afterwards. Retrying a failing seed on
 *     every request would turn one broken column into a permanent per-request
 *     tax; instead it retries on the next boot, because the migration marker
 *     was left unwritten.
 *   - Every seed runs through `runAuthzMigration(marker, seed)`, so each marker
 *     is a row in the database. These marker strings are PRODUCTION DATA:
 *     renaming one re-runs that seed on every deployed database.
 *
 * The module-level flag below is the per-process memory of that decision. It is
 * shared by everything that resolves a context, which is why this state lives
 * in its own module rather than inside one caller's closure.
 *
 * Split out of `context.js` (560 lines). Behaviour identical.
 */

import { runAuthzMigration } from "@/models/authorization/migrations";
import {
  ensureEligibilitySchema,
  seedDefaultEligibility,
  seedLmsFeatureEligibility,
  seedVenturesMemberEligibility,
  seedProgramAssignmentEligibility,
  seedProfileEligibilityDefaults,
  removeNonBaselineRoleEligibility,
} from "@/models/authorization/eligibility";

let eligibilitySeeded = false;
let eligibilitySeedPromise = null;

/** Seed the eligibility table ONCE per database (bootstrap), then stop. */
function ensureEligibilitySeeded() {
  if (!eligibilitySeeded) {
    if (!eligibilitySeedPromise) {
      eligibilitySeedPromise = (async () => {
        await ensureEligibilitySchema();
        await runAuthzMigration(
          "eligibility-bootstrap-seed",
          seedDefaultEligibility,
        );
        // Databases that bootstrapped before the LMS feature existed get the
        // new feature's default rows exactly once (never overwrites edits).
        // v2 re-runs the seed after developer was added to the LMS allowlist
        // (ON CONFLICT DO NOTHING — idempotent, never touches admin edits).
        await runAuthzMigration(
          "eligibility-lms-bootstrap-v2",
          seedLmsFeatureEligibility,
        );
        // Phase 6: member-baseline founders need the ventures feature to be
        // eligible for their baseline identity (the capability alone is not
        // enough — eligibility is checked first and fails closed).
        await runAuthzMigration(
          "eligibility-ventures-member-v1",
          seedVenturesMemberEligibility,
        );
        // Assignment-derived PROGRAM access (facilitator / program manager).
        // Same gap as the ventures/member row above: the ceiling must allow the
        // baseline identities these contextual roles resolve to, or the
        // assignment-derived capability is refused before it is ever read.
        await runAuthzMigration(
          "eligibility-programs-assignment-v1",
          seedProgramAssignmentEligibility,
        );
        // Phase H — the PROFILE ceilings. The contextual values that used to be
        // seeded as role rows are written as `identity_type = 'profile'` rows,
        // insert-only, so an existing database gains the profile coverage.
        await runAuthzMigration(
          "eligibility-profile-defaults-v1",
          seedProfileEligibilityDefaults,
        );
        // Baseline-only vocabulary: EVERY role row that is not a baseline
        // identity is a leftover of the old role vocabulary (contextual
        // functions + retired labels). Those functions are PROFILES now, so the
        // role rows are deleted for good. Profile rows are untouched (they are
        // the new ceiling); group rows are untouched. Runs ONCE per database.
        await runAuthzMigration(
          "eligibility-baseline-roles-only-v1",
          removeNonBaselineRoleEligibility,
        );
      })()
        // A one-time seed is DATA work, and the authorization gate awaits this
        // call: a failure is reported and never propagated, so a single missing
        // column cannot turn every gated request into a 500. The migration
        // marker is still unwritten, so the seed does retry on the next boot.
        .catch((error) => {
          console.error(
            "[Authz] one-time eligibility seed failed (not recorded, retried on the next boot):",
            error.message,
          );
        })
        .finally(() => {
          eligibilitySeedPromise = null;
          // Attempted once per process whatever the outcome: leaving this false
          // would re-run the seed and its marker checks on EVERY request.
          eligibilitySeeded = true;
        });
    }
  }
  return eligibilitySeeded ? Promise.resolve() : eligibilitySeedPromise;
}

export { ensureEligibilitySeeded };
