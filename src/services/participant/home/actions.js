/**
 * Participant service — the home dashboard's action centre.
 *
 * What is overdue, what is due within a week, the pending submissions and the
 * next sessions of the primary program. No SQL, no HTTP.
 */

import { startOfDay } from "../rules";

const DAY_MS = 1000 * 60 * 60 * 24;

/**
 * The action centre of the primary program: what is overdue, what is due within
 * a week, the pending submissions, and the next sessions. System-generated
 * attendance tasks never appear as overdue or due soon.
 */
export function buildActionCenter(programsData, today) {
  const primaryProgram = programsData[0] || null;
  const primarySubmissions = primaryProgram ? primaryProgram.submissions : [];
  const pendingSubmissions = primarySubmissions.filter(
    (submission) => submission.status === "pending",
  );

  const overdue = [];
  const dueSoon = [];

  if (primaryProgram) {
    for (const deliverable of primaryProgram.deliverables) {
      if (deliverable.title?.toLowerCase().includes("attendance")) continue;
      if (!deliverable.due_date && !deliverable.created_at) continue;
      const dueDate = startOfDay(new Date(deliverable.due_date || deliverable.created_at));
      const existingSubmission = primaryProgram.submissions.find(
        (submission) =>
          String(submission.document_id) === String(deliverable.id) ||
          String(submission.deliverable_id) === String(deliverable.id),
      );
      const isApproved = existingSubmission?.status === "approved";
      if (!isApproved && dueDate < today) {
        overdue.push({
          id: deliverable.id,
          title: deliverable.title,
          type: "deliverable",
          dueDate: deliverable.due_date || deliverable.created_at,
          daysOverdue: Math.floor((today - dueDate) / DAY_MS),
          programId: primaryProgram.id,
          programName: primaryProgram.name,
        });
      } else if (!isApproved && dueDate >= today) {
        const diffDays = Math.ceil((dueDate - today) / DAY_MS);
        if (diffDays <= 7) {
          dueSoon.push({
            id: deliverable.id,
            title: deliverable.title,
            type: "deliverable",
            dueDate: deliverable.due_date || deliverable.created_at,
            daysLeft: diffDays,
            programId: primaryProgram.id,
            programName: primaryProgram.name,
          });
        }
      }
    }
  }

  const upcomingSessions = primaryProgram
    ? primaryProgram.sessions
        .filter((session) => {
          if (!session.start_at && !session.scheduled_date) return false;
          return new Date(session.start_at || session.scheduled_date) >= today;
        })
        .slice(0, 5)
    : [];

  return { overdue, dueSoon, pendingSubmissions, upcomingSessions };
}