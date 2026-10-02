import { Search, Filter } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export default function ProjectsFilters({
  search,
  setSearch,
  filterStatus,
  setFilterStatus,
}) {
  const { t } = useI18n();
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t("common.search")}
          className="w-full bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl py-4 pl-12 text-sm font-bold text-white outline-none focus:border-[var(--brand-orange)] transition-all"
        />
      </div>
      <div className="relative">
        <Filter className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <select
          value={filterStatus}
          onChange={(event) => setFilterStatus(event.target.value)}
          className="w-full bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl py-4 pl-12 pr-4 text-sm font-bold text-[var(--text-primary)] outline-none appearance-none cursor-pointer focus:border-[var(--brand-orange)]"
        >
          <option value="all">
            {t("adminMisc.projectsList.allStatuses")}
          </option>
          <option value="Active">
            {t("adminMisc.projectsList.statusActive")}
          </option>
          <option value="Completed">
            {t("adminMisc.projectsList.statusCompleted")}
          </option>
          <option value="Paused">
            {t("adminMisc.projectsList.statusPaused")}
          </option>
          <option value="Archived">
            {t("adminMisc.projectsList.statusArchived")}
          </option>
        </select>
      </div>
    </div>
  );
}
