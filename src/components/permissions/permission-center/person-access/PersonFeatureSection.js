"use client";

/**
 * PERSON FEATURE SECTION — extracted from `PersonAccessView.js`.
 *
 * One eligible/ineligible feature and its modules: the section heading, the
 * module cards with their CRUD capability grid, the level chips, block/restore
 * and revoke controls, and the "why" affordance. Purely presentational — it
 * receives the section and the access helpers the parent resolved and renders
 * them. It must never decide anything itself, or a chip could offer a grant the
 * resolver would refuse.
 *
 * Split out verbatim, behaviour identical.
 */

import { crudCapabilities } from "@/components/permissions/matrixHelpers";
import {
  ACCESS_LEVEL_KEYS,
  ACCESS_SHORT,
  LEVELS_ORDER,
  LEVEL_CHIP_ACTIVE,
  LEVEL_CHIP_BASE,
  LEVEL_CHIP_IDLE,
  LEVEL_CHIP_INHERITED,
} from "@/components/permissions/levelChips";
import { capabilityLabel } from "@/models/authorization/capability-catalog";
import { Ban, ChevronDown, ChevronRight, Info, RotateCcw, Trash2 } from "lucide-react";

export default function PersonFeatureSection({
  section,
  featureLabel,
  t,
  availableModules,
  expandedModules,
  setExpandedModules,
  getEffectiveLevel,
  getOrigin,
  originText,
  handleQuickAction,
  setWhyTarget,
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 pl-1">
        <h3 className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest opacity-50">
          {featureLabel(section.feature)}
        </h3>
        {!section.eligible && (
          <span className="px-1.5 py-0.5 rounded border border-amber-400/40 bg-amber-400/10 text-[9px] font-black uppercase tracking-widest text-amber-400">
            {t("engineering.permissions.personSectionNotEligible")}
          </span>
        )}
      </div>
      {section.modules.map((modKey) => {
        const mod = availableModules[modKey];
        if (!mod) return null;
        // The CRUD grid edits CRUD only; the module's other
        // capabilities live in the Advanced section below.
        const caps = crudCapabilities(mod.capabilities || []);
        if (caps.length === 0) return null;
        const isExpanded = expandedModules[modKey] !== false;
        // Eligibility ceiling on the WRITE control only: the
        // server refuses a grant on an ineligible feature. The
        // section still shows what the person holds, and a
        // block can still be undone.
        const lockLevels = !section.eligible;

        return (
          <div
            key={modKey}
            className="ios-card !p-0 border-[var(--border-primary)] overflow-hidden"
          >
            {/* Module header */}
            <button
              onClick={() =>
                setExpandedModules((prev) => ({
                  ...prev,
                  [modKey]: !prev[modKey],
                }))
              }
              className="w-full flex items-center justify-between px-5 py-4 bg-tertiary/30 hover:bg-tertiary/50 transition-all border-b border-[var(--border-primary)]"
            >
              <div className="flex items-center gap-3">
                {isExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
                )}
                <span className="text-xs font-black text-[var(--text-primary)] uppercase tracking-wider">
                  {mod.name}
                </span>
              </div>
              <span className="text-[10px] font-medium text-[var(--text-secondary)]">
                {t("engineering.permissions.capabilitiesCount", { count: caps.length })}
              </span>
            </button>

            {isExpanded && (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-[var(--border-primary)]">
                      <th className="text-left px-5 py-3 text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">
                        {t("engineering.permissions.capability")}
                      </th>
                      <th className="px-5 py-3 text-right text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">
                        {t("engineering.permissions.actions")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {caps.map((cap) => {
                      const effectiveLevel =
                        getEffectiveLevel(modKey, cap);
                      const origin = getOrigin(modKey, cap);

                      return (
                        <tr
                          key={cap}
                          className="group border-b border-divider/50 last:border-b-0 hover:bg-tertiary/20 transition-all"
                        >
                          {/* Capability name */}
                          <td className="px-5 py-3">
                            <div className="flex flex-wrap items-center gap-2">
                              {origin === "granted" && (
                                <span
                                  className="w-2 h-2 rounded-full bg-emerald-400 shrink-0"
                                  title={t("engineering.permissions.titleIndividualGrant")}
                                />
                              )}
                              {origin === "restricted" && (
                                <span
                                  className="w-2 h-2 rounded-full bg-red-400 shrink-0"
                                  title={t("engineering.permissions.restricted")}
                                />
                              )}
                              {origin === "inherited" && (
                                <span
                                  className="w-2 h-2 rounded-full bg-slate-400 shrink-0"
                                  title={t("engineering.permissions.titleInherited")}
                                />
                              )}
                              <span className="text-[11px] font-bold text-[var(--text-primary)] uppercase tracking-wide">
                                {capabilityLabel(modKey, cap)}
                              </span>
                              {origin === "granted" && (
                                <span className="shrink-0 px-1.5 py-0.5 rounded border border-emerald-400/30 bg-emerald-400/10 text-[9px] font-black uppercase tracking-widest text-emerald-400">
                                  {t("engineering.permissions.legendIndividualGrant")}
                                </span>
                              )}
                              {origin === "restricted" && (
                                <span className="shrink-0 px-1.5 py-0.5 rounded border border-red-500/40 bg-red-500/10 text-[9px] font-black uppercase tracking-widest text-red-400">
                                  {t("engineering.permissions.restricted")}
                                </span>
                              )}
                            </div>
                            {/* The state the chips act on: what the
                                person has TODAY and where it comes
                                from, so a chip is never clicked blind
                                (a direct grant of a level the person
                                already inherits changes nothing). */}
                            <p className="mt-1 text-[9px] font-bold text-[var(--text-secondary)] opacity-80">
                              {t("engineering.permissions.advancedCurrentState")}:{" "}
                              {originText(modKey, cap)}
                            </p>
                          </td>

                          {/* Controls — the level chips use the same
                              visual language as the template matrix:
                              pick a level to grant it personally, block
                              a right the person would otherwise inherit,
                              or restore it. */}
                          <td className="px-5 py-3">
                            {origin === "restricted" ? (
                              <div className="flex flex-wrap items-center justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleQuickAction(
                                      "unrestrict",
                                      modKey,
                                      cap,
                                    )
                                  }
                                  title={t("engineering.permissions.titleRemoveRestriction")}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-emerald-500/40 bg-emerald-500/10 text-[9px] font-black uppercase tracking-widest text-emerald-400 hover:bg-emerald-500/20 transition-all"
                                >
                                  <RotateCcw className="w-3 h-3" />
                                  {t("engineering.permissions.restore")}
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setWhyTarget({ module: modKey, capability: cap })
                                  }
                                  className="p-1.5 rounded-lg hover:bg-blue-500/10 transition-all"
                                  title={t("engineering.permissions.whyAccess")}
                                >
                                  <Info className="w-3 h-3 text-blue-400" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex flex-wrap items-center justify-end gap-1.5">
                                {LEVELS_ORDER.filter(
                                  (level) => level > 0,
                                ).map((level) => {
                                  const isActive =
                                    effectiveLevel === level;
                                  return (
                                    <button
                                      key={level}
                                      type="button"
                                      disabled={isActive || lockLevels}
                                      aria-pressed={isActive}
                                      onClick={() =>
                                        handleQuickAction(
                                          "grant",
                                          modKey,
                                          cap,
                                          level,
                                        )
                                      }
                                      title={t(
                                        "engineering.permissions.titleSetTo",
                                        {
                                          level: t(
                                            ACCESS_LEVEL_KEYS[level],
                                          ),
                                        },
                                      )}
                                      className={`${LEVEL_CHIP_BASE} ${
                                        isActive
                                          ? origin === "granted"
                                            ? LEVEL_CHIP_ACTIVE[level]
                                            : LEVEL_CHIP_INHERITED
                                          : LEVEL_CHIP_IDLE
                                      }`}
                                    >
                                      {ACCESS_SHORT[level]}
                                    </button>
                                  );
                                })}

                                {effectiveLevel > 0 && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleQuickAction(
                                        "restrict",
                                        modKey,
                                        cap,
                                        0,
                                      )
                                    }
                                    title={t("engineering.permissions.titleRestrict")}
                                    className="ml-1 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-dashed border-[var(--border-primary)] text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)] hover:border-red-400/50 hover:text-red-400 transition-all"
                                  >
                                    <Ban className="w-3 h-3" />
                                    {t("engineering.permissions.block")}
                                  </button>
                                )}

                                {origin === "granted" && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleQuickAction(
                                        "revoke",
                                        modKey,
                                        cap,
                                      )
                                    }
                                    title={t("engineering.permissions.titleRevokeGrant")}
                                    className="p-1.5 rounded-lg hover:bg-red-500/10 transition-all"
                                  >
                                    <Trash2 className="w-3 h-3 text-red-400" />
                                  </button>
                                )}

                                <button
                                  type="button"
                                  onClick={() =>
                                    setWhyTarget({ module: modKey, capability: cap })
                                  }
                                  className="p-1.5 rounded-lg hover:bg-blue-500/10 transition-all"
                                  title={t("engineering.permissions.whyAccess")}
                                >
                                  <Info className="w-3 h-3 text-blue-400" />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
