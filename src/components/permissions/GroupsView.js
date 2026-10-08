"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Layers, Loader2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { cacheGet, cacheSet } from "@/lib/hooks/useApi";
import { defer } from "./effectUtils";
import { ACCESS_LEVEL_KEYS, ACCESS_SHORT, LEVEL_CHIP_ACTIVE, LEVEL_CHIP_BASE } from "./levelChips";
import Badge from "./ui/Badge";

/**
 * GROUPS (People → Groups).
 *
 * A group ADDS capabilities to everyone in it; it never replaces what a person
 * already holds. This screen reports that: for one group, what it grants today
 * and which features it may ever touch.
 *
 * Read-only on purpose. Group capability editing is not exposed anywhere in the
 * center (the write path exists server-side but no surface drives it), so this
 * screen does not invent a second, partial editor — it makes the current
 * configuration visible, which nothing did before.
 */

const DEF_URL = "/api/engineering/permissions";
const ELIG_URL = "/api/engineering/permissions/eligibility";

export default function GroupsView() {
  const { t } = useI18n();
  const [modules, setModules] = useState({});
  const [groupDefaults, setGroupDefaults] = useState([]);
  const [eligibility, setEligibility] = useState(null);
  const [selected, setSelected] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    defer(async () => {
      try {
        const cached = cacheGet(DEF_URL);
        const applyDefinition = (payload) => {
          if (!payload?.success) return;
          setModules(payload.modules || {});
          setGroupDefaults(payload.groupDefaults || []);
        };
        if (cached?.success) applyDefinition(cached);

        const [definitionRes, eligibilityRes] = await Promise.all([
          fetch(DEF_URL).then((response) => response.json()),
          fetch(ELIG_URL).then((response) => response.json()),
        ]);
        if (definitionRes?.success) {
          cacheSet(DEF_URL, definitionRes);
          applyDefinition(definitionRes);
        }
        if (eligibilityRes?.success) setEligibility(eligibilityRes);
      } catch {
        setErr(t("engineering.permissions.groupsLoadFailed"));
      } finally {
        setLoading(false);
      }
    });
  }, [t]);

  const groups = useMemo(() => {
    const names = new Set(eligibility?.groups || []);
    for (const row of groupDefaults) if (row.group_name) names.add(row.group_name);
    return Array.from(names).sort();
  }, [eligibility, groupDefaults]);

  useEffect(() => {
    defer(() => {
      if (!selected && groups.length > 0) setSelected(groups[0]);
    });
  }, [selected, groups]);

  const levelFor = (module, capability) => {
    const row = groupDefaults.find(
      (candidate) =>
        candidate.group_name === selected &&
        candidate.module === module &&
        candidate.capability === capability,
    );
    return Number(row?.access_level ?? 0);
  };

  const eligibilityFor = (feature) => {
    const row = (eligibility?.rows || []).find(
      (candidate) =>
        candidate.identity_type === "group" &&
        candidate.identity_value === selected &&
        candidate.feature_key === feature,
    );
    return row ? Number(row.eligible) : null;
  };

  const configuredCount = groupDefaults.filter(
    (row) => row.group_name === selected && Number(row.access_level) > 0,
  ).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-[var(--brand-orange)]" aria-hidden="true" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-[var(--border-primary)] bg-secondary/40 p-4 space-y-1.5">
        <p className="text-xs font-bold leading-relaxed text-[var(--text-primary)]">
          {t("engineering.permissions.groupsIntro")}
        </p>
        <p className="text-[10px] font-bold text-[var(--text-secondary)]">
          {t("engineering.permissions.groupsAdditiveNote")}
        </p>
      </div>

      {err && <p className="text-xs font-bold text-red-500">{err}</p>}

      {groups.length === 0 ? (
        <p className="text-xs font-medium text-[var(--text-secondary)]">
          {t("engineering.permissions.groupsEmpty")}
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {groups.map((group) => (
              <button
                key={group}
                type="button"
                onClick={() => setSelected(group)}
                aria-pressed={selected === group}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/60 ${
                  selected === group
                    ? "border-brand-orange/40 bg-brand-orange/10 text-[var(--brand-orange)]"
                    : "border-[var(--border-primary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
              >
                <Layers className="h-3 w-3" aria-hidden="true" />
                {group}
              </button>
            ))}
          </div>

          <section className="space-y-2">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
              {t("engineering.permissions.groupsCapabilities", { count: configuredCount })}
            </h3>
            {configuredCount === 0 ? (
              <p className="text-xs font-medium text-[var(--text-secondary)]">
                {t("engineering.permissions.groupsNoCapabilities")}
              </p>
            ) : (
              <div className="space-y-1.5">
                {Object.entries(modules).map(([module, definition]) => {
                  const caps = (definition.capabilities || []).filter(
                    (capability) => levelFor(module, capability) > 0,
                  );
                  if (caps.length === 0) return null;
                  return (
                    <div
                      key={module}
                      className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--border-primary)] bg-[var(--surface-1)] px-3 py-2"
                    >
                      <span className="min-w-[7rem] text-[10px] font-black uppercase tracking-wide text-[var(--text-primary)]">
                        {definition.name || module}
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {caps.map((capability) => {
                          const level = levelFor(module, capability);
                          return (
                            <span
                              key={capability}
                              title={t(ACCESS_LEVEL_KEYS[level])}
                              className={`inline-flex h-7 items-center gap-1 rounded-lg border-2 px-2 text-[9px] font-black uppercase tracking-wide ${
                                LEVEL_CHIP_ACTIVE[level] || LEVEL_CHIP_ACTIVE[3]
                              } ${LEVEL_CHIP_BASE}`}
                            >
                              {capability}
                              <span className="opacity-70">{ACCESS_SHORT[level]}</span>
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {(eligibility?.features || []).length > 0 && (
            <section className="space-y-2">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                {t("engineering.permissions.groupsEligibility")}
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {eligibility.features.map((feature) => {
                  const value = eligibilityFor(feature);
                  const variant = value === 1 ? "allowed" : value === 0 ? "denied" : "neutral";
                  const label =
                    value === 1
                      ? t("engineering.permissions.eligibilityEligible")
                      : value === 0
                        ? t("engineering.permissions.eligibilityNotEligible")
                        : t("engineering.permissions.eligibilityUnset");
                  return (
                    <Badge key={feature} variant={variant}>
                      {feature} · {label}
                    </Badge>
                  );
                })}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
