import { MessageSquare } from "lucide-react";

/** Weekly reports (PM intelligence + instructor progress) rendered inside a programme week. */
export default function WeekReports({ reports, t }) {
  if (reports.length === 0) return null;

  return (
    <div className="mt-10 space-y-6">
      {reports.map((report, reportIndex) => (
        <div key={`report-${report.id || reportIndex}`} className="p-8 rounded-3xl bg-white/[0.03] border border-white/5 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <MessageSquare className={`w-4 h-4 ${report.report_type === 'pm' ? 'text-[var(--brand-orange)]' : 'text-emerald-500'}`} />
              <p className="text-[10px] font-black text-white uppercase tracking-widest">
                {report.report_type === 'pm' ? t("adminMisc.programDetail.pmIntelligenceReport") : t("adminMisc.programDetail.instructorProgressReport")}
              </p>
            </div>
            <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">
              {t("adminMisc.programDetail.submittedBy", { name: report.teacher_name || report.instructor_name })}
            </span>
          </div>

          {report.report_type === 'pm' ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${report.status === 'on-track' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                  {report.status}
                </span>
              </div>
              <p className="text-sm text-slate-200 font-bold leading-relaxed">{report.summary}</p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {report.week_status && (
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{t("adminMisc.programDetail.weekStatus")}</p>
                    <span className="inline-block px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest bg-white/5 border border-white/10">{report.week_status.replace(/_/g, ' ')}</span>
                  </div>
                )}
                {report.week_rating && (
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{t("adminMisc.programDetail.weekRating")}</p>
                    <span className="inline-block px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest bg-white/5 border border-white/10">{report.week_rating}</span>
                  </div>
                )}
                {report.main_topic && (
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{t("adminMisc.programDetail.mainTopic")}</p>
                    <p className="text-xs font-bold text-white">{report.main_topic}</p>
                  </div>
                )}
                {report.reception_score != null && (
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{t("adminMisc.programDetail.receptionScore")}</p>
                    <span className="inline-block px-2 py-1 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">{report.reception_score}/10</span>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-2">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{t("adminMisc.programDetail.progressNotes")}</p>
                  <p className="text-sm text-slate-200 font-bold leading-relaxed">{report.progress_notes || '—'}</p>
                </div>
                <div className="space-y-2">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{t("adminMisc.programDetail.actionPlan")}</p>
                  <p className="text-sm text-slate-200 font-bold leading-relaxed">{report.action_taken || '—'}</p>
                </div>
              </div>
              {(report.attendance_level || report.participation_level) && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-white/5">
                  {report.attendance_level && (
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{t("adminMisc.programDetail.attendance")}</p>
                      <span className="text-xs font-bold text-white">{report.attendance_level}</span>
                    </div>
                  )}
                  {report.participation_level && (
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{t("adminMisc.programDetail.participation")}</p>
                      <span className="text-xs font-bold text-white">{report.participation_level}</span>
                    </div>
                  )}
                  {report.program_on_track != null && (
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{t("adminMisc.programDetail.programOnTrack")}</p>
                      <span className={`text-xs font-bold ${report.program_on_track ? 'text-emerald-400' : 'text-rose-400'}`}>{report.program_on_track ? t("adminMisc.programDetail.yes") : t("adminMisc.programDetail.no")}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
