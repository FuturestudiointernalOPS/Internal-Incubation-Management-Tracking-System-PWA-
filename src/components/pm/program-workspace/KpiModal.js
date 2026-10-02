import { useI18n } from "@/lib/i18n";
import { X } from "lucide-react";

export default function KpiModal({
  isSaving,
  newKPI,
  onAddKPI,
  onCloseKPIModal,
  onNewKPIChange,
}) {
  const { t } = useI18n();

  return (
    <div
      className="fixed inset-0 z-[400] bg-black/40 flex items-center justify-center p-6"
      onClick={() => onCloseKPIModal()}
    >
      <div
        className="card w-full max-w-sm space-y-6"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex justify-between items-center">
          <h3
            className="text-base font-black uppercase tracking-tight"
            style={{ color: "var(--text-primary)" }}
          >
            {t("pmMisc.workspace.defineKpiTarget")}
          </h3>
          <button onClick={() => onCloseKPIModal()}>
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="space-y-4">
          <div className="space-y-1">
            <label
              className="text-[10px] font-black uppercase tracking-widest"
              style={{ color: "var(--text-secondary)" }}
            >
              {t("pmMisc.workspace.kpiTitle")}
            </label>
            <input
              value={newKPI.title}
              onChange={(event) =>
                onNewKPIChange((prev) => ({
                  ...prev,
                  title: event.target.value,
                }))
              }
              className="w-full rounded-lg px-4 py-3 text-sm outline-none font-bold"
              style={{
                background: "var(--bg-primary)",
                border: "1px solid var(--border-primary)",
                color: "var(--text-primary)",
              }}
              placeholder={t("pmMisc.workspace.kpiTitlePlaceholder")}
            />
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => onCloseKPIModal()}
            className="flex-1 btn btn-secondary"
          >
            {t("pmMisc.workspace.cancel")}
          </button>
          <button
            onClick={onAddKPI}
            disabled={isSaving || !newKPI.title.trim()}
            className="flex-1 btn btn-primary"
          >
            {isSaving
              ? t("pmMisc.workspace.defining")
              : t("pmMisc.workspace.define")}
          </button>
        </div>
      </div>
    </div>
  );
}
