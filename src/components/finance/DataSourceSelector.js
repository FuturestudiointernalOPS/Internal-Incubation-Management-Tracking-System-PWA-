"use client";

import { useI18n } from "@/lib/i18n";

/**
 * Data Source Selector — fiscal year dropdown.
 *
 * Props:
 *   sources     - Array of { id, name, fiscalYear }
 *   selectedId  - Currently selected data source ID
 *   onSelect    - Callback (id) => void
 *   loading     - Whether the list is still loading
 */
export default function DataSourceSelector({
  sources = [],
  selectedId,
  onSelect,
  loading = false,
}) {
  const { t } = useI18n();
  if (loading) {
    return (
      <div className="flex items-center gap-2">
        <label
          className="text-[9px] font-bold uppercase tracking-widest"
          style={{ color: "var(--text-secondary)" }}
        >
          {t("finance.selector.label")}
        </label>
        <div
          className="rounded-lg px-4 py-2 text-xs"
          style={{
            background: "var(--surface-2)",
            color: "var(--text-secondary)",
            border: "1px solid var(--border-primary)",
          }}
        >
          {t("finance.selector.loading")}
        </div>
      </div>
    );
  }

  if (!sources.length) {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      <label
        className="text-[9px] font-bold uppercase tracking-widest"
        style={{ color: "var(--text-secondary)" }}
      >
        {t("finance.selector.label")}
      </label>
      <select
        value={selectedId || ""}
        onChange={(e) => onSelect(e.target.value)}
        className="rounded-lg px-4 py-2 text-xs font-bold outline-none transition-all cursor-pointer"
        style={{
          background: "var(--surface-2)",
          color: "var(--text-primary)",
          border: "1px solid var(--border-primary)",
        }}
        aria-label={t("finance.selector.label")}
      >
        {sources.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name} ({s.fiscalYear})
          </option>
        ))}
      </select>
    </div>
  );
}
