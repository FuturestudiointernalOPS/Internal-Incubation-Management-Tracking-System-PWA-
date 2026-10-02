/**
 * Participant service — the submission assignments.
 *
 * Layer (see docs/LAYER_SPLIT.md): the DECISIONS live here — which deliverables
 * a participant may see (the requirement's assignee scoping), how a submission
 * is matched to a deliverable, how the list is ordered, and whether a submit is
 * a first version or a new version. Every statement lives in
 * `@/models/participantPortal` and `@/models/participant-membership`. No SQL,
 * no HTTP.
 */

import { getParticipantProgramIds } from "@/models/participant-membership";
import {
  getAssignmentsProgramById,
  getAssignmentsDeliverablesByProgramId,
  getAssignmentsSubmissionsByProgram,
  getExistingSubmission,
  archiveSubmissionVersion,
  updateSubmissionVersion,
  insertSubmission,
} from "@/models/participantPortal";

/**
 * The team ids a participant can be matched against, in both id styles the
 * contact record exposes.
 */
export function participantTeamIds(contact) {
  return [contact?.v2_team_id, contact?.team_id]
    .filter(Boolean)
    .map((teamId) => String(teamId));
}

/**
 * Whether a requirement targets this participant.
 *
 * A PM can scope a requirement at everyone, a team, or a single individual.
 * Without this filter every participant would incorrectly see every requirement
 * regardless of how the PM scoped it. An unknown scope stays VISIBLE (safe:
 * never hide work we do not understand).
 */
export function deliverableTargetsParticipant(deliverable, { cid, teamIds }) {
  const type = String(deliverable.assignee_type || "all").toLowerCase();
  if (type === "all" || !type) return true;
  if (type === "team") {
    return teamIds.length > 0 && teamIds.includes(String(deliverable.assignee_id));
  }
  if (type === "individual") {
    return String(deliverable.assignee_id) === String(cid);
  }
  return true; // unknown scope — stay safe and visible
}

/**
 * Order: an overdue, unsubmitted requirement first, then the most recent due
 * date. Copies before sorting so the caller's list is untouched.
 */
export function sortAssignments(assignments, now = new Date()) {
  return [...assignments].sort((first, second) => {
    const firstOverdue = !first.submission && new Date(first.dueDate) < now ? 1 : 0;
    const secondOverdue = !second.submission && new Date(second.dueDate) < now ? 1 : 0;
    if (firstOverdue !== secondOverdue) return secondOverdue - firstOverdue;
    return new Date(second.dueDate) - new Date(first.dueDate);
  });
}

/**
 * Build the participant's assignment list across every program they belong to
 * (or a single one when filtered): read each program's requirements and the
 * participant's submissions, keep the requirements that target them, attach the
 * matching submission, and sort.
 */
export async function buildParticipantAssignments({
  cid,
  contact,
  filterProgramId,
}) {
  const programIds = await getParticipantProgramIds({
    cid,
    email: contact.email,
    contact,
  });

  const teamIds = participantTeamIds(contact);
  const allAssignments = [];

  for (const programId of programIds) {
    if (filterProgramId && programId !== filterProgramId) continue;

    const [progRes, delRes, subRes] = await Promise.all([
      getAssignmentsProgramById(programId),
      getAssignmentsDeliverablesByProgramId(programId),
      getAssignmentsSubmissionsByProgram(cid, programId),
    ]);

    const program = progRes.rows[0];
    if (!program) continue;

    const deliverables = (delRes.rows || []).filter((deliverable) =>
      deliverableTargetsParticipant(deliverable, { cid, teamIds }),
    );
    const submissions = subRes.rows || [];

    for (const deliverable of deliverables) {
      // Match by document_id (preferred) or deliverable_id (legacy/int compat)
      const matchedSubmission = submissions.find(
        (submission) =>
          String(submission.document_id) === String(deliverable.id) ||
          String(submission.deliverable_id) === String(deliverable.id),
      );
      allAssignments.push({
        id: deliverable.id,
        title: deliverable.title,
        description: deliverable.description,
        allowedFormat: deliverable.allowed_format,
        resourceUrl: deliverable.resource_url || null,
        resourceLabel: deliverable.resource_label || null,
        weight: deliverable.weight,
        programId,
        programName: program.name,
        dueDate: deliverable.due_date || deliverable.created_at,
        submission: matchedSubmission
          ? {
              id: matchedSubmission.id,
              status: matchedSubmission.status,
              fileUrl: matchedSubmission.file_url,
              score: matchedSubmission.score,
              submittedAt: matchedSubmission.created_at,
              feedback: matchedSubmission.feedback || null,
              rejectionReason: matchedSubmission.rejection_reason || null,
            }
          : null,
      });
    }
  }

  return sortAssignments(allAssignments);
}

/**
 * Record a submission for a requirement: a first version when nothing exists
 * yet, otherwise archive the previous version and advance.
 */
export async function submitAssignmentVersion({
  cid,
  programId,
  deliverableId,
  fileUrl,
}) {
  // Check for existing submission (for version history)
  const existing = await getExistingSubmission(cid, deliverableId);

  if (existing.rows.length > 0) {
    const previousSubmission = existing.rows[0];
    // Archive previous version
    await archiveSubmissionVersion(
      previousSubmission.id,
      cid,
      deliverableId,
      previousSubmission.file_url,
      previousSubmission.version || 1,
    );
    // Update with new version
    await updateSubmissionVersion(fileUrl || null, previousSubmission.id);
  } else {
    await insertSubmission(cid, programId, deliverableId, fileUrl || null);
  }
}
