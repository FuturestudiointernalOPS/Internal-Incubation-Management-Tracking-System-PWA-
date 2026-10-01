/**
 * COMPATIBILITY FACADE — the authorization decision moved to the service layer.
 *
 * This file used to hold the resolver. It mixed two responsibilities: it ran
 * SQL, and it decided access. The reads now live in
 * `@/models/authorization/contextReads` (repository) and the decision moved to
 * `@/services/authorization/context` (service).
 *
 * Everything is re-exported unchanged so nothing breaks:
 *   - route handlers that import the old paths
 *   - the endpoint suites that `jest.mock` or `jest.requireActual` this path
 *
 * New code imports from `@/services/authorization/context`. This facade is
 * deleted once `grep` finds no importer — see docs/LAYER_SPLIT.md.
 *
 * Note for the layer rules: this file is a re-export shim, not a model that
 * calls a service. The one real cross-layer edge created by the split is
 * `@/models/authorization/contextGrantReadiness`, which asks the service for a
 * resolved context; it is listed as follow-up work in docs/LAYER_SPLIT.md.
 */

export * from "@/services/authorization/context";
