import { AlertCircle, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { formatDate } from "./constants";

export default function SystemAlertsTab({ alerts, status }) {
  const { t } = useI18n();
  return (
    <div className="bg-[var(--surface-1)] border border-[var(--border-primary)] rounded-xl overflow-hidden">
      <div className="p-4 border-b border-[var(--border-primary)] text-sm text-[var(--text-secondary)]">
        {t("adminMisc.system.alertsOpen", { count: alerts?.open || 0 })} · {t("adminMisc.system.alertsCritical", { count: alerts?.critical || 0 })}
      </div>
      {status?.open_alerts?.length > 0 ? (
        <div className="divide-y divide-[var(--border-secondary)]">
          {status.open_alerts.map((alert) => (
            <div key={alert.id} className="flex items-start gap-3 p-4">
              {alert.severity === "critical" ? <AlertCircle size={16} className="mt-0.5 text-red-400 shrink-0" /> :
               <AlertTriangle size={16} className="mt-0.5 text-amber-400 shrink-0" />}
              <div>
                <p className="text-sm font-medium">{alert.title}</p>
                {alert.message && <p className="text-xs text-[var(--text-secondary)] mt-1">{alert.message}</p>}
                <div className="flex gap-2 mt-1.5 text-[10px] text-[var(--text-secondary)]">
                  <span className={`px-1.5 py-0.5 rounded ${alert.severity === "critical" ? "bg-red-500/10 text-red-400" : "bg-amber-500/10 text-amber-400"}`}>
                    {alert.severity}
                  </span>
                  <span>{alert.alert_type?.replace(/_/g, " ")}</span>
                  <span>{formatDate(alert.created_at)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-12 text-center">
          <CheckCircle2 className="mx-auto mb-3 text-emerald-400" size={40} />
          <p className="text-[var(--text-secondary)]">{t("adminMisc.system.noOpenAlerts")}</p>
        </div>
      )}
    </div>
  );
}
