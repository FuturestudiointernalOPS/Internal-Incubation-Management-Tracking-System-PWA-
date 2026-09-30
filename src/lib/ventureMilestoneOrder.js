/**
 * COMPATIBILITY FACADE — milestone ordering moved to the service layer.
 *
 * This module normalized and swapped display_order while running the SQL in the
 * same functions. The decisions now live in
 * `@/services/ventures/milestoneOrder`; every statement in
 * `@/models/ventureMilestoneOrderStore`.
 *
 * Re-exported unchanged so existing importers keep working (the milestones
 * reorder route and the suites). New code imports the decisions from the
 * service. Deleted once `grep` finds no importer — see docs/LAYER_SPLIT.md.
 */

import { listStageMilestones, moveStageMilestone } from "@/services/ventures/milestoneOrder";

export { listStageMilestones, moveStageMilestone };

export default { listStageMilestones, moveStageMilestone };
