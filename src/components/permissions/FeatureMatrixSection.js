"use client";

import React from "react";
import { useI18n } from "@/lib/i18n";
import {
  buildSectionColumns,
  crudCapabilities,
  isModuleFull,
} from "@/components/permissions/matrixHelpers";

/**
 * PHASE UI-6 + dashboard sub-sections — one FEATURE section of the template.
 *
 * A feature is a sidebar-level section (CRM, Communication, …); its rows are
 * the SAME sub-sections the sidebar shows (People, Membership, Timeline,
 * Duplicates, Bulk Import, …), in the same order — see FEATURE_SUBSECTIONS.
 *
 * A sub-section backed by a permission module is editable through the fixed
 * CRUD ladder View · Edit · Create · Delete · Full. A sub-section with no
 * capability of its own (Membership, Timeline, …) is INFORMATIONAL: it is shown
 * without checkboxes. Non-CRUD capabilities of a module (send, execute, grant,
 * …) live in the "Advanced" section below.
 *
 * A module named by several sub-sections is editable once (its first row); the
 * later rows are informational aliases. "Full" is scoped to the module's CRUD
 * set, so it can never grant a capability this table does not show.
 *
 * Every cell is a CHECKBOX (no dropdown). View is the base capability — checking
 * any other CRUD capability also checks View, and clearing View clears the
 * module's other CRUD capabilities. The header checkbox applies a column to
 * every editable row of the group at once (indeterminate when only some hold it).
 *
 * Level numbers are preserved for the engine (view=1 … delete=4, Full=5).
 */

const LEVEL_LABEL_KEYS = {
  view: "engineering.permissions.accessLevelView",
  create: "engineering.permissions.accessLevelCreate",
  edit: "engineering.permissions.accessLevelEdit",
  delete: "engineering.permissions.accessLevelDelete",
  full: "engineering.permissions.accessLevelFull",
};

/** Tri-state checkbox (native indeterminate is only reachable through a ref). */
function MatrixCheckbox({
  checked,
  indeterminate = false,
  disabled = false,
  onChange,
  title,
}) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (ref.current) ref.current.indeterminate = !checked && indeterminate;
  }, [checked, indeterminate]);
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      disabled={disabled}
      onChange={(e) => onChange(e.target.checked)}
      title={title}
      aria-label={title}
      className="h-4 w-4 rounded border-[var(--border-primary)] accent-[var(--brand-orange)] cursor-pointer disabled:opacity-25 disabled:cursor-not-allowed"
    />
  );
}

