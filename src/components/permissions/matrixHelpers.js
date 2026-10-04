/**
 * PHASE 2 — Permission Center matrix helpers.
 *
 * Pure derivation functions shared by the Defaults Matrix and the User
 * Matrix. Kept free of React/DB so the module-access rules are unit-tested:
 *
 *   - Module access is DERIVED from capabilities (never stored).
 *   - A module with zero capabilities remains visible ([—]).
 *   - `locked` modules are displayed with a lock state.
 *   - Scope is never encoded into capability names (displayed separately).
 *
 * This module is a barrel; the implementation lives in ./matrixHelpers/:
 *   featureRows.js  — feature/module grouping and section rows
 *   capabilities.js — capability levels, CRUD set and section filters
 *   toggles.js      — immutable capability toggles
 *   state.js        — effective capability state and denial reasons
 *   origins.js      — capability origin descriptors
 *   coverage.js     — hidden stored caps and person eligibility
 */

export * from "./matrixHelpers/featureRows";
export * from "./matrixHelpers/capabilities";
export * from "./matrixHelpers/toggles";
export * from "./matrixHelpers/state";
export * from "./matrixHelpers/origins";
export * from "./matrixHelpers/coverage";
