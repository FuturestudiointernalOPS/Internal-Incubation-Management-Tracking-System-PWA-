import { useI18n } from "@/lib/i18n";

export default function SystemApiTab({ apiMonitor }) {
  const { t } = useI18n();
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-[var(--surface-1)] border border-[var(--border-primary)] rounded-xl p-4">
        <h3 className="text-sm font-medium mb-4">{t("adminMisc.system.summary")}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-[var(--bg-primary)] rounded-lg p-3"><p className="text-2xl font-bold">{apiMonitor?.total_requests || 0}</p><p className="text-xs text-[var(--text-secondary)]">{t("adminMisc.system.requests")}</p></div>
          <div className="bg-[var(--bg-primary)] rounded-lg p-3"><p className="text-2xl font-bold text-red-400">{apiMonitor?.errors || 0}</p><p className="text-xs text-[var(--text-secondary)]">{t("adminMisc.system.errors")}</p></div>
          <div className="bg-[var(--bg-primary)] rounded-lg p-3"><p className="text-2xl font-bold">{apiMonitor?.error_rate || 0}%</p><p className="text-xs text-[var(--text-secondary)]">{t("adminMisc.system.errorRate")}</p></div>
        </div>
      </div>
      {apiMonitor?.slow_endpoints?.length > 0 && (
        <div className="bg-[var(--surface-1)] border border-[var(--border-primary)] rounded-xl p-4">
          <h3 className="text-sm font-medium mb-4">{t("adminMisc.system.slowEndpoints")}</h3>
          <div className="space-y-1.5">
            {apiMonitor.slow_endpoints.map((endpoint, index) => (
              <div key={index} className="flex justify-between text-xs">
                <span className="text-[var(--text-secondary)] font-mono truncate max-w-[250px]">{endpoint.endpoint}</span>
                <span className="text-amber-400">{Math.round(endpoint.avg_ms)}ms</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
