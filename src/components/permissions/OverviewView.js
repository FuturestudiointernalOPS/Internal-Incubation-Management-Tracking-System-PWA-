"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, MapPin, ShieldCheck, Users } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { Skeleton } from "@/components/ui/Skeleton";
import Badge from "./ui/Badge";
import StatCard from "./ui/StatCard";
import SectionCard from "./ui/SectionCard";
import { PERMISSION_NAV, PERMISSION_BASE } from "./permissionNav";
import { SCOPE_POLICIES, SCOPE_POLICY_KEYS } from "@/lib/authorization/scope-catalog";
import { summarizeContextRoles } from "./overviewHelpers";

/**
 * PHASE UI-1 — Permission Center Overview.
 *
 * The landing screen that did not exist before: governance health at a glance
 * (context coverage, profile inventory, scope-engine state) plus the most
 * recent permission changes. Read-only; every number comes from an existing
 * endpoint (each card fails soft and independently).
 */

/** Deterministic, locale-independent timestamp for the audit preview. */
function formatStamp(value) {
  const s = String(value || "");
  if (s.length < 16) return s;
  return `${s.slice(0, 10)} ${s.slice(11, 16)}`;
}

export default function OverviewView() {
  const { t } = useI18n();
  const [state, setState] = useState({
    loading: true,
    error: "",
    contextRoles: null,
    profiles: null,
    audit: null,
  });

  useEffect(() => {
    let alive = true;
    (async () => {
      const [cr, ap, au] = await Promise.allSettled([
        fetch("/api/engineering/permissions/context-roles").then((r) => r.json()),
        fetch("/api/access-profiles").then((r) => r.json()),
        fetch("/api/engineering/permissions/audit?page=1&pageSize=5").then((r) =>
          r.json(),
        ),
      ]);
      if (!alive) return;
      const pick = (settled) =>
        settled.status === "fulfilled" && settled.value?.success
          ? settled.value
          : null;
      const next = {
        loading: false,
        error: "",
        contextRoles: pick(cr),
        profiles: pick(ap),
        audit: pick(au),
      };
      if (!next.contextRoles && !next.profiles && !next.audit) {
        next.error = t("engineering.permissions.overviewLoadFailed");
      }
      setState(next);
    })();
    return () => {
      alive = false;
    };
  }, [t]);

  if (state.loading) {
    return (
      <div className="grid sm:grid-cols-3 gap-3">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
    );
  }

  const coverage = summarizeContextRoles(state.contextRoles?.roles || []);
  const profileCount = state.profiles?.profiles?.length ?? null;
  const roleDefaultCount = state.profiles?.roleDefaults
    ? Object.keys(state.profiles.roleDefaults).length
    : null;
  const implementedPolicies = SCOPE_POLICY_KEYS.filter(
    (k) => SCOPE_POLICIES[k]?.implemented,
  ).length;
  const entries = state.audit?.entries || [];

  return (
    <div className="space-y-4">
      {state.error && (
        <p className="flex items-center gap-2 text-xs font-bold text-red-500">
          <AlertTriangle className="w-3.5 h-3.5" /> {state.error}
        </p>
      )}

      {/* How access is decided — the one place the model is stated on screen. */}
      <SectionCard title={t("engineering.permissions.modelStripTitle")}>
        <div className="flex flex-wrap items-center gap-2">
          {[
            { key: "identity", label: t("engineering.permissions.modelStripIdentity"), href: null },
            { key: "eligibility", label: t("engineering.permissions.modelStripEligibility"), href: `${PERMISSION_BASE}/eligibility` },
            { key: "profile", label: t("engineering.permissions.modelStripProfile"), href: `${PERMISSION_BASE}/profiles` },
            { key: "context", label: t("engineering.permissions.modelStripContext"), href: `${PERMISSION_BASE}/context-scope?sub=roles` },
            { key: "scope", label: t("engineering.permissions.modelStripScope"), href: `${PERMISSION_BASE}/context-scope?sub=policies` },
          ].map((chip, i) => (
            <React.Fragment key={chip.key}>
              {i > 0 && <span className="text-[var(--text-secondary)] opacity-50">→</span>}
              {chip.href ? (
                <Link
                  href={chip.href}
                  className="px-3 py-1.5 rounded-lg border border-[var(--border-primary)] text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--brand-orange)]/40 transition-colors"
                >
                  {chip.label}
                </Link>
              ) : (
                <span className="px-3 py-1.5 rounded-lg border border-dashed border-[var(--border-primary)] text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] opacity-70">
                  {chip.label}
                </span>
              )}
            </React.Fragment>
          ))}
        </div>
        <p className="mt-2 text-[10px] font-bold text-[var(--text-secondary)] opacity-70">
          {t("engineering.permissions.modelStripHint")}
        </p>
      </SectionCard>

      <div className="grid sm:grid-cols-3 gap-3">
        <StatCard
          label={t("engineering.permissions.overviewContextCoverage")}
          value={
            state.contextRoles
              ? `${coverage.mapped}/${coverage.total}`
              : "—"
          }
          tone={coverage.gaps.length > 0 ? "warning" : "success"}
          icon={MapPin}
          hint={
            coverage.gaps.length > 0
              ? t("engineering.permissions.overviewContextGaps", {
                  total: coverage.gaps.length,
                })
              : t("engineering.permissions.overviewContextAllMapped")
          }
        />
        <StatCard
          label={t("engineering.permissions.overviewProfilesTitle")}
          value={profileCount === null ? "—" : profileCount}
          tone="brand"
          icon={Users}
          hint={
            roleDefaultCount === null
              ? t("engineering.permissions.overviewProfilesNoHint")
              : t("engineering.permissions.overviewProfilesHint", {
                  count: roleDefaultCount,
                })
          }
        />
        <StatCard
          label={t("engineering.permissions.overviewScopeTitle")}
          value={`${implementedPolicies}/${SCOPE_POLICY_KEYS.length}`}
          tone={implementedPolicies === SCOPE_POLICY_KEYS.length ? "success" : "warning"}
          icon={ShieldCheck}
          hint={t("engineering.permissions.overviewScopeHint")}
        />
      </div>

      {coverage.gaps.length > 0 && (
        <SectionCard title={t("engineering.permissions.overviewOpenGaps")}>
          <ul className="flex flex-wrap gap-2">
            {coverage.gaps.map((gap) => (
              <li key={`${gap.context}:${gap.role_key}`}>
                <Badge variant="gap">
                  {gap.context} · {gap.role_key}
                </Badge>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      <SectionCard
        title={t("engineering.permissions.overviewRecentTitle")}
        action={
          <Link
            href={`${PERMISSION_BASE}/audit`}
            className="text-[10px] font-black uppercase tracking-widest text-[var(--brand-orange)] hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]/60 rounded-sm"
          >
            {t("engineering.permissions.overviewViewAudit")}
          </Link>
        }
      >
        {entries.length === 0 ? (
          <p className="text-xs font-medium text-[var(--text-secondary)]">
            {t("engineering.permissions.overviewRecentEmpty")}
          </p>
        ) : (
          <ul className="divide-y divide-[var(--border-primary)]">
            {entries.map((entry, i) => (
              <li
                key={entry.id ?? i}
                className="py-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs"
              >
                <span className="font-mono text-[10px] text-[var(--text-secondary)]">
                  {formatStamp(entry.created_at)}
                </span>
                <span className="font-bold text-[var(--text-primary)]">
                  {entry.action}
                </span>
                <span className="text-[var(--text-secondary)]">
                  {entry.target_name || entry.module || "—"}
                </span>
                {entry.actor_name && (
                  <span className="text-[var(--text-secondary)] opacity-70">
                    {entry.actor_name}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard title={t("engineering.permissions.overviewQuickLinks")}>
        <div className="flex flex-wrap gap-2">
          {PERMISSION_NAV.filter((n) => n.key !== "overview").map((item) => (
            <Link
              key={item.key}
              href={item.href}
              className="px-3 py-2 rounded-lg border border-[var(--border-primary)] text-[11px] font-bold uppercase tracking-widest text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--brand-orange)]/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]/60"
            >
              {t(item.labelKey)}
            </Link>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
