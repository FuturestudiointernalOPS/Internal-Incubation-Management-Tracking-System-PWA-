"use client";

import React, { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { cacheGet, cacheSet } from "@/lib/hooks/useApi";
import { defer, settled } from "./effectUtils";
import { Skeleton } from "@/components/ui/Skeleton";

/**
 * PHASE UI-3e / UI-4a / UI-7 — the one person picker, as a dropdown.
 *
 * Individual Access is a single stacked screen (picker + the selected person's
 * panels), so the picker owns the whole width instead of sitting in a narrow
 * side column: the details below it are the point of the screen, and a column
 * claimed a third of it. This mirrors the Templates screen, which selects its
 * profile the same way, so the two doors read alike.
 *
 * Source of truth: /api/contacts — the same directory the Job-shortcuts screen
 * uses. It used to call /api/responsibilities/assign without a `user_cid`, and
 * that endpoint answers 400 "user_cid is required", so the list was always
 * empty and the search box looked broken.
 *
 * Failure is stated, never silent: a refused or failed fetch shows the reason
 * with a Retry, and an empty directory says so. The `?cid=` deep link still
 * preselects, which is what the Membership Control Center links rely on.
 */
export default function PersonPicker({ selectedCid = null, onSelect }) {
  const { t } = useI18n();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const loadUsers = useCallback(
    async (bypassCache = false) => {
      const url = "/api/contacts";
      const apply = (data) => {
        const sorted = (data.contacts || []).slice().sort((first, second) => {
          if (first.status === "active" && second.status !== "active") return -1;
          if (first.status !== "active" && second.status === "active") return 1;
          return (first.name || "").localeCompare(second.name || "");
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
      } catch (error) {
        setErr(error?.message || t("engineering.permissions.peopleListFailed"));
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
    const hit = users.find((user) => String(user.cid) === String(cid));
    if (hit) defer(() => onSelect(hit));
  }, [users, onSelect]);

  // The select shows a person only once the list can name them: a ?cid= deep
  // link paints before the directory arrives.
  const selectedInList = users.some(
    (user) => String(user.cid) === String(selectedCid),
  );

  // Status is data, not copy: translate it when a label exists, otherwise show
  // the stored value. Active people say nothing (they are the norm).
  const statusLabel = (user) => {
    if (!user.status || user.status === "active") return "";
    const key = `status.${user.status}`;
    const value = t(key);
    return value === key ? user.status : value;
  };

  return (
    <div className="ios-card !p-5 border-[var(--border-primary)] space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <label
          htmlFor="permission-person-picker"
          className="block text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]"
        >
          {t("engineering.permissions.personPickerLabel")}
        </label>
        {!loading && !err && (
          <span className="text-[10px] font-bold text-[var(--text-secondary)]">
            {t("engineering.permissions.personPickerCount", {
              count: users.length,
            })}
          </span>
        )}
      </div>

      {loading ? (
        <Skeleton className="h-11" />
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
        <select
          id="permission-person-picker"
          value={selectedInList ? String(selectedCid) : ""}
          onChange={(event) => {
            const hit = users.find((user) => String(user.cid) === event.target.value);
            if (hit && onSelect) onSelect(hit);
          }}
          className="w-full bg-secondary border border-[var(--border-primary)] rounded-xl px-3 py-3 text-xs font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)]/50 focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]/40"
        >
          <option value="">
            {t("engineering.permissions.personPickerPlaceholder")}
          </option>
          {users.map((user) => (
            <option key={user.cid} value={user.cid}>
              {user.name || user.cid}
              {user.email ? ` — ${user.email}` : ""}
              {statusLabel(user) ? ` · ${statusLabel(user)}` : ""}
            </option>
          ))}
        </select>
      )}

      <p className="text-[10px] font-bold text-[var(--text-secondary)]">
        {!loading && !err && users.length === 0
          ? t("engineering.permissions.peopleListEmpty")
          : t("engineering.permissions.personPickerHint")}
      </p>
    </div>
  );
}
