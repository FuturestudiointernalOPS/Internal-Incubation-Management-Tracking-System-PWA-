/**
 * Projects model — data access for the project controllers:
 * `src/app/api/projects/route.js`, `src/app/api/admin/projects/route.js`,
 * `src/app/api/admin/projects/[id]/route.js`,
 * `src/app/api/admin/projects/[id]/approvals/route.js`,
 * `src/app/api/admin/projects/[id]/updates/route.js`, and
 * `src/app/api/admin/projects/[id]/reports/generate/route.js`.
 *
 * This file is a thin BARREL over cohesive modules in the sibling
 * `models/projects/` folder (the split convention: `x.js` + `x/`):
 *
 *   core.js      — project lifecycle writes and the lead-member sync
 *   reads.js     — the project list and its lookup reads
 *   admin.js     — the Super Admin project list and per-project detail reads
 *   approvals.js — contribution approval reads, decisions and notifications
 *   updates.js   — the weekly project updates (list, upsert check, write)
 *   reports.js   — the auto-generated weekly report reads and update writes
 *
 * Each function wraps exactly one SQL statement. SQL is byte-identical to the
 * queries that used to live inline in the controllers, so behavior is unchanged.
 *
 * Model-layer rules (see docs/MVC_REFACTOR.md):
 *  - No HTTP / Next.js imports here — only the db engine.
 *  - One function per query, named after the data it returns.
 */

export * from "./projects/core";
export * from "./projects/reads";
export * from "./projects/admin";
export * from "./projects/approvals";
export * from "./projects/updates";
export * from "./projects/reports";
