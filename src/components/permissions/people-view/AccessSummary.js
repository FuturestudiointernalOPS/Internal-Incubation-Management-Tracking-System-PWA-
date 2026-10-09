"use client";

import React from "react";
import { Info } from "lucide-react";

/**
 * ACCESS SUMMARY — the five numbers an admin needs before reading any detail:
 * what profile/role the person holds, how many rights they effectively have,
 * how many are inherited vs granted directly, how many are restricted, and how
 * broad their scope is. Every figure is derived live (see ./accessSummary);
 * nothing here is stored or hardcoded.
 *
 * Deliberately a band, not a card-of-cards: one hairline border, generous
 * spacing, and a label/value pair per figure. The state never relies on colour
 * alone — each figure carries a word.
 */
function SummaryFigure({ label, value, hint }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-[var(--text-secondary)]">{label}</dt>
      <dd
        className="mt-0.5 truncate text-lg font-semibold tabular-nums text-[var(--text-primary)]"
        title={hint || undefined}
      >
        {value}
      </dd>
    </div>
  );
}

export default function AccessSummary({
  t,
  summary,
  role = null,
  profileName = null,
}) {
  if (!summary) return null;
  const scopeValue =
    summary.scopeCount > 0
      ? t("engineering.permissions.accessSummaryScopeValue", {
          count: summary.scopeCount,
        })
      : t("engineering.permissions.accessSummaryScopeNone");

  return (
    <section
      aria-labelledby="access-summary-title"
      className="rounded-xl border border-[var(--border-primary)] bg-[var(--surface-1)] px-5 py-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2
          id="access-summary-title"
          className="text-sm font-semibold text-[var(--text-primary)]"
        >
          {t("engineering.permissions.accessSummaryTitle")}
        </h2>
        <span
          className="inline-flex items-center gap-1.5 text-xs text-[var(--text-secondary)]"
          aria-hidden="true"
          title={t("engineering.permissions.accessSummaryHint")}
        >
          <Info className="h-3.5 w-3.5" />
        </span>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-divider/60 pb-4">
        <div className="min-w-0">
          <p className="text-xs font-medium text-[var(--text-secondary)]">
            {t("engineering.permissions.accessSummaryProfile")}
          </p>
          <p className="mt-0.5 truncate text-sm font-semibold text-[var(--text-primary)]">
            {profileName || t("engineering.permissions.accessSummaryNoProfile")}
          </p>
        </div>
        {role && (
          <div className="min-w-0">
            <p className="text-xs font-medium text-[var(--text-secondary)]">
              {t("engineering.permissions.accessSummaryRole")}
            </p>
            <p className="mt-0.5 truncate text-sm font-semibold text-[var(--text-primary)]">
              {role}
            </p>
          </div>
        )}
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-5">
        <SummaryFigure
          label={t("engineering.permissions.accessSummaryPermissions")}
          value={summary.permissions}
        />
        <SummaryFigure
          label={t("engineering.permissions.accessSummaryInherited")}
          value={summary.inherited}
        />
        <SummaryFigure
          label={t("engineering.permissions.accessSummaryDirect")}
          value={summary.direct}
        />
        <SummaryFigure
          label={t("engineering.permissions.accessSummaryRestricted")}
          value={summary.restricted}
        />
        <SummaryFigure
          label={t("engineering.permissions.accessSummaryScope")}
          value={scopeValue}
        />
      </dl>

      <p className="mt-3 text-xs text-[var(--text-secondary)]">
        {t("engineering.permissions.accessSummaryHint")}
      </p>
    </section>
  );
}
