"use client";

import { Send } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { UPDATE_STATUS_LABELS } from "./constants";

/**
 * The updates tab: the weekly update form and the posted-update history.
 * Extracted verbatim from StaffProjectDetail.
 */
export default function UpdatesTab({
  updateForm,
  onUpdateFormChange,
  onSubmit,
  savingUpdate,
  updates,
}) {
  const { t } = useI18n();
  return (
    <div className="space-y-6">
      <div className="card space-y-4">
        <h3 className="text-[10px] font-black text-[var(--text-primary)] uppercase tracking-widest">
          {t("staffMisc.projectDetail.postWeeklyUpdate")}
        </h3>
        <div>
          <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-1 block">
            {t("staffMisc.projectDetail.statusField")}
          </label>
          <select
            value={updateForm.overall_status}
            onChange={(event) =>
              onUpdateFormChange((prev) => ({
                ...prev,
                overall_status: event.target.value,
              }))
            }
            className="w-full px-3 py-2 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[11px] font-bold text-[var(--text-primary)] outline-none"
          >
            <option value="on_track">
              {t("staffMisc.projectDetail.updateStatusOnTrack")}
            </option>
            <option value="at_risk">
              {t("staffMisc.projectDetail.updateStatusAtRisk")}
            </option>
            <option value="blocked">
              {t("staffMisc.projectDetail.updateStatusBlocked")}
            </option>
            <option value="completed">
              {t("staffMisc.projectDetail.updateStatusCompleted")}
            </option>
          </select>
        </div>
        {[
          { key: "accomplishments", label: t("staffMisc.projectDetail.fieldAccomplishments") },
          { key: "current_focus", label: t("staffMisc.projectDetail.fieldCurrentFocus") },
          { key: "blockers", label: t("staffMisc.projectDetail.fieldBlockers") },
          { key: "next_steps", label: t("staffMisc.projectDetail.fieldNextSteps") },
          { key: "notes", label: t("staffMisc.projectDetail.fieldNotes") },
        ].map(({ key, label }) => (
          <div key={key}>
            <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-1 block">
              {label}
            </label>
            <textarea
              value={updateForm[key]}
              onChange={(event) =>
                onUpdateFormChange((prev) => ({ ...prev, [key]: event.target.value }))
              }
              rows={2}
              className="w-full px-3 py-2 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[11px] font-bold text-[var(--text-primary)] outline-none resize-none"
            />
          </div>
        ))}
        <button
          onClick={onSubmit}
          disabled={
            savingUpdate ||
            (!updateForm.accomplishments && !updateForm.current_focus)
          }
          className="w-full py-3 bg-[var(--brand-orange)] text-black rounded-xl text-sm font-bold uppercase tracking-wide disabled:opacity-30 flex items-center justify-center gap-2"
        >
          <Send className="w-4 h-4" />
          {savingUpdate
            ? t("staffMisc.projectDetail.saving")
            : t("staffMisc.projectDetail.submitUpdate")}
        </button>
      </div>
      {updates.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-[10px] font-black text-[var(--text-primary)] uppercase tracking-widest">
            {t("staffMisc.projectDetail.historyCount", {
              count: updates.length,
            })}
          </h3>
          {updates.map((update) => (
            <div key={update.id} className="card p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-[var(--text-primary)]">
                  {t("staffMisc.projectDetail.weekLabel", {
                    week: update.week_number,
                    year: update.year,
                  })}
                </span>
                <span
                  className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${update.overall_status === "on_track" ? "bg-emerald-500/10 text-emerald-500" : update.overall_status === "at_risk" ? "bg-amber-500/10 text-amber-500" : "bg-rose-500/10 text-rose-500"}`}
                >
                  {t(UPDATE_STATUS_LABELS[update.overall_status] || update.overall_status)}
                </span>
              </div>
              {update.accomplishments && (
                <p className="text-[10px] text-[var(--text-secondary)]">
                  <span className="font-bold text-[var(--text-primary)]">
                    {t("staffMisc.projectDetail.doneLabel")}
                  </span>{" "}
                  {update.accomplishments}
                </p>
              )}
              {update.current_focus && (
                <p className="text-[10px] text-[var(--text-secondary)]">
                  <span className="font-bold text-[var(--text-primary)]">
                    {t("staffMisc.projectDetail.focusLabel")}
                  </span>{" "}
                  {update.current_focus}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
