import db from "@/lib/db";

/**
 * Participant enrollment store — the participant/contact credential sync and
 * the active-participants read behind `/api/participants`.
 *
 * Split out of `src/models/groups.js` (see docs/MVC_REFACTOR.md). SQL is
 * byte-identical to the statements that used to live there, so behavior is
 * unchanged; the barrel `@/models/groups` re-exports every name.
 *
 * Model-layer rules:
 *  - No HTTP / Next.js imports here — only the db engine.
 *  - One function per query, named after the data it returns.
 */

// ── POST / GET /api/participants (enrollment + contact sync) ─────────────────

/** Upsert the participant's V1 contact (unusable hash; role participant). */
export async function upsertParticipantContact(cid, name, email, phone, password) {
  return db.execute({
    sql: `INSERT INTO contacts (cid, name, email, phone, role, password)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(email) DO UPDATE SET
              name = EXCLUDED.name,
              phone = EXCLUDED.phone,
              role = EXCLUDED.role`,
    args: [cid, name, email, phone || null, "participant", password],
  });
}

/** Resolve the real contact cid after the email upsert (case-insensitive). */
export async function getContactCidByEmail(email) {
  return db.execute({
    sql: "SELECT cid FROM contacts WHERE LOWER(email) = LOWER(?) AND deleted = 0 LIMIT 1",
    args: [email],
  });
}

/** Enroll a participant as pending in participant_programs (canonical membership). */
export async function enrollPendingParticipantProgram(
  participant_id,
  program_id,
  screening_status,
) {
  return db.execute({
    sql: `INSERT INTO participant_programs (participant_id, program_id, status, accepted_at, screening_status)
              VALUES (?, ?, 'pending', NOW(), ?)
              ON CONFLICT (participant_id, program_id) DO UPDATE SET screening_status = EXCLUDED.screening_status`,
    args: [participant_id, program_id, screening_status || "pending"],
  });
}

/** Timeline event for the direct participant enrollment (generated cid, program_id). */
export async function logParticipantEnrollment(contact_cid, program_id) {
  return db.execute({
    sql: `INSERT INTO contact_timeline (contact_cid, event_type, description, context_module, context_id, actor_id, metadata)
              VALUES (?, 'participant_enrolled', 'Enrolled in program', 'programs', ?, 'system', '{}'::jsonb)`,
    args: [contact_cid, program_id],
  });
}

/** Active program participants (participant_programs + contacts), optionally scoped to facilitator team ids. */
export async function getProgramParticipants(programId, teamIds) {
  let sql = `
      SELECT CAST(c.cid AS TEXT) as id,
             c.cid,
             CAST(c.cid AS TEXT) as user_id,
             c.name, c.email, c.phone,
             c.status, c.created_at, c.group_name, c.v2_team_id,
             pp.screening_status,
             pp.program_id, 'enrolled' as source
      FROM participant_programs pp
      JOIN contacts c ON pp.participant_id = c.cid
      WHERE CAST(pp.program_id AS TEXT) = ?
        AND c.deleted = 0
        AND c.deleted_at IS NULL
        AND c.archived_at IS NULL
        AND LOWER(COALESCE(c.status, '')) = 'active'
        AND NOT EXISTS (
          SELECT 1 FROM v2_program_staff ps
          WHERE CAST(ps.program_id AS TEXT) = ?
            AND ps.role = 'facilitator'
            AND (ps.staff_id = c.cid OR LOWER(TRIM(ps.staff_id)) = LOWER(TRIM(c.email)))
        )
    `;
  const args = [String(programId), String(programId)];

  // Facilitator team scope: only participants assigned to the facilitator's
  // v2_teams (where handler_id = facilitator cid).
  if (teamIds && teamIds.length > 0) {
    sql += " AND c.v2_team_id IN (" + teamIds.map(() => "?").join(",") + ")";
    args.push(...teamIds);
  }

  sql += " ORDER BY c.created_at DESC";

  return db.execute({ sql, args });
}
