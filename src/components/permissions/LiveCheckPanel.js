"use client";

import React, { useEffect, useState } from "react";
import { Loader2, PlayCircle } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { cacheGet, cacheSet } from "@/lib/hooks/useApi";
import Badge from "./ui/Badge";
import { SCOPE_POLICIES, SCOPE_POLICY_KEYS } from "@/lib/authorization/scope-catalog";
import { describeScopeCheck } from "./scopeCheckHelpers";

/**
 * PHASE UI-2 — Live scope check (read-only verification bench).
 *
 * Wraps GET /api/engineering/permissions/scope-check so a Super Admin can see,
 * for a real person and a real record, what the Scope Engine decides — before
 * any route enforces scope. Nothing here grants access; it only reads the
 * assignment data the predicate uses and reports the verdict honestly.
 */
export default function LiveCheckPanel() {
  const { t } = useI18n();
  const [policy, setPolicy] = useState(SCOPE_POLICY_KEYS[0]);
  const [cid, setCid] = useState("");
  const [resourceId, setResourceId] = useState("");
  const [users, setUsers] = useState([]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const url = "/api/responsibilities/assign";
        const cached = cacheGet(url);
        const d = cached?.success ? cached : await (await fetch(url)).json();
        if (!alive || !d?.success) return;
        cacheSet(url, d);
        setUsers(d.users || d.contacts || d.rows || []);
      } catch {
        /* the picker is a convenience — a raw cid still works */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const run = async () => {
    if (!cid.trim()) return;
    setBusy(true);
    setErr("");
    setResult(null);
    try {
      const params = new URLSearchParams({ policy, cid: cid.trim() });
      if (resourceId.trim()) params.set("resource_id", resourceId.trim());
      const res = await fetch(
        `/api/engineering/permissions/scope-check?${params.toString()}`,
      );
      const d = await res.json();
      if (!d.success) throw new Error(d.error || "scope check failed");
      setResult(d);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const verdict = result ? describeScopeCheck(result) : null;
  const ids = result?.resolved_ids || [];

  return (
    <div className="rounded-xl border border-[var(--border-primary)] bg-surface-1 p-4 space-y-3">
      <div>
        <h2 className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
          {t("engineering.permissions.liveCheckTitle")}
        </h2>
        <p className="text-xs font-medium text-[var(--text-secondary)] mt-1 leading-relaxed">
          {t("engineering.permissions.liveCheckHint")}
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
            {t("engineering.permissions.liveCheckPolicy")}
          </span>
          <select
            value={policy}
            onChange={(e) => setPolicy(e.target.value)}
            className="bg-secondary border border-[var(--border-primary)] rounded-lg px-3 py-2 text-xs font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)]/50"
          >
            {SCOPE_POLICY_KEYS.map((key) => (
              <option key={key} value={key}>
                {key} · {SCOPE_POLICIES[key]?.resource}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
            {t("engineering.permissions.liveCheckUser")}
          </span>
          <input
            value={cid}
            onChange={(e) => setCid(e.target.value)}
            list="live-check-users"
            placeholder={t("engineering.permissions.liveCheckUserPlaceholder")}
            className="w-56 bg-secondary border border-[var(--border-primary)] rounded-lg px-3 py-2 text-xs font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)]/50"
          />
          <datalist id="live-check-users">
            {users.slice(0, 200).map((u) => (
              <option key={u.cid} value={u.cid}>
                {u.name || u.email || u.cid}
              </option>
            ))}
          </datalist>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
            {t("engineering.permissions.liveCheckResource")}
          </span>
          <input
            value={resourceId}
            onChange={(e) => setResourceId(e.target.value)}
            placeholder={t("engineering.permissions.liveCheckResourcePlaceholder")}
            className="w-56 bg-secondary border border-[var(--border-primary)] rounded-lg px-3 py-2 text-xs font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)]/50"
          />
        </label>

        <button
          onClick={run}
          disabled={busy || !cid.trim()}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--brand-orange)] text-black text-[10px] font-black uppercase tracking-widest disabled:opacity-40"
        >
          {busy ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <PlayCircle className="w-3.5 h-3.5" />
          )}
          {busy
            ? t("engineering.permissions.liveCheckRunning")
            : t("engineering.permissions.liveCheckRun")}
        </button>
      </div>

      {err && <p className="text-xs font-bold text-red-500">{err}</p>}

      {result && (
        <div className="rounded-lg border border-[var(--border-primary)] bg-secondary/40 p-3 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={verdict.variant}>{t(verdict.labelKey)}</Badge>
            <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
              {t("engineering.permissions.liveCheckResolved", {
                count: result.resolved_count ?? 0,
              })}
            </span>
          </div>
          {ids.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {ids.slice(0, 12).map((id) => (
                <span
                  key={id}
                  className="px-2 py-0.5 rounded-md bg-primary border border-[var(--border-primary)] text-[10px] font-mono text-[var(--text-secondary)]"
                >
                  {id}
                </span>
              ))}
              {ids.length > 12 && (
                <span className="text-[10px] font-bold text-[var(--text-secondary)]">
                  +{ids.length - 12}
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
