"use client";

import React, { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Users } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useApi, useApiMulti } from "@/lib/hooks/useApi";
import { capabilityRisk } from "@/lib/authorization/capability-catalog";
import { Skeleton } from "@/components/ui/Skeleton";
import RiskBadge from "./RiskBadge";
import { ACCESS_LEVEL_KEYS } from "./levelChips";

/**
 * PHASE UI-9 — "what does this kind of person / this group get?"
 *
 * Every other screen in the Permission Center starts from an INDIVIDUAL (People)
 * or from a TEMPLATE (Templates). Neither answers the question an administrator
 * asks when they are about to hand out access: "if I make someone a facilitator,
 * or put them in the Founders group, what do they actually end up with?"
 *
 * This rollup answers it for a whole CATEGORY, read-only, from data the
 * permissions API already computes — no new endpoint, no write path:
 *
 *   • how many people currently hold it            → /api/engineering/permissions?users=true
 *   • what it gets today                           → the role's default template
 *                                                    (/api/access-profiles?id=),
 *                                                    the legacy role defaults, or the
 *                                                    group's own capabilities
 *   • what it may EVER have (the feature ceiling)   → /api/engineering/permissions/eligibility
 *
 * It sits inside Templates as a control rather than as a seventh door: it is the
 * read-only twin of the screen that edits those templates, not a place of its
 * own.
 */
