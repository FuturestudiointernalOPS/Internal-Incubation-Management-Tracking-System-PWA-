import { BarChart3, AlertTriangle, FileText } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { TableSkeleton } from "@/components/ui/Skeleton";
import ReportCard from "./ReportCard";

export default function FeedTab({
  userStats,
  viewingUser,
  setViewingUser,
  loading,
  filteredReports,
  reportsPage,
  PAGE_SIZE,
  setReportsPage,
  setViewingReport,
}) {
  const { t } = useI18n();
  return (
    <>
      {/* TEAM OVERVIEW CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {userStats
          .sort(
            (statA, statB) =>
              statB.standups +
              statB.retros -
              (statA.standups + statA.retros),
          )
          .map((stat) => (
            <button
              key={stat.id}
              onClick={() => setViewingUser(stat)}
              className={`p-4 rounded-xl border transition-all text-left ${
                viewingUser?.id === stat.id
                  ? "bg-brand-orange/5 border-brand-orange/30"
                  : "bg-tertiary border-[var(--border-primary)] hover:border-brand-orange/30"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-black uppercase tracking-tight text-[var(--text-primary)]">
                  {stat.name}
                </span>
                <span className="text-[10px] font-bold uppercase text-[var(--text-secondary)] px-1.5 py-0.5 bg-primary rounded">
                  {stat.role}
                </span>
              </div>
              <div className="flex items-center gap-4 text-[10px] font-bold text-[var(--text-secondary)]">
                <span className="flex items-center gap-1">
                  <BarChart3 className="w-3 h-3" />{" "}
                  {stat.standups + stat.retros}
                </span>
                <span className="flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 text-rose-400" />{" "}
                  {stat.blockers.length}
                </span>
              </div>
              <p className="text-[10px] font-medium text-[var(--text-secondary)] mt-1">
                {stat.latest
                  ? new Date(stat.latest).toLocaleDateString()
                  : t("reports.noActivity")}
              </p>
            </button>
          ))}
      </div>

      {/* REPORTS LIST */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black uppercase tracking-tight text-[var(--text-primary)]">
            {viewingUser
              ? t("reports.userReports", { name: viewingUser.name })
              : t("reports.recentReports")}
          </h3>
          {viewingUser && (
            <button
              onClick={() => setViewingUser(null)}
              className="text-[10px] font-bold text-[var(--brand-orange)] uppercase tracking-wide hover:underline"
            >
              {t("common.clearFilter")}
            </button>
          )}
        </div>

        {loading ? (
          <TableSkeleton rows={6} />
        ) : filteredReports.length === 0 ? (
          <div className="card py-32 flex flex-col items-center justify-center text-center opacity-40 border-dashed">
            <FileText className="w-16 h-16 mb-4" />
            <p className="text-sm text-[var(--text-secondary)]">
              {t("reports.noReportsFound")}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredReports
              .slice(0, reportsPage * PAGE_SIZE)
              .map((report) => (
                <ReportCard
                  key={report.id}
                  report={report}
                  onClick={() => setViewingReport(report)}
                />
              ))}
          </div>
        )}

        {/* Load More for reports */}
        {filteredReports.length > reportsPage * PAGE_SIZE && (
          <div className="flex justify-center pt-2">
            <button
              onClick={() => setReportsPage((page) => page + 1)}
              className="px-6 py-2.5 bg-tertiary border border-[var(--border-primary)] rounded-lg text-[10px] font-bold uppercase tracking-wide hover:border-brand-orange/30 transition-all"
            >
              {t("reports.loadMore", {
                count: filteredReports.length - reportsPage * PAGE_SIZE,
              })}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
