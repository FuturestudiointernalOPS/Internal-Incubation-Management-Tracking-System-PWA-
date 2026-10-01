/**
 * CONTACT DIRECTORY SEARCH — the pool decision.
 *
 * The CRM directory is membership-keyed: a caller who belongs to the requested
 * program — as a participant, or as a venture founder whose venture is in it —
 * gets the program-scoped pool (program participants, program staff, the
 * assigned program manager). Everyone else falls through to the global
 * directory, which the route gates on `contacts.view`.
 *
 * This module answers only "is the caller a member of this program, and if so
 * what does the scoped pool return?"; the capability gate and the envelope stay
 * on the route. Reads go through `@/models/contacts`; nothing here runs SQL.
 *
 * See docs/LAYER_SPLIT.md.
 */

import {
  isParticipantInProgram,
  isVentureFounderInProgram,
  searchContactsInProgram,
  searchContactsByNameOrEmail,
} from "@/models/contacts";

/** The LIKE pattern for a trimmed search term. */
export function contactSearchPattern(query) {
  return `%${query}%`;
}

/**
 * The program-scoped pool: `{ member: false }` when the caller is not in the
 * program, else `{ member: true, contacts }` (names/emails only).
 */
export async function searchProgramPoolForMember({ session, programId, likePattern }) {
  const [participant, founder] = await Promise.all([
    isParticipantInProgram(session.cid, programId),
    isVentureFounderInProgram(session.cid, programId),
  ]);
  if (participant.rows.length === 0 && founder.rows.length === 0) {
    return { member: false };
  }
  const result = await searchContactsInProgram(likePattern, programId);
  return { member: true, contacts: result.rows || [] };
}

/** The global directory pool (names/emails/role). */
export async function searchGlobalDirectory(likePattern) {
  const result = await searchContactsByNameOrEmail(likePattern);
  return result.rows || [];
}
