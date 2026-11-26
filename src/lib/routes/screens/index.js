/**
 * The address catalogue — one entry per SCREEN, one screen per address.
 *
 * A screen row says:
 *   id      — the stable identifier a link uses (`path(id, params)`).
 *   role    — member | staff | admin.
 *   context — what the owner does there, or null for the space's core screens.
 *   feature — the screen inside that context, or null for the context's home.
 *   path    — the canonical address (may contain `[param]` placeholders).
 *   tab     — the view behind `?tab=` when the screen is one view of a record.
 *   query   — extra query parameters carried with the address.
 *   legacy  — addresses that still answer to this screen.
 *   pending — the move has NOT happened: the first legacy address still serves
 *             its own page and nothing redirects. Removing it is the last step
 *             of a move (see docs/ADDRESS_CONTRACT.md).
 *
 * The files are split by area so two people can work side by side without
 * touching the same list: member, staff, admin (everything except the venture
 * hub), adminVentures (the hub and its record views).
 */

import { MEMBER_SCREENS } from "./member.js";
import { STAFF_SCREENS } from "./staff.js";
import { ADMIN_SCREENS } from "./admin.js";
import { ADMIN_VENTURE_SCREENS } from "./adminVentures.js";

/** The catalogue, in one list. Order is cosmetic: ids are the identity. */
export const SCREENS = [
  ...MEMBER_SCREENS,
  ...STAFF_SCREENS,
  ...ADMIN_SCREENS,
  ...ADMIN_VENTURE_SCREENS,
];

/** By id — the lookup every link uses. */
export const SCREENS_BY_ID = new Map(SCREENS.map((screen) => [screen.id, screen]));

/** The per-area lists, kept addressable so a move can be reviewed alone. */
export const SCREEN_GROUPS = {
  member: MEMBER_SCREENS,
  staff: STAFF_SCREENS,
  admin: ADMIN_SCREENS,
  adminVentures: ADMIN_VENTURE_SCREENS,
};

export { MEMBER_SCREENS, STAFF_SCREENS, ADMIN_SCREENS, ADMIN_VENTURE_SCREENS };
