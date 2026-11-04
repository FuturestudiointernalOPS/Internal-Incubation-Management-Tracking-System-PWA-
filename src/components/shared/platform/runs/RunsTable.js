import React, { useMemo } from "react";
import { Play, ChevronDown, ChevronUp, RotateCcw, Archive, Trash2 } from "lucide-react";
import AppSplitMenu from "@/components/ui/AppSplitMenu";
import { useI18n } from "@/lib/i18n";
import { STATUS_CONFIG } from "./constants";
import { cn } from "./helpers";

// ─── Optimized Runs Table (memoized for performance) ───
const RunsTable = React.memo(function RunsTable({ runs, search, statusFilter, sortField, sortDir, page, perPage, total, onSort, onPage, openRun, groups, onArchive, onRestore, onDelete }) {
  const { t } = useI18n();
  const filtered = useMemo(() => {
    return runs.filter((run) => {
      if (search && !run.name.toLowerCase().includes(search.toLowerCase())) return false;
      // When "all" is selected, exclude archived
      if (statusFilter === "all" && run.status === "archived") return false;
      if (statusFilter !== "all" && run.status !== statusFilter) return false;
      return true;
    });
  }, [runs, search, statusFilter]);

  const sorted = useMemo(() => {
    return [...filtered].sort((firstRun, secondRun) => {
      const firstValue = firstRun[sortField] ?? "";
      const secondValue = secondRun[sortField] ?? "";
      if (sortField === "created_at" || sortField === "opens_at" || sortField === "closes_at") {
        return sortDir === "asc" ? new Date(firstValue) - new Date(secondValue) : new Date(secondValue) - new Date(firstValue);
      }
      return sortDir === "asc" ? String(firstValue).localeCompare(String(secondValue)) : String(secondValue).localeCompare(String(firstValue));
    });
  }, [filtered, sortField, sortDir]);

  const totalPages = Math.ceil(total / perPage);
  const paginated = sorted;

  if (sorted.length === 0) return <div className="text-center py-16 text-sm text-[var(--text-secondary)]">{t("platformMisc.runs.noRunsFound")}</div>;

  return <>
    <div className="overflow-x-auto rounded-xl border border-[var(--border-primary)]">
      <table className="w-full text-left">
        <thead className="bg-tertiary">
          <tr className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
            <th className="px-3 py-3 w-10">{t("platformMisc.runs.colSn")}</th>
            {[
              { key: "name", label: t("platformMisc.runs.colName"), w: "" },
              { key: "form_name", label: t("platformMisc.runs.form"), w: "w-40" },
              { key: "group_target_id", label: t("platformMisc.runs.targetGroup"), w: "w-32" },
              { key: "status", label: t("platformMisc.runs.colStatus"), w: "w-28" },
              { key: "opens_at", label: t("platformMisc.runs.opens"), w: "w-28" },
              { key: "closes_at", label: t("platformMisc.runs.closes"), w: "w-28" },
              { key: "created_at", label: t("platformMisc.runs.created"), w: "w-28" },
            ].map((column) => (
              <th key={column.key} className={`px-3 py-3 cursor-pointer hover:text-[var(--brand-orange)] transition-colors ${column.w}`} onClick={() => {
                if (sortField === column.key) onSort(column.key, sortDir === "asc" ? "desc" : "asc");
                else onSort(column.key, "asc");
              }}>
                <span className="flex items-center gap-1">
                  {column.label}
                  {sortField === column.key && (sortDir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                </span>
              </th>
            ))}
            <th className="px-3 py-3 text-right">{t("platformMisc.runs.colActions")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border-primary)]">
          {paginated.map((run, index) => {
            const statusConfig = STATUS_CONFIG[run.status] || STATUS_CONFIG.draft;
            const rowNumber = (page - 1) * perPage + index + 1;
            return (
              <tr key={run.id} onClick={() => openRun(run)} className="text-[11px] font-bold text-[var(--text-primary)] hover:bg-tertiary/50 cursor-pointer">
                <td className="px-3 py-3 text-[var(--text-secondary)] text-center">{rowNumber}</td>
                <td className="px-3 py-3 font-black uppercase truncate max-w-[250px]">
                  <div className="flex items-center gap-2">
                    <Play className="w-3.5 h-3.5 text-[var(--brand-orange)] shrink-0" />
                    <span className="truncate">{run.name}</span>
                  </div>
                </td>
                <td className="px-3 py-3 text-[10px] font-medium text-[var(--text-secondary)] truncate max-w-[160px]">{run.form_name || "—"}</td>
                <td className="px-3 py-3 text-[10px] font-bold truncate max-w-[120px]">
                  {(() => {
                    const group = groups.find((candidate) => (candidate.registration_id || candidate.id) === run.group_target_id);
                    return group ? (
                      <span className="text-[var(--brand-orange)]">{group.name}</span>
                    ) : (
                      <span className="text-[var(--text-secondary)]">—</span>
                    );
                  })()}
                </td>
                <td className="px-3 py-3"><span className={cn("px-2 py-0.5 rounded text-[10px] font-bold uppercase whitespace-nowrap", statusConfig.color, statusConfig.bg)}>{t(statusConfig.label)}</span></td>
                <td className="px-3 py-3 text-[10px] font-medium text-[var(--text-secondary)] whitespace-nowrap">{run.opens_at ? new Date(run.opens_at).toLocaleDateString() : "—"}</td>
                <td className="px-3 py-3 text-[10px] font-medium text-[var(--text-secondary)] whitespace-nowrap">{run.closes_at ? new Date(run.closes_at).toLocaleDateString() : "—"}</td>
                <td className="px-3 py-3 text-[10px] font-medium text-[var(--text-secondary)] whitespace-nowrap">{new Date(run.created_at).toLocaleDateString()}</td>
                <td className="px-3 py-3 text-right" onClick={(event) => event.stopPropagation()}>
                  <AppSplitMenu
                    label={t("platformMisc.runs.colActions")}
                    actions={[
                      run.status === "archived"
                        ? { key: "restore", label: t("platformMisc.runs.restore"), icon: RotateCcw, className: "text-emerald-500 hover:bg-emerald-500/10", iconClassName: "text-emerald-500", onSelect: () => onRestore(run.id) }
                        : run.status !== "active"
                          ? { key: "archive", label: t("platformMisc.runs.archive"), icon: Archive, className: "text-[var(--text-secondary)] hover:bg-slate-500/10 hover:text-[var(--text-primary)]", iconClassName: "text-[var(--text-secondary)]", onSelect: () => onArchive(run.id) }
                          : null,
                      { key: "delete", label: t("platformMisc.runs.delete"), icon: Trash2, danger: true, className: "text-rose-500 hover:bg-rose-500/10", iconClassName: "text-rose-500", onSelect: () => onDelete(run.id) },
                    ].filter(Boolean)}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
    {totalPages > 1 && (
      <div className="flex items-center justify-between pt-2">
        <p className="text-[10px] text-[var(--text-secondary)]">{t("platformMisc.runs.showingRange", { start: ((page - 1) * perPage) + 1, end: Math.min(page * perPage, total), total })}</p>
        <div className="flex items-center gap-1">
          <button onClick={() => onPage(Math.max(1, page - 1))} disabled={page === 1} className="px-2 py-1 rounded-lg bg-tertiary text-[10px] font-bold text-[var(--text-secondary)] disabled:opacity-30 hover:text-[var(--text-primary)]">{t("platformMisc.runs.prev")}</button>
          {Array.from({ length: Math.min(totalPages, 7) }, (_, index) => {
            let pageNumber;
            if (totalPages <= 7) pageNumber = index + 1;
            else if (page <= 4) pageNumber = index + 1;
            else if (page >= totalPages - 3) pageNumber = totalPages - 6 + index;
            else pageNumber = page - 3 + index;
            return <button key={pageNumber} onClick={() => onPage(pageNumber)} className={cn("w-7 h-7 rounded-lg text-[10px] font-bold", page === pageNumber ? "bg-[var(--brand-orange)] text-black" : "bg-tertiary text-[var(--text-secondary)] hover:text-[var(--text-primary)]")}>{pageNumber}</button>;
          })}
          <button onClick={() => onPage(Math.min(totalPages, page + 1))} disabled={page === totalPages} className="px-2 py-1 rounded-lg bg-tertiary text-[10px] font-bold text-[var(--text-secondary)] disabled:opacity-30 hover:text-[var(--text-primary)]">{t("platformMisc.runs.next")}</button>
        </div>
      </div>
    )}
  </>;
});

export default RunsTable;
