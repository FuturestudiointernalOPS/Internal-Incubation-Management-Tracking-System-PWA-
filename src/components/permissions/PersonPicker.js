"use client";

import React, { useCallback, useEffect, useState } from "react";
import { RefreshCw, Search } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { cacheGet, cacheSet } from "@/lib/hooks/useApi";
import { defer, settled } from "./effectUtils";
import { Skeleton } from "@/components/ui/Skeleton";

/**
 * PHASE UI-3e / UI-4a — the one person picker.
 *
 * Individual Access is a single screen (picker + the selected person's panels),
 * so the searchable list lives here instead of inside each lens: the write lens
 * and the read lens both receive the person this picks.
 *
 * Source of truth: /api/contacts — the same directory the Job-shortcuts screen
 * uses. It used to call /api/responsibilities/assign without a `user_cid`, and
 * that endpoint answers 400 "user_cid is required", so the list was always
 * empty and the search box looked broken.
 *
 * Failure is stated, never silent: a refused or failed fetch shows the reason
 * with a Retry, and an empty result says whether the directory is empty or the
 * search simply matched nothing. The `?cid=` deep link still preselects, which
 * is what the Membership Control Center links rely on.
 */
export default function PersonPicker({ selectedCid = null, onSelect }) {
  const { t } = useI18n();
  const [users, setUsers] = useState([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const loadUsers = useCallback(
    async (bypassCache = false) => {
      const url = "/api/contacts";
      const apply = (data) => {
        const sorted = (data.contacts || []).slice().sort((a, b) => {
          if (a.status === "active" && b.status !== "active") return -1;
          if (a.status !== "active" && b.status === "active") return 1;
          return (a.name || "").localeCompare(b.name || "");
        });
        setUsers(sorted);
      };
      try {
        // Cache-first paint, then converge on the network (the pattern used
        // across the Permission Center).
        if (!bypassCache) {
          const cached = cacheGet(url);
          if (cached?.success) apply(await settled(cached));
        }
        const res = await fetch(url);
        const data = await res.json();
        if (!data?.success) throw new Error(data?.error || `HTTP ${res.status}`);
        cacheSet(url, data);
        apply(data);
        setErr("");
      } catch (e) {
        setErr(e?.message || t("engineering.permissions.peopleListFailed"));
      } finally {
        setLoading(false);
      }
    },
    [t],
  );

  useEffect(() => {
    defer(() => loadUsers());
  }, [loadUsers]);

  // Deep link: ?cid= preselects a person once the list is available.
  useEffect(() => {
    if (!users.length || !onSelect) return;
    let cid = "";
    try {
      cid = new URLSearchParams(window.location.search).get("cid") || "";
    } catch {
      cid = "";
    }
    if (!cid) return;
    const hit = users.find((u) => String(u.cid) === String(cid));
    if (hit) defer(() => onSelect(hit));
  }, [users, onSelect]);

  const filtered = users.filter(
    (u) =>
      !query.trim() ||
      (u.name || "").toLowerCase().includes(query.toLowerCase()) ||
      (u.email || "").toLowerCase().includes(query.toLowerCase()) ||
      (u.cid || "").toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("engineering.permissions.searchPlaceholder")}
          className="w-full bg-secondary border border-[var(--border-primary)] rounded-xl pl-10 pr-4 py-3 text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)]/50 focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]/40 font-bold text-xs"
        />
      </div>

      {loading ? (
        <Skeleton className="h-40" />
      ) : err ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-3 space-y-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-red-400">
            {t("engineering.permissions.peopleListFailed")}
          </p>
          <p className="text-[10px] font-medium text-[var(--text-secondary)] break-words">
            {err}
          </p>
          <button
            onClick={() => {
              setErr("");
              setLoading(true);
              loadUsers(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border-primary)] text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]/60"
          >
            <RefreshCw className="w-3 h-3" />
            {t("common.refresh")}
          </button>
        </div>
      ) : (
        <div className="max-h-72 overflow-y-auto rounded-xl border border-[var(--border-primary)] divide-y divide-[var(--border-primary)]">
          {filtered.slice(0, 50).map((u) => (
            <button
              key={u.cid}
              onClick={() => onSelect && onSelect(u)}
              className={`w-full text-left px-3 py-2 transition-colors ${
                String(selectedCid) === String(u.cid)
                  ? "bg-[var(--brand-orange)]/10"
                  : "hover:bg-secondary/60"
              }`}
            >
              <span className="block text-xs font-bold text-[var(--text-primary)]">
                {u.name || u.cid}
              </span>
              <span className="block text-[10px] text-[var(--text-secondary)]">
                {u.email || u.cid}
              </span>
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="px-3 py-4 text-xs font-bold text-[var(--text-secondary)]">
              {users.length === 0
                ? t("engineering.permissions.peopleListEmpty")
                : t("common.noResults")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
