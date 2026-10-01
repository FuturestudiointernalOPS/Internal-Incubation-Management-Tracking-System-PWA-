/**
 * services/investor — the investor-portal SERVICE layer.
 *
 * Use-case and decision code for the investor surfaces. It reads and writes
 * through `@/models/investor` (the repository layer) and never runs SQL itself
 * (enforced by `src/__tests__/server/services-boundaries.test.js`).
 *
 *   diligence.js — the due-diligence workspace and its action dispatch
 *   campaigns.js — the fundraising campaigns (scope, matching, milestones)
 *   pipeline.js  — the investment pipeline (scope, stages, invested cascade)
 *   relationships.js — the relationship workspaces (scope, create/update cascade)
 *   relationshipMeetings.js — a workspace's meetings (scope, completion cascade)
 *   evaluation.js — founder evaluations and risk assessments (scope, type dispatch)
 *   decisions.js — the investment decisions (profile, types, stage mapping)
 *   organizations.js — the investor organizations (member/organization scope)
 *   watchlist.js — the watchlist toggle
 *   preferences.js — the investment preferences (profile guard)
 *   meetings.js — the investor meetings (venture-required read, schedule)
 *   dashboard.js — the personalized dashboard (recommendation scoring)
 *   setupPassword.js — the investor password setup (token + expiry)
 *   executiveDashboard.js — the executive dashboard aggregation
 *   adminOverview.js — the admin overview aggregation
 */

export * from "./diligence";
export * from "./campaigns";
export * from "./pipeline";
export * from "./relationships";
export * from "./relationshipMeetings";
export * from "./evaluation";
export * from "./decisions";
export * from "./organizations";
export * from "./watchlist";
export * from "./preferences";
export * from "./meetings";
export * from "./dashboard";
export * from "./setupPassword";
export * from "./executiveDashboard";
export * from "./adminOverview";
