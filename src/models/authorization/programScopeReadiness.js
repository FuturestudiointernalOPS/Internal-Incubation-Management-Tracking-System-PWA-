/**
 * COMPATIBILITY FACADE — program scope readiness moved to the service layer.
 *
 * This module computed the readiness report and ran its five statements in the
 * same place. The report now lives in
 * `@/services/authorization/programScopeReadiness`; every statement in
 * `@/models/authorization/programScopeReadinessReads`.
 *
 * Re-exported unchanged so existing importers keep working. New code imports
 * from the service. Deleted once `grep` finds no importer — see
 * docs/LAYER_SPLIT.md.
 */

export * from "@/services/authorization/programScopeReadiness";
