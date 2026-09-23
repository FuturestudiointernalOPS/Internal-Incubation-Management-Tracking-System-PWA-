/**
 * server/auth — session lifecycle.
 *
 * Creates, reads and destroys the server-side session record behind the cookie.
 * All SQL lives in `@/models/sessions`; this module owns the *policy*:
 *
 *   - at most two live sessions per user (creating a third evicts the oldest);
 *   - the cookie carries an opaque token, the database stores only its hash;
 *   - a token is resolved once per in-flight window and cached briefly, because
 *     one page load fires several requests that all ask the same question;
 *   - a database outage is remembered for a few seconds so a paused database
 *     turns into fast failures instead of a queue of 30-second waits;
 *   - a session whose user standing was revoked is simply not served. It is
 *     never deleted on the read path — that would turn a rejected account into
 *     a login loop.
 */

import { initDb } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";
import { hashToken, ensureTokenHashColumns } from "@/lib/token-hashing";
import { deriveLegacyRoleEnabled, deriveLegacyRole } from "@/lib/identity";
import {
  listSessionsForUser,
  deleteSessionById,
  insertSession,
  findSessionByTokenHash,
  findSessionByToken,
  backfillSessionTokenHash,
  deleteSessionByTokenOrHash,
  ensureImpersonationColumn,
} from "@/models/sessions";
import {
  readSessionToken,
  clearSessionCookie,
  sessionMaxAgeSeconds,
  sessionDurationMs,
} from "./cookies";

const SESSION_CACHE_TTL = 15000; // 15s — a page's burst of getSession() calls hits the cache
const _sessionCache = new Map();

// Reads that are currently in flight, keyed by token. A page load fires several
// requests at once, and on a cold cache they all miss `_sessionCache` in the
// same instant — each would then issue the SAME session select in parallel
// (observed as a burst of identical slow queries). The first caller performs the
// read; the others await its result instead of duplicating it.
const _sessionInflight = new Map();

const _failureCache = new Map(); // Cache DB failures to avoid cascading timeouts
const FAILURE_CACHE_TTL = 5000; // If DB fails, don't retry for 5s (avoids 30s lockouts on transient errors)

// Hard cap on the in-memory session cache so a warm serverless instance that
// rotates many tokens cannot grow the Map unboundedly. Simple LRU: when full,
// evict the oldest entry. Purely a memory bound — never changes which sessions
// are valid, only how many are kept warm between requests.
const SESSION_CACHE_MAX = 5000;

/** `expires_at` as the database column expects it: 'YYYY-MM-DD HH:MM:SS'. */
function toSqlTimestamp(date) {
  return date.toISOString().replace("T", " ").replace("Z", "");
}

/**
 * Creates a new session for a user.
 * Stores session in database and returns the token and maxAge.
 * The caller is responsible for setting the cookie on the response.
 */
export async function createSession(userCid, userRole, rememberMe = false, isImpersonation = false) {
  await initDb();
  await ensureTokenHashColumns();

  // PHASE I2 (transitional, flag-gated): when the stored role is a baseline
  // (member) and legacy-role derivation is enabled, derive the session role
  // from memberships so legacy gates keep working AFTER contacts.role stops
  // being mutated on context joins. Baseline stays untouched in the DB.
  if (deriveLegacyRoleEnabled() && userRole === "member") {
    try {
      const { hasActiveParticipantProgram, isActiveVentureOwner } = await import("@/models/authorization/membership");
      const [inProgram, ownsVenture] = await Promise.all([
        hasActiveParticipantProgram(userCid),
        isActiveVentureOwner(userCid),
      ]);
      const derived = deriveLegacyRole({
        storedRole: userRole,
        hasActiveParticipantProgram: inProgram,
        isActiveVentureOwner: ownsVenture,
      });
      if (derived !== userRole) {
        console.log("[session] createSession — derived legacy role:", userRole, "→", derived, "(cid:", userCid, ")");
        userRole = derived;
      }
    } catch (error) {
      console.error("[session] legacy-role derivation failed (falling back to stored role):", error.message);
    }
  }

  const token = uuidv4();
  const expiresAtStr = toSqlTimestamp(new Date(Date.now() + sessionDurationMs(rememberMe)));

  console.log(
    "[session] createSession — cid:",
    userCid,
    "role:",
    userRole,
    "impersonation:",
    isImpersonation,
    "expires:",
    expiresAtStr,
  );

  // Enforce max 2 concurrent sessions — if already 2, remove the oldest
  const existing = await listSessionsForUser(userCid);
  if (existing.rows.length >= 2) {
    const toRemove = existing.rows.length - 1; // keep 1, we'll add 1 more = 2 total
    for (let i = 0; i < toRemove; i++) {
      await deleteSessionById(existing.rows[i].id);
    }
  }

  // Create new session
  const tokenHash = hashToken(token);
  await ensureSessionColumns();
  await insertSession({
    token,
    tokenHash,
    userCid,
    role: userRole,
    expiresAt: expiresAtStr,
    isImpersonation,
  });

  return { token, maxAge: sessionMaxAgeSeconds(rememberMe), isImpersonation };
}

