"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Search } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { cacheGet, cacheSet } from "@/lib/hooks/useApi";
import { defer, settled } from "./effectUtils";
import { Skeleton } from "@/components/ui/Skeleton";

/**
 * PHASE UI-3e — the one person picker.
 *
 * Individual Access is a single screen (picker + the selected person's panels),
 * so the searchable list lives here instead of inside each lens: the write lens
 * and the read lens both receive the person this picks. Same endpoint and cache
 * as before (`/api/responsibilities/assign`), and the same `?cid=` deep-link
 * behaviour, which is what the Membership Control Center links rely on.
 */
export default function PersonPicker({ selectedCid = null, onSelect }) {
  const { t } = useI18n();
  const [users, setUsers] = useState([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  const loadUsers = useCallback(async () => {
    try {
      const url = "/api/responsibilities/assign";
      const cached = cacheGet(url);
      const d = cached?.success ? await settled(cached) : await (await fetch(url)).json();
      if (d?.success) {
        cacheSet(url, d);
        setUsers(d.users || d.contacts || d.rows || []);
      }
    } catch {
      /* list optional */
    } finally {
      setLoading(false);
    }
  }, []);

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
              {t("common.noResults")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
