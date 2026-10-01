/**
 * COMPATIBILITY FACADE — the assignment derivation moved to the service layer.
 *
 * This module derived a program assignment's capabilities and expiry while
 * running its own SQL. The derivation now lives in
 * `@/services/authorization/programAssignments`, its reads in
 * `@/models/authorization/programAssignmentReads`.
 *
 * Re-exported unchanged so existing importers keep working (routes,
 * `programAssignmentBackfill`, `programScopeReadiness`, and
 * `program-assignment-grants.test.js`, which imports this path directly). New
 * code imports the reads from `./programAssignmentReads` and the decisions from
 * the service. Deleted once `grep` finds no importer — see docs/LAYER_SPLIT.md.
 */

export * from "./programAssignmentReads";
export * from "@/services/authorization/programAssignments";
