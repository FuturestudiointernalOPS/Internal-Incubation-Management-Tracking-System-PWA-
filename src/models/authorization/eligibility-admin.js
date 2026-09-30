/**
 * COMPATIBILITY FACADE — eligibility administration moved to the service layer.
 *
 * This module held the eligibility-configuration vocabulary and validators, but
 * it also ran three SQL statements — and reached into the eligibility decision
 * from the model layer. The vocabulary and validators now live in
 * `@/services/authorization/eligibilityAdmin`, its statements in
 * `@/models/authorization/eligibilityAdminReads` (plus the shared eligibility-row
 * read in `./contextReads`).
 *
 * Re-exported unchanged so existing importers (routes via `@/lib/authorization`,
 * and `ui4-contexts.test.js` which imports this path directly) keep working.
 * Deleted once `grep` finds no importer — see docs/LAYER_SPLIT.md.
 */

export * from "@/services/authorization/eligibilityAdmin";
