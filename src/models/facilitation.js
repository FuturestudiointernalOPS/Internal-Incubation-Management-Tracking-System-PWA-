/**
 * Facilitation model — data access for the facilitation & evaluation controllers.
 *
 * This file is a thin BARREL over cohesive modules in the sibling
 * `models/facilitation/` folder (the split convention: `x.js` + `x/`):
 *
 *   invites.js      — the facilitator invite flow (contacts, program staff,
 *                     contact roles, setup tokens, CRM timeline entries)
 *   reviews.js      — facilitator reviews: listing, resubmission reset, PM decision
 *   evaluation.js   — program grading-mode / evaluation-config reads and writes
 *   attendance.js   — the attendance table self-heal, mark upserts and summaries
 *   feedback.js     — weekly participant feedback create/listing
 *   deliverables.js — program deliverable create/listing
 *
 * Each function wraps exactly one SQL statement. SQL is byte-identical to the
 * queries that used to live inline in the controllers, so behavior is unchanged.
 *
 * Route → function map:
 *   src/app/api/facilitators/invite-bulk/route.js → invites.js
 *   src/app/api/facilitator-reviews/route.js      → reviews.js
 *   src/app/api/evaluation/route.js               → evaluation.js
 *   src/app/api/attendance/route.js               → attendance.js
 *   src/app/api/feedback/route.js                 → feedback.js
 *   src/app/api/deliverables/route.js             → deliverables.js
 *
 * Model-layer rules (see docs/MVC_REFACTOR.md):
 *  - No HTTP / Next.js imports here — only the db engine (in the modules).
 *  - One function per query, named after the data it returns.
 */

export * from "./facilitation/invites";
export * from "./facilitation/reviews";
export * from "./facilitation/evaluation";
export * from "./facilitation/attendance";
export * from "./facilitation/feedback";
export * from "./facilitation/deliverables";
