/**
 * COMPATIBILITY FACADE — objective progress moved to the service layer.
 *
 * This module computed the objective rate and ran the SQL in the same place.
 * The computation and the cache policy now live in
 * `@/services/programs/kpiProgress`; every statement in
 * `@/models/kpiProgressStore`.
 *
 * Re-exported unchanged so existing importers keep working (the KPI routes and
 * the suites that mock this path). New code imports the statements from
 * `./kpiProgressStore` and the decisions from the service. Deleted once `grep`
 * finds no importer — see docs/LAYER_SPLIT.md.
 */

export * from "./kpiProgressStore";
export * from "@/services/programs/kpiProgress";
