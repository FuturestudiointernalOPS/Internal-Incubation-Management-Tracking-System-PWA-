"use client";

import React from "react";
import { Loader2, Save, X } from "lucide-react";
import {
  ACCESS_SHORT,
  LEVEL_CHIP_ACTIVE,
  LEVEL_CHIP_BASE,
  LEVEL_CHIP_IDLE,
} from "@/components/permissions/levelChips";

/**
 * The capability editor of the Profiles screen (profiles takeover).
 *
 * Cut out of `ProfilesView.js`: the panel keeps the state and the writes, this
 * block only renders the level matrix and reports a click. The levels are set
 * by clicking a capability chip (0 → 1 → … → 5 → 0); the server normalizes
 * "view is implied" on save.
 */
export default function ProfileCapabilityEditor({ ctx }) {
  const {
    t,
    selectedKey,
    availableModules,
    draftCaps,
    capsLoading,
    capsDirty,
    busyKey,
    setLevel,
    saveCaps,
    closeCaps,
    baselineRoles,
    roleDefaults,
    setRoleDefault,
  } = ctx;

  if (!selectedKey) return null;

  return (
    <div className="ios-card !p-5 border-[var(--border-primary)] space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="text-xs font-black text-[var(--text-primary)] uppercase tracking-widest">
            {t("engineering.permissions.profilesCapabilitiesTitle")}
          </h4>
          <p className="text-[10px] font-bold text-[var(--text-secondary)] mt-0.5">
            {t("engineering.permissions.profilesCapabilitiesHint")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={saveCaps}
            disabled={!capsDirty || busyKey === selectedKey}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[var(--brand-orange)] text-black text-[10px] font-black uppercase tracking-widest disabled:opacity-40"
          >
            <Save className="w-3 h-3" />
            {busyKey === selectedKey
              ? t("engineering.permissions.profilesSaving")
              : t("engineering.permissions.profilesCapsSave")}
          </button>
          <button
            onClick={closeCaps}
            className="p-2 rounded-xl bg-secondary border border-[var(--border-primary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            aria-label={t("common.close")}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* "Default for" — which baseline roles receive this profile by default. */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--border-primary)] px-3 py-2">
        <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
          {t("engineering.permissions.defaultForTitle")}
        </span>
        {(baselineRoles || []).map((role) => {
          const isDefault = roleDefaults?.[role] === selectedKey;
          return (
            <button
              key={role}
              type="button"
              disabled={busyKey === `role:${role}`}
              onClick={() => setRoleDefault(role, isDefault ? null : selectedKey)}
              className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest border transition-colors disabled:opacity-40 ${
                isDefault
                  ? "border-brand-orange/40 bg-brand-orange/10 text-[var(--brand-orange)]"
                  : "border-[var(--border-primary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              {t(`engineering.permissions.profilesRoles.${role}`)}
            </button>
          );
        })}
      </div>

      {capsLoading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="w-5 h-5 animate-spin text-[var(--brand-orange)]" />
        </div>
      ) : (
        <div className="space-y-3">
          {Object.entries(availableModules).map(([module, def]) => (
            <div
              key={module}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--border-primary)] px-3 py-2"
            >
              <span className="text-[10px] font-black uppercase tracking-wide text-[var(--text-primary)]">
                {def.name || module}
              </span>
              <div className="flex flex-wrap gap-1.5">
                {(def.capabilities || []).map((capability) => {
                  const level = Number(draftCaps?.[module]?.[capability] ?? 0);
                  return (
                    <button
                      key={capability}
                      type="button"
                      onClick={() => setLevel(module, capability, level >= 5 ? 0 : level + 1)}
                      title={`${capability} — ${level}`}
                      className={`px-2 h-7 rounded-lg border-2 text-[9px] font-black uppercase tracking-wide transition-all ${
                        level > 0
                          ? LEVEL_CHIP_ACTIVE[level] || LEVEL_CHIP_ACTIVE[3]
                          : LEVEL_CHIP_IDLE
                      } ${LEVEL_CHIP_BASE}`}
                    >
                      {capability}
                      <span className="ml-1 opacity-70">{ACCESS_SHORT[level]}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
