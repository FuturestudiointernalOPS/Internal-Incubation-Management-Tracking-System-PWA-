import { Cpu } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { formatDate } from "./constants";

export default function SystemJobsTab({ jobStats, jobs }) {
  const { t } = useI18n();
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-[var(--surface-1)] border border-[var(--border-primary)] rounded-xl p-4"><p className="text-2xl font-bold text-blue-400">{jobStats?.running || 0}</p><p className="text-xs text-[var(--text-secondary)]">{t("adminMisc.system.statsRunning")}</p></div>
        <div className="bg-[var(--surface-1)] border border-[var(--border-primary)] rounded-xl p-4"><p className="text-2xl font-bold text-amber-400">{jobStats?.queued || 0}</p><p className="text-xs text-[var(--text-secondary)]">{t("adminMisc.system.statsQueued")}</p></div>
        <div className="bg-[var(--surface-1)] border border-[var(--border-primary)] rounded-xl p-4"><p className="text-2xl font-bold text-red-400">{jobStats?.failed || 0}</p><p className="text-xs text-[var(--text-secondary)]">{t("adminMisc.system.statsFailed")}</p></div>
        <div className="bg-[var(--surface-1)] border border-[var(--border-primary)] rounded-xl p-4"><p className="text-2xl font-bold text-emerald-400">{jobStats?.completed_24h || 0}</p><p className="text-xs text-[var(--text-secondary)]">{t("adminMisc.system.statsCompleted")}</p></div>
      </div>
      {jobs.length > 0 ? (
        <div className="bg-[var(--surface-1)] border border-[var(--border-primary)] rounded-xl overflow-x-auto">
          <table className="w-full">
            <thead><tr className="border-b border-[var(--border-primary)]">
              <th className="text-left p-3 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("adminMisc.system.colJob")}</th>
              <th className="text-left p-3 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("adminMisc.system.colType")}</th>
              <th className="text-left p-3 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("adminMisc.system.status")}</th>
              <th className="text-left p-3 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("adminMisc.system.duration")}</th>
              <th className="text-left p-3 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("adminMisc.system.started")}</th>
            </tr></thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.id} className="border-b border-[var(--border-secondary)]">
                  <td className="p-3 text-sm">{job.job_name}</td>
                  <td className="p-3 text-sm text-[var(--text-secondary)]">{job.job_type}</td>
                  <td className="p-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      job.status === "completed" ? "bg-emerald-500/10 text-emerald-400" :
                      job.status === "running" ? "bg-blue-500/10 text-blue-400" :
                      job.status === "failed" ? "bg-red-500/10 text-red-400" : "bg-amber-500/10 text-amber-400"
                    }`}>{job.status}</span>
                  </td>
                  <td className="p-3 text-sm text-[var(--text-secondary)]">{job.duration_ms ? `${job.duration_ms}ms` : "-"}</td>
                  <td className="p-3 text-sm text-[var(--text-secondary)]">{formatDate(job.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-[var(--surface-1)] border-[var(--border-primary)] rounded-xl p-12 text-center">
          <Cpu className="mx-auto mb-3 text-[var(--text-secondary)]" size={40} />
          <p className="text-[var(--text-secondary)]">{t("adminMisc.system.noJobs")}</p>
        </div>
      )}
    </div>
  );
}
