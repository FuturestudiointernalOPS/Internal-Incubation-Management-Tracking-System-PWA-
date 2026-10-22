/**
 * server/auth — password.
 *
 * The single seam between the application and the hashing algorithm. Routes and
 * models call these two functions instead of importing `bcryptjs`, so the work
 * factor and the algorithm can be changed in one place — and so a review starts
 * from a complete list of every place a password is handled.
 *
 * `verifyPassword` deliberately does not catch: a malformed stored hash is a
 * data problem that must surface, not be reported to the user as a bad
 * password.
 */

import bcrypt from "bcryptjs";

/** Cost factor for new hashes. Raising it invalidates nothing: old hashes still verify. */
export const PASSWORD_HASH_ROUNDS = 10;

export async function hashPassword(plainPassword, { rounds = PASSWORD_HASH_ROUNDS } = {}) {
  return bcrypt.hash(plainPassword, rounds);
}

export async function verifyPassword(plainPassword, passwordHash) {
  return bcrypt.compare(plainPassword, passwordHash);
}

/**
 * True when a STORED credential value is a legacy clear-text password (i.e. not
 * a bcrypt hash). Vacuously false for empty / missing values.
 */
export function isLegacyClearPassword(stored) {
  return typeof stored === "string" && stored.length > 0 && !stored.startsWith("$2");
}

/**
 * Verify a candidate against a STORED value, upgrading a legacy clear-text
 * value to a bcrypt hash on the spot (SECRET-1).
 *
 *  - a bcrypt hash is verified normally;
 *  - a legacy clear-text row is accepted ONCE and, when an `upgrade` callback is
 *    supplied, immediately replaced by a hash so the clear value never survives
 *    another login;
 *  - anything else is refused.
 *
 * The upgrade is best-effort: a failure to persist it never fails the login
 * (the migration script, or the next login, retries).
 */
export async function verifyPasswordOrUpgradeLegacy(candidate, stored, { upgrade } = {}) {
  if (typeof stored !== "string" || stored.length === 0) return false;
  if (stored.startsWith("$2")) return verifyPassword(candidate, stored);
  if (candidate !== stored) return false;
  if (typeof upgrade === "function") {
    try {
      await upgrade(await hashPassword(candidate));
    } catch {
      // best-effort: the login still succeeds with the legacy value this once.
    }
  }
  return true;
}
