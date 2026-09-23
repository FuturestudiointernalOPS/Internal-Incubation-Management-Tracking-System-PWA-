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
    const result = await db.execute({
      sql: "SELECT program_id FROM participant_programs WHERE participant_id = ?",
      args: [cid],
    });
    return result.rows
      .map((row) => String(row.program_id).trim())
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
    .map((segment) => segment.trim())
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

  // The legacy sources are three independent lookups. They used to run one
  // after another purely because the results were merged in order — three
  // round trips (~400ms on the current link) where one wave is enough. Each
  // lookup keeps its own failure guard, so a missing table still cannot take
  // the others down with it.
  const [familyRes, programNameRes, intakeRes] = await Promise.all([
    contact.group_name
      ? db
          .execute({
            sql: "SELECT program_id FROM families WHERE UPPER(TRIM(name)) = UPPER(TRIM(?)) AND program_id IS NOT NULL",
            args: [contact.group_name],
          })
          .catch(() => null)
      : null,
    contact.group_name
      ? db
          .execute({
            sql: "SELECT id FROM v2_programs WHERE UPPER(TRIM(name)) = UPPER(TRIM(?))",
            args: [contact.group_name],
          })
          .catch(() => null)
      : null,
    email
      ? db
          .execute({
            sql: "SELECT program_id FROM v2_participants WHERE LOWER(email) = LOWER(?)",
            args: [email],
          })
          .catch(() => null)
      : null,
  ]);

  const legacyProgramIds = new Set(splitLegacyProgramIds(contact.program_id));

  (familyRes?.rows || []).forEach((row) => {
    if (row.program_id) legacyProgramIds.add(String(row.program_id).trim());
  });
  (programNameRes?.rows || []).forEach((row) => {
    if (row.id) legacyProgramIds.add(String(row.id).trim());
  });
  (intakeRes?.rows || []).forEach((row) => {
    if (row.program_id) legacyProgramIds.add(String(row.program_id).trim());
  });

  // Warn only when the legacy sources actually produced a program: a caller
  // with no legacy program at all is not an un-reconciled participant (staff,
  // Program Managers and mentors resolve their program scope here too), so
  // warning for them turned a reconciliation signal into per-request noise.
  if (legacyProgramIds.size > 0) {
    console.warn(
      `[participant-membership] legacy fallback used for ${cid || email || "unknown"}`,
    );
  }

  return Array.from(legacyProgramIds);
}

/**
 * Returns true when the participant belongs to the given program.
 */
export async function isParticipantInProgram({ cid, email, programId, contact = {} }) {
  const programIds = await getParticipantProgramIds({ cid, email, contact });
  return programIds.includes(String(programId));
}
