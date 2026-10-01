/**
 * COMPATIBILITY FACADE — the Venture plan import moved to the service layer.
 *
 * This module interpreted a tracker into a proposal, validated it, kept the
 * draft and turned an approved draft into journey rows — while running the SQL
 * in the same functions. The decisions now live in
 * `@/services/ventures/planImport`; every statement in
 * `@/models/venturePlanImportStore`.
 *
 * Re-exported unchanged so existing importers keep working (the plan-import
 * route and the suites). New code imports the decisions from the service and the
 * statements from the store. Deleted once `grep` finds no importer — see
 * docs/LAYER_SPLIT.md.
 */

export * from "@/services/ventures/planImport";
export { default } from "@/services/ventures/planImport";
