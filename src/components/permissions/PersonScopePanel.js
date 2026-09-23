"use client";

import React, { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Loader2,
  PlayCircle,
  RefreshCw,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { SCOPE_POLICIES } from "@/lib/authorization/scope-catalog";
import { describeScopeCheck } from "./scopeCheckHelpers";
import Badge from "./ui/Badge";

/**
 * PHASE UI-9 — the resolved scope of ONE person, with the records named.
 *
 * The panel used to answer "how many records does this policy resolve for
 * them?" — a number an administrator cannot act on, because the whole question
 * about scope is WHICH records. The ids the scope read already returns are the
 * answer, and the person's own contexts already carry the label of every record
 * they are part of (see models/authorization/contextContexts), so the names are
 * a join of two reads that already happened — no second endpoint, no invented
 * verdict.
 *
 * The verification bench used to live only under "Where it applies": you had to
 * leave the person, restate their cid, and come back to answer "does this policy
 * cover THIS record?". The same operation now runs here, on the person you are
 * looking at, with their resolved records offered as the values to try — the
 * check is the same endpoint, called from where the question arises.
 *
 * Read-only end to end: `checkPolicy` runs the verification endpoint, which
 * reads assignment rows and grants nothing.
 */
export default function PersonScopePanel({
  policies = [],
  contexts = [],
  checkPolicy,
  onRefresh,
  refreshing = false,
}) {
  const { t } = useI18n();
  // Which policy rows have been opened for detail (records + verification).
  const [open, setOpen] = useState({});
  // One probe per policy, kept separately so opening a second policy never
  // discards the answer of the first.
  const [probes, setProbes] = useState({});

  /** id → label, from the contexts the user-context read already returned. */
  const labelsByPolicy = {};
  for (const ctx of contexts || []) {
    if (!ctx?.scopePolicy) continue;
    if (!labelsByPolicy[ctx.scopePolicy]) labelsByPolicy[ctx.scopePolicy] = {};
    labelsByPolicy[ctx.scopePolicy][String(ctx.id)] = ctx.label || String(ctx.id);
  }

  const setProbe = (policy, patch) =>
    setProbes((prev) => ({ ...prev, [policy]: { ...prev[policy], ...patch } }));

  const runCheck = async (policy, resourceId) => {
    if (!checkPolicy) return;
    setProbe(policy, { busy: true, error: "" });
    try {
      const result = await checkPolicy(policy, resourceId);
      // A null answer is the read failing, not a deny — say so rather than
      // painting a verdict the engine never returned.
      if (!result) throw new Error(t("engineering.permissions.scopeVerifyFailed"));
      setProbe(policy, { result, busy: false });
    } catch (error) {
      setProbe(policy, {
        result: null,
        error: error?.message || t("engineering.permissions.scopeVerifyFailed"),
        busy: false,
      });
    }
  };

  return (
    <div className="rounded-xl border border-[var(--border-primary)] bg-secondary/40 p-3 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
          {t("engineering.permissions.peopleScopeTitle")}
        </p>
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-primary)] px-2.5 py-1.5 text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]/60 disabled:opacity-40"
          >
            <RefreshCw className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing
              ? t("engineering.permissions.scopeRefreshing")
              : t("engineering.permissions.scopeRefresh")}
          </button>
        )}
      </div>

      {policies.length === 0 ? (
        <p className="text-[10px] font-bold text-[var(--text-secondary)]">
          {t("engineering.permissions.peopleScopeEmpty")}
        </p>
      ) : (
        <div className="space-y-1.5">
          {policies.map((entry) => {
            const info = SCOPE_POLICIES[entry.policy] || {};
            const isOpen = Boolean(open[entry.policy]);
            const ids = entry.ids || [];
            const labels = labelsByPolicy[entry.policy] || {};
            const probe = probes[entry.policy] || {};
            const verdict = probe.result ? describeScopeCheck(probe.result) : null;
            return (
              <div
                key={entry.policy}
                className="rounded-lg border border-[var(--border-primary)] bg-primary/60 p-2"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-mono text-[var(--text-primary)]">
                    {entry.policy}
                  </span>
                  <span className="text-[9px] font-bold uppercase tracking-widest text-[var(--text-secondary)] opacity-70">
                    {info.resource || "—"}
                  </span>
                  <span
                    // The count is only a shortcut; the records behind it are
                    // what the panel exists to show (hence the title).
                    title={t("engineering.permissions.liveCheckResolved", {
                      count: entry.count ?? 0,
                    })}
                    className="rounded-md border border-[var(--border-primary)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--text-secondary)]"
                  >
                    {entry.count === null || entry.count === undefined
                      ? "—"
                      : entry.count}
                  </span>
                  {!info.implemented && (
                    <Badge variant="pending">
                      {t("engineering.permissions.liveCheckUnsupported")}
                    </Badge>
                  )}
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() =>
                      setOpen((prev) => ({ ...prev, [entry.policy]: !isOpen }))
                    }
                    className="ml-auto inline-flex items-center gap-1 rounded-lg border border-[var(--border-primary)] px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]/60"
                  >
                    {isOpen ? (
                      <ChevronDown className="h-3 w-3" />
                    ) : (
                      <ChevronRight className="h-3 w-3" />
                    )}
                    {isOpen
                      ? t("engineering.permissions.scopeRecordsHide")
                      : t("engineering.permissions.scopeRecordsShow")}
                  </button>
                </div>

                {isOpen && (
                  <div className="mt-2 space-y-2 border-t border-[var(--border-primary)]/50 pt-2">
                    {/* 1. WHICH records — named, because a count answers nothing. */}
                    <p className="text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                      {t("engineering.permissions.scopeRecordsNamed")}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {ids.map((id) => (
                        <button
                          key={id}
                          type="button"
                          // Clicking a record loads it into the check below: the
                          // records this person already has are exactly the ones
                          // worth trying.
                          onClick={() =>
                            setProbe(entry.policy, {
                              resourceId: String(id),
                              error: "",
                            })
                          }
                          title={String(id)}
                          className="rounded-md border border-[var(--border-primary)] bg-primary px-2 py-0.5 text-[10px] font-bold text-[var(--text-secondary)] transition-colors hover:border-[var(--brand-orange)]/50 hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]/60"
                        >
                          {labels[String(id)] || String(id)}
                        </button>
                      ))}
                      {ids.length === 0 && (
                        <span className="text-[10px] font-bold text-[var(--text-secondary)]">
                          {t("engineering.permissions.scopeRecordsNone")}
                        </span>
                      )}
                    </div>

                    {/* 2. Test one record, here, for THIS person. */}
                    <form
                      onSubmit={(event) => {
                        event.preventDefault();
                        if (probe.resourceId?.trim()) {
                          runCheck(entry.policy, probe.resourceId.trim());
                        }
                      }}
                      className="flex flex-wrap items-end gap-2"
                    >
                      <label className="flex min-w-[180px] flex-1 flex-col gap-1">
                        <span className="text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                          {t("engineering.permissions.scopeVerifyTitle")}
                        </span>
                        <input
                          value={probe.resourceId || ""}
                          onChange={(event) =>
                            setProbe(entry.policy, {
                              resourceId: event.target.value,
                              error: "",
                            })
                          }
                          list={`scope-records-${entry.policy}`}
                          placeholder={t(
                            "engineering.permissions.scopeVerifyPlaceholder",
                          )}
                          className="w-full rounded-lg border border-[var(--border-primary)] bg-secondary px-3 py-2 text-[11px] font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)]/50 focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]/40"
                        />
                        <datalist id={`scope-records-${entry.policy}`}>
                          {ids.slice(0, 200).map((id) => (
                            <option key={id} value={String(id)}>
                              {labels[String(id)] || String(id)}
                            </option>
                          ))}
                        </datalist>
                      </label>
                      <button
                        type="submit"
                        disabled={probe.busy || !probe.resourceId?.trim()}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--brand-orange)] px-3 py-2 text-[10px] font-black uppercase tracking-widest text-black disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]/60"
                      >
                        {probe.busy ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <PlayCircle className="h-3 w-3" />
                        )}
                        {probe.busy
                          ? t("engineering.permissions.scopeVerifyRunning")
                          : t("engineering.permissions.scopeVerifyRun")}
                      </button>
                    </form>

                    <p className="text-[9px] font-bold text-[var(--text-secondary)] opacity-70">
                      {t("engineering.permissions.scopeVerifyPickHint")}
                    </p>

                    {probe.error && (
                      <p className="text-[10px] font-bold text-red-400">
                        {probe.error}
                      </p>
                    )}

                    {verdict && (
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={verdict.variant}>
                          {t(verdict.labelKey)}
                        </Badge>
                        <span className="text-[10px] font-bold text-[var(--text-secondary)]">
                          {t("engineering.permissions.liveCheckResolved", {
                            count: probe.result.resolved_count ?? 0,
                          })}
                        </span>
                        {probe.result.resource_id && (
                          <span className="text-[10px] font-mono text-[var(--text-secondary)] opacity-80">
                            {labels[String(probe.result.resource_id)] ||
                              probe.result.resource_id}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <p className="text-[10px] font-bold text-[var(--text-secondary)] opacity-70">
        {t("engineering.permissions.peopleScopeNote")}
      </p>
    </div>
  );
}
