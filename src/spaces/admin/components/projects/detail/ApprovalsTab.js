import { Clock, UserPlus } from "lucide-react";
import { useI18n } from "@/lib/i18n";
export default function ApprovalsTab({ approvalRequests,
  approvalsLoading,
  approvalStatusLabels,
  onApprovalAction,
  onRejectRequest, }) {
  const { t } = useI18n();
  return (
    <div className="space-y-4">
      {approvalsLoading ? (
        <div className="text-center py-8 text-[10px] font-medium text-[var(--text-secondary)]">
          {t("adminMisc.projectDetail.loadingRequests")}
        </div>
      ) : approvalRequests.filter((request) => request.status === "pending")
          .length === 0 &&
        approvalRequests.filter((request) => request.status !== "pending")
          .length === 0 ? (
        <div className="card py-16 flex flex-col items-center justify-center text-center opacity-50 border-dashed">
          <UserPlus className="w-12 h-12 mb-3" />
          <p className="text-sm text-[var(--text-secondary)]">
            {t("adminMisc.projectDetail.noContributionRequests")}
          </p>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            {t("adminMisc.projectDetail.noContributionRequestsHint")}
          </p>
        </div>
      ) : (
        <>
          {/* Pending Requests */}
          {approvalRequests.filter((request) => request.status === "pending")
            .length > 0 && (
            <div className="space-y-2">
              <h3 className="text-[10px] font-bold text-amber-500 uppercase tracking-widest flex items-center gap-2">
                <Clock className="w-3.5 h-3.5" />
                {t("adminMisc.projectDetail.pendingReview", {
                  count: approvalRequests.filter(
                    (request) => request.status === "pending",
                  ).length,
                })}
              </h3>
              {approvalRequests
                .filter((request) => request.status === "pending")
                .map((pendingRequest) => (
                  <div
                    key={pendingRequest.id}
                    className="card border-l-4 border-l-amber-500 p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold text-[var(--text-primary)]">
                          {pendingRequest.task_title ||
                            t("adminMisc.projectDetail.taskFallback", {
                              id: pendingRequest.task_id,
                            })}
                        </p>
                        <p className="text-[10px] font-medium text-[var(--text-secondary)] mt-0.5">
                          {t("adminMisc.projectDetail.by")}{" "}
                          {pendingRequest.requester_name ||
                            pendingRequest.requester_name_lookup ||
                            pendingRequest.requester_id}{" "}
                          ·{" "}
                          {new Date(pendingRequest.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => onApprovalAction(pendingRequest.id, "approved")}
                        className="px-4 py-2 bg-emerald-500 text-black rounded-lg text-sm font-bold uppercase tracking-wide hover:brightness-110 transition-all"
                      >
                        {t("adminMisc.projectDetail.approve")}
                      </button>
                      <button
                        onClick={() => onRejectRequest(pendingRequest.id)}
                        className="px-4 py-2 bg-rose-500/10 text-rose-400 rounded-lg text-[10px] font-bold uppercase tracking-wide hover:brightness-110 transition-all"
                      >
                        {t("adminMisc.projectDetail.reject")}
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          )}

          {/* History */}
          {approvalRequests.filter((request) => request.status !== "pending")
            .length > 0 && (
            <div className="space-y-2">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                {t("adminMisc.projectDetail.history")}
              </h3>
              {approvalRequests
                .filter((request) => request.status !== "pending")
                .map((decidedRequest) => (
                  <div
                    key={decidedRequest.id}
                    className={`card p-3 border-l-4 ${
                      decidedRequest.status === "approved"
                        ? "border-l-emerald-500"
                        : "border-l-rose-500"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded ${
                          decidedRequest.status === "approved"
                            ? "bg-emerald-500/10 text-emerald-500"
                            : "bg-rose-500/10 text-rose-500"
                        }`}
                      >
                        {approvalStatusLabels[decidedRequest.status] || decidedRequest.status}
                      </span>
                      <span className="text-[10px] font-bold text-[var(--text-primary)]">
                        {decidedRequest.task_title ||
                          t("adminMisc.projectDetail.taskFallback", {
                            id: decidedRequest.task_id,
                          })}
                      </span>
                    </div>
                    <p className="text-[10px] font-medium text-[var(--text-secondary)] mt-1">
                      {decidedRequest.requester_name || decidedRequest.requester_id} ·{" "}
                      {new Date(decidedRequest.created_at).toLocaleDateString()}
                      {decidedRequest.rejection_reason && (
                        <>
                          {" "}
                          · {t("adminMisc.projectDetail.reasonLabel")}{" "}
                          <span className="text-rose-400">
                            {decidedRequest.rejection_reason}
                          </span>
                        </>
                      )}
                    </p>
                  </div>
                ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
