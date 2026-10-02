import { AlertTriangle, Clock, Eye } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export default function ReportCard({ report, onClick }) {
  const { t } = useI18n();
  return (
    <div
      className="card group hover:border-[var(--brand-orange)] transition-all bg-secondary/50 cursor-pointer"
      onClick={onClick}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div
            className={
              "w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black " +
              (report.report_type === "standup"
                ? "bg-brand-orange/10 text-[var(--brand-orange)] border border-brand-orange/20"
                : "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20")
            }
          >
            {report.report_type === "standup" ? "M" : "F"}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-black uppercase tracking-tight text-[var(--text-primary)]">
                {report.user_name}
              </span>
              <span className="text-[10px] font-bold uppercase text-[var(--text-secondary)] px-1.5 py-0.5 bg-tertiary rounded">
                {report.user_role}
              </span>
            </div>
            <div className="flex items-center gap-3 text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest opacity-60">
              <span>
                W{report.week_number} · {report.year}
              </span>
              <span className="w-1 h-1 rounded-full bg-slate-700" />
              <span>
                {report.report_type === "standup"
                  ? t("reports.standup")
                  : t("reports.retro")}
              </span>
              <span className="w-1 h-1 rounded-full bg-slate-700" />
              {report.has_blockers && (
                <AlertTriangle className="w-3 h-3 text-rose-500" />
              )}
              <Clock className="w-3 h-3" />{" "}
              {new Date(report.created_at).toLocaleDateString()}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`text-[10px] font-bold uppercase px-2 py-1 rounded ${
              report.status === "submitted"
                ? "bg-emerald-500/10 text-emerald-500"
                : "bg-amber-500/10 text-amber-500"
            }`}
          >
            {{
              submitted: t("status.submitted"),
              draft: t("status.draft"),
            }[report.status] || report.status}
          </span>
          <button className="btn btn-secondary !p-3 rounded-xl border-[var(--border-primary)] group-hover:border-[var(--brand-orange)]">
            <Eye className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
