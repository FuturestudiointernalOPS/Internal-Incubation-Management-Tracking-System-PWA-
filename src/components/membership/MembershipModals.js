"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Search,
  UserPlus,
  History,
  RotateCcw,
  Ban,
  CheckCircle2,
  Clock,
  Shield,
} from "lucide-react";
import AppButton from "@/components/ui/AppButton";
import AppInput from "@/components/ui/AppInput";
import AppSelect from "@/components/ui/AppSelect";
import AppModal from "@/components/ui/AppModal";
import AppEmptyState from "@/components/ui/AppEmptyState";

/**
 * Shared membership building blocks for the CRM integration:
 * - STATUS_STYLE / ACCOUNT_STYLE / Badge  → consistent status visuals
 * - runMembershipAction                   → server-side PUT + toast
 * - AddMemberModal / RenewModal / ConfirmModal / HistoryModal
 *
 * All mutations go through PUT /api/org-membership, which enforces
 * org_membership.manage server-side (Super Admin bypass). The UI is never
 * the security boundary.
 */

export const notify = (type, message) =>
  window.dispatchEvent(
    new CustomEvent("impactos:notify", { detail: { type, message } }),
  );

export const STATUS_STYLE = {
  active: { bg: "rgba(16,185,129,0.12)", color: "#10B981" },
  expiringSoon: { bg: "rgba(245,158,11,0.12)", color: "#F59E0B" },
  expired: { bg: "rgba(239,68,68,0.12)", color: "#EF4444" },
  ended: { bg: "rgba(100,116,139,0.15)", color: "#94A3B8" },
};

export const ACCOUNT_STYLE = {
  active: { bg: "rgba(16,185,129,0.12)", color: "#10B981" },
  pending: { bg: "rgba(245,158,11,0.12)", color: "#F59E0B" },
  invited: { bg: "rgba(59,130,246,0.12)", color: "#3B82F6" },
  inactive: { bg: "rgba(100,116,139,0.15)", color: "#94A3B8" },
  rejected: { bg: "rgba(239,68,68,0.12)", color: "#EF4444" },
};

export function Badge({ label, style }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider"
      style={{ background: style.bg, color: style.color }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: style.color }} />
      {label}
    </span>
  );
}

/**
 * Execute a membership lifecycle action via PUT /api/org-membership.
 * Returns true on success (caller closes modal + reloads).
 */
export async function runMembershipAction(member, action, t, extra = {}) {
  try {
    const res = await fetch("/api/org-membership", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_cid: member.user_cid,
        group_name: member.group_name,
        action,
        ...extra,
      }),
    });
    const data = await res.json();
    if (!data.success) {
      notify("error", data.error || t("membership.mutate.error"));
      return false;
    }
    const msg = {
      joined: t("membership.add.success"),
      activated: t("membership.mutate.activateSuccess"),
      deactivated: t("membership.mutate.deactivateSuccess"),
      ended: t("membership.mutate.endSuccess"),
      renewed: t("membership.renew.success"),
    }[action];
    notify("success", msg || t("membership.mutate.activateSuccess"));
    return true;
  } catch {
    notify("error", t("membership.mutate.error"));
    return false;
  }
}

/* ── Add Member ─────────────────────────────────────────────────────────── */

