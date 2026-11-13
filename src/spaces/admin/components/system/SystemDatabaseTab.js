import { useI18n } from "@/lib/i18n";

export default function SystemDatabaseTab({ dbInfo }) {
  const { t } = useI18n();
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-[var(--surface-1)] border border-[var(--border-primary)] rounded-xl p-4">
        <h3 className="text-sm font-medium mb-4">{t("adminMisc.system.info")}</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between py-1 border-b border-[var(--border-secondary)]"><span className="text-[var(--text-secondary)]">{t("adminMisc.system.activeConnections")}</span><span>{dbInfo?.active_connections || 0}</span></div>
          <div className="flex justify-between py-1 border-b border-[var(--border-secondary)]"><span className="text-[var(--text-secondary)]">{t("adminMisc.system.size")}</span><span>{dbInfo?.database_size_mb || 0} MB</span></div>
        </div>
      </div>
      {dbInfo?.tables?.length > 0 && (
        <div className="bg-[var(--surface-1)] border border-[var(--border-primary)] rounded-xl p-4">
          <h3 className="text-sm font-medium mb-4">{t("adminMisc.system.tables")}</h3>
          <div className="space-y-1 max-h-[300px] overflow-y-auto">
            {dbInfo.tables.slice(0, 15).map((row, rowIndex) => (
              <div key={rowIndex} className="flex justify-between text-xs py-1 border-b border-divider/30">
                <span className="text-[var(--text-secondary)]">{row.tablename}</span>
                <span className="text-[var(--text-secondary)]">{t("adminMisc.system.rows", { count: row.approx_rows })}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
