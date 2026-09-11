"use client";

import React from "react";
import { useI18n } from "@/lib/i18n";
import { capabilityLabel } from "@/lib/authorization/capability-catalog";

const ACCESS_LEVEL_KEYS = {
  0: "engineering.permissions.accessLevelNone",
  1: "engineering.permissions.accessLevelView",
  2: "engineering.permissions.accessLevelCreate",
  3: "engineering.permissions.accessLevelEdit",
  4: "engineering.permissions.accessLevelDelete",
  5: "engineering.permissions.accessLevelFull",
};
const LEVELS_ORDER = [0, 1, 2, 3, 4, 5];

/**
 * One FEATURE section of the Defaults Matrix.
 *
 * A feature is a sidebar-level section (crm, communication, programs, …). Its
 * modules are the sub-sections, rendered as rows; the ordered union of their
 * capabilities is the header row (the columns). A cell sets the access level
 * of one capability on one sub-section. Capabilities a sub-section does not
 * carry show a muted placeholder.
 *
 * View stays the base capability: its level-0 option is disabled while another
 * capability of the same sub-section is enabled — the API enforces the same
 * rule in /api/access-profiles.
 */
export default function FeatureMatrixSection({
  section,
  availableModules,
  draftCaps,
  savedCaps,
  onSetLevel,
}) {
  const { t } = useI18n();
  const { feature, modules, capabilities, unmapped } = section;

  const label = unmapped
    ? availableModules[feature]?.name || feature.replace(/_/g, " ")
    : feature.replace(/_/g, " ");

  const levelOf = (mod, cap) => draftCaps?.[mod]?.[cap] ?? 0;
  const isChanged = (mod, cap) =>
    (draftCaps?.[mod]?.[cap] ?? 0) !== (savedCaps?.[mod]?.[cap] ?? 0);
  const othersActive = (mod) =>
    Object.entries(draftCaps?.[mod] || {}).some(
      ([c, lvl]) => c !== "view" && Number(lvl) > 0,
    );

  // The column header for a capability is owned by the first sub-section that
  // carries it (labels are stable across modules).
  const columnLabel = (cap) => {
    const owner =
      modules.find((m) =>
        (availableModules[m]?.capabilities || []).includes(cap),
      ) || modules[0];
    return capabilityLabel(owner, cap);
  };

  const sectionChanged = modules.some((m) =>
    capabilities.some((c) => isChanged(m, c)),
  );

  const renderSelect = (modKey, cap) => {
    const level = levelOf(modKey, cap);
    const changed = isChanged(modKey, cap);
    const viewLocked = cap === "view" && othersActive(modKey);
    return (
      <select
        value={level}
        onChange={(e) => onSetLevel(modKey, cap, Number(e.target.value))}
        title={
          viewLocked
            ? t("engineering.permissions.viewRequiredMsg")
            : `${availableModules[modKey]?.name || modKey} · ${capabilityLabel(modKey, cap)}`
        }
        className={`w-full rounded-lg border px-2 py-1.5 text-[10px] font-bold bg-secondary text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)] ${
          changed
            ? "border-amber-400/70 ring-1 ring-amber-400/40"
            : "border-[var(--border-primary)]"
        }`}
      >
        {LEVELS_ORDER.map((l) => (
          <option key={l} value={l} disabled={viewLocked && l === 0}>
            {l === 0 ? "—" : t(ACCESS_LEVEL_KEYS[l])}
          </option>
        ))}
      </select>
    );
  };

  return (
    <div className="ios-card !p-0 border border-[var(--border-primary)] overflow-hidden">
      <div className="px-5 py-3 bg-tertiary/30 border-b border-[var(--border-primary)] flex items-center justify-between">
        <h4 className="text-[10px] font-black text-[var(--brand-orange)] uppercase tracking-wider">
          {label}
        </h4>
        {sectionChanged && (
          <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">
            {t("engineering.permissions.changedBadge")}
          </span>
        )}
      </div>

      {/* Desktop: sub-sections are rows, capabilities are the columns. */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left min-w-[480px]">
          <thead>
            <tr className="border-b border-[var(--border-primary)]">
              <th className="px-4 py-2.5 text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">
                {t("engineering.permissions.subsections")}
              </th>
              {capabilities.map((cap) => (
                <th
                  key={cap}
                  className="px-2 py-2.5 text-center text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest whitespace-nowrap"
                >
                  {columnLabel(cap)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {modules.map((modKey) => {
              const modCaps = availableModules[modKey]?.capabilities || [];
              return (
                <tr
                  key={modKey}
                  className="border-b border-[var(--border-primary)]/50 last:border-b-0"
                >
                  <td className="px-4 py-2 text-[11px] font-bold text-[var(--text-primary)] uppercase tracking-wide whitespace-nowrap">
                    {availableModules[modKey]?.name || modKey.replace(/_/g, " ")}
                  </td>
                  {capabilities.map((cap) =>
                    modCaps.includes(cap) ? (
                      <td key={cap} className="px-2 py-1.5 min-w-[6rem]">
                        {renderSelect(modKey, cap)}
                      </td>
                    ) : (
                      <td key={cap} className="px-2 py-1.5 text-center">
                        <span className="text-[10px] text-[var(--text-secondary)] opacity-30">
                          ·
                        </span>
                      </td>
                    ),
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Small screens: one card per sub-section, one control per capability. */}
      <div className="md:hidden divide-y divide-[var(--border-primary)]/50">
        {modules.map((modKey) => {
          const modCaps = availableModules[modKey]?.capabilities || [];
          return (
            <div key={modKey} className="p-3 space-y-2">
              <p className="text-[11px] font-bold text-[var(--text-primary)] uppercase tracking-wide">
                {availableModules[modKey]?.name || modKey.replace(/_/g, " ")}
              </p>
              <div className="space-y-1.5">
                {capabilities
                  .filter((cap) => modCaps.includes(cap))
                  .map((cap) => (
                    <div
                      key={cap}
                      className="flex items-center justify-between gap-2"
                    >
                      <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wide">
                        {capabilityLabel(modKey, cap)}
                      </span>
                      {renderSelect(modKey, cap)}
                    </div>
                  ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
