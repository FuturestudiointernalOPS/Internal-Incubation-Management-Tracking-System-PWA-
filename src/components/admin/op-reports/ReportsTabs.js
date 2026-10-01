import {
  Activity,
  Calendar,
  ListTodo,
  AlertTriangle,
  TrendingUp,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";

export default function ReportsTabs({ activeTab, onSelectTab }) {
  const { t } = useI18n();
  return (
    <div className="flex gap-1 border-b border-[var(--border-primary)]">
      {[
        { id: "feed", label: t("reports.reportFeed"), icon: Activity },
        {
          id: "monthly",
          label: t("reports.monthlyBreakdown"),
          icon: Calendar,
        },
        {
          id: "tasks",
          label: t("reports.tasks"),
          icon: ListTodo,
        },
        {
          id: "blockers",
          label: t("reports.blockers"),
          icon: AlertTriangle,
        },
        {
          id: "trends",
          label: t("reports.trends"),
          icon: TrendingUp,
        },
      ].map((tab) => (
        <button
          key={tab.id}
          onClick={() => onSelectTab(tab.id)}
          className={`flex items-center gap-2 px-5 py-3 text-[10px] font-black uppercase tracking-widest transition-all border-b-2 ${
            activeTab === tab.id
              ? "border-[var(--brand-orange)] text-[var(--text-primary)]"
              : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          }`}
        >
          <tab.icon className="w-3.5 h-3.5" />
          {tab.label}
        </button>
      ))}
    </div>
  );
}
