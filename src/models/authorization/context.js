/**
 * COMPATIBILITY FACADE — context & assignment access moved to the service layer.
 *
 * The scoped-access guard and its per-resource assignment resolvers used to run
 * their own SQL here. The decision now lives in
 * `@/services/authorization/scopedAccess`, its lookups in
 * `@/models/authorization/contextAssignmentReads`.
 *
 * Re-exported unchanged so existing importers (routes via
 * `@/lib/authorization`, and `context-access.test.js`) keep working. New code
 * imports from the service. Deleted once `grep` finds no importer — see
 * docs/LAYER_SPLIT.md.
 */

export * from "@/services/authorization/scopedAccess";
