import { AlertTriangle } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export default function UserTimelineModal({
  viewingUser,
  userReports,
  setViewingUser,
  setViewingReport,
}) {
  const { t } = useI18n();
  return (
    <div
      className="fixed inset-0 z-[450] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6"
      onClick={() => setViewingUser(null)}
    >
      <div
        className="card w-full max-w-2xl max-h-[85vh] overflow-y-auto space-y-6"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex justify-between items-start">
          <div>
            <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">
              {t("reports.staffTimeline")}
            </span>
            <h3 className="text-2xl font-black text-white uppercase tracking-tight mt-1">
              {viewingUser.name}
            </h3>
          </div>
          <button
            onClick={() => setViewingUser(null)}
            className="p-2 hover:bg-white/5 rounded-lg"
          >
            <svg
              className="w-6 h-6"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          </button>
        </div>

        <div className="flex flex-wrap gap-4 text-[10px] font-bold">
          <span className="text-[var(--text-secondary)]">
            {t("reports.totalReports")}: {userReports.length}
          </span>
          <span className="text-[var(--brand-orange)]">
            {userReports.filter((report) => report.report_type === "standup")
              .length}{" "}
            {t("reports.standups")}
          </span>
          <span className="text-emerald-500">
            {userReports.filter((report) => report.report_type === "retro")
              .length}{" "}
            {t("reports.retros")}
          </span>
          <span className="text-rose-500">
            {userReports.filter((report) => report.has_blockers).length}{" "}
            {t("reports.blockers")}
          </span>
        </div>

        {/* Consistency Score */}
        {(() => {
          const total = userReports.length;
          const weeks = new Set(
            userReports.map(
              (report) =>
                String(report.year) +
                "-W" +
                String(report.week_number).padStart(2, "0"),
            ),
          );
          const uniqueWeeks = weeks.size;
          const maxPossible = uniqueWeeks * 2; // one standup + one retro per week
          const reliability =
            maxPossible > 0 ? Math.round((total / maxPossible) * 100) : 0;

          // Calculate current streak (consecutive weeks with at least one report)
          const sorted = [...userReports].sort(
            (reportA, reportB) =>
              reportB.year - reportA.year ||
              reportB.week_number - reportA.week_number,
          );
          const weekSet = new Set(
            sorted.map(
              (report) =>
                String(report.year) +
                "-W" +
                String(report.week_number).padStart(2, "0"),
            ),
          );
          let _streak = 0;
          const weekList = [...weekSet].sort().reverse();
          for (let weekIndex = 0; weekIndex < weekList.length; weekIndex++) {
            if (weekIndex === 0) {
              _streak = 1;
              continue;
            }
            _streak++;
          }

          return (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 bg-primary rounded-xl border border-[var(--border-primary)] text-center">
                <p className="text-lg font-black text-emerald-500">
                  {reliability}%
                </p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                  {t("reports.reliability")}
                </p>
              </div>
              <div className="p-3 bg-primary rounded-xl border border-[var(--border-primary)] text-center">
                <p className="text-lg font-black text-[var(--brand-orange)]">
                  {uniqueWeeks}
                </p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                  {t("reports.activeWeeks")}
                </p>
              </div>
              <div className="p-3 bg-primary rounded-xl border border-[var(--border-primary)] text-center">
                <p className="text-lg font-black text-indigo-500">
                  {uniqueWeeks * 2 - total > 0
                    ? uniqueWeeks * 2 - total
                    : 0}
                </p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                  {t("reports.missedReports")}
                </p>
              </div>
            </div>
          );
        })()}

        <div className="space-y-2">
          {userReports.map((report) => (
            <button
              key={report.id}
              onClick={() => {
                setViewingReport(report);
                setViewingUser(null);
              }}
              className="w-full flex items-center justify-between p-3 rounded-xl bg-tertiary border border-[var(--border-primary)] hover:border-brand-orange/30 transition-all text-left"
            >
              <div className="flex items-center gap-3">
                <div
                  className={
                    "w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-black " +
                    (report.report_type === "standup"
                      ? "bg-brand-orange/10 text-[var(--brand-orange)]"
                      : "bg-emerald-500/10 text-emerald-500")
                  }
                >
                  {report.report_type === "standup" ? "M" : "F"}
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase">
                    W{report.week_number} · {report.year}
                  </p>
                  <p className="text-[10px] font-medium text-[var(--text-secondary)]">
                    {new Date(report.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {report.has_blockers && (
                  <AlertTriangle className="w-3 h-3 text-rose-500" />
                )}
                <span
                  className={
                    "text-[10px] font-bold uppercase px-2 py-0.5 rounded " +
                    (report.status === "submitted"
                      ? "bg-emerald-500/10 text-emerald-500"
                      : "bg-amber-500/10 text-amber-500")
                  }
                >
                  {{
                    submitted: t("status.submitted"),
                    draft: t("status.draft"),
                  }[report.status] || report.status}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
