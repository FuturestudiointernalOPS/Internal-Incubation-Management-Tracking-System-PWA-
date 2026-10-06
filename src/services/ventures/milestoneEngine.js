/**
 * Milestone progression engine (Vinance 3 — Phase 3; updated: date-driven
 * Journeys, no positional chain).
 *
 * How availability works now:
 *   - a Journey starts on its OWN start_date (activateDueStages) — never by
 *     waiting for another Journey to complete, so Journeys overlap freely;
 *   - a milestone is available as soon as its Journey is: an active Journey's
 *     milestones are all offered (held -> not_started) EXCEPT one whose
 *     explicit dependencies are unmet — that one reads `blocked`. Position
 *     releases nothing; dependencies are the only thing that ever holds a
 *     milestone back;
 *   - a Journey completes automatically the moment every milestone in it is
 *     completed; completing it does NOT start another one.
 *
 * Authority (unchanged): a milestone may ONLY be created, restructured or
 * marked completed by a holder of the permission matrix cell `milestones.edit`
 * — which the seeded Lead Manager holds and a Coach does not — or by a Super
 * Admin. Authority is read from the matrix and nowhere else.
 *
 * Founders see future work through the visibility projection (sealed, with its
 * real status) rather than through a positional lock. Manual overrides by
 * authorized actors are recorded through the normal history/notification
 * events.
 *
 * Every statement lives in `@/models/ventureMilestoneEngineStore`; nothing here
 * runs SQL. This module used to be re-exported through the
 * `@/lib/ventureMilestoneEngine` facade; that facade is gone (CH-4) and importers
 * read this module directly.
 *
 * Split (lane L2): the code lives in `./milestoneEngine/` — authority, availability, status.
 * This file re-exports the same public surface (named + default when there is
 * one), so importers and tests are unchanged.
 */

export {
  isMilestoneLeadAuthority,
  resolveVentureCode,
  canManageMilestones,
} from "./milestoneEngine/authority";
export {
  computeInitialMilestoneStatus,
  completeStageIfAllMilestonesDone,
  releaseMilestonesForStage,
  activateDueStages,
  getUnmetMilestoneDependencies,
  assertBookableMilestone,
} from "./milestoneEngine/availability";
export {
  deriveMilestoneStatusFromDeliverables,
  deriveMilestoneStatusFromTasks,
  combineMilestoneStatus,
  syncMilestoneFromWork,
  syncMilestoneStatusFromDeliverables,
  completeMilestone,
} from "./milestoneEngine/status";

