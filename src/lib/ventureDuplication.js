/**
 * COMPATIBILITY FACADE — the Venture OS duplication engine moved to the service.
 *
 * This module decided what a copy resets and re-serialised the stage order while
 * running the SQL in the same functions. The decisions now live in
 * `@/services/ventures/duplication`; every statement in
 * `@/models/ventureDuplicationStore`.
 *
 * Re-exported unchanged so existing importers keep working (the journey /
 * milestone / task duplicate routes and the suites). New code imports the
 * decisions from the service. Deleted once `grep` finds no importer — see
 * docs/LAYER_SPLIT.md.
 */

import { duplicateJourneyStage, duplicateMilestone, duplicateTask } from "@/services/ventures/duplication";

export { duplicateJourneyStage, duplicateMilestone, duplicateTask };

export default { duplicateJourneyStage, duplicateMilestone, duplicateTask };
