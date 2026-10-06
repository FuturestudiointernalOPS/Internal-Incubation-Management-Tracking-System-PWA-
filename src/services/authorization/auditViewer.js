/**
 * PERMISSION AUDIT VIEWER DECISIONS (SERVICE layer).
 *
 * `src/app/api/engineering/permissions/audit/route.js` assembled its own WHERE
 * clause — choosing an exact `=` or a substring `ILIKE` per field — and clamped
 * its own pagination. Those decisions move here.
 *
 * Rules, unchanged:
 *   - Some fields are EXACT (`action`, `module`, `target_cid`): "granted" must
 *     not match "granted_by_admin". Others are SUBSTRING (`actor`, `target`,
 *     `capability`): the UI filters on what somebody typed. The wildcards
 *     belong to the substring ones only.
 *   - `q` spans six columns with the SAME pattern repeated, so one search box
 *     covers actor, target, action, module, capability and details.
 *   - Every text filter is TRIMMED, and a whitespace-only value is dropped
 *     rather than turned into `% %` (which would match every row).
 *   - No filter means NO `WHERE` clause at all, never a tautology.
 *   - `from`/`to` become UTC ISO and are INCLUSIVE bounds.
 *   - `page` clamps up to 1; `pageSize` falls back to 25 when FALSY (0 or
 *     non-numeric) and otherwise clamps into [1, 100]. A negative pageSize is
 *     truthy, so it reaches the clamp and lands on 1 rather than on the
 *     default.
 *   - The count and the page share the SAME clause; only limit/offset differ,
 *     and the count runs first so `total` can never describe a later state.
 */

/** Rows per page when the caller gives nothing usable. */
export const DEFAULT_AUDIT_PAGE_SIZE = 25;
/** Hard ceiling on `pageSize`, so the viewer cannot be turned into a dump. */
export const MAX_AUDIT_PAGE_SIZE = 100;

/** Fields compared EXACTLY — an exact value must not match a longer one. */
const EXACT_FIELDS = [
  ["action", "action"],
  ["module", "module"],
  ["target_cid", "target_cid"],
];

/** Fields compared as a SUBSTRING, with the wildcards added here. */
const SUBSTRING_FIELDS = [
  ["actor", "actor_name"],
  ["target", "target_name"],
  ["capability", "capability"],
];

/** Every column the free-text `q` searches, in the order the UI documents. */
const SEARCH_COLUMNS = [
  "actor_name",
  "target_name",
  "action",
  "module",
  "capability",
  "details",
];

/**
 * Builds the WHERE fragment and args for the audit viewer.
 *
 * @param {Object<string, string>} filters raw search params, already read
 * @returns {{whereSql: string, args: Array<string>}} `whereSql` is "" when
 *   nothing filters — the query then has no WHERE clause at all.
 */
export function buildAuditFilters(filters = {}) {
  const where = [];
  const args = [];

  const searchQuery = (filters.q || "").trim();
  if (searchQuery) {
    const likePattern = `%${searchQuery}%`;
    where.push(
      `(${SEARCH_COLUMNS.map((column) => `${column} ILIKE ?`).join(" OR ")})`,
    );
    args.push(...SEARCH_COLUMNS.map(() => likePattern));
  }

  for (const [param, column] of SUBSTRING_FIELDS) {
    const value = (filters[param] || "").trim();
    if (value) {
      where.push(`${column} ILIKE ?`);
      args.push(`%${value}%`);
    }
  }

  for (const [param, column] of EXACT_FIELDS) {
    const value = (filters[param] || "").trim();
    if (value) {
      where.push(`${column} = ?`);
      args.push(value);
    }
  }

  for (const [param, operator] of [["from", ">="], ["to", "<="]]) {
    const value = (filters[param] || "").trim();
    if (value) {
      // An unparseable date THROWS here (RangeError from toISOString) and
      // becomes a 500. That is deliberate: silently dropping a bad date filter
      // would return an UNFILTERED audit log, which is the dangerous direction
      // to fail in. Turning it into a 400 is a product decision, not this
      // module's.
      where.push(`created_at ${operator} ?`);
      args.push(new Date(value).toISOString());
    }
  }

  return {
    whereSql: where.length ? `WHERE ${where.join(" AND ")}` : "",
    args,
  };
}

/**
 * Clamps the viewer's pagination.
 *
 * `parseInt(value) || DEFAULT`: a FALSY result (0, NaN) takes the default, but
 * a negative is truthy and therefore reaches the clamp.
 *
 * @param {string|null} rawPage
 * @param {string|null} rawPageSize
 * @returns {{page: number, pageSize: number, offset: number}}
 */
export function resolveAuditPagination(rawPage, rawPageSize) {
  const page = Math.max(parseInt(rawPage) || 1, 1);
  const pageSize = Math.min(
    Math.max(parseInt(rawPageSize) || DEFAULT_AUDIT_PAGE_SIZE, 1),
    MAX_AUDIT_PAGE_SIZE,
  );
  return { page, pageSize, offset: (page - 1) * pageSize };
}