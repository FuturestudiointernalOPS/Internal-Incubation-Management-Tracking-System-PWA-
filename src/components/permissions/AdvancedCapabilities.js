"use client";

import React from "react";
import { Info } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import {
  CAPABILITY_CATALOG,
  capabilityLabel,
} from "@/lib/authorization/capability-catalog";
import { CRUD_CAPABILITIES } from "@/components/permissions/matrixHelpers";

/**
 * "Advanced" — every NON-CRUD capability, grouped by feature then module, with
 * its catalog risk. Mounted by BOTH editors through `mode`:
 *
 *   - mode="profile"    → checkbox bound to a profile's draft capabilities
 *                         (onToggle), saved with the rest of the profile.
 *   - mode="individual" → grant / restrict controls bound to a person's
 *                         overrides (onAction), applied immediately.
 *
 * Why it exists: the CRUD matrix edits view/create/edit/delete/full only. The
 * privileged / operational capabilities (grant, promote_super_admin, send,
 * publish, archive, execute, manage, …) stay real and enforced, so they need a
 * home that never hides them — and that keeps their risk visible, so a
 * `medium` capability is never mistaken for a `critical` one.
 */

const RISK_CLASS = {
  low: "text-emerald-400 border-emerald-400/30 bg-emerald-400/10",
  medium: "text-amber-400 border-amber-400/30 bg-amber-400/10",
  high: "text-red-400 border-red-400/30 bg-red-400/10",
  critical: "text-red-500 border-red-500/40 bg-red-500/15",
};
const RISK_UNKNOWN_CLASS =
  "text-[var(--text-secondary)] border-[var(--border-primary)] bg-secondary/40";

function RiskBadge({ label, risk }) {
  return (
    <span
      className={`shrink-0 px-1.5 py-0.5 rounded border text-[9px] font-black uppercase tracking-widest ${
        RISK_CLASS[risk] || RISK_UNKNOWN_CLASS
      }`}
    >
      {label}
    </span>
  );
}

