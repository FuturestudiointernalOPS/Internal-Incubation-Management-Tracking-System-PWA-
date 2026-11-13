import { useI18n } from "@/lib/i18n";

export default function SubmissionsTab({
  onOpenReviewModal,
  onViewSubmission,
  submissions,
  submissionsSeen,
}) {
  const { t } = useI18n();

  return (
    <div className="table-container">
      <table className="data-table">
        <thead>
          <tr>
            <th>{t("pmMisc.workspace.tableParticipant")}</th>
            <th>{t("pmMisc.workspace.tableDeliverable")}</th>
            <th>{t("pmMisc.workspace.tableDate")}</th>
            <th>{t("pmMisc.workspace.tableStatus")}</th>
            <th className="text-right">{t("pmMisc.workspace.tableAction")}</th>
          </tr>
        </thead>
        <tbody>
          {submissions.map((submission) => (
            <tr
              key={submission.id}
              className={
                submission.status === "pending" && !submissionsSeen
                  ? "bg-brand-orange/5"
                  : ""
              }
            >
              <td>
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    {submission.status === "pending" && !submissionsSeen && (
                      <span className="w-2 h-2 rounded-full bg-[var(--brand-orange)] shrink-0" />
                    )}
                    <span className="font-black text-[var(--text-primary)]">
                      {submission.participant_name || t("pmMisc.workspace.na")}
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-blue-500 uppercase tracking-widest">
                    {submission.group_name || t("pmMisc.workspace.individual")}
                  </span>
                </div>
              </td>
              <td>{submission.deliverable_title}</td>
              <td className="text-[10px] opacity-60 font-bold">
                {new Date(submission.created_at).toLocaleDateString()}
              </td>
              <td>
                <span
                  className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${submission.status === "approved" ? "bg-emerald-500/10 text-emerald-500" : "bg-orange-500/10 text-orange-500"}`}
                >
                  {{
                    approved: t("pmMisc.workspace.submissionStatusApproved"),
                    pending: t("pmMisc.workspace.submissionStatusPending"),
                    submitted: t("pmMisc.workspace.submissionStatusSubmitted"),
                    rejected: t("pmMisc.workspace.submissionStatusRejected"),
                    revision_requested: t(
                      "pmMisc.workspace.submissionStatusRevision",
                    ),
                    pending_followup: t(
                      "pmMisc.workspace.submissionStatusFollowup",
                    ),
                  }[submission.status] || submission.status}
                </span>
              </td>
              <td className="text-right">
                <div className="flex items-center justify-end gap-4">
                  <button
                    onClick={() => onViewSubmission(submission)}
                    className="text-[var(--brand-orange)] text-[10px] font-bold uppercase"
                  >
                    {t("pmMisc.workspace.viewSubmission")}
                  </button>
                  <button
                    onClick={() => onOpenReviewModal(submission)}
                    className="text-[var(--brand-blue)] text-[10px] font-bold uppercase"
                  >
                    {t("pmMisc.workspace.review")}
                  </button>
                </div>
              </td>
            </tr>
          ))}
          {submissions.length === 0 && (
            <tr>
              <td colSpan="5" className="py-20 text-center opacity-30">
                {t("pmMisc.workspace.noSubmissions")}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
