import { upsertParticipantActive, setParticipantActiveByEmail } from "@/models/participantSyncStore";

/**
 * Sync a contact into v2_participants as Active.
 *
 * A missing (email, program_id) unique constraint makes the keyed upsert throw;
 * the fallback is then a plain status UPDATE, so a schema that never gained the
 * constraint still ends up Active rather than unchanged.
 *
 * Layer (see docs/LAYER_SPLIT.md): the fallback policy is decided here; the two
 * statements live in `@/models/participantSyncStore`.
 */
export async function upsertV2ParticipantActiveWithFallback(programId, name, email, phone) {
  try {
    return await upsertParticipantActive(programId, name, email, phone);
  } catch (_) {
    // Fallback if unique constraint (email, program_id) is not there
    return setParticipantActiveByEmail(programId, email);
  }
}
