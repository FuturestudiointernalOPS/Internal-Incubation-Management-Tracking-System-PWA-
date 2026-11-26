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
 *
 * Both answers read the SAME statement: the program ids (for the content) and
 * the lifecycle status of each seat (for the menu and the dashboard) can no
 * longer disagree, and the whole thing costs one round trip.
 */

const LEGACY_FALLBACK_DISABLED =
  process.env.DISABLE_LEGACY_PARTICIPANT_FALLBACK === "true";

/** The older links, as SQL, or an empty string when the fallback is disabled. */
function legacySeatsSql() {
  if (LEGACY_FALLBACK_DISABLED) return "";
  return `
        UNION
        SELECT CAST(p.id AS TEXT), 'legacy', NULL, NULL, NULL, NULL
          FROM v2_programs p
         WHERE (SELECT COUNT(*) FROM membership) = 0
           AND (
                CAST(p.id AS TEXT) = (SELECT program_id FROM contact)
                OR UPPER(TRIM(p.name)) = UPPER(TRIM((SELECT group_name FROM contact)))
           )
        UNION
        SELECT CAST(f.program_id AS TEXT), 'legacy', NULL, NULL, NULL, NULL
          FROM families f
         WHERE (SELECT COUNT(*) FROM membership) = 0
           AND f.program_id IS NOT NULL
           AND UPPER(TRIM(f.name)) = UPPER(TRIM((SELECT group_name FROM contact)))
        UNION
        SELECT CAST(vp.program_id AS TEXT), 'legacy', NULL, NULL, NULL, NULL
          FROM v2_participants vp
         WHERE (SELECT COUNT(*) FROM membership) = 0
           AND LOWER(vp.email) = LOWER(COALESCE(?, (SELECT email FROM contact)))`;
}

/**
 * THE participation read: which programs this person holds, the lifecycle
 * status of each seat, whether the program still exists, and the contact hints
 * the older links need — in ONE statement.
 *
 * `participant_programs` wins whenever it has a row; the older links are
 * consulted only for a person with no modern row (the same rule the program
 * content applies), so a door and its content can never point at two different
 * sets of programs.
 *
 * @returns {Promise<{rows: Array<Object>}>} one row per seat; `program_id` is
 *   null only when the person holds no seat at all (the contact columns still
 *   come back, because the legacy branches decide).
 */
export async function getParticipantParticipationSnapshot({ cid, email = "" } = {}) {
  const legacySeats = legacySeatsSql();
  // The legacy branches carry the only extra parameter; a disabled fallback
  // must not bind a value the statement never uses.
  const args = legacySeats ? [cid, cid, email || null] : [cid, cid];
  return db.execute({
    sql: `
      WITH contact AS (
        SELECT email, group_name, program_id FROM contacts WHERE cid = ? LIMIT 1
      ),
      membership AS (
        SELECT program_id::text AS program_id, status, completed_at, outcome, certificate_issued
          FROM participant_programs
         WHERE participant_id = ?
      ),
      seats AS (
        SELECT m.program_id, 'membership' AS source,
               m.status, m.completed_at, m.outcome, m.certificate_issued
          FROM membership m${legacySeats}
      )
      SELECT s.program_id, s.source, s.status, s.completed_at, s.outcome,
             s.certificate_issued,
             p.name AS program_name, p.status AS program_status,
             (p.id IS NOT NULL) AS program_exists,
             (SELECT email FROM contact) AS contact_email,
             (SELECT group_name FROM contact) AS contact_group,
             (SELECT program_id FROM contact) AS contact_program_id
        FROM seats s
        LEFT JOIN v2_programs p ON CAST(p.id AS TEXT) = s.program_id
       ORDER BY s.source, p.name NULLS LAST`,
    args,
  });
}

function splitLegacyProgramIds(field) {
  if (!field) return [];
  return String(field)
    .split(",")
    .map((segment) => segment.trim())
    .filter(Boolean);
}

/**
 * The guarded, older chain. Only used when the combined read above is
 * unavailable (a deployment where one of the legacy tables is missing).
 */
async function legacyProgramIdsWithoutSnapshot({ cid, email, contact = {} }) {
  if (LEGACY_FALLBACK_DISABLED) return [];

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
 * Returns the participant's program ids. `participant_programs` is authoritative;
 * legacy sources are used only when it is empty (or unavailable).
 */
export async function getParticipantProgramIds({ cid, email, contact = {} }) {
  await initDb();

  try {
    const snapshot = await getParticipantParticipationSnapshot({ cid, email });
    const ids = new Set(
      (snapshot.rows || [])
        .map((row) => (row.program_id == null ? "" : String(row.program_id).trim()))
        .filter(Boolean),
    );
    return Array.from(ids);
  } catch (_) {
    // An older deployment where one of the legacy tables is absent: fall back
    // to the guarded chain below rather than failing the read.
    try {
      const modern = await db.execute({
        sql: "SELECT program_id FROM participant_programs WHERE participant_id = ?",
        args: [cid],
      });
      const modernIds = (modern.rows || [])
        .map((row) => (row.program_id == null ? "" : String(row.program_id).trim()))
        .filter(Boolean);
      if (modernIds.length > 0) return Array.from(new Set(modernIds));
    } catch (_) {}
  }

  return legacyProgramIdsWithoutSnapshot({ cid, email, contact });
}

/**
 * Returns true when the participant belongs to the given program.
 */
export async function isParticipantInProgram({ cid, email, programId, contact = {} }) {
  const programIds = await getParticipantProgramIds({ cid, email, contact });
  return programIds.includes(String(programId));
}
