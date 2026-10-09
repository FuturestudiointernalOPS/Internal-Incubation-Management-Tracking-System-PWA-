"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Search, ShieldAlert, UserMinus, UserPlus } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useDialogs } from "@/components/ui/DialogProvider";
import { notify } from "@/lib/notify";
import NoteBox from "./ui/NoteBox";
import { defer } from "./effectUtils";

/**
 * ADMINISTRATORS (People → Administrators).
 *
 * Who holds the platform-wide bypass, and how to give it or take it away. This
 * is the most sensitive action in the center:
 *   • the server only lets a super administrator perform it, whatever else the
 *     caller was granted;
 *   • the screen demands a REASON before it fires, and the reason is what lands
 *     in the log.
 */

const USERS_URL = "/api/engineering/permissions?users=true";
const WRITE_URL = "/api/engineering/permissions";

const FIELD_CLASS =
  "w-full rounded-lg border border-[var(--border-primary)] bg-secondary px-3 py-2 text-xs font-bold text-[var(--text-primary)] outline-none transition-colors focus:border-brand-orange/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/60";

export default function AdminsView() {
  const { t } = useI18n();
  const { prompt } = useDialogs();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [busyCid, setBusyCid] = useState("");
  const [query, setQuery] = useState("");
  const [picking, setPicking] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await fetch(USERS_URL).then((response) => response.json());
      if (data?.success) setUsers(data.users || []);
      else setErr(data?.error || t("engineering.permissions.adminsLoadFailed"));
    } catch {
      setErr(t("engineering.permissions.adminsLoadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    defer(() => load());
  }, [load]);

  const superAdmins = useMemo(
    () => users.filter((user) => user.role === "super_admin"),
    [users],
  );

  const candidates = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return users
      .filter((user) => user.role !== "super_admin")
      .filter(
        (user) =>
          !needle ||
          (user.name || "").toLowerCase().includes(needle) ||
          (user.email || "").toLowerCase().includes(needle) ||
          (user.cid || "").toLowerCase().includes(needle),
      )
      .slice(0, 25);
  }, [users, query]);

  const applyChange = useCallback(
    async (action, user) => {
      const reason = await prompt({
        title: t(
          action === "promote_super_admin"
            ? "engineering.permissions.adminsPromoteTitle"
            : "engineering.permissions.adminsRemoveTitle",
        ),
        message: t(
          action === "promote_super_admin"
            ? "engineering.permissions.adminsPromotePrompt"
            : "engineering.permissions.adminsRemovePrompt",
          { name: user.name || user.cid },
        ),
        inputLabel: t("engineering.permissions.adminsReason"),
        placeholder: t("engineering.permissions.adminsReasonPlaceholder"),
        tone: "danger",
        required: true,
        confirmLabel: t("common.confirm"),
        cancelLabel: t("common.cancel"),
      });
      if (reason === null) return;

      setBusyCid(user.cid);
      setErr("");
      try {
        const response = await fetch(WRITE_URL, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, user_cid: user.cid, reason }),
        });
        const data = await response.json();
        if (!response.ok || data?.success === false) {
          throw new Error(data?.error || t("engineering.permissions.adminsFailed"));
        }
        notify(
          "success",
          t("engineering.permissions.adminsDone", { name: user.name || user.cid }),
        );
        setPicking(false);
        await load();
      } catch (error) {
        setErr(error.message || t("engineering.permissions.adminsFailed"));
      } finally {
        setBusyCid("");
      }
    },
    [prompt, t, load],
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-[var(--brand-orange)]" aria-hidden="true" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <NoteBox tone="warning">
        <span className="flex items-start gap-2 text-[var(--text-primary)]">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-[var(--brand-orange)]" aria-hidden="true" />
          {t("engineering.permissions.adminsIntro")}
        </span>
      </NoteBox>

      {err && <p className="text-xs font-bold text-red-500">{err}</p>}

      <section
        className="overflow-hidden rounded-xl border border-[var(--border-primary)]"
        aria-label={t("engineering.permissions.adminsCurrent")}
      >
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-[var(--border-primary)] bg-secondary/40">
              <th className="p-3 text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                {t("engineering.permissions.adminsName")}
              </th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {superAdmins.length === 0 ? (
              <tr>
                <td colSpan={2} className="p-3 text-xs text-[var(--text-secondary)]">
                  {t("engineering.permissions.adminsNoSuperAdmins")}
                </td>
              </tr>
            ) : (
              superAdmins.map((user) => (
                <tr key={user.cid} className="border-b border-divider/50">
                  <td className="p-3">
                    <p className="text-xs font-bold text-[var(--text-primary)]">
                      {user.name || user.cid}
                    </p>
                    <p className="text-[10px] font-medium text-[var(--text-secondary)]">
                      {user.email || user.cid}
                    </p>
                  </td>
                  <td className="p-3 text-right">
                    <button
                      type="button"
                      onClick={() => applyChange("remove_super_admin", user)}
                      disabled={busyCid === user.cid}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-red-400 transition-colors hover:bg-red-500/20 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/60"
                    >
                      <UserMinus className="h-3 w-3" aria-hidden="true" />
                      {t("engineering.permissions.adminsRemove")}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      {!picking ? (
        <button
          type="button"
          onClick={() => setPicking(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-[var(--brand-orange)] px-3 py-2 text-[10px] font-black uppercase tracking-widest text-black transition-all hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/60"
        >
          <UserPlus className="h-3.5 w-3.5" aria-hidden="true" />
          {t("engineering.permissions.adminsPromote")}
        </button>
      ) : (
        <section className="space-y-3 rounded-xl border border-[var(--border-primary)] bg-[var(--surface-1)] p-4">
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-secondary)]"
              aria-hidden="true"
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("engineering.permissions.adminsSearchPlaceholder")}
              className={`${FIELD_CLASS} pl-9`}
            />
          </div>
          <div className="space-y-1">
            {candidates.length === 0 ? (
              <p className="text-xs text-[var(--text-secondary)]">
                {t("engineering.permissions.noUsersFound")}
              </p>
            ) : (
              candidates.map((user) => (
                <div
                  key={user.cid}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--border-primary)] bg-secondary/30 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-[var(--text-primary)]">
                      {user.name || user.cid}
                    </p>
                    <p className="truncate text-[10px] font-medium text-[var(--text-secondary)]">
                      {user.role} · {user.email || user.cid}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => applyChange("promote_super_admin", user)}
                    disabled={busyCid === user.cid}
                    className="shrink-0 rounded-lg bg-[var(--brand-orange)] px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-black transition-all hover:opacity-90 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/60"
                  >
                    {t("engineering.permissions.adminsPromoteAction")}
                  </button>
                </div>
              ))
            )}
          </div>
        </section>
      )}
    </div>
  );
}
