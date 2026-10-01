/**
 * COMPATIBILITY FACADE — the milestone/task archive engine moved to the service.
 *
 * This module decided the filed-work guard and the cascade while running the SQL
 * in the same functions. The decisions now live in
 * `@/services/ventures/archive`; every statement in
 * `@/models/ventureArchiveStore`.
 *
 * Re-exported unchanged so existing importers keep working (the milestone/task
 * archive routes, the task delete path and the suites). New code imports the
 * decisions from the service. Deleted once `grep` finds no importer — see
 * docs/LAYER_SPLIT.md.
 */

import {
  taskHasFiledWork,
  milestoneHasFiledWork,
  archiveTask,
  restoreTask,
  archiveMilestone,
  restoreMilestone,
  applyBulk,
} from "@/services/ventures/archive";

export { taskHasFiledWork, milestoneHasFiledWork, archiveTask, restoreTask, archiveMilestone, restoreMilestone, applyBulk };

export default {
  taskHasFiledWork,
  milestoneHasFiledWork,
  archiveTask,
  restoreTask,
  archiveMilestone,
  restoreMilestone,
  applyBulk,
};
