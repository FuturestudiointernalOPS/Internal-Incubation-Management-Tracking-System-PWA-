"use client";

import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronRight, CheckCircle2, XCircle } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { STATUS_CONFIG } from "./statusConfig";

/**
 * The respondents list: the column header strip, the empty state, and each row
 * with its expandable detail and decision buttons.
 * Extracted verbatim from ScoresPage.
 */
export default function RespondentsTable({
  filteredRespondents,
  selected,
  expanded,
  deciding,
  onToggleExpand,
  onToggleSelect,
  onDecision,
  hasActiveFilters,
  onClearFilters,
}) {
  const { t } = useI18n();
  return (
    <div className="card divide-y divide-[var(--border-primary)]">
      {/* Column header strip — S/N is a presentation-level row number */}
      <div className="flex items-center gap-4 px-4 py-2 bg-[var(--bg-primary)]">
        <span className="w-8 text-center text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("adminMisc.platformScores.colSn")}</span>
        <span className="w-4" />
        <span className="flex-1 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("adminMisc.platformScores.colApplicant")}</span>
        <span className="hidden md:block w-56 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("adminMisc.platformScores.csvEmail")}</span>
        <span className="flex-shrink-0 w-16 sm:w-20 text-center text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
          <span className="hidden sm:inline">{t("adminMisc.platformScores.csvStatus")}</span>
        </span>
        <span className="flex-shrink-0 w-12 sm:w-16 text-right text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("adminMisc.platformScores.csvScore")}</span>
        <span className="w-4" />
      </div>
      {filteredRespondents.length === 0 ? (
        <div className="p-8 text-center">
          <p className="text-sm text-[var(--text-secondary)]">
            {t("adminMisc.platformScores.noRespondents")}
          </p>
          {hasActiveFilters && (
            <button onClick={onClearFilters} className="mt-3 text-[10px] font-bold uppercase tracking-wide text-[var(--brand-orange)] hover:underline">
              Clear all filters
            </button>
          )}
        </div>
      ) : (
        filteredRespondents.map((respondent, index) => (
          <div key={index}>
            <div
              onClick={() => onToggleExpand(index)}
              className="w-full p-4 flex items-center gap-4 hover:bg-[var(--bg-primary)] transition-colors text-left cursor-pointer"
            >
              {/* S/N — continuous row number over the filtered result set */}
              <div className="w-8 flex-shrink-0 text-center">
                <span className="text-[10px] font-bold text-[var(--text-secondary)]">{index + 1}</span>
              </div>
              <div className="w-4 flex-shrink-0 flex items-center justify-center">
                {respondent.status === "submitted" && (
                  <input
                    type="checkbox"
                    checked={!!selected[respondent.submission_id]}
                    onChange={() => onToggleSelect(respondent.submission_id)}
                    onClick={(event) => event.stopPropagation()}
                    className="accent-[var(--brand-orange)]"
                  />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-bold text-[var(--text-primary)] truncate">
                  {respondent.name}
                </p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                  {respondent.ranking || "—"}
                </p>
              </div>
              {/* Email column — the address that receives the emails */}
              <div className="hidden md:block w-56 min-w-0 flex-shrink-0">
                <p
                  className="text-[10px] font-medium text-[var(--text-secondary)] truncate"
                  title={respondent.email || "No email"}
                >
                  {respondent.email || "—"}
                </p>
              </div>
              <div className="flex-shrink-0 w-16 sm:w-20 flex items-center justify-center">
                {(STATUS_CONFIG[respondent.status] || STATUS_CONFIG.submitted) && (
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${STATUS_CONFIG[respondent.status].bg} ${STATUS_CONFIG[respondent.status].color}`}>
                    {t(STATUS_CONFIG[respondent.status].label)}
                  </span>
                )}
              </div>
              <div className="text-right flex-shrink-0 w-12 sm:w-16">
                <p
                  className={`text-sm font-black ${
                    respondent.score >= 70
                      ? "text-emerald-500"
                      : respondent.score >= 40
                      ? "text-amber-500"
                      : "text-rose-500"
                  }`}
                >
                  {respondent.score}
                </p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                  {t("adminMisc.platformScores.detailScore")}
                </p>
              </div>
              {expanded[index] ? (
                <ChevronDown className="w-4 h-4 text-[var(--text-secondary)] flex-shrink-0" />
              ) : (
                <ChevronRight className="w-4 h-4 text-[var(--text-secondary)] flex-shrink-0" />
              )}
            </div>

            <AnimatePresence>
              {expanded[index] && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="px-4 pb-4 pl-16 space-y-2">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                        {t("adminMisc.platformScores.detailScore")}
                      </span>
                      <p className="text-sm font-bold text-[var(--text-primary)]">
                        {respondent.score}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                        {t("adminMisc.platformScores.detailRanking")}
                      </span>
                      <p className="text-sm font-bold text-[var(--text-primary)]">
                        {respondent.ranking || t("adminMisc.platformScores.na")}
                      </p>
                    </div>
                    {respondent.recommendation && (
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                          {t("adminMisc.platformScores.detailRecommendation")}
                        </span>
                        <p className="text-sm text-[var(--text-primary)] mt-1 leading-relaxed">
                          {respondent.recommendation}
                        </p>
                      </div>
                    )}

                    {/* Decision actions */}
                    {respondent.status === "submitted" ? (
                      <div className="flex items-center gap-2 pt-2">
                        <button
                          onClick={() => onDecision(respondent.submission_id, "approved")}
                          disabled={deciding?.submission_id === respondent.submission_id}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 text-white text-sm font-bold uppercase tracking-wide hover:brightness-110 disabled:opacity-40"
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          {deciding?.submission_id === respondent.submission_id && deciding?.decision === "approved" ? "..." : t("adminMisc.platformScores.approve")}
                        </button>
                        <button
                          onClick={() => onDecision(respondent.submission_id, "rejected")}
                          disabled={deciding?.submission_id === respondent.submission_id}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-600 text-white text-sm font-bold uppercase tracking-wide hover:brightness-110 disabled:opacity-40"
                        >
                          <XCircle className="w-3 h-3" />
                          {deciding?.submission_id === respondent.submission_id && deciding?.decision === "rejected" ? "..." : t("adminMisc.platformScores.reject")}
                        </button>
                      </div>
                    ) : (
                      <div className="pt-2">
                        <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${STATUS_CONFIG[respondent.status]?.bg} ${STATUS_CONFIG[respondent.status]?.color}`}>
                          {t(STATUS_CONFIG[respondent.status]?.label) || respondent.status}
                        </span>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))
      )}
    </div>
  );
}
