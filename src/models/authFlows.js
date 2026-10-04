/**
 * Auth flows model — data access for the `/api/auth/*` controllers
 * (`session-login`, `login`, `invite`, `activate`,
 * `invite-family`, `forgot-password`, `setup-password`,
 * `reset-password`, `resend-invite`, `language`).
 *
 * This file is a thin BARREL over cohesive modules in the sibling
 * `models/authFlows/` folder (the split convention: `x.js` + `x/`):
 *
 *   sessionLogin.js  — the session-login identity searches + self-heal
 *   login.js         — the legacy login identity searches + self-heal
 *   invite.js        — new invite / resend-invite contact + token writes
 *   activate.js      — the activation invite read + account activation writes
 *   familyInvite.js  — the invite-family program gate and participant writes
 *   passwordReset.js — forgot/setup/reset password token + credential writes
 *   resendInvite.js  — the resend-invite contact read and token re-issue
 *   account.js       — language preference and revoke-access writes
 *
 * Each function wraps exactly one SQL statement that used to live inline in the
 * controller. SQL is byte-identical to the original queries, so behavior is
 * unchanged. Statements several controllers run with identical SQL are
 * mirrored 1:1 here — one exported function per former call site.
 *
 * Model-layer rules (see docs/MVC_REFACTOR.md):
 *  - No HTTP / Next.js imports here — only the db engine.
 *  - One function per query, named after the data it returns.
 *  - Session mechanics (`createSession`/`getSession` from `@/server/auth`),
 *    bcrypt hashing, emails and audit logging stay in the controllers.
 */

export * from "./authFlows/sessionLogin";
export * from "./authFlows/login";
export * from "./authFlows/invite";
export * from "./authFlows/activate";
export * from "./authFlows/familyInvite";
export * from "./authFlows/passwordReset";
export * from "./authFlows/resendInvite";
export * from "./authFlows/account";

// The V2 invite helpers that used to end this file (create/list/validate the
// legacy invitation row, and the contact + v2_participants writes performed while
// accepting one) were removed together with their only callers, the two routes
// under src/app/api/v2/invites. Nothing referenced them once those routes went,
// and one of them rewrote contacts.role unconditionally — a contextual flow
// mutating the baseline identity. The live invitation path is
// src/app/api/invites -> src/models/groups.js. See docs/AUTHZ_CURRENT_STATE.md
// section 12.6.1.
