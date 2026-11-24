import { FileText, Loader2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { REPORT_TYPE_KEYS, formatDate } from "./constants";

export default function SystemReportsTab({ reports, generatingReport, onGenerateReport }) {
  const { t } = useI18n();
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3">
        <button onClick={() => onGenerateReport("daily")} disabled={generatingReport}
          className="px-4 py-2 bg-[var(--surface-1)] border border-[var(--border-primary)] rounded-xl text-sm hover:bg-[var(--surface-2)] disabled:opacity-50 flex items-center gap-2">
          {generatingReport && <Loader2 className="animate-spin" size={12} />}
          {t("adminMisc.system.generateDailyReport")}
        </button>
        <button onClick={() => onGenerateReport("weekly")} disabled={generatingReport}
          className="px-4 py-2 bg-[var(--surface-1)] border border-[var(--border-primary)] rounded-xl text-sm hover:bg-[var(--surface-2)] disabled:opacity-50">
          {t("adminMisc.system.generateWeeklyReport")}
        </button>
        <button onClick={() => onGenerateReport("monthly")} disabled={generatingReport}
          className="px-4 py-2 bg-[var(--surface-1)] border border-[var(--border-primary)] rounded-xl text-sm hover:bg-[var(--surface-2)] disabled:opacity-50">
          {t("adminMisc.system.generateMonthlyReport")}
        </button>
      </div>
      {reports.length > 0 ? (
        <div className="bg-[var(--surface-1)] border border-[var(--border-primary)] rounded-xl overflow-x-auto">
          <table className="w-full">
            <thead><tr className="border-b border-[var(--border-primary)]">
              <th className="text-left p-3 text-xs text-[var(--text-secondary)]">{t("adminMisc.system.colTitle")}</th>
              <th className="text-left p-3 text-xs text-[var(--text-secondary)]">{t("adminMisc.system.colType")}</th>
              <th className="text-left p-3 text-xs text-[var(--text-secondary)]">{t("adminMisc.system.period")}</th>
              <th className="text-left p-3 text-xs text-[var(--text-secondary)] max-w-[300px]">{t("adminMisc.system.summary")}</th>
              <th className="text-left p-3 text-xs text-[var(--text-secondary)]">{t("adminMisc.system.generated")}</th>
            </tr></thead>
            <tbody>
              {reports.map((report) => (
                <tr key={report.id} className="border-b border-[var(--border-secondary)]">
                  <td className="p-3 text-sm font-medium">{report.title}</td>
                  <td className="p-3"><span className="text-xs px-2 py-0.5 bg-blue-500/10 text-blue-400 rounded-full">{t(REPORT_TYPE_KEYS[report.report_type] || "") || report.report_type}</span></td>
                  <td className="p-3 text-sm text-[var(--text-secondary)]">{report.period_start} → {report.period_end}</td>
                  <td className="p-3 text-sm text-[var(--text-secondary)] truncate max-w-[300px]">{report.summary}</td>
                  <td className="p-3 text-sm text-[var(--text-secondary)] whitespace-nowrap">{formatDate(report.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-[var(--surface-1)] border border-[var(--border-primary)] rounded-xl p-12 text-center">
          <FileText className="mx-auto mb-3 text-[var(--text-secondary)]" size={40} />
          <p className="text-[var(--text-secondary)]">{t("adminMisc.system.noReports")}</p>
        </div>
      )}
    </div>
  );
}
