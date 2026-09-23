/**
 * Shared team credentials (the team username and password every member of a team
 * uses to log in) are MANAGEMENT data. A read that is visible to a delegated,
 * non-management caller — an assignment holder, or a team reading its own row —
 * must not carry them.
 *
 * This also owns their GENERATION. A team password is a shared login credential:
 * it must come from a cryptographic source, never `Math.random()`, whose output
 * is predictable from a few observations. The alphabet excludes the glyphs that
 * are misread when the credential is dictated or re-typed (0/O, 1/I) — it is
 * exactly 32 symbols, so the modulo used to map a random byte is unbiased.
 *
 * This returns a shallow copy with those fields removed, so the caller can map a
 * whole result set without leaking them.
 */
import { randomBytes } from "node:crypto";

const TEAM_CREDENTIAL_FIELDS = ["password", "team_username"];

const TEAM_CREDENTIAL_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomCredentialToken(length) {
  const bytes = randomBytes(length);
  let token = "";
  for (let index = 0; index < length; index += 1) {
    token += TEAM_CREDENTIAL_ALPHABET[bytes[index] % TEAM_CREDENTIAL_ALPHABET.length];
  }
  return token;
}

/** `slug_XXXXX` — a readable, unguessable team username derived from the name. */
export function generateTeamUsername(name) {
  const slug = String(name || "team")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "_")
    .substring(0, 10);
  return `${slug}_${randomCredentialToken(5)}`;
}

/** `FSTXXXXXXXX` — a strong shared password, never the old 5-char `Math.random()`. */
export function generateTeamPassword() {
  return `FST${randomCredentialToken(8)}`;
}

export function stripTeamCredentials(team) {
  if (!team) return team;
  const safe = { ...team };
  for (const field of TEAM_CREDENTIAL_FIELDS) delete safe[field];
  return safe;
}

export default { stripTeamCredentials, generateTeamUsername, generateTeamPassword };
