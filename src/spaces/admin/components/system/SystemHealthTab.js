import { Activity, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { COMPONENT_ICONS, COMPONENT_KEYS, STATUS_COLORS, formatDate } from "./constants";

export default function SystemHealthTab({ health }) {
  const { t } = useI18n();
  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {(Array.isArray(health) ? health : []).map((component) => {
          const Icon = COMPONENT_ICONS[component.component] || Activity;
          return (
            <div key={component.id || component.component} className={`rounded-xl p-4 border ${STATUS_COLORS[component.status] || STATUS_COLORS.healthy}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2"><Icon size={18} /><span className="font-medium capitalize">{t(COMPONENT_KEYS[component.component] || "") || component.component}</span></div>
                {component.status === "healthy" ? <CheckCircle2 size={18} className="text-emerald-400" /> :
                 component.status === "degraded" ? <AlertTriangle size={18} className="text-amber-400" /> :
                 <XCircle size={18} className="text-red-400" />}
              </div>
              <p className="text-xs text-[var(--text-secondary)]">{component.message || t("adminMisc.system.noMessage")}</p>
              {component.response_time_ms != null && <p className="text-xs text-[var(--text-secondary)] mt-2">{t("adminMisc.system.responseTime", { ms: component.response_time_ms })}</p>}
              <p className="text-[10px] text-[var(--text-tertiary)] mt-1">{formatDate(component.checked_at)}</p>
            </div>
          );
        })}
      </div>
      {(Array.isArray(health) ? health : []).length === 0 && (
        <div className="bg-[var(--surface-1)] border-[var(--border-primary)] rounded-xl p-12 text-center">
          <Activity className="mx-auto mb-3 text-[var(--text-secondary)]" size={40} />
          <p className="text-[var(--text-secondary)]">{t("adminMisc.system.noHealthChecks")}</p>
        </div>
      )}
    </div>
  );
}
