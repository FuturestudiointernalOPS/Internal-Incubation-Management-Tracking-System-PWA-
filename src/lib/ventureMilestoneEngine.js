/**
 * COMPATIBILITY FACADE — the milestone progression engine moved to the service.
 *
 * This module decided availability, authority and milestone status while
 * running its SQL in the same functions. The decisions now live in
 * `@/services/ventures/milestoneEngine`; every statement in
 * `@/models/ventureMilestoneEngineStore`.
 *
 * Re-exported unchanged so existing importers keep working (the milestones /
 * journey / deliverables / tasks routes and the suites). New code imports the
 * decisions from the service. Deleted once `grep` finds no importer — see
 * docs/LAYER_SPLIT.md.
 */

import {
  isMilestoneLeadAuthority,
  resolveVentureCode,
  canManageMilestones,
  computeInitialMilestoneStatus,
  completeStageIfAllMilestonesDone,
  releaseMilestonesForStage,
  activateDueStages,
  getUnmetMilestoneDependencies,
  assertBookableMilestone,
  deriveMilestoneStatusFromDeliverables,
  deriveMilestoneStatusFromTasks,
  combineMilestoneStatus,
  syncMilestoneFromWork,
  syncMilestoneStatusFromDeliverables,
  completeMilestone,
} from "@/services/ventures/milestoneEngine";

export {
  isMilestoneLeadAuthority,
  resolveVentureCode,
  canManageMilestones,
  computeInitialMilestoneStatus,
  completeStageIfAllMilestonesDone,
  releaseMilestonesForStage,
  activateDueStages,
  getUnmetMilestoneDependencies,
  assertBookableMilestone,
  deriveMilestoneStatusFromDeliverables,
  deriveMilestoneStatusFromTasks,
  combineMilestoneStatus,
  syncMilestoneFromWork,
  syncMilestoneStatusFromDeliverables,
  completeMilestone,
};

export default {
  isMilestoneLeadAuthority,
  resolveVentureCode,
  canManageMilestones,
  computeInitialMilestoneStatus,
  activateDueStages,
  releaseMilestonesForStage,
  completeStageIfAllMilestonesDone,
  completeMilestone,
  getUnmetMilestoneDependencies,
  assertBookableMilestone,
  deriveMilestoneStatusFromDeliverables,
  deriveMilestoneStatusFromTasks,
  combineMilestoneStatus,
  syncMilestoneStatusFromDeliverables,
  syncMilestoneFromWork,
};
