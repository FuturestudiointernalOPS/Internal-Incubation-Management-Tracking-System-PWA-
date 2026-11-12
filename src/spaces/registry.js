/**
 * ImpactOS — the THREE spaces.
 *
 * A SPACE is where a kind of person works. There are exactly three:
 *
 *   member — a person acting in their own programmes, ventures and learning
 *   staff  — an internal function (operations, programme management, finance, CRM)
 *   admin  — the platform owner
 *
 * Within a space, a CONTEXT is what that person is or does there (founder,
 * learner, venture member, programme manager, lead manager…). Contexts are
 * CUMULATIVE: one person holds several at once, and each adds its own screens
 * and doors. A space is exclusive: an identity belongs to exactly one.
 *
 * This module is the single answer to "which space is this identity in?" and
 * "where do they land?". The section guards and the navigation read it here
 * instead of keeping private lists that drift apart.
 *
 * ── Transitional note ───────────────────────────────────────────────────────
 * `OPERATING_DENIED` is narrower than the `member` space on purpose: facilitator
 * and team accounts already keep a working operating shell today, so they are
 * turned away only once the member space ships its own screens for them. Until
 * then the guard behaves exactly as before — the list simply lives here now.
 */

import { normalizeRole } from "@/lib/identity";

export const SPACE_KEYS = ["member", "staff", "admin"];

export const SPACES = {
  member: {
    key: "member",
    home: "/member",
    identities: ["member", "participant", "founder", "investor", "facilitator", "team"],
  },
  staff: {
    key: "staff",
    home: "/staff",
    identities: ["staff", "program_manager", "finance", "crm"],
  },
  admin: {
    key: "admin",
    home: "/admin",
    identities: ["super_admin"],
  },
};

/**
 * Identities that must not enter an OPERATING section (staff, admin).
 *
 * Kept as its own list rather than derived from `SPACES.member.identities` so
 * widening the space (facilitator, team) does not silently change what a guard
 * refuses. See the transitional note above.
 */
export const OPERATING_DENIED = ["member", "participant", "founder", "investor"];

/** Every identity → its space key, built once from `SPACES`. */
const IDENTITY_SPACE = (() => {
  const map = {};
  for (const key of SPACE_KEYS) {
    for (const identity of SPACES[key].identities) map[normalizeRole(identity)] = key;
  }
  return map;
})();

/** Which space an identity belongs to, or `null` for an unknown value. */
export function spaceForRole(role) {
  return IDENTITY_SPACE[normalizeRole(role)] || null;
}

/** Whether a space is an OPERATING one (staff or admin). */
export function isOperatingSpace(space) {
  return space === "staff" || space === "admin";
}

/**
 * Whether this identity must be kept out of an operating section.
 *
 * A platform owner is never turned away. An unknown role is not turned away
 * either: the section renders as before until the session answers, and the API
 * remains the authority.
 */
export function isDeniedInOperatingSpace(role) {
  const normalized = normalizeRole(role);
  if (!normalized) return false;
  if (spaceForRole(normalized) === "admin") return false;
  return OPERATING_DENIED.includes(normalized);
}

/** The default landing page for an identity, or `null` when it has none. */
export function spaceHomeForRole(role) {
  const space = spaceForRole(role);
  return space ? SPACES[space].home : null;
}
