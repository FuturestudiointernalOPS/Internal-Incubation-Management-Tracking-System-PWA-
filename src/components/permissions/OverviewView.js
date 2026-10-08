"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, MapPin, ShieldCheck, Users } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { Skeleton } from "@/components/ui/Skeleton";
import StatCard from "./ui/StatCard";
import SectionCard from "./ui/SectionCard";
import { PERMISSION_BASE } from "./permissionNav";
import { SCOPE_POLICIES, SCOPE_POLICY_KEYS } from "@/models/authorization/scope-catalog";
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
  const stamp = String(value || "");
  if (stamp.length < 16) return stamp;
  return `${stamp.slice(0, 10)} ${stamp.slice(11, 16)}`;
}

export default function OverviewView({ hideRecent = false }) {
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
      const [contextRolesResult, profilesResult, auditResult] = await Promise.allSettled([
        fetch("/api/engineering/permissions/context-roles").then((response) => response.json()),
        fetch("/api/engineering/permissions/profiles").then((response) => response.json()),
        fetch("/api/engineering/permissions/audit?page=1&pageSize=5").then((response) =>
          response.json(),
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
        contextRoles: pick(contextRolesResult),
        profiles: pick(profilesResult),
        audit: pick(auditResult),
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
  const roleDefaultCount = state.profiles?.role_defaults
    ? Object.keys(state.profiles.role_defaults).length
    : null;
  const implementedPolicies = SCOPE_POLICY_KEYS.filter(
    (policyKey) => SCOPE_POLICIES[policyKey]?.implemented,
  ).length;
  const entries = state.audit?.entries || [];

  // Health alerts — the things that need a hand, each with a way straight to the
  // screen that fixes it. Only the two the center can act on are raised here;
  // the memberships health heads the same page just below, so it is not
  // repeated as an alert.
  const alerts = [];
  if (state.contextRoles && coverage.gaps.length > 0) {
    alerts.push({
      key: "gaps",
      icon: MapPin,
      href: `${PERMISSION_BASE}/profiles?sub=contextRoles`,
      label: t("engineering.permissions.healthAlertGaps", { count: coverage.gaps.length }),
    });
  }
  if (implementedPolicies < SCOPE_POLICY_KEYS.length) {
    alerts.push({
      key: "scope",
      icon: ShieldCheck,
      href: `${PERMISSION_BASE}/eligibility?sub=scope`,
      label: t("engineering.permissions.healthAlertScope", {
        count: SCOPE_POLICY_KEYS.length - implementedPolicies,
      }),
    });
  }

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
            { key: "context", label: t("engineering.permissions.modelStripContext"), href: `${PERMISSION_BASE}/profiles?sub=contextRoles` },
            { key: "scope", label: t("engineering.permissions.modelStripScope"), href: `${PERMISSION_BASE}/eligibility?sub=scope` },
          ].map((chip, index) => (
            <React.Fragment key={chip.key}>
              {index > 0 && <span className="text-[var(--text-secondary)] opacity-50">→</span>}
              {chip.href ? (
                <Link
                  href={chip.href}
                  className="px-3 py-1.5 rounded-lg border border-[var(--border-primary)] text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-brand-orange/40 transition-colors"
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

      <SectionCard title={t("engineering.permissions.healthAlertsTitle")}>
        {alerts.length === 0 ? (
          <p className="text-xs font-medium text-emerald-500">
            {t("engineering.permissions.healthAllClear")}
          </p>
        ) : (
          <ul className="divide-y divide-[var(--border-primary)]">
            {alerts.map((alert) => {
              const Icon = alert.icon;
              return (
                <li key={alert.key}>
                  <Link
                    href={alert.href}
                    className="flex items-center justify-between gap-3 rounded-sm py-2.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/60"
                  >
                    <span className="flex items-center gap-2 text-xs font-bold text-[var(--text-secondary)]">
                      <Icon className="h-3.5 w-3.5 shrink-0 text-amber-400" aria-hidden="true" />
                      {alert.label}
                    </span>
                    <span className="text-[10px] font-black uppercase tracking-widest text-[var(--brand-orange)]">
                      {t("engineering.permissions.healthSee")}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>

      {!hideRecent && (
      <SectionCard
        title={t("engineering.permissions.overviewRecentTitle")}
        action={
          <Link
            href={`${PERMISSION_BASE}/audit`}
            className="text-[10px] font-black uppercase tracking-widest text-[var(--brand-orange)] hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/60 rounded-sm"
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
            {entries.map((entry, index) => (
              <li
                key={entry.id ?? index}
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
      )}
    </div>
  );
}
