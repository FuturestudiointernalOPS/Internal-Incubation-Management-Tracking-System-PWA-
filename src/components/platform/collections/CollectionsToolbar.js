import { FolderTree, Search } from "lucide-react";
import { cn } from "./helpers";

export default function CollectionsToolbar({ t, search, setSearch, statusFilter, setStatusFilter, viewMode, setViewMode }) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <div className="relative flex-1 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-secondary)]" />
        <input
          type="text"
          placeholder={t("platformMisc.collections.searchPlaceholder")}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-tertiary border border-[var(--border-primary)] text-[11px] font-bold text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] outline-none focus:border-[var(--brand-orange)] transition-all"
        />
      </div>
      <select
        value={statusFilter}
        onChange={(event) => setStatusFilter(event.target.value)}
        className="px-3 py-2.5 rounded-xl bg-tertiary border border-[var(--border-primary)] text-[11px] font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)]"
      >
        <option value="all">{t("platformMisc.collections.allStatus")}</option>
        <option value="active">{t("platformMisc.collections.statusActive")}</option>
        <option value="draft">{t("platformMisc.collections.statusDraft")}</option>
        <option value="archived">{t("platformMisc.collections.statusArchived")}</option>
      </select>
      <div className="flex bg-primary p-1 rounded-xl border border-[var(--border-primary)]">
        {[
          { id: "grid", label: t("platformMisc.collections.viewGrid") },
          { id: "tree", icon: FolderTree, label: t("platformMisc.collections.viewTree") },
        ].map((mode) => (
          <button
            key={mode.id}
            onClick={() => setViewMode(mode.id)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all",
              viewMode === mode.id
                ? "bg-[var(--brand-orange)] text-black"
                : "text-[var(--text-secondary)]",
            )}
          >
            {mode.label}
          </button>
        ))}
      </div>
    </div>
  );
}
