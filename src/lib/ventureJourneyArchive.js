/**
 * COMPATIBILITY FACADE — the Journey archive/delete engine moved to the service.
 *
 * This module decided which journeys were clean enough to delete and hid the
 * rest, while running the SQL in the same functions. The decisions now live in
 * `@/services/ventures/journey`; every statement in
 * `@/models/ventureJourneyStore`.
 *
 * Re-exported unchanged so existing importers keep working (the journey
 * archive/delete routes and the suites). New code imports the decisions from the
 * service. Deleted once `grep` finds no importer — see docs/LAYER_SPLIT.md.
 */

import {
  stageHasFiledWork,
  archiveJourneyStages,
  restoreJourneyStages,
  deleteJourneyStages,
} from "@/services/ventures/journey";

export { stageHasFiledWork, archiveJourneyStages, restoreJourneyStages, deleteJourneyStages };

export default { stageHasFiledWork, archiveJourneyStages, restoreJourneyStages, deleteJourneyStages };
