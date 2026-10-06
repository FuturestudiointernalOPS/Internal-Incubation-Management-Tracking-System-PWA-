"use client";

import { useI18n } from "@/lib/i18n";
import RegistrationLinkField from "./RegistrationLinkField";

/**
 * The programme's basic registry fields (name, dates, visibility/language,
 * vision/objectives, outcomes/metrics, registration link).
 *
 * Extracted verbatim from `EditProgramModal.js` — see docs/LAYER_SPLIT.md. The
 * modal keeps the form, the personnel/notes/duration/status sections and the
 * actions; this component only renders the basic fields. It returns a fragment
 * (no wrapper node), so the form's `space-y-6` spacing still applies directly.
 */
export default function ProgramBasicsFields({
  editingProgram,
  setEditingProgram,
  programDateError,
  setProgramDateError,
  validateEditDates,
  formUrl,
  formName,
}) {
  const { t } = useI18n();

  return (
    <>
      {/* Program Name */}
      <div className="space-y-2">
        <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest ml-2">
          {t("adminMisc.programs.programName")}
        </label>
        <input
          type="text"
          value={editingProgram?.name || ""}
          onChange={(e) =>
            setEditingProgram({ ...editingProgram, name: e.target.value })
          }
          className="w-full bg-primary border border-[var(--border-primary)] rounded-xl p-4 font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)] focus:ring-1 focus:ring-[var(--brand-orange)] transition-all"
        />
      </div>

      {/* Start / End Dates */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest ml-2">
            {t?.("admin.startDate") || "Start Date"}
          </label>
          <input
            type="date"
            value={editingProgram?.start_date || ""}
            onChange={(e) => {
              const start = e.target.value;
              setEditingProgram({ ...editingProgram, start_date: start });
              setProgramDateError(
                validateEditDates(
                  start,
                  editingProgram?.end_date,
                  editingProgram?.duration_weeks,
                ),
              );
            }}
            className="w-full bg-primary border border-[var(--border-primary)] rounded-xl p-4 font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)] transition-all"
          />
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest ml-2">
            {t?.("admin.endDate") || "End Date"}
          </label>
          <input
            type="date"
            value={editingProgram?.end_date || ""}
            onChange={(e) => {
              const end = e.target.value;
              setEditingProgram({ ...editingProgram, end_date: end });
              setProgramDateError(
                validateEditDates(
                  editingProgram?.start_date,
                  end,
                  editingProgram?.duration_weeks,
                ),
              );
            }}
            className="w-full bg-primary border border-[var(--border-primary)] rounded-xl p-4 font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)] transition-all"
          />
        </div>
      </div>

      {programDateError && (
        <p className="text-[10px] font-bold text-rose-400 uppercase tracking-widest mt-1 ml-2">
          {programDateError}
        </p>
      )}

      {/* Visibility / Language */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest ml-2">
            {t?.("admin.visibility") || "Visibility"}
          </label>
          <select
            value={editingProgram?.visibility || "private"}
            onChange={(e) =>
              setEditingProgram({
                ...editingProgram,
                visibility: e.target.value,
              })
            }
            className="w-full bg-primary border border-[var(--border-primary)] rounded-xl p-4 text-[13px] font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)] transition-all cursor-pointer"
          >
            <option value="private">
              {t?.("admin.visibilityOptions.private") || "Private"}
            </option>
            <option value="public">
              {t?.("admin.visibilityOptions.public") || "Public"}
            </option>
            <option value="invite_only">
              {t?.("admin.visibilityOptions.inviteOnly") || "Invite Only"}
            </option>
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest ml-2">
            {t?.("admin.language") || "Language"}
          </label>
          <select
            value={editingProgram?.language || "en"}
            onChange={(e) =>
              setEditingProgram({
                ...editingProgram,
                language: e.target.value,
              })
            }
            className="w-full bg-primary border border-[var(--border-primary)] rounded-xl p-4 text-[13px] font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)] transition-all cursor-pointer"
          >
            <option value="en">English</option>
            <option value="fr">French</option>
          </select>
        </div>
      </div>

      {/* Vision / Objectives */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest ml-2">
            {t?.("admin.vision") || "Vision"}
          </label>
          <textarea
            rows={2}
            value={editingProgram?.vision || ""}
            onChange={(e) =>
              setEditingProgram({ ...editingProgram, vision: e.target.value })
            }
            className="w-full bg-primary border border-[var(--border-primary)] rounded-xl p-4 font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)] resize-none transition-all"
          />
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest ml-2">
            {t?.("admin.objectives") || "Objectives"}
          </label>
          <textarea
            rows={2}
            value={editingProgram?.objectives || ""}
            onChange={(e) =>
              setEditingProgram({
                ...editingProgram,
                objectives: e.target.value,
              })
            }
            className="w-full bg-primary border border-[var(--border-primary)] rounded-xl p-4 font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)] resize-none transition-all"
          />
        </div>
      </div>

      {/* Expected Outcomes / Success Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest ml-2">
            {t("adminMisc.programs.expectedOutcomes")}
          </label>
          <textarea
            rows={2}
            value={editingProgram?.expected_outcomes || ""}
            onChange={(e) =>
              setEditingProgram({
                ...editingProgram,
                expected_outcomes: e.target.value,
              })
            }
            className="w-full bg-primary border border-[var(--border-primary)] rounded-xl p-4 font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)] resize-none transition-all"
          />
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest ml-2">
            {t("adminMisc.programs.successMetrics")}
          </label>
          <textarea
            rows={2}
            value={editingProgram?.success_metrics || ""}
            onChange={(e) =>
              setEditingProgram({
                ...editingProgram,
                success_metrics: e.target.value,
              })
            }
            className="w-full bg-primary border border-[var(--border-primary)] rounded-xl p-4 font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)] resize-none transition-all"
          />
        </div>
      </div>

      {/* Registration Link */}
      <div className="space-y-2">
        <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest ml-2">
          {t("adminMisc.programs.registrationLink")}
        </label>
        <RegistrationLinkField formUrl={formUrl} formName={formName} />
      </div>
    </>
  );
}
