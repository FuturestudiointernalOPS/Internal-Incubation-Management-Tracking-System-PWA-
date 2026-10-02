import {
  isParticipantInProgram,
  isVentureFounderInProgram,
  searchContactsInProgram,
  searchContactsByNameOrEmail,
} from "@/models/contacts";

/**
 * Membership-keyed search: anyone who holds an active participant or
 * venture-founder relationship IN the requested program.
 *
 * @returns {{ hit: true, contacts: object[] } | { hit: false }}
 */
export async function searchContactsInCallerProgram({
  sessionCid,
  likePattern,
  programId,
}) {
  if (!programId) return { hit: false };

  const [participantResult, founderResult] = await Promise.all([
    isParticipantInProgram(sessionCid, programId),
    isVentureFounderInProgram(sessionCid, programId),
  ]);

  if (participantResult.rows.length === 0 && founderResult.rows.length === 0) {
    return { hit: false };
  }

  const result = await searchContactsInProgram(likePattern, programId);
  return { hit: true, contacts: result.rows || [] };
}

/**
 * Global directory search (caller already passed contacts.view).
 */
export async function searchContactsDirectory(likePattern) {
  const result = await searchContactsByNameOrEmail(likePattern);
  return { contacts: result.rows || [] };
}
