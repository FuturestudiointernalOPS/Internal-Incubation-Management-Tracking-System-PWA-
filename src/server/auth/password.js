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