/**
 * Validates a session and returns user info.
 * Reads the session token from the HTTP-only cookie.
 */
export async function getSession() {
  try {
    // Global failure cache: if DB was down in the last 30s, short-circuit immediately
    if (_failureCache.has("db_down")) {
      console.log("[session] DB failure cache active, skipping query");
      return null;
    }

    await initDb();
    await ensureTokenHashColumns();

    const token = await readSessionToken();

    if (!token) {
      console.log("[session] No cookie found");
      return null;
    }

    // In-memory cache: avoid re-querying DB for the same token within the TTL
    const cacheKey = token;
    const cached = _sessionCache.get(cacheKey);
    if (cached && cached.expires > Date.now()) {
      return cached.session;
    }

    // Share one read between callers that arrive before it resolves.
    const inflight = _sessionInflight.get(cacheKey);
    if (inflight) return inflight;

    const pending = readSessionFromToken(token)
      .then((session) => {
        if (session) cacheSession(cacheKey, session);
        return session;
      })
      .finally(() => {
        if (_sessionInflight.get(cacheKey) === pending) {
          _sessionInflight.delete(cacheKey);
        }
      });

    _sessionInflight.set(cacheKey, pending);
    return await pending;
  } catch (error) {
    console.error("Session validation error:", error.message);
    // Cache failure to prevent cascading timeouts (e.g., Supabase paused)
    _failureCache.set("db_down", Date.now() + FAILURE_CACHE_TTL);
    setTimeout(() => _failureCache.delete("db_down"), FAILURE_CACHE_TTL);
    return null;
  }
}

/** Store a resolved session in the bounded cache (evict oldest when over cap). */
function cacheSession(token, session) {
  _sessionCache.set(token, {
    session,
    expires: Date.now() + SESSION_CACHE_TTL,
  });
  if (_sessionCache.size > SESSION_CACHE_MAX) {
    const oldestKey = _sessionCache.keys().next().value;
    if (oldestKey !== undefined) _sessionCache.delete(oldestKey);
  }
}

/**
 * The actual session read: look the cookie token up (by hash first, then by
 * plaintext for legacy rows), enforce user standing, and return the session
 * shape — or null when the token is unknown, expired or rejected.
 *
 * Called at most once per token per in-flight window; the result is cached by
 * the caller.
 */
async function readSessionFromToken(token) {
  const tokenHash = hashToken(token);

  // Look up by token_hash FIRST so the unique partial index is used. The old
  // `token_hash = ? OR token = ?` defeated the index → sequential scan (~1–2s).
  // Legacy rows without a hash fall back to the plaintext token (PK-indexed).
  let result = await findSessionByTokenHash(tokenHash);
  if (result.rows.length === 0) {
    result = await findSessionByToken(token);
  }

  if (result.rows.length === 0) {
    console.log("[session] Token not in DB or expired");
    return null;
  }

  console.log("[session] Session FOUND in DB");

  const session = result.rows[0];

  // Lazily backfill the hash for legacy sessions stored before hashing was added.
  if (session && !session.token_hash) {
    backfillSessionTokenHash(tokenHash, token).catch(() => {});
  }

  // Check user standing
  const allowedStatuses = ["active", "approved"];
  if (
    session.status &&
    !allowedStatuses.includes(session.status) &&
    session.role !== "super_admin"
  ) {
    console.log(
      "[session] User status rejected:",
      session.status,
      "role:",
      session.role,
    );
    // NOTE: never destroy the session on the READ path — destroying here turns
    // a bad status into a login loop (login creates a session, the next request
    // deletes it). The session simply expires naturally. A rejected session is
    // never cached (this read completes before the caller caches it).
    return null;
  }

  return {
    cid: session.user_cid,
    name: session.name,
    email: session.email,
    role: session.role,
    group_name: session.group_name,
    token: session.token,
    is_impersonation: session.is_impersonation === true,
  };
}

/**
 * Idempotent self-heal for the session columns this module writes, so an
 * environment whose schema predates them does not fail the login path.
 */
let ensureSessionColumnsPromise = null;
function ensureSessionColumns() {
  if (!ensureSessionColumnsPromise) {
    ensureSessionColumnsPromise = ensureImpersonationColumn().catch((error) => {
      console.warn("[session] ensureSessionColumns skipped:", error.message);
      ensureSessionColumnsPromise = null;
    });
  }
  return ensureSessionColumnsPromise;
}

/**
 * Destroys the current session (logout).
 */
export async function destroySession() {
  try {
    await initDb();

    const token = await readSessionToken();

    if (token) {
      // Never serve a session we just destroyed — drop the cached copy AND any
      // read that is still in flight (it must not re-cache the dead session).
      _sessionCache.delete(token);
      _sessionInflight.delete(token);
      await deleteSessionByTokenOrHash(hashToken(token), token);
      // Immediately evict the cached session so a just-logged-out token cannot
      // be re-validated from the in-memory cache for the remaining TTL.
      _sessionCache.delete(token);
    }

    await clearSessionCookie();
  } catch (error) {
    console.error("Session destruction error:", error);
  }
}
