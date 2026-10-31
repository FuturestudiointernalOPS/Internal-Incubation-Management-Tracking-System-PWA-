import db from "@/lib/db";

/**
 * Forms & submissions model — submission status reads (REPOSITORY layer).
 *
 * The program/participant status gates, the facilitator team-scope check and the
 * submission review detail read behind `src/app/api/submissions/route.js`. Split
 * verbatim out of `models/forms/submissions.js` — see docs/LAYER_SPLIT.md.
 *
 * Model-layer rules: no HTTP, one function per query, named after the data.
 */

/** Program status lookup used to gate participant/team submissions. */
export async function getSubmissionProgramStatus(programId) {
  return db.execute({
    sql: "SELECT status FROM v2_programs WHERE id::text = ?",
    args: [String(programId)],
  });
}

/** A participant's own membership status within a program (completion gate). */
export async function getParticipantProgramSubmissionStatus(participantId, programId) {
  return db.execute({
    sql: `SELECT status FROM participant_programs
                  WHERE participant_id = ? AND program_id::text = ?
                  LIMIT 1`,
    args: [participantId, String(programId)],
  });
}

/** Program id of a submission (used for facilitator assignment checks). */
export async function getSubmissionProgramId(id) {
  return db.execute({
    sql: "SELECT program_id FROM v2_submissions WHERE id::text = ?",
    args: [String(id)],
  });
}

/** True-check that a submission's participant belongs to one of the team ids. */
export async function checkSubmissionInFacilitatorTeamScope(id, teamIds) {
  return db.execute({
    sql:
      "SELECT 1 FROM v2_submissions s JOIN contacts c ON s.participant_id::text = c.cid WHERE s.id::text = ? AND c.v2_team_id IN (" +
      teamIds.map(() => "?").join(",") +
      ")",
    args: [String(id), ...teamIds],
  });
}

/** Submission + participant + deliverable + program details for a review. */
export async function getSubmissionReviewDetails(id) {
  return db.execute({
    sql: `
           SELECT s.id, s.program_id, s.participant_id, s.team_id,
                  s.status, s.reviewed_by_role, s.teacher_id,
                  c.email, c.name as participant_name,
                  d.title as deliverable_title, prog.assigned_pm_id,
                  prog.name as program_name
           FROM v2_submissions s
           LEFT JOIN contacts c ON s.participant_id::text = c.cid
           LEFT JOIN v2_document_requirements d ON s.deliverable_id::text = d.id::text
           LEFT JOIN v2_programs prog ON s.program_id::text = prog.id::text
           WHERE s.id::text = ?
        `,
    args: [id],
  });
}
