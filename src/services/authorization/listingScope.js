/**
 * Authorization — listing scope (SERVICE layer).
 *
 * A decision that recurs across every "list my X" endpoint: which callers may
 * look at somebody else's rows, and which are pinned to their own. Asking for
 * another person's rows without the cross-person right is refused rather than
 * silently ignored.
 *
 * WHO may look at other people's rows is a RIGHT, resolved by the domain before
 * it calls here (`tasks.act_any`, `tasks.view_all`, `projects.view_all`). This
 * module therefore takes the verdict and no longer reads a role: an absent
 * verdict is a closed scope — fail closed, never "this role probably meant it".
 *
 * It lives here, in the authorization decision layer, because it is a "may
 * they?" question — and once, so the rule cannot drift between endpoints.
 *
 * Layer (see docs/LAYER_SPLIT.md): a pure decision — no SQL, no HTTP.
 */

/**
 * Resolve a caller's own-scope filter for a listing endpoint.
 *
 * @param {Object} args
 * @param {string} args.sessionCid        the caller's own id
 * @param {string|null} args.requestedCid the id the caller asked for (or null)
 * @param {string} args.denialMessage     the refusal to return when refused
 * @param {boolean} args.seesAll          the resolved cross-person verdict
 * @returns {{cid?: string|null, denied?: string}}
 *   `cid` is the id to filter on — null means "no filter" for a cross-person
 *   caller; `denied` is set when a caller without the right asked for someone
 *   else.
 */
export function resolveListingScope({
  sessionCid,
  requestedCid,
  denialMessage,
  seesAll,
}) {
  if (seesAll === true) {
    return { cid: requestedCid };
  }
  if (requestedCid && String(requestedCid) !== String(sessionCid)) {
    return { denied: denialMessage };
  }
  return { cid: requestedCid || sessionCid };
}
