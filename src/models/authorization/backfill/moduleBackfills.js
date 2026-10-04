/**
 * ImpactOS — Authorization Foundation: CAPABILITY BACKFILL
 *
 * When a role-only feature is migrated to the capability model, its current
 * role-based access must be reproduced as capability rows so no user loses
 * access (zero-loser principle). These backfills run once per process, mirroring
 * the self-healing seed pattern used elsewhere in the codebase.
 *
 * Policy: ON CONFLICT DO NOTHING — backfill only fills MISSING rows and never
 * overwrites an administrator's explicit settings (an admin who intentionally
 * lowers a level wins; missing capability fails closed).
 *
 * This file is a thin BARREL over cohesive modules in the sibling
 * `backfill/moduleBackfills/` folder (the `x.js` + `x/` convention), grouped by
 * the phase/domain each backfill belongs to:
 *
 *   contentBackfills.js  — knowledge, reports, announcements, forms
 *   workBackfills.js     — runs, projects, tasks
 *   programBackfills.js  — programs, ventures
 *   investorBackfills.js — the investor portal
 */

export * from "./moduleBackfills/contentBackfills";
export * from "./moduleBackfills/workBackfills";
export * from "./moduleBackfills/programBackfills";
export * from "./moduleBackfills/investorBackfills";
