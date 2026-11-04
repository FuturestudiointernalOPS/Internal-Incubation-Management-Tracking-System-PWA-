"use client";

import { useState } from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useDialogs } from "@/components/ui/DialogProvider";
import { formatDate } from "./constants";

export default function SystemAlertsTab({ alerts, status, onAlertAction }) {
  const { t } = useI18n();
  const { confirm } = useDialogs();
  const [busyId, setBusyId] = useState(null);

  const openAlerts = status?.open_alerts || [];

  const runAction = async (alert, action) => {
    const isResolve = action === "resolve";
    const ok = await confirm({
      message: t(
        isResolve
          ? "adminMisc.system.confirmResolveAlert"
          : "adminMisc.system.confirmAcknowledgeAlert",
      ),
      tone: isResolve ? "danger" : "primary",
      confirmLabel: t(
        isResolve ? "adminMisc.system.resolveAlert" : "adminMisc.system.acknowledgeAlert",
      ),
    });
    if (!ok) return;

    setBusyId(alert.id);
    try {
      const response = await fetch("/api/system/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, alert_id: alert.id }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || "errors.somethingWrong");
      }
      await onAlertAction?.();
    } catch (error) {
      console.error(error);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="bg-[var(--surface-1)] border border-[var(--border-primary)] rounded-xl overflow-hidden">
      <div className="p-4 border-b border-[var(--border-primary)] text-sm text-[var(--text-secondary)]">
        {t("adminMisc.system.alertsOpen", { count: alerts?.open || 0 })} ·{" "}
        {t("adminMisc.system.alertsCritical", { count: alerts?.critical || 0 })}
      </div>
      {openAlerts.length > 0 ? (
        <div className="divide-y divide-[var(--border-secondary)]">
          {openAlerts.map((alert) => {
            const isBusy = busyId === alert.id;
            return (
              <div key={alert.id} className="flex items-start gap-3 p-4">
                {alert.severity === "critical" ? (
                  <AlertCircle size={16} className="mt-0.5 text-red-400 shrink-0" />
                ) : (
                  <AlertTriangle size={16} className="mt-0.5 text-amber-400 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{alert.title}</p>
                  {alert.message && (
                    <p className="text-xs text-[var(--text-secondary)] mt-1">{alert.message}</p>
                  )}
                  <div className="flex flex-wrap gap-2 mt-1.5 text-[10px] text-[var(--text-secondary)]">
                    <span
                      className={`px-1.5 py-0.5 rounded ${
                        alert.severity === "critical"
                          ? "bg-red-500/10 text-red-400"
                          : "bg-amber-500/10 text-amber-400"
                      }`}
                    >
                      {alert.severity}
                    </span>
                    <span>{alert.alert_type?.replace(/_/g, " ")}</span>
                    <span>{alert.status}</span>
                    <span>{formatDate(alert.created_at)}</span>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {alert.status === "open" && (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => runAction(alert, "acknowledge")}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-[var(--border-primary)] bg-[var(--surface-2)] hover:bg-[var(--surface-3)] disabled:opacity-50"
                      >
                        {isBusy ? <Loader2 size={12} className="animate-spin" /> : null}
                        {t("adminMisc.system.acknowledgeAlert")}
                      </button>
                    )}
                    {alert.status !== "resolved" && (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => runAction(alert, "resolve")}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 disabled:opacity-50"
                      >
                        {isBusy ? <Loader2 size={12} className="animate-spin" /> : null}
                        {t("adminMisc.system.resolveAlert")}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
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
