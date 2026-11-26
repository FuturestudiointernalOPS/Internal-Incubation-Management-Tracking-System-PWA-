import { useI18n } from "@/lib/i18n";

export default function AttendanceTab({ onOpenAttendanceModal, sessions }) {
  const { t } = useI18n();

  return (
    <div className="space-y-6 animate-in">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-black uppercase tracking-widest text-[var(--text-primary)]">
          {t("pmMisc.workspace.attendanceOverview")}
        </h3>
      </div>
      <p className="text-[10px] text-[var(--text-secondary)]">
        {t("pmMisc.workspace.attendanceSelectWeek")}
      </p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {sessions
          .filter((session) => session.type === "session")
          .sort(
            (first, second) =>
              (first.week_number || 0) - (second.week_number || 0),
          )
          .map((session) => (
            <div
              key={session.id}
              className="card border border-[var(--border-primary)] hover:border-indigo-500/30 transition-all cursor-pointer"
              onClick={() => onOpenAttendanceModal(session)}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-lg font-black text-indigo-400">
                  {session.week_number || "?"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-bold text-[var(--text-primary)] truncate">
                    {session.title}
                  </p>
                  <p className="text-[8px] text-[var(--text-secondary)] uppercase tracking-wider">
                    {t("pmMisc.workspace.week")} {session.week_number}
                  </p>
                </div>
              </div>
              {session.scheduled_date && (
                <p className="text-[9px] text-[var(--text-secondary)] mb-2">
                  {new Date(session.scheduled_date).toLocaleDateString(
                    "fr-FR",
                    { day: "numeric", month: "short", year: "numeric" },
                  )}
                </p>
              )}
              <button className="w-full py-2 rounded-lg bg-indigo-500/10 text-indigo-400 text-[9px] font-black uppercase tracking-widest hover:bg-indigo-500/20 transition-all">
                {t("pmMisc.workspace.openAttendance")}
              </button>
            </div>
          ))}
        {sessions.filter((session) => session.type === "session").length ===
          0 && (
          <div className="col-span-3 py-12 text-center">
            <p className="text-[11px] text-slate-500">
              {t("pmMisc.workspace.noSessionsYet")}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
