import { X } from "lucide-react";

export default function ExportOptionsModal({
  exportFormat, setExportFormat, exportScope, setExportScope,
  selectedCount, filteredCount, onExport, onClose, t,
}) {
  return (
    <div className="fixed inset-0 z-[500] bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-secondary border border-[var(--border-primary)] p-6 space-y-4" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black uppercase text-[var(--text-primary)]">{t("platformMisc.runs.exportTitle")}</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-tertiary text-[var(--text-secondary)]"><X className="w-4 h-4" /></button>
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("platformMisc.runs.exportFormat")}</label>
          <div className="space-y-1.5">
            <label className="flex items-center gap-2 text-[10px] font-bold text-[var(--text-primary)] cursor-pointer">
              <input type="radio" name="exportFormat" checked={exportFormat === "csv"} onChange={() => setExportFormat("csv")} className="accent-[var(--brand-orange)]" /> {t("platformMisc.runs.exportCsv")}
            </label>
            <label className="flex items-center gap-2 text-[10px] font-bold text-[var(--text-primary)] cursor-pointer">
              <input type="radio" name="exportFormat" checked={exportFormat === "xlsx"} onChange={() => setExportFormat("xlsx")} className="accent-[var(--brand-orange)]" /> {t("platformMisc.runs.exportXlsx")}
            </label>
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("platformMisc.runs.exportScope")}</label>
          <div className="space-y-1.5">
            {selectedCount > 0 && (
              <label className="flex items-center gap-2 text-[10px] font-bold text-[var(--text-primary)] cursor-pointer">
                <input type="radio" name="exportScope" checked={exportScope === "selected"} onChange={() => setExportScope("selected")} className="accent-[var(--brand-orange)]" /> {t("platformMisc.runs.exportSelected", { count: selectedCount })}
              </label>
            )}
            <label className="flex items-center gap-2 text-[10px] font-bold text-[var(--text-primary)] cursor-pointer">
              <input type="radio" name="exportScope" checked={exportScope === "filtered"} onChange={() => setExportScope("filtered")} className="accent-[var(--brand-orange)]" /> {t("platformMisc.runs.exportFiltered", { count: filteredCount })}
            </label>
          </div>
        </div>
        <button
          onClick={onExport}
          className="w-full py-2.5 rounded-lg bg-[var(--brand-orange)] text-black text-sm font-bold uppercase tracking-wide"
        >
          {t("platformMisc.runs.exportAction")}
        </button>
      </div>
    </div>
  );
}
