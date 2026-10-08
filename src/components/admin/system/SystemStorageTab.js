import { Activity, FileText, HardDrive, Server } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export default function SystemStorageTab({ storage }) {
  const { t } = useI18n();
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div className="bg-[var(--surface-1)] border border-[var(--border-primary)] rounded-xl p-4">
        <HardDrive size={20} className="text-blue-400 mb-2" />
        <p className="text-2xl font-bold">{storage?.database_size_mb || 0} MB</p>
        <p className="text-xs text-[var(--text-secondary)]">{t("adminMisc.system.databaseSize")}</p>
      </div>
      <div className="bg-[var(--surface-1)] border border-[var(--border-primary)] rounded-xl p-4">
        <Server size={20} className="text-emerald-400 mb-2" />
        <p className="text-2xl font-bold">{storage?.total_ventures || 0}</p>
        <p className="text-xs text-[var(--text-secondary)]">{t("adminMisc.system.ventures")}</p>
      </div>
      <div className="bg-[var(--surface-1)] border border-[var(--border-primary)] rounded-xl p-4">
        <Activity size={20} className="text-purple-400 mb-2" />
        <p className="text-2xl font-bold">{storage?.total_users || 0}</p>
        <p className="text-xs text-[var(--text-secondary)]">{t("adminMisc.system.users")}</p>
      </div>
      <div className="bg-[var(--surface-1)] border border-[var(--border-primary)] rounded-xl p-4">
        <FileText size={20} className="text-amber-400 mb-2" />
        <p className="text-2xl font-bold">{storage?.total_documents || 0}</p>
        <p className="text-xs text-[var(--text-secondary)]">{t("adminMisc.system.documents")}</p>
      </div>
    </div>
  );
}