export default function AdvancedCapabilities({
  availableModules,
  moduleToFeature = {},
  visibleFeatures = null,
  mode = "profile",
  stateOf,
  onToggle,
  onAction,
  onWhy,
  disabled = false,
}) {
  const { t } = useI18n();

  // i18n with a real fallback: a missing key comes back as the key itself.
  const labelOr = (key, fallback) => {
    const value = t(key);
    return value && value !== key ? value : fallback;
  };

  const advancedCapsOf = (module) =>
    (availableModules?.[module]?.capabilities || []).filter(
      (capability) => !CRUD_CAPABILITIES.includes(capability),
    );

  // Feature → modules → non-CRUD capabilities, in the catalog's module order.
  const groups = [];
  const byFeature = new Map();
  for (const [module, def] of Object.entries(availableModules || {})) {
    const caps = advancedCapsOf(module);
    if (caps.length === 0) continue;
    const feature = moduleToFeature[module] || null;
    // Strict mode (the profile template passes visibleFeatures): only the
    // features the roles are eligible for — and NEVER the "unmapped" bucket,
    // which is not a feature/section (e.g. org_membership).
    if (visibleFeatures) {
      if (!feature || !visibleFeatures.has(feature)) continue;
    }
    const key = feature || "unmapped";
    if (!byFeature.has(key)) {
      const group = { feature: key, modules: [] };
      byFeature.set(key, group);
      groups.push(group);
    }
    byFeature.get(key).modules.push({
      module,
      name: def?.name || module,
      caps,
    });
  }

  const capabilityRisk = (module, capability) =>
    CAPABILITY_CATALOG[module]?.capabilities?.[capability]?.risk ||
    CAPABILITY_CATALOG[module]?.risk ||
    "unknown";

  const capabilityText = (module, capability) =>
    labelOr(
      `engineering.permissions.capabilityLabels.${capability.replace(/\./g, "_")}`,
      capabilityLabel(module, capability),
    );

  const riskText = (risk) =>
    labelOr(`engineering.permissions.advancedRisk.${risk}`, risk);

  const featureText = (feature) =>
    feature === "unmapped"
      ? t("engineering.permissions.advancedUnmapped")
      : labelOr(
          `engineering.permissions.features.${feature}`,
          feature.replace(/_/g, " "),
        );

  const renderRisk = (module, capability) => {
    const risk = capabilityRisk(module, capability);
    return <RiskBadge label={riskText(risk)} risk={risk} />;
  };

  const renderProfileRow = (module, capability) => {
    const state = stateOf?.(module, capability) || {};
    const checked = Number(state.level ?? 0) > 0;
    const allCaps = availableModules?.[module]?.capabilities || [];
    return (
      <label
        key={`${module}.${capability}`}
        className="flex items-center justify-between gap-3 py-1.5 cursor-pointer"
      >
        <span className="flex items-center gap-2 min-w-0">
          <span className="text-[11px] font-bold text-[var(--text-primary)] truncate">
            {capabilityText(module, capability)}
          </span>
          {renderRisk(module, capability)}
        </span>
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onToggle?.(module, capability, e.target.checked, allCaps)}
          className="h-4 w-4 rounded border-[var(--border-primary)] accent-[var(--brand-orange)] cursor-pointer disabled:opacity-25"
        />
      </label>
    );
  };

  const renderIndividualRow = (module, capability) => {
    const state = stateOf?.(module, capability) || {};
    const origin = state.origin || "inherited";
    const checked = Number(state.level ?? 0) > 0;
    return (
      <div
        key={`${module}.${capability}`}
        className="flex items-center justify-between gap-3 py-1.5"
      >
        <span className="flex items-center gap-2 min-w-0">
          <span className="text-[11px] font-bold text-[var(--text-primary)] truncate">
            {capabilityText(module, capability)}
          </span>
          {renderRisk(module, capability)}
          {origin === "granted" && (
            <span className="shrink-0 text-[9px] font-black uppercase tracking-widest text-emerald-400">
              {t("engineering.permissions.legendIndividualGrant")}
            </span>
          )}
        </span>
        <span className="flex items-center gap-1.5">
          {origin === "restricted" ? (
            <button
              type="button"
              onClick={() => onAction?.("unrestrict", module, capability)}
              className="px-2 py-0.5 rounded border border-red-500/40 bg-red-500/10 text-[9px] font-black uppercase tracking-widest text-red-400"
            >
              {t("engineering.permissions.restricted")}
            </button>
          ) : (
            <input
              type="checkbox"
              checked={checked}
              disabled={disabled}
              onChange={(e) => {
                if (e.target.checked) onAction?.("grant", module, capability, 1);
                else if (origin === "granted") onAction?.("revoke", module, capability);
                else onAction?.("restrict", module, capability, 0);
              }}
              className="h-4 w-4 rounded border-[var(--border-primary)] accent-[var(--brand-orange)] cursor-pointer disabled:opacity-25"
            />
          )}
          {onWhy && (
            <button
              type="button"
              onClick={() => onWhy(module, capability)}
              title={t("engineering.permissions.whyAccess")}
              className="p-1 rounded hover:bg-blue-500/10"
            >
              <Info className="w-3 h-3 text-blue-400" />
            </button>
          )}
        </span>
      </div>
    );
  };

  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-[10px] font-black uppercase tracking-widest text-[var(--brand-orange)]">
          {t("engineering.permissions.advancedTitle")}
        </h3>
        <p className="text-[10px] font-medium text-[var(--text-secondary)]">
          {t("engineering.permissions.advancedHint")}
        </p>
      </div>

      {groups.length === 0 ? (
        <p className="text-[10px] font-bold text-[var(--text-secondary)] opacity-70">
          {t("engineering.permissions.advancedEmpty")}
        </p>
      ) : (
        groups.map((group) => (
          <div
            key={group.feature}
            className="ios-card !p-0 border border-[var(--border-primary)] overflow-hidden"
          >
            <div className="px-5 py-3 bg-tertiary/30 border-b border-[var(--border-primary)]">
              <h4 className="text-[10px] font-black text-[var(--brand-orange)] uppercase tracking-wider">
                {featureText(group.feature)}
              </h4>
            </div>
            <div className="divide-y divide-[var(--border-primary)]/50">
              {group.modules.map((mod) => (
                <div key={mod.module} className="px-4 py-3 space-y-1">
                  <p className="text-[11px] font-black text-[var(--text-primary)] uppercase tracking-wide">
                    {mod.name}
                  </p>
                  <div>
                    {mod.caps.map((capability) =>
                      mode === "individual"
                        ? renderIndividualRow(mod.module, capability)
                        : renderProfileRow(mod.module, capability),
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </section>
  );
}
