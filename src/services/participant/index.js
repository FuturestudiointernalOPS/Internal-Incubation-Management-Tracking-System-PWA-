/**
 * services/participant — the participant-portal SERVICE layer.
 *
 * Use-case and decision code for the participant-facing portal. It reads and
 * writes through `@/models/**` (the repository layer) and never runs SQL itself
 * (enforced by `src/__tests__/server/services-boundaries.test.js`).
 *
 *   assignments.js — the submission assignments and their version history
 *   home.js        — the participant home dashboard (metrics, action centre,
 *                    calendar)
 *   progress.js    — the participant progress report (per-program metrics,
 *                    milestones, history, overall)
 *   followups.js   — the participant follow-up meetings (merged, shaped)
 *   fullState.js   — the full participant state bundle (access, cid, grades)
 *   rituals.js     — the weekly rituals (check-in, stand-up, retro, reflection)
 *   timeline.js    — the self timeline page size
 *   submissions.js — participant / team submissions (access + view-only gate)
 */

export * from "./assignments";
export * from "./home";
export * from "./progress";
export * from "./followups";
export * from "./fullState";
export * from "./rituals";
export * from "./timeline";
export * from "./submissions";
