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
          className="text-[10px] font-bold uppercase tracking-widest"
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
        className="text-[10px] font-bold uppercase tracking-widest"
        style={{ color: "var(--text-secondary)" }}
      >
        {t("finance.selector.label")}
      </label>
      <select
        value={selectedId || ""}
        onChange={(event) => onSelect(event.target.value)}
        className="rounded-lg px-4 py-2 text-xs font-bold outline-none transition-all cursor-pointer"
        style={{
          background: "var(--surface-2)",
          color: "var(--text-primary)",
          border: "1px solid var(--border-primary)",
        }}
        aria-label={t("finance.selector.label")}
      >
        {sources.map((source) => (
          <option key={source.id} value={source.id}>
            {source.name} ({source.fiscalYear})
          </option>
        ))}
      </select>
    </div>
  );
}
