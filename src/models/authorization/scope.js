/**
 * COMPATIBILITY FACADE — the scope engine moved to the service layer.
 *
 * This module decided record scope and ran its own SQL. The decision now lives
 * in `@/services/authorization/scope`, its statements in
 * `@/models/authorization/scopeReads`, and the pure catalogue stays in
 * `./scope-catalog` (re-exported through the service so this path is unchanged).
 *
 * Re-exported unchanged so existing importers keep working. New code imports
 * from the service. Deleted once `grep` finds no importer — see
 * docs/LAYER_SPLIT.md.
 */

export * from "@/services/authorization/scope";
