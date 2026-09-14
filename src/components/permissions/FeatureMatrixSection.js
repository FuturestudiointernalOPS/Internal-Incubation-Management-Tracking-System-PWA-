"use client";

import React from "react";
import { useI18n } from "@/lib/i18n";
import {
  buildSectionColumns,
  crudCapabilities,
  isModuleFull,
} from "@/components/permissions/matrixHelpers";

/**
 * PHASE UI-6 + CRUD split — one FEATURE section of the CRUD matrix.
 *
 * A feature is a sidebar-level section (communication, program_management, …);
 * its modules are the sub-sections shown in the left column. The header row is
 * the FIXED access-level ladder View · Edit · Create · Delete · Full.
 *
 * This table edits the CRUD ladder ONLY. Every non-CRUD capability (send,
 * moderate, publish, archive, grant, promote_super_admin, execute, …) lives in
 * the "Advanced" section (AdvancedCapabilities) — so it stays real and
 * enforceable, but never clutters this table.
 *
 * "Full" is scoped to the module's CRUD set: it can never grant a capability
 * this table does not show. That is what keeps hiding a capability from the
 * matrix from silently granting it.
 *
 * Every cell is a CHECKBOX (no dropdown). View is the base capability —
 * checking any other CRUD capability also checks View, and clearing View clears
 * the module's other CRUD capabilities. The header checkbox applies a column to
 * every sub-section of the group at once (indeterminate when only some hold it).
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
  availableModules,
  draftCaps,
  savedCaps,
  onToggle,
  onToggleFull,
}) {
  const { t } = useI18n();
  const { feature, modules, unmapped } = section;

  const moduleCaps = (mod) => availableModules?.[mod]?.capabilities || [];
  const crudCaps = (mod) => crudCapabilities(moduleCaps(mod));
  const levelOf = (mod, cap) => Number(draftCaps?.[mod]?.[cap] ?? 0);
  const isChecked = (mod, cap) => levelOf(mod, cap) > 0;
  const isChanged = (mod, cap) =>
    (draftCaps?.[mod]?.[cap] ?? 0) !== (savedCaps?.[mod]?.[cap] ?? 0);
  const moduleFull = (mod) => isModuleFull(draftCaps, mod, crudCaps(mod));

  const columns = buildSectionColumns();

  // i18n with a real fallback: a missing key comes back as the key itself.
  const labelOr = (key, fallback) => {
    const value = t(key);
    return value && value !== key ? value : fallback;
  };

  // Section title = the FEATURE (the group), or the module name when a module
  // has no feature mapping of its own.
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

  const columnLabel = (col) =>
    col.kind === "full"
      ? t(LEVEL_LABEL_KEYS.full)
      : t(LEVEL_LABEL_KEYS[col.capability]);

  /** Applicable modules + checked/indeterminate state for a header column. */
  const headerState = (col) => {
    const applicable = modules.filter((mod) => {
      const caps = crudCaps(mod);
      return col.kind === "full" ? caps.length > 0 : caps.includes(col.capability);
    });
    if (applicable.length === 0) {
      return { applicable, checked: false, indeterminate: false };
    }
    const states = applicable.map((mod) =>
      col.kind === "full" ? moduleFull(mod) : isChecked(mod, col.capability),
    );
    const checked = states.every(Boolean);
    return { applicable, checked, indeterminate: states.some(Boolean) && !checked };
  };

  const onHeaderToggle = (col, next) => {
    const { applicable } = headerState(col);
    for (const mod of applicable) {
      const caps = crudCaps(mod);
      if (col.kind === "full") onToggleFull(mod, next, caps);
      else onToggle(mod, col.capability, next, caps);
    }
  };

  const cellTitle = (mod, col) => `${moduleLabel(mod)} · ${columnLabel(col)}`;

  const sectionChanged = modules.some((mod) =>
    crudCaps(mod).some((cap) => isChanged(mod, cap)),
  );

  /** A checkbox cell for one module + column, or the "not carried" placeholder. */
  const renderCell = (mod, col) => {
    const caps = crudCaps(mod);
    if (col.kind === "full") {
      if (caps.length === 0) return <Placeholder />;
      return (
        <MatrixCheckbox
          checked={moduleFull(mod)}
          onChange={(next) => onToggleFull(mod, next, caps)}
          title={cellTitle(mod, col)}
        />
      );
    }
    if (!caps.includes(col.capability)) return <Placeholder />;
    return (
      <MatrixCheckbox
        checked={isChecked(mod, col.capability)}
        onChange={(next) => onToggle(mod, col.capability, next, caps)}
        title={cellTitle(mod, col)}
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
            {modules.map((mod) => (
              <tr
                key={mod}
                className="border-b border-[var(--border-primary)]/50 last:border-b-0"
              >
                <td className="px-4 py-2 text-[11px] font-bold text-[var(--text-primary)] uppercase tracking-wide whitespace-nowrap">
                  {moduleLabel(mod)}
                </td>
                {columns.map((col) => (
                  <td key={col.key} className="px-2 py-1.5 text-center">
                    {renderCell(mod, col)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Small screens: one card per sub-section, one checkbox per capability. */}
      <div className="md:hidden divide-y divide-[var(--border-primary)]/50">
        {modules.map((mod) => (
          <div key={mod} className="p-3 space-y-2">
            <p className="text-[11px] font-bold text-[var(--text-primary)] uppercase tracking-wide">
              {moduleLabel(mod)}
            </p>
            <div className="space-y-1.5">
              {columns
                .filter(
                  (col) =>
                    col.kind === "full" ||
                    crudCaps(mod).includes(col.capability),
                )
                .map((col) => (
                  <label
                    key={col.key}
                    className="flex items-center justify-between gap-2 cursor-pointer"
                  >
                    <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wide">
                      {columnLabel(col)}
                    </span>
                    {renderCell(mod, col)}
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
