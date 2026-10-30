import db from "@/lib/db";

/**
 * Auth flows model — family member invites (REPOSITORY layer).
 *
 * The program gate and the contact/participant/token writes used by
 * `/api/auth/invite-family`, split verbatim out of `models/authFlows.js` — see
 * docs/LAYER_SPLIT.md.
 *
 * Model-layer rules: no HTTP, one function per query, named after the data.
 */

/** Program existence check by id (invite-family program gate). */
export async function getProgramById(programId) {
  return db.execute({
    sql: "SELECT id FROM v2_programs WHERE id = ?",
    args: [programId],
  });
}

/** Create a pending participant contact for a family member invite. */
export async function createFamilyMemberContact(cid, name, email, groupName, programId) {
  return db.execute({
    sql: "INSERT INTO contacts (cid, name, email, role, status, group_name, program_id) VALUES (?, ?, ?, 'participant', 'pending', ?, ?)",
    args: [cid, name, email, groupName, programId],
  });
}

/** Link a contact to a program in the participant_programs junction table. */
export async function linkContactToParticipantProgram(participantId, programId) {
  return db.execute({
    sql: `INSERT INTO participant_programs (participant_id, program_id)
                    VALUES (?, ?)
                    ON CONFLICT (participant_id, program_id) DO NOTHING`,
    args: [participantId, programId],
  });
}

/** Issue a family-invite password setup token (no token_type). */
export async function createFamilyInviteSetupToken(token, tokenHash, contactCid) {
  return db.execute({
    sql: "INSERT INTO password_setup_tokens (token, token_hash, contact_cid, expires_at) VALUES (?, ?, ?, NOW() + INTERVAL '48 hours')",
    args: [token, tokenHash, contactCid],
  });
}
