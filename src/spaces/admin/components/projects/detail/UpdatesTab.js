import { Clock, Edit3, FileText, Send } from "lucide-react";
import { useI18n } from "@/lib/i18n";
export default function UpdatesTab({ updateForm,
  onFormChange,
  savingUpdate,
  onSubmitUpdate,
  onGenerateReport,
  updates,
  updatesLoading,
  updateStatusLabels, }) {
  const { t } = useI18n();
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Current Week Form */}
      <div className="card space-y-4">
        <div className="flex items-center gap-2">
          <Edit3 className="w-4 h-4 text-[var(--brand-orange)]" />
          <h3 className="text-[10px] font-bold text-[var(--brand-orange)] uppercase tracking-widest">
            {t("adminMisc.projectDetail.thisWeeksUpdate")}
          </h3>
          <button
            onClick={onGenerateReport}
            className="ml-auto px-3 py-1 rounded text-[10px] font-bold uppercase tracking-widest bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-white transition-all"
          >
            {t("adminMisc.projectDetail.generateReport")}
          </button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] block mb-1">
              {t("adminMisc.projectDetail.overallStatus")}
            </label>
            <select
              value={updateForm.overall_status}
              onChange={(event) => onFormChange("overall_status", event.target.value)}
              className="w-full bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-2 text-xs font-bold outline-none text-[var(--text-primary)] appearance-none cursor-pointer"
            >
              <option value="on_track">
                {t("adminMisc.projectDetail.statusOnTrack")}
              </option>
              <option value="at_risk">
                {t("adminMisc.projectDetail.statusAtRisk")}
              </option>
              <option value="behind">
                {t("adminMisc.projectDetail.statusBehind")}
              </option>
              <option value="completed">
                {t("adminMisc.projectDetail.statusCompleted")}
              </option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] block mb-1">
              {t("adminMisc.projectDetail.accomplishmentsThisWeek")}
            </label>
            <textarea
              value={updateForm.accomplishments}
              onChange={(event) => onFormChange("accomplishments", event.target.value)}
              placeholder={t("adminMisc.projectDetail.accomplishmentsPlaceholder")}
              rows={3}
              className="w-full bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-2 text-xs font-bold outline-none focus:border-[var(--brand-orange)] transition-all resize-none"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] block mb-1">
              {t("adminMisc.projectDetail.currentFocus")}
            </label>
            <textarea
              value={updateForm.current_focus}
              onChange={(event) => onFormChange("current_focus", event.target.value)}
              placeholder={t("adminMisc.projectDetail.currentFocusPlaceholder")}
              rows={2}
              className="w-full bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-2 text-xs font-bold outline-none focus:border-[var(--brand-orange)] transition-all resize-none"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] block mb-1">
              {t("adminMisc.projectDetail.blockersIssues")}
            </label>
            <textarea
              value={updateForm.blockers}
              onChange={(event) => onFormChange("blockers", event.target.value)}
              placeholder={t("adminMisc.projectDetail.blockersPlaceholder")}
              rows={2}
              className="w-full bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-2 text-xs font-bold outline-none focus:border-[var(--brand-orange)] transition-all resize-none"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] block mb-1">
              {t("adminMisc.projectDetail.nextSteps")}
            </label>
            <textarea
              value={updateForm.next_steps}
              onChange={(event) => onFormChange("next_steps", event.target.value)}
              placeholder={t("adminMisc.projectDetail.nextStepsPlaceholder")}
              rows={2}
              className="w-full bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-2 text-xs font-bold outline-none focus:border-[var(--brand-orange)] transition-all resize-none"
            />
          </div>
          <button
            onClick={onSubmitUpdate}
            disabled={
              savingUpdate ||
              (!updateForm.accomplishments && !updateForm.current_focus)
            }
            className="flex items-center justify-center gap-2 w-full py-3 bg-[var(--brand-orange)] text-black rounded-xl text-sm font-bold uppercase tracking-wide hover:brightness-110 transition-all disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5" />
            {savingUpdate
              ? t("adminMisc.projectDetail.saving")
              : t("adminMisc.projectDetail.submitWeeklyUpdate")}
          </button>
        </div>
      </div>

      {/* Previous Updates */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-slate-500" />
          <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
            {t("adminMisc.projectDetail.previousUpdates")}
          </h3>
          <span className="text-[10px] font-medium text-[var(--text-secondary)] ml-auto">
            {t("adminMisc.projectDetail.totalCount", {
              count: updates.length,
            })}
          </span>
        </div>

        {updates.length === 0 && !updatesLoading ? (
          <div className="card py-12 flex flex-col items-center justify-center text-center opacity-50 border-dashed">
            <FileText className="w-10 h-10 mb-2" />
            <p className="text-sm text-[var(--text-secondary)]">
              {t("adminMisc.projectDetail.noUpdates")}
            </p>
            <p className="text-sm text-[var(--text-secondary)] mt-1">
              {t("adminMisc.projectDetail.noUpdatesHint")}
            </p>
          </div>
        ) : updatesLoading ? (
          <div className="text-center py-8 text-[10px] font-medium text-[var(--text-secondary)]">
            {t("adminMisc.projectDetail.loadingUpdates")}
          </div>
        ) : (
          <div className="space-y-2 max-h-[600px] overflow-y-auto custom-scrollbar pr-1">
            {updates.map((update) => {
              const statusColors = {
                on_track: "text-emerald-500",
                at_risk: "text-amber-500",
                behind: "text-rose-500",
                completed: "text-purple-500",
              };
              const statusBg = {
                on_track: "bg-emerald-500/10",
                at_risk: "bg-amber-500/10",
                behind: "bg-rose-500/10",
                completed: "bg-purple-500/10",
              };
              return (
                <div key={update.id} className="card p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black">
                        {t("adminMisc.projectDetail.weekLabel", {
                          week: update.week_number,
                          year: update.year,
                        })}
                      </span>
                      <span
                        className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded ${
                          statusBg[update.overall_status] ||
                          "bg-slate-500/10"
                        } ${
                          statusColors[update.overall_status] ||
                          "text-slate-500"
                        }`}
                      >
                        {updateStatusLabels[update.overall_status] ||
                          update.overall_status.replace(/_/g, " ")}
                      </span>
                    </div>
                    <span className="text-[10px] font-medium text-[var(--text-secondary)]">
                      {new Date(update.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  {update.accomplishments && (
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-1">
                        {t("adminMisc.projectDetail.accomplishments")}
                      </p>
                      <p className="text-[10px] text-[var(--text-secondary)] whitespace-pre-wrap">
                        {update.accomplishments}
                      </p>
                    </div>
                  )}
                  {update.current_focus && (
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-1">
                        {t("adminMisc.projectDetail.currentFocus")}
                      </p>
                      <p className="text-[10px] text-[var(--text-secondary)] whitespace-pre-wrap">
                        {update.current_focus}
                      </p>
                    </div>
                  )}
                  {update.blockers && (
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-1">
                        {t("adminMisc.projectDetail.blockers")}
                      </p>
                      <p className="text-[10px] text-rose-400 whitespace-pre-wrap">
                        {update.blockers}
                      </p>
                    </div>
                  )}
                  {update.next_steps && (
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-1">
                        {t("adminMisc.projectDetail.nextSteps")}
                      </p>
                      <p className="text-[10px] text-[var(--text-secondary)] whitespace-pre-wrap">
                        {update.next_steps}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