export default function FeatureMatrixSection({
  section,
  rows,
  availableModules,
  draftCaps,
  savedCaps,
  onToggle,
  onToggleFull,
}) {
  const { t } = useI18n();
  const { feature, unmapped } = section;

  const rowCaps = (row) => row.capabilities || [];
  const rowCrud = (row) => crudCapabilities(rowCaps(row));
  const isEditable = (row) => Boolean(row.editable);
  const levelOf = (row, cap) => Number(draftCaps?.[row.module]?.[cap] ?? 0);
  const isChecked = (row, cap) => levelOf(row, cap) > 0;
  const isChanged = (row, cap) =>
    (draftCaps?.[row.module]?.[cap] ?? 0) !== (savedCaps?.[row.module]?.[cap] ?? 0);
  const rowFull = (row) => isModuleFull(draftCaps, row.module, rowCrud(row));

  const columns = buildSectionColumns();

  // i18n with a real fallback: a missing key comes back as the key itself.
  const labelOr = (key, fallback) => {
    const value = t(key);
    return value && value !== key ? value : fallback;
  };

  // Section title = the FEATURE (the dashboard section).
  const title = unmapped
    ? labelOr(
        `engineering.permissions.moduleLabels.${feature}`,
        availableModules[feature]?.name || feature.replace(/_/g, " "),
      )
    : labelOr(
        `engineering.permissions.features.${feature}`,
        feature.replace(/_/g, " "),
      );

  const moduleLabel = (mod) =>
    labelOr(
      `engineering.permissions.moduleLabels.${mod}`,
      availableModules?.[mod]?.name || mod.replace(/_/g, " "),
    );

  /** Label of a sub-section row (sub-section name, or the module name). */
  const rowLabel = (row) => {
    if (row.moduleLabel || !row.labelKey) return moduleLabel(row.module);
    return labelOr(row.labelKey, row.module ? moduleLabel(row.module) : row.id);
  };

  const columnLabel = (col) =>
    col.kind === "full"
      ? t(LEVEL_LABEL_KEYS.full)
      : t(LEVEL_LABEL_KEYS[col.capability]);

  /** Editable rows that carry a column's capability. */
  const applicableRows = (col) =>
    (rows || []).filter((row) => {
      if (!isEditable(row)) return false;
      const caps = rowCrud(row);
      return col.kind === "full" ? caps.length > 0 : caps.includes(col.capability);
    });

  const headerState = (col) => {
    const applicable = applicableRows(col);
    if (applicable.length === 0) {
      return { applicable, checked: false, indeterminate: false };
    }
    const states = applicable.map((row) =>
      col.kind === "full" ? rowFull(row) : isChecked(row, col.capability),
    );
    const checked = states.every(Boolean);
    return { applicable, checked, indeterminate: states.some(Boolean) && !checked };
  };

  const onHeaderToggle = (col, next) => {
    for (const row of applicableRows(col)) {
      const caps = rowCrud(row);
      if (col.kind === "full") onToggleFull(row.module, next, caps);
      else onToggle(row.module, col.capability, next, caps);
    }
  };

  const cellTitle = (row, col) => `${rowLabel(row)} · ${columnLabel(col)}`;

  const sectionChanged = (rows || []).some(
    (row) => isEditable(row) && rowCrud(row).some((cap) => isChanged(row, cap)),
  );

  /** A checkbox cell for one sub-section + column, or a placeholder. */
  const renderCell = (row, col) => {
    if (!isEditable(row)) return <Placeholder />;
    const caps = rowCrud(row);
    if (col.kind === "full") {
      if (caps.length === 0) return <Placeholder />;
      return (
        <MatrixCheckbox
          checked={rowFull(row)}
          onChange={(next) => onToggleFull(row.module, next, caps)}
          title={cellTitle(row, col)}
        />
      );
    }
    if (!caps.includes(col.capability)) return <Placeholder />;
    return (
      <MatrixCheckbox
        checked={isChecked(row, col.capability)}
        onChange={(next) => onToggle(row.module, col.capability, next, caps)}
        title={cellTitle(row, col)}
      />
    );
  };

  return (
    <div className="ios-card !p-0 border border-[var(--border-primary)] overflow-hidden">
      <div className="px-5 py-3 bg-tertiary/30 border-b border-[var(--border-primary)] flex items-center justify-between">
        <h4 className="text-[10px] font-black text-[var(--brand-orange)] uppercase tracking-wider">
          {title}
        </h4>
        {sectionChanged && (
          <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">
            {t("engineering.permissions.changedBadge")}
          </span>
        )}
      </div>

      {/* Desktop: sub-sections are rows, access-level columns are checkboxes. */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left min-w-[480px]">
          <thead>
            <tr className="border-b border-[var(--border-primary)]">
              <th className="px-4 py-2.5 text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">
                {t("engineering.permissions.subsections")}
              </th>
              {columns.map((col) => {
                const state = headerState(col);
                const disabled = state.applicable.length === 0;
                return (
                  <th
                    key={col.key}
                    className="px-2 py-2.5 text-center align-bottom whitespace-nowrap"
                  >
                    <span className="flex flex-col items-center gap-1.5">
                      <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">
                        {columnLabel(col)}
                      </span>
                      <MatrixCheckbox
                        checked={state.checked}
                        indeterminate={state.indeterminate}
                        disabled={disabled}
                        onChange={(next) => onHeaderToggle(col, next)}
                        title={`${title} · ${columnLabel(col)}`}
                      />
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {(rows || []).map((row) => (
              <tr
                key={row.id}
                className="border-b border-[var(--border-primary)]/50 last:border-b-0"
              >
                <td className="px-4 py-2 text-[11px] font-bold text-[var(--text-primary)] uppercase tracking-wide whitespace-nowrap">
                  {rowLabel(row)}
                  {!isEditable(row) && (
                    <span className="ml-2 text-[9px] font-bold uppercase tracking-widest text-[var(--text-secondary)] opacity-70">
                      {t("engineering.permissions.subsectionInfo")}
                    </span>
                  )}
                </td>
                {columns.map((col) => (
                  <td key={col.key} className="px-2 py-1.5 text-center">
                    {renderCell(row, col)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Small screens: one card per sub-section, one checkbox per capability. */}
      <div className="md:hidden divide-y divide-[var(--border-primary)]/50">
        {(rows || []).map((row) => (
          <div key={row.id} className="p-3 space-y-2">
            <p className="text-[11px] font-bold text-[var(--text-primary)] uppercase tracking-wide">
              {rowLabel(row)}
              {!isEditable(row) && (
                <span className="ml-2 text-[9px] font-bold uppercase tracking-widest text-[var(--text-secondary)] opacity-70">
                  {t("engineering.permissions.subsectionInfo")}
                </span>
              )}
            </p>
            <div className="space-y-1.5">
              {columns
                .filter(
                  (col) =>
                    col.kind === "full" || rowCrud(row).includes(col.capability),
                )
                .map((col) => (
                  <label
                    key={col.key}
                    className="flex items-center justify-between gap-2 cursor-pointer"
                  >
                    <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wide">
                      {columnLabel(col)}
                    </span>
                    {renderCell(row, col)}
                  </label>
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** A capability the sub-section does not carry for that column. */
function Placeholder() {
  return (
    <span
      aria-hidden="true"
      className="text-[10px] text-[var(--text-secondary)] opacity-30"
    >
      ·
    </span>
  );
}
