import db, { initDb } from "@/lib/db";

/**
 * PARTICIPANT MEMBERSHIP RESOLUTION
 *
 * Phase 2 of the participant-architecture cleanup: `participant_programs` is
 * now the authoritative source for "which program is this person in?".
 *
 * The legacy sources (`contacts.program_id`, `contacts.group_name` name-lookup,
 * and `v2_participants`) are kept ONLY as a silent fallback for people who have
 * not yet been reconciled into `participant_programs`. Once reconciliation has
 * been verified, set DISABLE_LEGACY_PARTICIPANT_FALLBACK=true to remove the
 * fallback entirely.
 */

const LEGACY_FALLBACK_DISABLED =
  process.env.DISABLE_LEGACY_PARTICIPANT_FALLBACK === "true";

async function queryParticipantProgramIds(cid) {
  try {
    const res = await db.execute({
      sql: "SELECT program_id FROM participant_programs WHERE participant_id = ?",
      args: [cid],
    });
    return res.rows
      .map((r) => String(r.program_id).trim())
      .filter(Boolean);
  } catch (_) {
    // participant_programs may not exist in older environments
    return null;
  }
}

function splitLegacyProgramIds(field) {
  if (!field) return [];
  return String(field)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Returns the participant's program ids. `participant_programs` is authoritative;
 * legacy sources are used only when it is empty (or unavailable).
 */
export async function getParticipantProgramIds({ cid, email, contact = {} }) {
  await initDb();

  const ppIds = await queryParticipantProgramIds(cid);
  if (ppIds !== null && ppIds.length > 0) {
    return Array.from(new Set(ppIds));
  }

  // Legacy fallback — retained temporarily for un-reconciled records. Once
  // reconciliation is verified, set DISABLE_LEGACY_PARTICIPANT_FALLBACK=true
  // to make participant_programs strictly authoritative.
  if (LEGACY_FALLBACK_DISABLED) {
    return [];
  }

  console.warn(
    `[participant-membership] legacy fallback used for ${cid || email || "unknown"}`,
  );

  const ids = new Set(splitLegacyProgramIds(contact.program_id));

  if (contact.group_name) {
    try {
      const famRes = await db.execute({
        sql: "SELECT program_id FROM families WHERE UPPER(TRIM(name)) = UPPER(TRIM(?)) AND program_id IS NOT NULL",
        args: [contact.group_name],
      });
      famRes.rows.forEach((r) => {
        if (r.program_id) ids.add(String(r.program_id).trim());
      });
    } catch (_) {}
    try {
      const grpRes = await db.execute({
        sql: "SELECT id FROM v2_programs WHERE UPPER(TRIM(name)) = UPPER(TRIM(?))",
        args: [contact.group_name],
      });
      grpRes.rows.forEach((r) => {
        if (r.id) ids.add(String(r.id).trim());
      });
    } catch (_) {}
  }

  if (email) {
    try {
      const vpRes = await db.execute({
        sql: "SELECT program_id FROM v2_participants WHERE LOWER(email) = LOWER(?)",
        args: [email],
      });
      vpRes.rows.forEach((r) => {
        if (r.program_id) ids.add(String(r.program_id).trim());
      });
    } catch (_) {}
  }

  return Array.from(ids);
}

/**
 * Returns true when the participant belongs to the given program.
 */
export async function isParticipantInProgram({ cid, email, programId, contact = {} }) {
  const ids = await getParticipantProgramIds({ cid, email, contact });
  return ids.includes(String(programId));
}
