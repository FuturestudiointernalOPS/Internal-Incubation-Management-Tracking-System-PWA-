import { useI18n } from "@/lib/i18n";

export default function PmReportIssuesSection({ ctx }) {
  const { t } = useI18n();
  const { newPMReport, onAdditionalIssueNoteChange, onHadIssues, onIssueTypes, onRequiresAdminAttention } = ctx;
  return (
    <>
          {/* ────────── SECTION 4: ISSUES & SUPPORT ────────── */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-rose-500/20">
              <div className="w-5 h-5 rounded-full bg-rose-500/10 flex items-center justify-center text-[10px] font-bold text-rose-500 border border-rose-500/20">
                4
              </div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-rose-500">
                {t("pmMisc.workspace.issuesAndSupport")}
              </span>
            </div>

            <div className="space-y-3">
              {/* Had Issues — Toggle */}
              <div className="p-3 bg-tertiary rounded-xl border border-[var(--border-primary)]">
                <div className="flex items-center justify-between">
                  <label className="text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                    {t("pmMisc.workspace.wereThereIssues")}
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      onHadIssues((prev) => ({
                        ...prev,
                        had_issues: !prev.had_issues,
                      }))
                    }
                    className={`w-10 h-5 rounded-full transition-all relative ${
                      newPMReport.had_issues ? "bg-rose-500" : "bg-white/10"
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-all ${
                        newPMReport.had_issues ? "left-5" : "left-0.5"
                      }`}
                    />
                  </button>
                </div>

                {newPMReport.had_issues && (
                  <div className="mt-3 space-y-3">
                    {/* Issue Types — Multi-select chips */}
                    <div>
                      <label className="text-[8px] font-black uppercase tracking-widest text-[var(--text-secondary)] opacity-60 mb-1.5 block">
                        {t("pmMisc.workspace.issueTypes")}
                      </label>
                      <div className="flex gap-1.5 flex-wrap">
                        {[
                          "technical",
                          "attendance",
                          "participation",
                          "curriculum",
                          "behavioral",
                          "other",
                        ].map((type) => {
                          const isSelected =
                            newPMReport.issue_types.includes(type);
                          return (
                            <button
                              key={type}
                              type="button"
                              onClick={() =>
                                onIssueTypes((prev) => ({
                                  ...prev,
                                  issue_types: isSelected
                                    ? prev.issue_types.filter(
                                        (issueType) => issueType !== type,
                                      )
                                    : [...prev.issue_types, type],
                                }))
                              }
                              className={`px-3 py-1.5 rounded-lg border text-[8px] font-black uppercase tracking-widest transition-all ${
                                isSelected
                                  ? "bg-rose-500/10 border-rose-500/30 text-rose-500"
                                  : "bg-transparent border-white/10 text-slate-500 hover:border-white/30"
                              }`}
                            >
                              {{
                                technical: t("pmMisc.workspace.issueTechnical"),
                                attendance: t(
                                  "pmMisc.workspace.issueAttendance",
                                ),
                                participation: t(
                                  "pmMisc.workspace.issueParticipation",
                                ),
                                curriculum: t(
                                  "pmMisc.workspace.issueCurriculum",
                                ),
                                behavioral: t(
                                  "pmMisc.workspace.issueBehavioral",
                                ),
                                other: t("pmMisc.workspace.issueOther"),
                              }[type] || type}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Requires Super Admin Attention — Toggle */}
                    <div className="flex items-center justify-between">
                      <label className="text-[8px] font-black uppercase tracking-widest text-amber-500">
                        {t("pmMisc.workspace.requiresSuperAdmin")}
                      </label>
                      <button
                        type="button"
                        onClick={() =>
                          onRequiresAdminAttention((prev) => ({
                            ...prev,
                            requires_admin_attention:
                              !prev.requires_admin_attention,
                          }))
                        }
                        className={`w-10 h-5 rounded-full transition-all relative ${
                          newPMReport.requires_admin_attention
                            ? "bg-amber-500"
                            : "bg-white/10"
                        }`}
                      >
                        <div
                          className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-all ${
                            newPMReport.requires_admin_attention
                              ? "left-5"
                              : "left-0.5"
                          }`}
                        />
                      </button>
                    </div>

                    {/* Additional Note */}
                    <textarea
                      value={newPMReport.additional_issue_note}
                      onChange={(event) =>
                        onAdditionalIssueNoteChange((prev) => ({
                          ...prev,
                          additional_issue_note: event.target.value,
                        }))
                      }
                      rows={2}
                      className="w-full bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-2 text-[10px] outline-none font-bold text-[var(--text-primary)] focus:border-rose-500 transition-all resize-none"
                      placeholder={t(
                        "pmMisc.workspace.additionalNotePlaceholder",
                      )}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
    </>
  );
}
