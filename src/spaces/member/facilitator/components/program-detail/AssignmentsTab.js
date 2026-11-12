"use client";

import { useI18n } from "@/lib/i18n";
import SubmissionRow from "./SubmissionRow";

/**
 * The assignments tab: the submissions within the facilitator's scope, each
 * with its review row.
 * Extracted verbatim from FacilitatorProgram.
 */
export default function AssignmentsTab({ submissions, onReview }) {
  const { t } = useI18n();
  return (
    <div className="space-y-3">
      {submissions.length === 0 && (
        <p className="text-sm text-[var(--text-secondary)] py-8 text-center">
          No submissions in your scope yet.
        </p>
      )}
      {submissions.map((submission) => (
        <SubmissionRow key={submission.id} sub={submission} onReview={onReview} t={t} />
      ))}
    </div>
  );
}
