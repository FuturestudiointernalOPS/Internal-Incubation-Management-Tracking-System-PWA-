/**
 * ORG MEMBERSHIP QUERY DECISIONS (SERVICE layer).
 *
 * `src/app/api/org-membership/route.js` assembled its filters, walked its
 * memberships to label protected groups, and chained the lifecycle write
 * itself. Those are decisions; they move here.
 *
 * Rules, unchanged:
 *   - The WHERE fragment is built from the filters present, in a fixed order
 *     (group, then user), with the args aligned to the predicates. No filter
 *     means NO `WHERE` clause at all, not `WHERE 1=1`.
 *   - The group filter is NORMALIZED before it reaches SQL, so `future studio`
 *     and `FUTURE STUDIO` are the same group.
 *   - History is opt-in and reuses the SAME filters on the event alias.
 *   - The protected flag is per group and read in ONE statement for the whole
 *     set. A group with no row in `groups` is not protected.
 *   - The lifecycle chain: an existing membership is UPDATED (never re-inserted,
 *     never duplicated), a missing one may only be `joined`. Only an insert
 *     syncs `user_groups`, because that is where the edge is created.
 */

import {
  normalizeGroupName,
  getProtectedGroupFlags,
} from "@/models/authorization/membership";

/**
 * Builds the WHERE fragment and args for a membership listing.
 *
 * @param {{group?: string|null, userCid?: string|null}} filters
 * @param {string} [alias] the table alias to qualify the columns with
 * @returns {{whereSql: string, args: Array}} `whereSql` is "" when unfiltered
 */
export function buildMembershipFilter(filters, alias = "gm") {
  const where = [];
  const args = [];

  if (filters.group) {
    where.push(`${alias}.group_name = ?`);
    args.push(normalizeGroupName(filters.group));
  }
  if (filters.userCid) {
    where.push(`${alias}.user_cid = ?`);
    args.push(filters.userCid);
  }

  return {
    whereSql: where.length ? `WHERE ${where.join(" AND ")}` : "",
    args,
  };
}

/**
 * The protected-group flags for a set of membership rows, keyed by the
 * `group_name` AS STORED on each row — the UI reads those keys verbatim, so a
 * case-variant row keeps its own key even though it resolves to the same
 * normalized group.
 *
 * @param {Array<{group_name: string}>} memberships
 * @returns {Promise<Object<string, boolean>>}
 */
export async function resolveProtectedGroupFlags(memberships) {
  const rows = memberships || [];
  if (rows.length === 0) return {};

  const flags = await getProtectedGroupFlags(rows.map((row) => row.group_name));

  const protectedGroups = {};
  for (const row of rows) {
    // A normalized group with no row in `groups` is simply not protected.
    protectedGroups[row.group_name] = flags[normalizeGroupName(row.group_name)] === true;
  }
  return protectedGroups;
}

/**
 * The membership lifecycle chain: which write does an action produce, and when
 * is the request invalid because there is nothing to act on.
 *
 * @param {object|null} current the existing membership row, or null
 * @param {string} action normalized action
 * @returns {{ok: true, operation: "insert"|"update"} | {ok: false, error: string}}
 */
export function resolveMembershipOperation(current, action) {
  if (!current && action !== "joined") {
    return { ok: false, error: "errors.membershipNotFound" };
  }
  return { ok: true, operation: current ? "update" : "insert" };
}

/**
 * Parses an optional expiry date.
 *
 * @param {string|null|undefined} raw
 * @returns {{status: "absent"} | {status: "absent"} | {status: "invalid"} | {status: "ok", date: Date}}
 *   `absent` (null, undefined, "") means "no expiry" and is never an error;
 *   `invalid` is a caller error. The distinction matters: an empty string is a
 *   deliberate "no expiry", not a malformed date.
 */
export function parseMembershipExpiry(raw) {
  if (raw === null || raw === undefined || raw === "") return { status: "absent" };
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return { status: "invalid" };
  return { status: "ok", date };
}