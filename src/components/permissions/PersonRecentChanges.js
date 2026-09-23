"use client";

import React from "react";
import Link from "next/link";
import { History, RefreshCw } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useApi } from "@/lib/hooks/useApi";
import { Skeleton } from "@/components/ui/Skeleton";
import Badge from "./ui/Badge";
import { splitAuditReason } from "./auditHelpers";
import { PERMISSION_BASE } from "./permissionNav";

/**
 * PHASE UI-9 — the last few changes ABOUT this person, on the person screen.
 *
 * The History door answers "what changed" for the whole portfolio. This panel
 * answers the same question for the ONE person in front of you, without leaving
 * the screen — because "who has been moving this person's access?" is part of
 * reading their access, not a separate errand. It reads the same audit endpoint
 * with the `target_cid` filter the API already supports (exact account, not a
 * name search), and links to the same log with that filter applied so the full
 * story is one click away.
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

  return (
    <div className="rounded-xl border border-[var(--border-primary)] bg-secondary/20 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-primary)] p-3">
        <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
          <History className="h-3.5 w-3.5 text-[var(--brand-orange)]" />
          {t("engineering.permissions.personRecentTitle")}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={refresh}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-primary)] px-2.5 py-1.5 text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]/60"
          >
            <RefreshCw className="h-3 w-3" />
            {t("common.refresh")}
          </button>
          <Link
            href={fullHistoryHref}
            className="rounded-lg border border-[var(--border-primary)] px-2.5 py-1.5 text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]/60"
          >
            {t("engineering.permissions.personRecentViewAll")}
          </Link>
        </div>
      </div>

      <p className="px-3 pt-2 text-[10px] font-bold text-[var(--text-secondary)] opacity-80">
        {t("engineering.permissions.personRecentHint")}
      </p>

      {loading && entries.length === 0 ? (
        <div className="space-y-2 p-3">
          <Skeleton className="h-8" />
          <Skeleton className="h-8" />
        </div>
      ) : failed ? (
        <p className="p-3 text-[10px] font-bold text-red-400">
          {t("engineering.permissions.personRecentFailed")}
        </p>
      ) : entries.length === 0 ? (
        <p className="p-3 text-[10px] font-bold text-[var(--text-secondary)]">
          {t("engineering.permissions.personRecentEmpty")}
        </p>
      ) : (
        <ul className="divide-y divide-[var(--border-primary)]/50">
          {entries.map((entry) => {
            const parsed = splitAuditReason(entry.details);
            return (
              <li key={entry.id} className="flex flex-wrap items-center gap-2 p-3">
                <Badge variant="neutral">{entry.action}</Badge>
                <span className="min-w-0 text-[11px] font-bold text-[var(--text-primary)]">
                  {entry.module
                    ? `${entry.module}.${entry.capability || "*"}`
                    : parsed.text || "—"}
                </span>
                {(entry.previous_value || entry.new_value) && (
                  <span className="text-[10px] font-bold text-[var(--text-secondary)]">
                    {entry.previous_value || "—"} → {entry.new_value || "—"}
                  </span>
                )}
                <span className="ml-auto text-[10px] font-bold text-[var(--text-secondary)]">
                  {entry.actor_name
                    ? t("engineering.permissions.personRecentBy", {
                        actor: entry.actor_name,
                      })
                    : ""}{" "}
                  · {fmtDate(entry.created_at)}
                </span>
                {parsed.reason && (
                  <span className="w-full text-[10px] font-bold text-[var(--text-secondary)] opacity-80">
                    {t("engineering.permissions.auditReason")}: {parsed.reason}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {!loading && !failed && (data?.total ?? 0) > pageSize && (
        <p className="px-3 pb-3 text-[10px] font-bold text-[var(--text-secondary)] opacity-80">
          {t("engineering.permissions.personRecentMore", {
            total: data.total,
          })}
        </p>
      )}
    </div>
  );
}
