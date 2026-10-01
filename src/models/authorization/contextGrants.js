/**
 * COMPATIBILITY FACADE — context grants moved to the service layer.
 *
 * The grant plan, the justification resolution and the reconcile orchestration
 * used to run their own SQL here. They now live in
 * `@/services/authorization/contextGrants`, and every statement in
 * `@/models/authorization/contextGrantsStore`.
 *
 * Re-exported unchanged so existing importers keep working — routes and other
 * services import from here, and four suites `jest.mock` this exact path (a
 * facade keeps those mocks intercepting). New code imports from the service.
 * Deleted once `grep` finds no importer — see docs/LAYER_SPLIT.md.
 */

export * from "@/services/authorization/contextGrants";