export function AddMemberModal({ groups, defaultGroup, isProtected, existing, t, lang, onClose, onAdded }) {
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(null);
  const [contactGroups, setContactGroups] = useState([]);
  const [group, setGroup] = useState(defaultGroup);
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [expires, setExpires] = useState("");
  const [busy, setBusy] = useState(false);

  const fmt = (v) =>
    v
      ? new Date(v).toLocaleDateString(lang === "fr" ? "fr-FR" : "en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })
      : "—";

  const runSearch = async () => {
    const q = query.trim();
    if (q.length < 2) return;
    setSearching(true);
    try {
      const res = await fetch(`/api/contacts/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setResults(data.success ? data.contacts || [] : []);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  const pick = async (c) => {
    setSelected({ ...c, role: "", status: "", group_name: "" });
    setContactGroups([]);
    try {
      const [dRes, gRes] = await Promise.all([
        fetch(`/api/contacts?cid=${encodeURIComponent(c.cid)}`),
        fetch(`/api/user-groups?user_cid=${encodeURIComponent(c.cid)}`),
      ]);
      const d = await dRes.json();
      const g = await gRes.json();
      const contact = Array.isArray(d.contacts) ? d.contacts[0] : d.contact || d;
      setSelected({
        cid: c.cid,
        name: contact.name || c.name,
        email: contact.email || c.email,
        role: contact.role || "",
        status: contact.status || "",
        group_name: contact.group_name || "",
      });
      setContactGroups((g.groups || []).filter((x) => x));
    } catch {
      /* keep minimal selection */
    }
  };

  const alreadyMember = useMemo(
    () =>
      selected && group
        ? existing.some((m) => m.user_cid === selected.cid && m.group_name === group)
        : false,
    [selected, group, existing],
  );

  const confirm = async () => {
    if (!selected || !group || busy) return;
    setBusy(true);
    try {
      const ok = await runMembershipAction(
        { user_cid: selected.cid, group_name: group },
        "joined",
        t,
        { expires_at: expires ? new Date(expires).toISOString() : null },
      );
      if (ok) onAdded();
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppModal isOpen onClose={onClose} title={t("membership.add.title")} size="lg">
      <div className="space-y-5">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: "var(--text-secondary)" }}>
            {t("membership.add.searchLabel")}
          </p>
          <div className="flex gap-2">
            <AppInput
              icon={Search}
              placeholder={t("membership.add.searchPlaceholder")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runSearch()}
            />
            <AppButton variant="secondary" size="md" loading={searching} onClick={runSearch}>
              {t("common.search")}
            </AppButton>
          </div>
          <p className="text-[10px] mt-1.5" style={{ color: "var(--text-tertiary)" }}>
            {t("membership.add.searchHint")}
          </p>
        </div>

        {results.length > 0 && !selected && (
          <div
            className="max-h-40 overflow-y-auto rounded-xl divide-y"
            style={{ background: "var(--surface-2)", border: "1px solid var(--border-primary)" }}
          >
            {results.map((c) => (
              <button
                key={c.cid}
                onClick={() => pick(c)}
                className="w-full text-left px-4 py-2.5 hover:opacity-80 transition-all flex items-center justify-between"
              >
                <span>
                  <span className="block text-xs font-bold" style={{ color: "var(--text-primary)" }}>
                    {c.name}
                  </span>
                  <span className="block text-[10px]" style={{ color: "var(--text-tertiary)" }}>
                    {c.email}
                  </span>
                </span>
                <UserPlus className="w-4 h-4" style={{ color: "var(--text-tertiary)" }} />
              </button>
            ))}
          </div>
        )}
        {!searching && query.trim().length >= 2 && results.length === 0 && !selected && (
          <p className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>
            {t("membership.add.noResults")}
          </p>
        )}

        {selected && (
          <div
            className="rounded-xl p-4 space-y-2"
            style={{ background: "var(--surface-2)", border: "1px solid var(--border-primary)" }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold" style={{ color: "var(--text-primary)" }}>
                  {selected.name}
                </p>
                <p className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>
                  {selected.email}
                </p>
              </div>
              <button
                onClick={() => {
                  setSelected(null);
                  setResults([]);
                }}
                className="text-[10px] font-bold uppercase tracking-wider hover:opacity-70"
                style={{ color: "var(--brand-orange)" }}
              >
                {t("common.change")}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[10px]" style={{ color: "var(--text-secondary)" }}>
              <span>
                {t("membership.columns.role")}: <b>{selected.role || "—"}</b>
              </span>
              <span>
                {t("membership.columns.accountStatus")}: <b>{selected.status || "—"}</b>
              </span>
              <span className="col-span-2">
                {t("membership.page.groupLabel")}: <b>{contactGroups.join(", ") || "—"}</b>
              </span>
            </div>
          </div>
        )}

        {selected && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <AppSelect
                label={t("membership.add.groupLabel")}
                value={group}
                onChange={(e) => setGroup(e.target.value)}
                options={groups.map((g) => ({
                  value: g.name,
                  label: g.isProtected ? `${g.name} (${t("membership.page.protected")})` : g.name,
                }))}
              />
              <AppInput
                label={t("membership.add.startLabel")}
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
              <AppInput
                label={t("membership.add.expiresLabel")}
                type="date"
                value={expires}
                onChange={(e) => setExpires(e.target.value)}
              />
            </div>
            {isProtected(group) && (
              <div
                className="rounded-xl p-3 space-y-1.5"
                style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)" }}
              >
                <p className="text-[10px] flex items-center gap-1.5" style={{ color: "#F59E0B" }}>
                  <Shield className="w-3.5 h-3.5" /> {t("membership.page.protected")}
                </p>
                <p className="text-[10px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                  {t("membership.add.protectedConfirm")}
                </p>
              </div>
            )}
            {alreadyMember && (
              <p className="text-[10px]" style={{ color: "#F59E0B" }}>
                {t("membership.add.alreadyMember")}
              </p>
            )}

            <div
              className="rounded-xl p-4 space-y-1.5"
              style={{ background: "var(--surface-3)", border: "1px solid var(--border-primary)" }}
            >
              <p className="text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: "var(--text-primary)" }}>
                {t("membership.add.summaryTitle")}
              </p>
              <p className="text-xs" style={{ color: "var(--text-primary)" }}>
                {t("membership.add.summaryAdd")}: <b>{selected.name}</b>
              </p>
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                {t("membership.add.summaryGroup")}: <b>{group}</b>
              </p>
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                {t("membership.add.summaryStart")}: <b>{fmt(startDate)}</b>
              </p>
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                {t("membership.add.summaryExpires")}:{" "}
                <b>{expires ? fmt(expires) : t("membership.status.never")}</b>
              </p>
            </div>

            <div className="flex justify-end gap-3">
              <AppButton variant="ghost" onClick={onClose}>
                {t("membership.actions.cancel")}
              </AppButton>
              <AppButton variant="primary" loading={busy} onClick={confirm}>
                {t("membership.add.confirmMembership")}
              </AppButton>
            </div>
          </>
        )}
      </div>
    </AppModal>
  );
}

/* ── Renew / Reactivate ─────────────────────────────────────────────────── */

export function RenewModal({ member, isReactivate, t, lang, fmtDate, onClose, onConfirm }) {
  const [expires, setExpires] = useState("");
  const [noExpiry, setNoExpiry] = useState(false);
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    if (busy) return;
    setBusy(true);
    const ok = await onConfirm(noExpiry ? null : expires || null);
    if (!ok) setBusy(false);
  };

  return (
    <AppModal
      isOpen
      onClose={onClose}
      title={isReactivate ? t("membership.actions.reactivate") : t("membership.renew.title")}
      size="md"
    >
      <div className="space-y-5">
        <p className="text-xs font-bold" style={{ color: "var(--text-primary)" }}>
          {member.name || member.user_cid}
        </p>
        <div
          className="rounded-xl p-4 space-y-2"
          style={{ background: "var(--surface-2)", border: "1px solid var(--border-primary)" }}
        >
          <p className="text-[10px]" style={{ color: "var(--text-secondary)" }}>
            {t("membership.renew.currentExpires")}:{" "}
            <b style={{ color: "var(--text-primary)" }}>
              {member.expires_at ? fmtDate(member.expires_at) : t("membership.renew.noExpiry")}
            </b>
          </p>
          <p className="text-[10px]" style={{ color: "var(--text-secondary)" }}>
            {t("membership.columns.start")}:{" "}
            <b style={{ color: "var(--text-primary)" }}>{fmtDate(member.started_at)}</b>
          </p>
          <p className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>
            {t("membership.renew.hint")}
          </p>
        </div>
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <AppInput
              label={t("membership.renew.newExpires")}
              type="date"
              value={expires}
              disabled={noExpiry}
              onChange={(e) => setExpires(e.target.value)}
            />
          </div>
          <label
            className="flex items-center gap-2 pb-3 text-[10px] font-bold cursor-pointer"
            style={{ color: "var(--text-secondary)" }}
          >
            <input
              type="checkbox"
              checked={noExpiry}
              onChange={(e) => {
                setNoExpiry(e.target.checked);
                if (e.target.checked) setExpires("");
              }}
            />
            {t("membership.status.never")}
          </label>
        </div>
        <div className="flex justify-end gap-3">
          <AppButton variant="ghost" onClick={onClose}>
            {t("membership.actions.cancel")}
          </AppButton>
          <AppButton variant="primary" loading={busy} onClick={confirm} disabled={!noExpiry && !expires}>
            {t("membership.renew.confirm")}
          </AppButton>
        </div>
      </div>
    </AppModal>
  );
}

/* ── Deactivate / End confirm ───────────────────────────────────────────── */

export function ConfirmModal({ state, t, onClose, onConfirm }) {
  const [busy, setBusy] = useState(false);
  const isEnd = state.action === "ended";

  return (
    <AppModal
      isOpen
      onClose={onClose}
      title={isEnd ? t("membership.actions.end") : t("membership.actions.deactivate")}
      size="sm"
    >
      <div className="space-y-5">
        <p className="text-xs font-bold" style={{ color: "var(--text-primary)" }}>
          {state.member.name || state.member.user_cid} — {state.member.group_name}
        </p>
        <p className="text-[10px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
          {t("membership.actions.endedNote")}
        </p>
        <div className="flex justify-end gap-3">
          <AppButton variant="ghost" onClick={onClose}>
            {t("membership.actions.cancel")}
          </AppButton>
          <AppButton variant={isEnd ? "danger" : "secondary"} loading={busy} onClick={onConfirm}>
            {isEnd ? t("membership.actions.end") : t("membership.actions.deactivate")}
          </AppButton>
        </div>
      </div>
    </AppModal>
  );
}

/* ── History ────────────────────────────────────────────────────────────── */

export function HistoryModal({ member, t, lang, fmtDate, onClose }) {
  const [events, setEvents] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/org-membership?user_cid=${encodeURIComponent(member.user_cid)}&group=${encodeURIComponent(
            member.group_name,
          )}&history=1`,
        );
        const data = await res.json();
        if (!cancelled) {
          if (data.success) setEvents(data.events || []);
          else setError(data.error || "—");
        }
      } catch {
        if (!cancelled) setError("—");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [member]);

  const eventLabel = (action, t) => {
    switch (action) {
      case "joined":
        return t("membership.detail.eventJoined");
      case "activated":
        return t("membership.detail.eventActivated");
      case "deactivated":
        return t("membership.detail.eventDeactivated");
      case "renewed":
        return t("membership.detail.eventRenewed");
      case "expired":
        return t("membership.detail.eventExpired");
      case "ended":
        return t("membership.detail.eventEnded");
      default:
        return action;
    }
  };

  const eventIcon = (action) => {
    switch (action) {
      case "joined":
      case "activated":
      case "renewed":
        return <CheckCircle2 className="w-4 h-4" style={{ color: "#10B981" }} />;
      case "deactivated":
      case "ended":
        return <Ban className="w-4 h-4" style={{ color: "#EF4444" }} />;
      case "expired":
        return <Clock className="w-4 h-4" style={{ color: "#F59E0B" }} />;
      default:
        return <History className="w-4 h-4" style={{ color: "var(--text-tertiary)" }} />;
    }
  };

  return (
    <AppModal isOpen onClose={onClose} title={t("membership.detail.membershipHistory")} size="lg">
      <div className="space-y-4">
        <p className="text-xs font-bold" style={{ color: "var(--text-primary)" }}>
          {member.name || member.user_cid} — {member.group_name}
        </p>
        {error ? (
          <AppEmptyState title={t("membership.detail.noHistory")} icon={History} />
        ) : !events ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-12 rounded-lg animate-pulse" style={{ background: "var(--surface-3)" }} />
            ))}
          </div>
        ) : events.length === 0 ? (
          <AppEmptyState title={t("membership.detail.noHistory")} icon={History} />
        ) : (
          <div
            className="rounded-xl divide-y overflow-hidden"
            style={{ background: "var(--surface-2)", border: "1px solid var(--border-primary)" }}
          >
            {events.map((ev, i) => {
              const by = ev.actor_name || ev.actor_cid;
              return (
                <div key={`${ev.created_at}-${i}`} className="px-4 py-3 flex items-start gap-3">
                  <div className="mt-0.5">{eventIcon(ev.action)}</div>
                  <div className="flex-1">
                    <p className="text-xs font-bold" style={{ color: "var(--text-primary)" }}>
                      {eventLabel(ev.action, t)}
                    </p>
                    {ev.note && (
                      <p className="text-[10px] mt-0.5" style={{ color: "var(--text-tertiary)" }}>
                        {ev.note}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-medium" style={{ color: "var(--text-secondary)" }}>
                      {fmtDate(ev.created_at)}
                    </p>
                    <p className="text-[10px] font-medium" style={{ color: "var(--text-secondary)" }}>
                      {by && by !== "system" && by !== "admin"
                        ? `${t("membership.detail.by")}: ${by}`
                        : t("membership.detail.bySystem")}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppModal>
  );
}
