import { ArrowLeft, Briefcase, Plus, RefreshCw } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export default function ProjectsHeader({
  projectCount,
  canCreate,
  onBack,
  onCreate,
  onRefresh,
}) {
  const { t } = useI18n();
  return (
    <header className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 border-b border-[var(--border-primary)] pb-8">
      <div className="space-y-2">
        <button
          onClick={onBack}
          className="group flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--brand-orange)] transition-all font-bold text-[10px] uppercase tracking-wide"
        >
          <ArrowLeft className="w-3 h-3 group-hover:-translate-x-1 transition-transform" />{" "}
          {t("navigation.dashboard")}
        </button>
        <div className="flex items-center gap-2 mt-2">
          <Briefcase className="w-4 h-4 text-[var(--brand-orange)]" />
          <span className="text-[10px] font-black text-[var(--brand-orange)] uppercase tracking-[0.4em]">
            {t("adminMisc.projectsList.internalOperations")}
          </span>
        </div>
        <h1 className="text-4xl font-black text-[var(--text-primary)] uppercase tracking-tighter">
          {t("adminMisc.projectsList.projects")}
        </h1>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-primary)]">
          <Briefcase className="w-4 h-4 text-[var(--brand-orange)]" />
          <span className="text-xs font-black">
            {t("adminMisc.projectsList.projectsCount", {
              count: projectCount,
            })}
          </span>
        </div>
        {canCreate && (
          <button
            onClick={onCreate}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--brand-orange)] text-black rounded-lg text-sm font-bold uppercase tracking-wide hover:brightness-110 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />{" "}
            {t("adminMisc.projectsList.createProject")}
          </button>
        )}
        <button
          onClick={onRefresh}
          className="p-2 rounded-xl hover:bg-white/5 transition-all"
          title={t("common.refresh")}
        >
          <RefreshCw className="w-4 h-4 text-slate-500" />
        </button>
      </div>
    </header>
  );
}
