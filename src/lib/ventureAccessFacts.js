/**
 * WHAT EVERY SCREEN ASKS ABOUT A VENTURE — asked once, answered to all.
 *
 * A round trip to the database costs ~185 ms (measured on the current link), so
 * when four screens of the same page each ask the same two questions, they pay
 * that cost four times. Two questions are asked from everywhere in the Venture
 * workspace:
 *
 *   • the Venture itself — its code, its lifecycle state (layer 1, viewer-free);
 *   • the viewer's relationship to it — member? delegated staff? (layer 2).
 *
 * Both are answered here, once per window, and shared by every caller in the
 * process. Three properties are deliberate:
 *
 *   • the PROMISE is cached, not the resolved value, so screens that ask at the
 *     same moment share one query instead of racing four identical ones — which
 *     is exactly what a page loading its tabs in parallel does;
 *   • a FAILED query is never remembered: an outage must not become a cached
 *     refusal that locks someone out of their own Venture for the window;
 *   • the window is SHORT (10 s, `VENTURE_ACCESS_CACHE_TTL_MS`) because a
 *     remembered answer is a remembered permission. The paths that remove or
 *     grant access call `invalidateVentureAccess` so the ordinary case is
 *     immediate; anything else is bounded by the window, which is the backstop.
 *     Covered today: a member removed or edited from the roster, and a staff
 *     assignment created. An assignment closed from the responsibilities screen
 *     cannot name its Venture, so it leans on the window.
 */

const DEFAULT_TTL_MS = 10_000;

/** Bounded, so a long-lived process cannot grow this without limit. */
const MAX_ENTRIES = 500;

const ttlMs = () => {
  const raw = Number(process.env.VENTURE_ACCESS_CACHE_TTL_MS);
  return Number.isFinite(raw) && raw >= 0 ? raw : DEFAULT_TTL_MS;
};

/** key → { promise, at } — the promise, so concurrent callers share one query. */
const ventureLayer = new Map();
const relationshipLayer = new Map();

const read = (cache, key) => {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.at >= ttlMs()) {
    cache.delete(key);
    return null;
  }
  return entry.promise;
};

const write = (cache, key, promise) => {
  if (cache.size >= MAX_ENTRIES) {
    // A Map iterates in insertion order: the first key is the oldest.
    const oldest = cache.keys().next();
    if (!oldest.done) cache.delete(oldest.value);
  }
  cache.set(key, { promise, at: Date.now() });
};

/** Cache the promise for `load()`, but never cache the failure of one. */
const remember = (cache, key, load) => {
  const cached = read(cache, key);
  if (cached) return cached;
  const promise = load().catch((error) => {
    cache.delete(key); // a failure is not an answer
    throw error;
  });
  write(cache, key, promise);
  return promise;
};

/** A Venture is reachable by its human code (VNT-…) or by its internal id. */
const looksLikeUuid = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(String(value || ""));

/**
 * The Venture's own row: its code and lifecycle state, in one round trip.
 * `null` when no such Venture exists.
 */
export function getVentureFacts(ventureId, db) {
  const key = String(ventureId || "").trim();
  if (!key) return Promise.resolve(null);
  return remember(ventureLayer, key, async () => {
    // Either predicate uses its own index; a cast (id::text) would not.
    const column = looksLikeUuid(key) ? "id" : "venture_id";
    const result = await db.execute({
      sql: `SELECT venture_id AS code, status, is_archived FROM ventures WHERE ${column} = ? LIMIT 1`,
      args: [key],
    });
    return result.rows?.[0] || null;
  });
}

/**
 * The viewer's relationship to one Venture, in one round trip: both facts in a
 * single statement, so the two questions that decide access stop costing two
 * round trips.
 */
export function getViewerRelationship(ventureCode, cid, db) {
  const key = String(ventureCode || "").trim();
  const viewer = String(cid || "").trim();
  if (!key || !viewer) {
    return Promise.resolve({ is_member: false, is_assigned: false });
  }
  return remember(relationshipLayer, `${key}|${viewer}`, async () => {
    const result = await db.execute({
      sql: `SELECT
              EXISTS (SELECT 1 FROM venture_members m
                      WHERE m.venture_id = ? AND m.contact_id = ? AND m.removed_at IS NULL) AS is_member,
              EXISTS (SELECT 1 FROM venture_staff_assignments a
                      WHERE a.venture_id = ? AND a.staff_contact_id = ? AND a.status = 'active') AS is_assigned`,
      args: [key, viewer, key, viewer],
    });
    const row = result.rows?.[0] || {};
    return { is_member: row.is_member === true, is_assigned: row.is_assigned === true };
  });
}

/**
 * Everything an access decision needs, cheapest first: the Venture's facts give
 * the code the relationship is stored under.
 */
export async function ventureAccessFacts(ventureId, cid, db) {
  const facts = await getVentureFacts(ventureId, db);
  if (!facts) return { facts: null, relationship: { is_member: false, is_assigned: false } };
  const relationship = await getViewerRelationship(facts.code, cid, db);
  return { facts, relationship };
}

/**
 * Forget what was remembered about a Venture — call it from the paths that
 * change membership or assignments, so a removed person loses the answer they
 * had without waiting for the window. Accepts the code or the internal id; the
 * relationship entries are stored under the code, so a removal by id relies on
 * the window (which only ever keeps an answer that was true moments before).
 */
export function invalidateVentureAccess(ventureId) {
  const key = String(ventureId || "").trim();
  if (!key) return;
  ventureLayer.delete(key);
  relationshipLayer.delete(key);
  for (const cacheKey of [...relationshipLayer.keys()]) {
    if (cacheKey.startsWith(`${key}|`)) relationshipLayer.delete(cacheKey);
  }
}

/** Tests only: a fresh process has empty layers, a re-run of the suite does not. */
export function resetVentureAccessCache() {
  ventureLayer.clear();
  relationshipLayer.clear();
}

export default {
  getVentureFacts,
  getViewerRelationship,
  ventureAccessFacts,
  invalidateVentureAccess,
  resetVentureAccessCache,
};
