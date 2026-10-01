/**
 * context.js — COMPATIBILITY FACADE over the split authorization context.
 *
 * This file used to BE the context service: 560 lines holding the capability
 * algebra, the eligibility bootstrap, the resolver, the cache, the pure
 * decisions and the one-call helpers. It is now a pure re-export of six focused
 * modules, and it deliberately re-exports rather than re-implements.
 *
 *   capabilityMerge.js  — the arithmetic: rows → max-merge → − restrictions.
 *                         Imports nothing, so the rules stay testable alone.
 *   contextBootstrap.js — the one-time per-process eligibility seed, and what
 *                         happens when it fails.
 *   contextResolver.js  — resolve ONE person's context, in a fixed set of waves.
 *   contextCache.js     — resolve once per `cid|role` per TTL; invalidation.
 *   contextDecisions.js — the pure "may they?" surface. No DB, no session.
 *   contextAccess.js    — `can()` (fails closed) and `evaluateAuthorization()`
 *                         (fails open to a 500 decision).
 *
 * Why a facade and not a straight deletion: seven endpoint suites
 * `jest.mock("@/services/authorization/context")` and reach the routes through
 * `@/models/authorization/resolver`, which re-exports this path. Identity has
 * to survive the split, not just presence — a wrapper here would leave those
 * mocks reaching an unmocked implementation and passing for a reason nobody
 * could read. That is pinned by
 * `src/__tests__/block-p2-context-module-decisions.test.js`.
 *
 * New code imports the focused module it actually needs. This facade is deleted
 * once `grep` finds no importer — see docs/LAYER_SPLIT.md.
 */

export * from "./capabilityMerge";
export * from "./contextBootstrap";
export * from "./contextResolver";
export * from "./contextCache";
export * from "./contextDecisions";
export * from "./contextAccess";