export default function EntitlementRollup() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState("role");
  const [value, setValue] = useState("");

  const endpoints = useMemo(
    () => [
      { key: "defaults", url: "/api/engineering/permissions" },
      { key: "directory", url: "/api/engineering/permissions?users=true" },
      { key: "eligibility", url: "/api/engineering/permissions/eligibility" },
    ],
    [],
  );
  const { data, loading, error } = useApiMulti(endpoints, { immediate: open });

  const defaults = data?.defaults?.success ? data.defaults : null;
  const directory = data?.directory?.success ? data.directory : null;
  const eligibility = data?.eligibility?.success ? data.eligibility : null;

  // One template read, only when the selected role actually has a default
  // template: the resolver uses the template INSTEAD of the legacy role rows, so
  // showing the legacy rows for such a role would describe access nobody has.
  const templateRef =
    kind === "role" ? defaults?.accessProfileDefaults?.[value] || null : null;
  const { data: templateData, error: templateError } = useApi(
    templateRef?.profileId ? `/api/access-profiles?id=${templateRef.profileId}` : null,
    { deps: [templateRef?.profileId], immediate: open },
  );
  // A template read that has neither answered nor failed must show as pending:
  // painting "no capability is configured" while the read is still on the wire
  // would state the opposite of the truth.
  const templatePending =
    Boolean(templateRef?.profileId) && !templateData && !templateError;

  // Memoized: three derivations below (the two identity lists and the holder
  // count) depend on it, and a fresh array on every render would recompute all
  // three for nothing.
  const people = useMemo(() => directory?.users || [], [directory]);
  const holderCount = value
    ? people.filter((user) =>
        kind === "role"
          ? user.role === value
          : (user.groups || []).includes(value),
      ).length
    : 0;

  // The identities offered are the union of what is CONFIGURED (defaults,
  // templates, ceilings) and what people actually HOLD — an identity nobody
  // configures and nobody holds has nothing to answer.
  const roleOptions = useMemo(() => {
    const set = new Set();
    for (const row of defaults?.roleDefaults || []) set.add(row.role);
    for (const role of Object.keys(defaults?.accessProfileDefaults || {})) {
      set.add(role);
    }
    for (const role of eligibility?.roles || []) set.add(role);
    for (const role of eligibility?.extraRoles || []) set.add(role);
    for (const user of people) if (user.role) set.add(user.role);
    return [...set].filter(Boolean).sort();
  }, [defaults, eligibility, people]);

  const groupOptions = useMemo(() => {
    const set = new Set();
    for (const row of defaults?.groupDefaults || []) set.add(row.group_name);
    for (const group of eligibility?.groups || []) set.add(group);
    for (const user of people) for (const group of user.groups || []) set.add(group);
    return [...set].filter(Boolean).sort();
  }, [defaults, eligibility, people]);

  const options = kind === "role" ? roleOptions : groupOptions;

  /** Capabilities grouped by module, for one list of stored rows. */
  const groupByModule = (rows) => {
    const byModule = new Map();
    for (const row of rows || []) {
      if (!byModule.has(row.module)) byModule.set(row.module, []);
      byModule.get(row.module).push({
        capability: row.capability,
        level: Number(row.access_level) || 0,
      });
    }
    return [...byModule.entries()]
      .map(([module, caps]) => ({
        module,
        caps: caps.sort((first, second) => first.capability.localeCompare(second.capability)),
      }))
      .sort((first, second) => first.module.localeCompare(second.module));
  };

  const legacyRows =
    kind === "role"
      ? (defaults?.roleDefaults || []).filter((roleDefault) => roleDefault.role === value)
      : (defaults?.groupDefaults || []).filter((groupDefault) => groupDefault.group_name === value);
  const payloadRows =
    kind === "role" && templateRef
      ? templateData?.success
        ? templateData.capabilities || []
        : []
      : legacyRows;
  const payload = groupByModule(payloadRows);

  /** The feature ceiling rows for the selected identity (fail-closed). */
  const ceiling = (featureKey) => {
    const row = (eligibility?.rows || []).find(
      (eligibilityRow) =>
        eligibilityRow.feature_key === featureKey &&
        eligibilityRow.identity_type === kind &&
        eligibilityRow.identity_value === value,
    );
    if (!row) return "unset";
    return Number(row.eligible) === 1 ? "allowed" : "denied";
  };

  const moduleLabel = (module) =>
    defaults?.catalog?.[module]?.name || module.replace(/_/g, " ");

  const capabilityText = (capability) => {
    const key = `engineering.permissions.capabilityLabels.${capability.replace(
      /\./g,
      "_",
    )}`;
    const label = t(key);
    return label === key ? capability.replace(/_/g, " ") : label;
  };

  const featureText = (feature) => {
    const key = `engineering.permissions.features.${feature}`;
    const label = t(key);
    return label === key ? feature.replace(/_/g, " ") : label;
  };

  const CEILING_CLASS = {
    allowed: "border-emerald-400/30 bg-emerald-400/10 text-emerald-400",
    denied: "border-red-400/30 bg-red-400/10 text-red-400",
    unset: "border-[var(--border-primary)] bg-secondary text-[var(--text-secondary)]",
  };

  return (
    <div className="space-y-3">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-primary)] px-3 py-2 text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/60"
      >
        {open ? (
          <ChevronDown className="h-3.5 w-3.5" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5" />
        )}
        {open
          ? t("engineering.permissions.rollupToggleHide")
          : t("engineering.permissions.rollupToggleShow")}
      </button>

      {open && (
        <section className="space-y-3 rounded-xl border border-[var(--border-primary)] bg-surface-1 p-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-primary)]">
              {t("engineering.permissions.rollupTitle")}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-[var(--text-secondary)]">
              {t("engineering.permissions.rollupHint")}
            </p>
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <div className="flex items-center gap-1 rounded-lg border border-[var(--border-primary)] p-1">
              {["role", "group"].map((identityKind) => (
                <button
                  key={identityKind}
                  type="button"
                  aria-pressed={kind === identityKind}
                  onClick={() => {
                    setKind(identityKind);
                    setValue("");
                  }}
                  className={`rounded-md px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/60 ${
                    kind === identityKind
                      ? "bg-brand-orange/10 text-[var(--brand-orange)]"
                      : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  {identityKind === "role"
                    ? t("engineering.permissions.rollupKindRole")
                    : t("engineering.permissions.rollupKindGroup")}
                </button>
              ))}
            </div>

            <label className="flex min-w-[220px] flex-col gap-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                {kind === "role"
                  ? t("engineering.permissions.rollupPickRole")
                  : t("engineering.permissions.rollupPickGroup")}
              </span>
              <select
                value={value}
                onChange={(event) => setValue(event.target.value)}
                className="rounded-xl border border-[var(--border-primary)] bg-secondary px-3 py-2.5 text-[10px] font-bold text-[var(--text-primary)] outline-none focus:border-brand-orange/50 focus-visible:ring-2 focus-visible:ring-brand-orange/40"
              >
                <option value="">—</option>
                {options.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            {value && (
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-primary)] bg-surface-2 px-3 py-2 text-[10px] font-bold text-[var(--text-secondary)]">
                <Users className="h-3 w-3" />
                {t("engineering.permissions.rollupPeople", {
                  count: holderCount,
                })}
              </span>
            )}
          </div>

          {error || templateError ? (
            <p className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-[10px] font-bold text-red-400">
              {t("engineering.permissions.rollupLoadFailed")}
            </p>
          ) : !value ? (
            <p className="text-xs text-[var(--text-secondary)]">
              {t("engineering.permissions.rollupPickPrompt")}
            </p>
          ) : loading || templatePending ? (
            <div className="space-y-2">
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
            </div>
          ) : (
            <>
              {/* ── What it gets today ───────────────────────────────────── */}
              <div className="space-y-2 border-t border-[var(--border-primary)] pt-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-primary)]">
                  {t("engineering.permissions.rollupCapsTitle")}
                </p>

                {kind === "role" && (
                  <p className="text-[11px] font-bold text-[var(--text-secondary)]">
                    {templateRef
                      ? t("engineering.permissions.rollupTemplate", {
                          name:
                            templateRef.profileName ||
                            templateData?.profile?.name ||
                            "—",
                        })
                      : t("engineering.permissions.rollupTemplateNone")}
                  </p>
                )}

                {payload.length === 0 ? (
                  <p className="text-xs text-[var(--text-secondary)]">
                    {kind === "role"
                      ? t("engineering.permissions.rollupEmptyRole")
                      : t("engineering.permissions.rollupEmptyGroup")}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {payload.map(({ module, caps }) => (
                      <div
                        key={module}
                        className="rounded-lg border border-[var(--border-primary)] bg-surface-2 p-2.5"
                      >
                        <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-primary)]">
                          {moduleLabel(module)}
                          <span className="ml-2 font-mono text-[9px] font-bold normal-case tracking-normal text-[var(--text-secondary)] opacity-70">
                            {module}
                          </span>
                        </p>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {caps.map(({ capability, level }) => (
                            <span
                              key={capability}
                              className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border-primary)] bg-primary px-2 py-1"
                            >
                              <span className="text-[10px] font-bold text-[var(--text-primary)]">
                                {capabilityText(capability)}
                              </span>
                              <span className="text-[9px] font-black uppercase tracking-widest text-[var(--brand-orange)]">
                                {t(ACCESS_LEVEL_KEYS[level] || ACCESS_LEVEL_KEYS[0])}
                              </span>
                              <RiskBadge
                                risk={capabilityRisk(module, capability)}
                              />
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {kind === "role" && !templateRef && payload.length > 0 && (
                  <p className="text-[10px] leading-relaxed text-[var(--text-secondary)] opacity-80">
                    {t("engineering.permissions.rollupLegacyNote")}
                  </p>
                )}
                {kind === "group" && payload.length > 0 && (
                  <p className="text-[10px] leading-relaxed text-[var(--text-secondary)] opacity-80">
                    {t("engineering.permissions.rollupGroupNote")}
                  </p>
                )}
              </div>

              {/* ── What it may ever have ────────────────────────────────── */}
              <div className="space-y-2 border-t border-[var(--border-primary)] pt-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-primary)]">
                  {t("engineering.permissions.rollupCeilingTitle")}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {(eligibility?.features || []).map((feature) => {
                    const state = ceiling(feature);
                    return (
                      <span
                        key={feature}
                        className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] font-bold ${CEILING_CLASS[state]}`}
                      >
                        {featureText(feature)}
                        <span className="text-[9px] font-black uppercase tracking-widest">
                          {state === "allowed"
                            ? t("engineering.permissions.rollupCeilingAllowed")
                            : state === "denied"
                              ? t("engineering.permissions.rollupCeilingDenied")
                              : t("engineering.permissions.rollupCeilingUnset")}
                        </span>
                      </span>
                    );
                  })}
                </div>
                <p className="text-[10px] leading-relaxed text-[var(--text-secondary)] opacity-80">
                  {t("engineering.permissions.rollupCeilingNote")}
                </p>
              </div>
            </>
          )}
        </section>
      )}
    </div>
  );
}
