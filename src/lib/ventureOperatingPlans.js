/**
 * COMPATIBILITY FACADE — the operating-plan access helpers moved to the service.
 *
 * This module resolved plan access and ran its SQL in the same functions. The
 * decisions now live in `@/services/ventures/operatingPlans`; every statement in
 * `@/models/ventureOperatingPlanStore`.
 *
 * Re-exported unchanged so existing importers keep working (the journey,
 * operating-plan, template and progress-report routes). New code imports the
 * decisions from the service. Deleted once `grep` finds no importer — see
 * docs/LAYER_SPLIT.md.
 */

export {
  resolveVentureCode,
  isGlobalRole,
  resolvePlanAccess,
  allowsPlanAction,
  listPlanTemplates,
  createTemplateFromPlan,
  applyTemplateToVenture,
} from "@/services/ventures/operatingPlans";
