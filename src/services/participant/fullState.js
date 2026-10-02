/**
 * Participant service — the full participant state bundle.
 *
 * Layer (see docs/LAYER_SPLIT.md): the DECISIONS live here — who may read
 * another person's state, how the participant id is resolved, and the grade
 * aggregation. Every statement lives in `@/models/participantPortal`. No SQL, no
 * HTTP.
 */

import {
  getFullStateContactCidByEmail,
  getFullStateProgramByName,
  getFullStateSubmissionsByParticipant,
  getFullStateSessionsByProgram,
  getFullStateNotificationsByRecipient,
  getFullStateKpisByProgram,
  getFullStateDocumentsByProgram,
  getFullStateFollowupsByProgram,
  getFullStateTeamByGroupName,
  getFullStateFamilyByName,
} from "@/models/participantPortal";

// The internal roles that may read anybody's state; everyone else only their own.
const FULL_STATE_ROLES = ["super_admin", "staff", "program_manager"];

/**
 * Whether the caller may read the state for `email`. Internal roles may read
 * anybody; everyone else may read only their own (case- and space-insensitive).
 */
export function canReadFullState({ role, sessionEmail, email }) {
  if (FULL_STATE_ROLES.includes(role)) return true;
  return (
    String(sessionEmail || "").toLowerCase() === String(email || "").trim().toLowerCase()
  );
}

/** The participant id behind an email, falling back to the email itself. */
export function resolveFullStateCid(contactRows = [], email) {
  return contactRows.length > 0 ? contactRows[0].cid : email;
}

/**
 * The grade aggregate. `groupScore` is a placeholder: the column does not exist
 * on families yet, so it stays 0 and the final grade is the individual sum.
 */
export function aggregateGrades(submissions = []) {
  let individualScore = 0;
  submissions.forEach((submission) => {
    individualScore += parseInt(submission.score || submission.grade) || 0;
  });
  const groupScore = 0; // group_score column not yet available on families
  return { individualScore, groupScore, finalGrade: individualScore + groupScore };
}

/** Read and assemble the whole participant state for one email / group. */
export async function buildParticipantFullState({ email, groupName }) {
  const contactResult = await getFullStateContactCidByEmail(email);
  const cid = resolveFullStateCid(contactResult.rows, email);

  const [
    programResult,
    submissionsResult,
    sessionsResult,
    notificationsResult,
    kpisResult,
    documentsResult,
    followupsResult,
    teamResult,
  ] = await Promise.all([
    getFullStateProgramByName(groupName),
    getFullStateSubmissionsByParticipant(cid),
    getFullStateSessionsByProgram(groupName),
    getFullStateNotificationsByRecipient(email),
    getFullStateKpisByProgram(groupName),
    getFullStateDocumentsByProgram(groupName),
    getFullStateFollowupsByProgram(groupName),
    getFullStateTeamByGroupName(groupName),
    getFullStateFamilyByName(groupName).catch(() => ({ rows: [] })),
  ]);

  const submissions = submissionsResult.rows;

  return {
    program: programResult.rows[0],
    submissions,
    sessions: sessionsResult.rows,
    notifications: notificationsResult.rows,
    kpis: kpisResult.rows,
    documents: documentsResult.rows,
    followups: followupsResult.rows,
    team: teamResult.rows[0],
    grades: aggregateGrades(submissions),
  };
}
