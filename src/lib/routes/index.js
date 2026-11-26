/**
 * THE ADDRESS CONTRACT — the only place a page address is written down.
 *
 * Every link (menu, card, reminder, notification) asks this module for its
 * address instead of writing one, and the legacy addresses that must redirect
 * are generated from the same table. See docs/ADDRESS_CONTRACT.md.
 *
 * Vocabulary:
 *   role    — member | staff | admin          (exclusive per person)
 *   context — what the screen's owner does    (cumulative)
 *   feature — the screen inside that context
 *
 * `pending` screens are moves that have not happened yet: their first legacy
 * address still serves its own page and NOTHING redirects. When a move is
 * finished, the flag is removed and this module starts emitting the redirects
 * for every legacy address.
 */

import { SCREENS, SCREENS_BY_ID, SCREEN_GROUPS } from "./screens/index.js";

export { SCREENS, SCREENS_BY_ID, SCREEN_GROUPS };

const PARAM = /\[([^\]]+)\]/g;

/** Whether a screen's move is still pending (its target is not live yet). */
export function isPending(screen) {
  return screen?.pending === true;
}

/** Substitute `[param]` placeholders. A missing param is left untouched. */
export function fillParams(pathname, params = {}) {
  return String(pathname).replace(PARAM, (whole, name) => {
    const value = params[name];
    if (value === undefined || value === null || value === "") return whole;
    return encodeURIComponent(String(value));
  });
}

/** The address of one screen row, parameters and query included. */
export function addressOf(screen, params) {
  if (!screen) throw new Error("addressOf: no screen");
  const base = fillParams(screen.path, params);
  const query = [
    screen.tab ? `tab=${screen.tab}` : null,
    screen.query || null,
  ].filter(Boolean);
  return query.length ? `${base}?${query.join("&")}` : base;
}

/** The address of a screen by id — the call every link should make. */
export function path(id, params) {
  const screen = SCREENS_BY_ID.get(id);
  if (!screen) throw new Error(`path: unknown screen id "${id}"`);
  return addressOf(screen, params);
}

/** The row behind an id (for callers that need `tab`, `role`, …). */
export function screen(id) {
  return SCREENS_BY_ID.get(id) || null;
}

/** Every address a menu may advertise for this screen, target first. */
export function addressesOf(screen) {
  if (!screen) return [];
  return [addressOf(screen), ...(screen.legacy || [])];
}

/** `[id]` → `:id`: the pattern syntax the redirect table uses. */
export function toNextPattern(address) {
  return String(address).replace(PARAM, (_whole, name) => `:${name}`);
}

/** Deeper addresses are matched first; static before dynamic at equal depth. */
function redirectOrder(a, b) {
  const depth = (source) => source.split("/").filter(Boolean).length;
  const params = (source) => (source.match(/:/g) || []).length;
  return depth(b.source) - depth(a.source) || params(a.source) - params(b.source) ||
    a.source.localeCompare(b.source);
}

/**
 * The redirects one screen needs, once its move is finished.
 * Empty while the move is pending (the old address still serves its page).
 */
export function redirectsFor(row, { permanent = false } = {}) {
  if (!row || isPending(row) || !Array.isArray(row.legacy) || row.legacy.length === 0) {
    return [];
  }
  const destination = toNextPattern(addressOf(row));
  return row.legacy.map((legacy) => ({
    source: toNextPattern(legacy),
    destination,
    permanent,
  }));
}

/**
 * Every legacy address whose screen is no longer pending, as a Next redirect.
 * Empty until a move is finished — this is what makes P0 behaviour-neutral.
 */
export function screenRedirects({ permanent = false } = {}) {
  return SCREENS
    .flatMap((row) => redirectsFor(row, { permanent }))
    .sort(redirectOrder);
}

/** The removals still to make — the work list a move follows. */
export function pendingScreens() {
  return SCREENS.filter(isPending);
}
