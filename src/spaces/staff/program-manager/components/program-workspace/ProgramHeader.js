import { useI18n } from "@/lib/i18n";

export default function ProgramHeader({ program }) {
  const { t } = useI18n();

  return (
    <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="status-badge bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
            {{
              active: t("pmMisc.workspace.programStatusActive"),
              archived: t("pmMisc.workspace.programStatusArchived"),
              draft: t("pmMisc.workspace.programStatusDraft"),
            }[program?.status] || t("pmMisc.workspace.programStatusActive")}
          </span>
          <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">
            {program?.id}
          </span>
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-[var(--text-primary)]">
          {program?.name}
        </h1>
        <p className="text-[var(--text-secondary)] text-sm max-w-2xl">
          {program?.description}
        </p>
      </div>
    </header>
  );
}
