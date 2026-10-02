import { useI18n } from "@/lib/i18n";
import { BarChart3, FileText } from "lucide-react";

export default function ReportsTab({ onExportPmReport, reports, user }) {
  const { t } = useI18n();

  return (
    <div className="space-y-6">
      {user.role === "program_manager" && (
        <div className="flex items-start gap-3 p-4 rounded-xl border border-brand-orange/30 bg-brand-orange/5">
          <FileText className="w-5 h-5 text-[var(--brand-orange)] shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-black uppercase tracking-tight text-[var(--text-primary)]">
              {t("pmMisc.workspace.reportsGoToCurriculumTitle")}
            </p>
            <p className="text-[11px] text-[var(--text-secondary)] mt-1 leading-relaxed">
              {t("pmMisc.workspace.reportsGoToCurriculumHint")}
            </p>
          </div>
        </div>
      )}
      {/* Export Bar */}
      <div className="flex flex-wrap items-center gap-2 p-3 bg-tertiary rounded-xl border border-[var(--border-primary)]">
        <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mr-2">
          {t("pmMisc.workspace.exportLabel")}
        </span>
        {[
          {
            label: t("pmMisc.workspace.exportParticipantsCsv"),
            type: "participants",
            format: "csv",
          },
          {
            label: t("pmMisc.workspace.exportParticipantsXlsx"),
            type: "participants",
            format: "xlsx",
          },
          {
            label: t("pmMisc.workspace.exportAttendanceCsv"),
            type: "attendance",
            format: "csv",
          },
          {
            label: t("pmMisc.workspace.exportSubmissionsCsv"),
            type: "submissions",
            format: "csv",
          },
          {
            label: t("pmMisc.workspace.exportTeamsCsv"),
            type: "teams",
            format: "csv",
          },
          {
            label: t("pmMisc.workspace.exportCalendarIcal"),
            type: "ical",
            format: "ical",
          },
          {
            label: t("pmMisc.workspace.exportParticipantsPdf"),
            type: "participants",
            format: "pdf",
          },
        ].map(({ label, type, format }) => (
          <button
            key={`${type}-${format}`}
            onClick={() => onExportPmReport(type, format, label)}
            className={`px-3 py-1.5 text-[10px] font-bold uppercase rounded-lg border transition-all ${
              format === "xlsx"
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20"
                : format === "pdf"
                  ? "bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-500/20"
                  : "bg-brand-orange/10 text-[var(--brand-orange)] border-brand-orange/20 hover:bg-brand-orange/20"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex justify-between items-center">
        <h3 className="text-xl font-black uppercase tracking-tighter">
          {t("pmMisc.workspace.reportsWeeklyFeed")}
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase">
            {t("pmMisc.workspace.totalSignals")}
          </span>
          <span className="text-sm font-black">{reports.length}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {reports.map((report, index) => (
          <div
            key={report.id || index}
            className="card !p-0 overflow-hidden border-[var(--border-primary)] hover:border-[var(--brand-orange)] transition-all"
          >
            <div className="p-4 bg-tertiary flex justify-between items-center border-b border-[var(--border-primary)]">
              <div className="flex items-center gap-4">
                <div className="px-3 py-1 bg-[var(--brand-orange)] text-white text-[10px] font-black rounded uppercase">
                  Wk{report.week_number}
                </div>
                <span className="text-xs font-bold uppercase tracking-tight text-[var(--text-primary)]">
                  {t("pmMisc.workspace.submissionBy", {
                    name:
                      report.staff_name ||
                      report.teacher_name ||
                      t("pmMisc.workspace.staffMember"),
                  })}
                </span>
              </div>
              <span className="text-[10px] font-medium text-[var(--text-secondary)]">
                {new Date(report.created_at).toLocaleDateString()}
              </span>
            </div>
            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--brand-orange)] mb-1">
                    {t("pmMisc.workspace.reportChallenges")}
                  </p>
                  <p className="text-xs text-[var(--text-primary)] leading-relaxed">
                    {report.challenges || t("pmMisc.workspace.noDataReported")}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-500 mb-1">
                    {t("pmMisc.workspace.reportHighlights")}
                  </p>
                  <p className="text-xs text-[var(--text-primary)] leading-relaxed">
                    {report.highlights || t("pmMisc.workspace.noDataReported")}
                  </p>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-blue-500 mb-1">
                    {t("pmMisc.workspace.reportNextSteps")}
                  </p>
                  <p className="text-xs text-[var(--text-primary)] leading-relaxed">
                    {report.planned_adjustments ||
                      report.next_steps ||
                      t("pmMisc.workspace.noDataReported")}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div className="p-3 bg-primary rounded-lg border border-[var(--border-primary)]">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                      {t("pmMisc.workspace.attendance")}
                    </p>
                    <p className="text-sm font-black">
                      {report.attendance_count || 0}
                    </p>
                  </div>
                  <div className="p-3 bg-primary rounded-lg border border-[var(--border-primary)]">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                      {t("pmMisc.workspace.sessions")}
                    </p>
                    <p className="text-sm font-black">
                      {report.sessions_completed || 0}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
        {reports.length === 0 && (
          <div className="py-20 text-center card border-dashed opacity-40">
            <BarChart3 className="w-10 h-10 mx-auto mb-4 opacity-20" />
            <p className="text-xs font-bold uppercase tracking-widest">
              {t("pmMisc.workspace.awaitingReports")}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
