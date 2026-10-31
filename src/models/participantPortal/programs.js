import db from "@/lib/db";

/**
 * Participant programs model — data access for GET/POST/DELETE /api/participant-programs
 */

export async function getParticipantProgramAssignments(participantId, programId) {
  let sql = `
      SELECT pp.*, p.name AS program_name, p.status AS program_status
      FROM participant_programs pp
      LEFT JOIN v2_programs p ON pp.program_id = p.id
      WHERE 1=1
    `;
  const args = [];

  if (participantId) {
    sql += " AND pp.participant_id = ?";
    args.push(participantId);
  }

  if (programId) {
    sql += " AND pp.program_id = ?";
    args.push(programId);
  }

  sql += " ORDER BY pp.assigned_at DESC";

  return db.execute({ sql, args });
}

export async function getProgramById(programId) {
  return db.execute({
    sql: "SELECT id FROM v2_programs WHERE id = ?",
    args: [programId],
  });
}

export async function getContactEmailByCid(participantId) {
  return db.execute({
    sql: "SELECT email FROM contacts WHERE cid = ? LIMIT 1",
    args: [participantId],
  });
}

export async function checkFacilitatorConflict(programId, participantId, participantEmail) {
  return db.execute({
    sql: `SELECT 1 FROM v2_program_staff
            WHERE CAST(program_id AS TEXT) = ? AND role = 'facilitator'
              AND (staff_id = ? OR LOWER(TRIM(staff_id)) = LOWER(TRIM(?)))
            LIMIT 1`,
    args: [String(programId), participantId, participantEmail],
  });
}

export async function insertParticipantProgram(participantId, programId) {
  return db.execute({
    sql: `INSERT INTO participant_programs (participant_id, program_id)
            VALUES (?, ?)
            ON CONFLICT (participant_id, program_id) DO NOTHING`,
    args: [participantId, programId],
  });
}

export async function insertAssignmentAudit(participantId, programId, performedBy) {
  return db.execute({
    sql: `INSERT INTO participant_program_audit (participant_id, program_id, action, performed_by)
            VALUES (?, ?, 'assigned', ?)`,
    args: [participantId, programId, performedBy],
  });
}

export async function insertEnrollmentTimeline(participantId, programId) {
  return db.execute({
    sql: `INSERT INTO contact_timeline (contact_cid, event_type, description, context_module, context_id, actor_id, metadata)
              VALUES (?, 'participant_enrolled', 'Enrolled in program', 'programs', ?, 'system', '{}'::jsonb)`,
    args: [participantId, programId],
  });
}

export async function deleteParticipantProgram(participantId, programId) {
  return db.execute({
    sql: "DELETE FROM participant_programs WHERE participant_id = ? AND program_id = ?",
    args: [participantId, programId],
  });
}

export async function insertRemovalAudit(participantId, programId, performedBy) {
  return db.execute({
    sql: `INSERT INTO participant_program_audit (participant_id, program_id, action, performed_by)
            VALUES (?, ?, 'removed', ?)`,
    args: [participantId, programId, performedBy],
  });
}

export async function insertWithdrawalTimeline(participantId, programId) {
  return db.execute({
    sql: `INSERT INTO contact_timeline (contact_cid, event_type, description, context_module, context_id, actor_id, metadata)
              VALUES (?, 'participant_withdrawn', 'Withdrawn from program', 'programs', ?, 'system', '{}'::jsonb)`,
    args: [participantId, programId],
  });
}