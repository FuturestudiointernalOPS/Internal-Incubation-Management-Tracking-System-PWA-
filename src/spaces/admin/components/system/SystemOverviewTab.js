import { Activity } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import {
  COMPONENT_ICONS,
  COMPONENT_KEYS,
  ENV_KEYS,
  STATUS_COLORS,
  STATUS_KEYS,
} from "./constants";

export default function SystemOverviewTab({ health, status, apiMonitor, storage }) {
  const { t } = useI18n();
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {(Array.isArray(health) ? health : []).map((component) => {
          const Icon = COMPONENT_ICONS[component.component] || Activity;
          return (
            <div key={component.id || component.component} className={`rounded-xl p-3 border ${STATUS_COLORS[component.status] || STATUS_COLORS.healthy}`}>
              <Icon size={16} className="mb-1.5" />
              <p className="text-xs font-medium capitalize truncate">{t(COMPONENT_KEYS[component.component] || "") || component.component}</p>
              <p className={`text-[10px] mt-0.5 ${component.status === "healthy" ? "text-emerald-400" : component.status === "degraded" ? "text-amber-400" : "text-red-400"}`}>
                {t(STATUS_KEYS[component.status] || "") || component.status}
              </p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-[var(--surface-1)] border border-[var(--border-primary)] rounded-xl p-4">
          <h3 className="text-sm font-medium text-[var(--text-primary)] mb-3">{t("adminMisc.system.systemTitle")}</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-[var(--text-secondary)]">{t("adminMisc.system.status")}</span>
              <span className={`${status?.status === "healthy" ? "text-emerald-400" : status?.status === "degraded" ? "text-amber-400" : "text-red-400"}`}>
                {t(STATUS_KEYS[status?.status] || "") || status?.status || t("adminMisc.system.unknown")}
              </span>
            </div>
            <div className="flex justify-between"><span className="text-[var(--text-secondary)]">{t("adminMisc.system.uptime")}</span><span className="text-[var(--text-primary)]">{Math.round(status?.uptime || 0)}s</span></div>
            <div className="flex justify-between"><span className="text-[var(--text-secondary)]">{t("adminMisc.system.env")}</span><span className="text-[var(--text-primary)]">{t(ENV_KEYS[status?.environment] || "") || status?.environment || t("adminMisc.system.na")}</span></div>
          </div>
        </div>
        <div className="bg-[var(--surface-1)] border border-[var(--border-primary)] rounded-xl p-4">
          <h3 className="text-sm font-medium text-[var(--text-primary)] mb-3">{t("adminMisc.system.apiActivity")}</h3>
          <div className="grid grid-cols-2 gap-2">
            <div><p className="text-xl font-bold">{apiMonitor?.total_requests || 0}</p><p className="text-xs text-[var(--text-secondary)]">{t("adminMisc.system.requests")}</p></div>
            <div><p className="text-xl font-bold text-red-400">{apiMonitor?.errors || 0}</p><p className="text-xs text-[var(--text-secondary)]">{t("adminMisc.system.errors")}</p></div>
          </div>
        </div>
        <div className="bg-[var(--surface-1)] border border-[var(--border-primary)] rounded-xl p-4">
          <h3 className="text-sm font-medium text-[var(--text-primary)] mb-3">{t("adminMisc.system.storage")}</h3>
          <div className="grid grid-cols-2 gap-2">
            <div><p className="text-xl font-bold">{storage?.database_size_mb || 0} MB</p><p className="text-xs text-[var(--text-secondary)]">{t("adminMisc.system.database")}</p></div>
            <div><p className="text-xl font-bold">{storage?.total_ventures || 0}</p><p className="text-xs text-[var(--text-secondary)]">{t("adminMisc.system.ventures")}</p></div>
          </div>
        </div>
      </div>
    </div>
  );
}
