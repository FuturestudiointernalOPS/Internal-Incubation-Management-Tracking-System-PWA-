"use client";

import React from "react";
import Link from "next/link";
import { History, RefreshCw } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useApi } from "@/lib/hooks/useApi";
import { Skeleton } from "@/components/ui/Skeleton";
import { splitAuditReason } from "./auditHelpers";
import { PERMISSION_BASE } from "./permissionNav";

/**
 * PHASE UI-9 — the last few changes ABOUT this person, as a timeline.
 *
 * The History door answers "what changed" for the whole portfolio. This panel
 * answers the same question for the ONE person in front of you, without leaving
 * the screen — because "who has been moving this person's access?" is part of
 * reading their access, not a separate errand. It reads the same audit endpoint
 * with the `target_cid` filter the API already supports (exact account, not a
 * name search), and links to the same log with that filter applied so the full
 * story is one click away.
 *
 * Presented as a timeline rather than a log line: date, what happened, what it
 * changed, and who did it — read top to bottom, newest first.
 *
 * Read-only: the audit log is append-only and this panel cannot write to it.
 */
export default function PersonRecentChanges({ person = null }) {
  const { t } = useI18n();
  const cid = person?.cid || null;
  const pageSize = 5;
  const url = cid
    ? `/api/engineering/permissions/audit?target_cid=${encodeURIComponent(
        cid,
      )}&page=1&pageSize=${pageSize}`
    : null;
  const { data, loading, error, refresh } = useApi(url, { deps: [cid] });

  if (!cid) return null;

  const entries = data?.success ? data.entries || [] : [];
  const failed = Boolean(error) || data?.success === false;
  const fullHistoryHref = `${PERMISSION_BASE}/audit?target_cid=${encodeURIComponent(
    cid,
  )}`;

  const fmtDate = (value) => {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  /** Audit action codes are machine names — show them as words. */
  const actionLabel = (action) =>
    action ? action.replace(/_/g, " ") : t("engineering.permissions.auditAction");

  return (
    <section
      id="person-section-history"
      aria-labelledby="person-history-title"
      className="scroll-mt-24 space-y-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="space-y-1">
          <h2
            id="person-history-title"
            className="flex items-center gap-2 text-base font-semibold text-[var(--text-primary)]"
          >
            <History className="h-4 w-4 text-[var(--brand-orange)]" aria-hidden="true" />
            {t("engineering.permissions.personRecentTitle")}
          </h2>
          <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
            {t("engineering.permissions.personRecentHint")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={refresh}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-primary)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/60"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            {t("common.refresh")}
          </button>
          <Link
            href={fullHistoryHref}
            className="rounded-lg border border-[var(--border-primary)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/60"
          >
            {t("engineering.permissions.personRecentViewAll")}
          </Link>
        </div>
      </div>

      {loading && entries.length === 0 ? (
        <div className="space-y-2">
          <Skeleton className="h-12" />
          <Skeleton className="h-12" />
        </div>
      ) : failed ? (
        <p className="text-sm font-medium text-red-400">
          {t("engineering.permissions.personRecentFailed")}
        </p>
      ) : entries.length === 0 ? (
        <p className="text-sm text-[var(--text-secondary)]">
          {t("engineering.permissions.personRecentEmpty")}
        </p>
      ) : (
        <ol className="space-y-0">
          {entries.map((entry, index) => {
            const parsed = splitAuditReason(entry.details);
            const object = entry.module
              ? `${entry.module}.${entry.capability || "*"}`
              : parsed.text || "—";
            const change =
              entry.previous_value || entry.new_value
                ? `${entry.previous_value || "—"} → ${entry.new_value || "—"}`
                : null;
            const last = index === entries.length - 1;
            return (
              <li key={entry.id} className="flex gap-3">
                <span className="flex flex-col items-center" aria-hidden="true">
                  <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full border-2 border-[var(--brand-orange)] bg-[var(--surface-1)]" />
                  {!last && <span className="w-px flex-1 bg-[var(--border-primary)]" />}
                </span>
                <div className="min-w-0 flex-1 pb-5">
                  <p className="text-xs text-[var(--text-secondary)]">
                    {fmtDate(entry.created_at)}
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-baseline gap-x-2 text-sm text-[var(--text-primary)]">
                    <span className="font-medium capitalize">{actionLabel(entry.action)}</span>
                    <span className="font-mono text-xs text-[var(--text-secondary)]">
                      {object}
                    </span>
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-[var(--text-secondary)]">
                    {change && <span className="tabular-nums">{change}</span>}
                    {entry.actor_name && (
                      <span>
                        ·{" "}
                        {t("engineering.permissions.personRecentBy", {
                          actor: entry.actor_name,
                        })}
                      </span>
                    )}
                  </p>
                  {parsed.reason && (
                    <p className="mt-1 text-xs text-[var(--text-secondary)]">
                      {t("engineering.permissions.auditReason")}: {parsed.reason}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {!loading && !failed && (data?.total ?? 0) > pageSize && (
        <p className="text-xs text-[var(--text-secondary)]">
          {t("engineering.permissions.personRecentMore", {
            total: data.total,
          })}
        </p>
      )}
    </section>
  );
}
