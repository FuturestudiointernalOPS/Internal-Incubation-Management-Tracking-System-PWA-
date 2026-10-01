/**
 * COMPATIBILITY FACADE — the Venture Journey stage layer moved to the service.
 *
 * This module read, ordered, moved and deleted journey stages while running the
 * SQL in the same functions. The decisions now live in
 * `@/services/ventures/journey`; every statement in
 * `@/models/ventureJourneyStore`.
 *
 * Re-exported unchanged so existing importers keep working (the journey routes
 * and the suites). New code imports the decisions from the service and the
 * statements from the store. Deleted once `grep` finds no importer — see
 * docs/LAYER_SPLIT.md.
 */

export {
  ensureJourneyTable,
  resolveVentureInternalId,
  listJourneyStages,
  getJourneyStage,
  nextJourneyStageOrder,
  moveJourneyStage,
  deleteJourneyStage,
} from "@/services/ventures/journey";
