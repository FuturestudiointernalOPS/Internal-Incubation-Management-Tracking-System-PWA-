"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  Users,
  Shield,
  Search,
  RefreshCw,
  UserPlus,
  History,
  Eye,
  RotateCcw,
  Ban,
  UserX,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Link2,
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useI18n } from "@/lib/i18n";
import AppButton from "@/components/ui/AppButton";
import AppInput from "@/components/ui/AppInput";
import AppSelect from "@/components/ui/AppSelect";
import AppModal from "@/components/ui/AppModal";
import AppEmptyState from "@/components/ui/AppEmptyState";
import {
  deriveMembershipStatus,
  sortGroups,
  EXPIRING_SOON_DAYS,
} from "@/lib/membership-ui";

const notify = (type, message) =>
  window.dispatchEvent(
    new CustomEvent("impactos:notify", { detail: { type, message } }),
  );

const STATUS_STYLE = {
  active: { bg: "rgba(16,185,129,0.12)", color: "#10B981" },
  expiringSoon: { bg: "rgba(245,158,11,0.12)", color: "#F59E0B" },
  expired: { bg: "rgba(239,68,68,0.12)", color: "#EF4444" },
  ended: { bg: "rgba(100,116,139,0.15)", color: "#94A3B8" },
};

const ACCOUNT_STYLE = {
  active: { bg: "rgba(16,185,129,0.12)", color: "#10B981" },
  pending: { bg: "rgba(245,158,11,0.12)", color: "#F59E0B" },
  invited: { bg: "rgba(59,130,246,0.12)", color: "#3B82F6" },
  inactive: { bg: "rgba(100,116,139,0.15)", color: "#94A3B8" },
  rejected: { bg: "rgba(239,68,68,0.12)", color: "#EF4444" },
};

function Badge({ label, style }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider"
      style={{ background: style.bg, color: style.color }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: style.color }} />
      {label}
    </span>
  );
}

export default function MembershipPage() {
  const { t, lang } = useI18n();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [members, setMembers] = useState([]);
  const [protectedMap, setProtectedMap] = useState({});
  const [selectedGroup, setSelectedGroup] = useState(""); // "" = all groups
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [accountFilter, setAccountFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [addOpen, setAddOpen] = useState(false);
  const [detailMember, setDetailMember] = useState(null);
  const [renewMember, setRenewMember] = useState(null);
  const [confirmState, setConfirmState] = useState(null); // { member, action }
  const [historyMember, setHistoryMember] = useState(null);

  const fetchMemberships = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError("");
      const res = await fetch("/api/org-membership");
      const data = await res.json();
      if (!data.success) {
        setLoadError(data.error || t("membership.page.loadError"));
        return;
      }
      setMembers(data.memberships || []);
      setProtectedMap(data.protected || {});
    } catch {
      setLoadError(t("membership.page.loadError"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchMemberships();
  }, [fetchMemberships]);

  const groups = useMemo(
    () =>
      sortGroups(
        [...new Set((members || []).map((m) => m.group_name).filter(Boolean))].map(
          (name) => ({ name, isProtected: !!protectedMap[name] }),
        ),
      ),
    [members, protectedMap],
  );

  const roles = useMemo(
    () => [...new Set((members || []).map((m) => m.role).filter(Boolean))].sort(),
    [members],
  );

  const fmtDate = useCallback(
    (v) => {
      if (!v) return "—";
      const d = new Date(v);
      if (Number.isNaN(d.getTime())) return "—";
      return d.toLocaleDateString(lang === "fr" ? "fr-FR" : "en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    },
    [lang],
  );

  const statusKey = (status) => {
    switch (status) {
      case "expiringSoon":
        return t("membership.status.expiringSoon");
      case "expired":
        return t("membership.status.expired");
      case "ended":
        return t("membership.status.ended");
      default:
        return t("membership.status.active");
    }
  };

  const accountKey = (status) => {
    const s = String(status || "").toLowerCase();
    switch (s) {
      case "active":
        return t("membership.status.accountActive");
      case "pending":
        return t("membership.status.accountPending");
      case "invited":
        return t("membership.status.accountInvited");
      case "inactive":
      case "rejected":
        return t("membership.status.accountInactive");
      default:
        return t("membership.status.accountUnknown");
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (members || []).filter((m) => {
      if (selectedGroup && m.group_name !== selectedGroup) return false;
      if (q && !(m.name || "").toLowerCase().includes(q) && !(m.email || "").toLowerCase().includes(q)) return false;
      const derived = deriveMembershipStatus(m);
      if (statusFilter !== "all" && derived !== statusFilter) return false;
      if (accountFilter !== "all" && String(m.account_status || "").toLowerCase() !== accountFilter) return false;
      if (roleFilter !== "all" && m.role !== roleFilter) return false;
      return true;
    });
  }, [members, selectedGroup, search, statusFilter, accountFilter, roleFilter]);

  const reload = () => {
    setDetailMember(null);
    setHistoryMember(null);
    fetchMemberships();
  };

  const runAction = async (member, action, extra = {}) => {
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
  };

  const handleAction = async () => {
    if (!confirmState) return;
    const ok = await runAction(confirmState.member, confirmState.action);
    if (ok) {
      setConfirmState(null);
      reload();
    }
  };

  const handleRenew = async (expiresAt) => {
    if (!renewMember) return false;
    const ok = await runAction(renewMember, "renewed", {
      expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
    });
    if (ok) {
      setRenewMember(null);
      reload();
    }
    return ok;
  };

  const isProtected = (name) => !!protectedMap[name];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1
              className="text-xl font-black uppercase tracking-tight flex items-center gap-3"
              style={{ color: "var(--text-primary)" }}
            >
              <Users className="w-6 h-6" style={{ color: "var(--brand-orange)" }} />
              {t("membership.page.title")}
            </h1>
            <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
              {t("membership.page.subtitle")}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <AppButton variant="secondary" size="sm" icon={RefreshCw} onClick={reload}>
              {t("membership.page.refresh")}
            </AppButton>
            <AppButton variant="primary" size="sm" icon={UserPlus} onClick={() => setAddOpen(true)}>
              {t("membership.page.addMember")}
            </AppButton>
          </div>
        </div>

        {/* Group selector */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setSelectedGroup("")}
            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${
              selectedGroup === "" ? "border-[var(--brand-orange)]" : "border-transparent"
            }`}
            style={{
              background: selectedGroup === "" ? "var(--surface-3)" : "var(--surface-1)",
              color: selectedGroup === "" ? "var(--brand-orange)" : "var(--text-secondary)",
            }}
          >
            {t("membership.page.allGroups")}
          </button>
          {groups.map((g) => {
            const active = selectedGroup === g.name;
            return (
              <button
                key={g.name}
                onClick={() => setSelectedGroup(active ? "" : g.name)}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${
                  active ? "border-[var(--brand-orange)]" : "border-transparent"
                }`}
                style={{
                  background: active ? "var(--surface-3)" : "var(--surface-1)",
                  color: active ? "var(--brand-orange)" : "var(--text-secondary)",
                }}
              >
                <span className="inline-flex items-center gap-1.5">
                  {g.isProtected && <Shield className="w-3.5 h-3.5" />}
                  {g.name}
                  {g.isProtected && (
                    <span
                      className="px-1.5 py-0.5 rounded-md text-[8px] font-black uppercase tracking-wider"
                      style={{ background: "rgba(245,158,11,0.15)", color: "#F59E0B" }}
                    >
                      {t("membership.page.protected")}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>

        {/* Toolbar: search + filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="md:col-span-1">
            <AppInput
              icon={Search}
              placeholder={t("membership.page.searchPlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <AppSelect
            label={t("membership.page.filterStatus")}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            options={[
              { value: "all", label: t("membership.page.filterStatusAll") },
              { value: "active", label: t("membership.status.active") },
              { value: "expiringSoon", label: t("membership.status.expiringSoon") },
              { value: "expired", label: t("membership.status.expired") },
              { value: "ended", label: t("membership.status.ended") },
            ]}
          />
          <AppSelect
            label={t("membership.page.filterAccountStatus")}
            value={accountFilter}
            onChange={(e) => setAccountFilter(e.target.value)}
            options={[
              { value: "all", label: t("membership.page.filterAccountAll") },
              { value: "active", label: t("membership.status.accountActive") },
              { value: "pending", label: t("membership.status.accountPending") },
              { value: "invited", label: t("membership.status.accountInvited") },
              { value: "inactive", label: t("membership.status.accountInactive") },
            ]}
          />
          <AppSelect
            label={t("membership.page.filterRole")}
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            options={[
              { value: "all", label: t("membership.page.filterRoleAll") },
              ...roles.map((r) => ({ value: r, label: r })),
            ]}
          />
        </div>

        {/* Roster */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: "var(--surface-1)", border: "1px solid var(--border-primary)" }}
        >
          <div
            className="px-5 py-3 flex items-center justify-between border-b"
            style={{ borderColor: "var(--border-primary)" }}
          >
            <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: "var(--text-secondary)" }}>
              {selectedGroup
                ? `${selectedGroup} — ${filtered.length} ${t("membership.page.membersCount")}`
                : `${t("membership.page.viewAllGroups")} — ${filtered.length} ${t("membership.page.membersCount")}`}
            </p>
          </div>

          {loading ? (
            <div className="p-8 space-y-3">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-10 rounded-lg animate-pulse"
                  style={{ background: "var(--surface-3)" }}
                />
              ))}
            </div>
          ) : loadError ? (
            <AppEmptyState
              title={t("membership.page.loadError")}
              icon={AlertTriangle}
              action={
                <AppButton variant="secondary" size="sm" icon={RefreshCw} onClick={reload}>
                  {t("membership.page.refresh")}
                </AppButton>
              }
            />
          ) : filtered.length === 0 ? (
            <AppEmptyState
              title={
                search || statusFilter !== "all" || accountFilter !== "all" || roleFilter !== "all"
                  ? t("membership.page.noResults")
                  : t("membership.page.noMembers")
              }
              icon={Users}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr
                    className="text-[9px] font-black uppercase tracking-widest"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    <th className="px-5 py-3">{t("membership.columns.name")}</th>
                    <th className="px-5 py-3">{t("membership.columns.role")}</th>
                    <th className="px-5 py-3">{t("membership.columns.group")}</th>
                    <th className="px-5 py-3">{t("membership.columns.membershipStatus")}</th>
                    <th className="px-5 py-3">{t("membership.columns.start")}</th>
                    <th className="px-5 py-3">{t("membership.columns.expires")}</th>
                    <th className="px-5 py-3">{t("membership.columns.accountStatus")}</th>
                    <th className="px-5 py-3 text-right">{t("membership.columns.actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((m, i) => {
                    const derived = deriveMembershipStatus(m);
                    const isExpired = derived === "expired";
                    const isEnded = derived === "ended";
                    return (
                      <tr
                        key={`${m.user_cid}|${m.group_name}`}
                        className="border-t"
                        style={{
                          borderColor: "var(--border-primary)",
                          background: i % 2 ? "var(--surface-2)" : "transparent",
                          opacity: isExpired || isEnded ? 0.65 : 1,
                        }}
                      >
                        <td className="px-5 py-3.5">
                          <p className="text-xs font-bold" style={{ color: "var(--text-primary)" }}>
                            {m.name || m.user_cid}
                          </p>
                          <p className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>
                            {m.email || "—"}
                          </p>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
                            {m.role || "—"}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold" style={{ color: "var(--text-secondary)" }}>
                            {isProtected(m.group_name) && <Shield className="w-3 h-3" style={{ color: "#F59E0B" }} />}
                            {m.group_name}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <Badge label={statusKey(derived)} style={STATUS_STYLE[derived] || STATUS_STYLE.active} />
                          {derived === "expiringSoon" && (
                            <p className="text-[9px] mt-1" style={{ color: "#F59E0B" }}>
                              {EXPIRING_SOON_DAYS} {t("time.days")}
                            </p>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-[10px]" style={{ color: "var(--text-secondary)" }}>
                          {fmtDate(m.started_at)}
                        </td>
                        <td className="px-5 py-3.5 text-[10px]" style={{ color: "var(--text-secondary)" }}>
                          {m.expires_at ? fmtDate(m.expires_at) : t("membership.status.never")}
                        </td>
                        <td className="px-5 py-3.5">
                          <Badge
                            label={accountKey(m.account_status)}
                            style={ACCOUNT_STYLE[String(m.account_status || "").toLowerCase()] || ACCOUNT_STYLE.inactive}
                          />
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center justify-end gap-1.5">
                            <AppButton variant="ghost" size="sm" icon={Eye} onClick={() => setDetailMember(m)}>
                              {t("membership.actions.view")}
                            </AppButton>
                            {!isExpired && !isEnded && (
                              <>
                                <AppButton variant="ghost" size="sm" icon={RotateCcw} onClick={() => setRenewMember(m)}>
                                  {t("membership.actions.renew")}
                                </AppButton>
                                <AppButton
                                  variant="ghost"
                                  size="sm"
                                  icon={Ban}
                                  onClick={() => setConfirmState({ member: m, action: "deactivated" })}
                                >
                                  {t("membership.actions.deactivate")}
                                </AppButton>
                                <AppButton
                                  variant="ghost"
                                  size="sm"
                                  icon={UserX}
                                  onClick={() => setConfirmState({ member: m, action: "ended" })}
                                >
                                  {t("membership.actions.end")}
                                </AppButton>
                              </>
                            )}
                            {isExpired && (
                              <>
                                <AppButton variant="ghost" size="sm" icon={RotateCcw} onClick={() => setRenewMember(m)}>
                                  {t("membership.actions.renew")}
                                </AppButton>
                                <AppButton variant="ghost" size="sm" icon={History} onClick={() => setHistoryMember(m)}>
                                  {t("membership.actions.history")}
                                </AppButton>
                              </>
                            )}
                            {isEnded && (
                              <>
                                <AppButton variant="ghost" size="sm" icon={RotateCcw} onClick={() => setRenewMember(m)}>
                                  {t("membership.actions.reactivate")}
                                </AppButton>
                                <AppButton variant="ghost" size="sm" icon={History} onClick={() => setHistoryMember(m)}>
                                  {t("membership.actions.history")}
                                </AppButton>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Add Member */}
      {addOpen && (
        <AddMemberModal
          groups={groups}
          defaultGroup={selectedGroup || (groups[0] ? groups[0].name : "")}
          isProtected={isProtected}
          existing={members}
          t={t}
          lang={lang}
          onClose={() => setAddOpen(false)}
          onAdded={() => {
            setAddOpen(false);
            reload();
          }}
        />
      )}

      {/* Member detail */}
      {detailMember && (
        <DetailModal
          member={detailMember}
          derived={deriveMembershipStatus(detailMember)}
          isProtected={isProtected(detailMember.group_name)}
          t={t}
          lang={lang}
          fmtDate={fmtDate}
          onClose={() => setDetailMember(null)}
          onHistory={() => {
            setHistoryMember(detailMember);
            setDetailMember(null);
          }}
        />
      )}

      {/* Renew / Reactivate */}
      {renewMember && (
        <RenewModal
          member={renewMember}
          isReactivate={deriveMembershipStatus(renewMember) === "ended"}
          t={t}
          lang={lang}
          fmtDate={fmtDate}
          onClose={() => setRenewMember(null)}
          onConfirm={handleRenew}
        />
      )}

      {/* Deactivate / End confirm */}
      {confirmState && (
        <ConfirmModal
          state={confirmState}
          t={t}
          onClose={() => setConfirmState(null)}
          onConfirm={handleAction}
        />
      )}

      {/* History */}
      {historyMember && (
        <HistoryModal member={historyMember} t={t} lang={lang} fmtDate={fmtDate} onClose={() => setHistoryMember(null)} />
      )}
    </DashboardLayout>
  );
}

/* ── Add Member ─────────────────────────────────────────────────────────── */

function AddMemberModal({ groups, defaultGroup, isProtected, existing, t, lang, onClose, onAdded }) {
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(null); // contact detail
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
      const res = await fetch("/api/org-membership", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_cid: selected.cid,
          group_name: group,
          action: "joined",
          expires_at: expires ? new Date(expires).toISOString() : null,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        notify("error", data.error || t("membership.add.error"));
        return;
      }
      notify("success", t("membership.add.success"));
      onAdded();
    } catch {
      notify("error", t("membership.add.error"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppModal isOpen onClose={onClose} title={t("membership.add.title")} size="lg">
      <div className="space-y-5">
        {/* Search */}
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

        {/* Results */}
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

        {/* Selected contact */}
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

        {/* Form */}
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
              <p className="text-[10px] flex items-center gap-1.5" style={{ color: "#F59E0B" }}>
                <Shield className="w-3.5 h-3.5" /> {t("membership.page.protected")}
              </p>
            )}
            {alreadyMember && (
              <p className="text-[10px]" style={{ color: "#F59E0B" }}>
                {t("membership.add.alreadyMember")}
              </p>
            )}

            {/* Summary */}
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

/* ── Member Detail ──────────────────────────────────────────────────────── */

function DetailModal({ member, derived, isProtected, t, lang, fmtDate, onClose, onHistory }) {
  const statusLabel = {
    active: t("membership.status.active"),
    expiringSoon: t("membership.status.expiringSoon"),
    expired: t("membership.status.expired"),
    ended: t("membership.status.ended"),
  }[derived];

  const accountLabel =
    {
      active: t("membership.status.accountActive"),
      pending: t("membership.status.accountPending"),
      invited: t("membership.status.accountInvited"),
      inactive: t("membership.status.accountInactive"),
      rejected: t("membership.status.accountRejected"),
    }[String(member.account_status || "").toLowerCase()] || t("membership.status.accountUnknown");

  return (
    <AppModal isOpen onClose={onClose} title={t("membership.detail.title")} size="lg">
      <div className="space-y-6">
        {/* Person */}
        <section>
          <p className="text-[9px] font-black uppercase tracking-widest mb-2" style={{ color: "var(--text-tertiary)" }}>
            {t("membership.detail.personSection")}
          </p>
          <div
            className="rounded-xl p-4 grid grid-cols-1 md:grid-cols-3 gap-3"
            style={{ background: "var(--surface-2)", border: "1px solid var(--border-primary)" }}
          >
            <div className="md:col-span-1">
              <p className="text-xs font-bold" style={{ color: "var(--text-primary)" }}>
                {member.name || member.user_cid}
              </p>
              <p className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>
                {member.email || "—"}
              </p>
            </div>
            <div>
              <p className="text-[9px] uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
                {t("membership.columns.role")}
              </p>
              <p className="text-xs font-bold mt-1" style={{ color: "var(--text-primary)" }}>
                {member.role || "—"}
              </p>
            </div>
            <div>
              <p className="text-[9px] uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
                {t("membership.columns.accountStatus")}
              </p>
              <div className="mt-1">
                <Badge
                  label={accountLabel}
                  style={
                    ACCOUNT_STYLE[String(member.account_status || "").toLowerCase()] || ACCOUNT_STYLE.inactive
                  }
                />
              </div>
            </div>
          </div>
        </section>

        {/* Organizational membership */}
        <section>
          <p className="text-[9px] font-black uppercase tracking-widest mb-2" style={{ color: "var(--text-tertiary)" }}>
            {t("membership.detail.membershipSection")}
          </p>
          <div
            className="rounded-xl p-4 grid grid-cols-2 md:grid-cols-4 gap-3"
            style={{ background: "var(--surface-2)", border: "1px solid var(--border-primary)" }}
          >
            <div className="col-span-2">
              <p className="text-[9px] uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
                {t("membership.columns.group")}
              </p>
              <p className="text-xs font-bold mt-1 flex items-center gap-1.5" style={{ color: "var(--text-primary)" }}>
                {isProtected && <Shield className="w-3.5 h-3.5" style={{ color: "#F59E0B" }} />}
                {member.group_name}
                {isProtected && (
                  <span
                    className="px-1.5 py-0.5 rounded-md text-[8px] font-black uppercase"
                    style={{ background: "rgba(245,158,11,0.15)", color: "#F59E0B" }}
                  >
                    {t("membership.page.protected")}
                  </span>
                )}
              </p>
            </div>
            <div>
              <p className="text-[9px] uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
                {t("membership.columns.membershipStatus")}
              </p>
              <div className="mt-1">
                <Badge label={statusLabel} style={STATUS_STYLE[derived] || STATUS_STYLE.active} />
              </div>
            </div>
            <div>
              <p className="text-[9px] uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
                {t("membership.columns.start")} / {t("membership.columns.expires")}
              </p>
              <p className="text-xs font-bold mt-1" style={{ color: "var(--text-primary)" }}>
                {fmtDate(member.started_at)}
              </p>
              <p className="text-[10px]" style={{ color: "var(--text-secondary)" }}>
                {member.expires_at ? fmtDate(member.expires_at) : t("membership.detail.noExpiry")}
              </p>
            </div>
          </div>
        </section>

        {/* Access — separate concept, deep link to Permissions */}
        <section>
          <p className="text-[9px] font-black uppercase tracking-widest mb-2" style={{ color: "var(--text-tertiary)" }}>
            {t("membership.detail.accessSection")}
          </p>
          <div
            className="rounded-xl p-4 flex flex-wrap items-center justify-between gap-3"
            style={{ background: "var(--surface-2)", border: "1px solid var(--border-primary)" }}
          >
            <p className="text-[10px] flex items-center gap-2" style={{ color: "var(--text-secondary)" }}>
              <Link2 className="w-4 h-4" />
              {t("membership.detail.accessHint")}
            </p>
            <div className="flex items-center gap-2">
              <AppButton variant="ghost" size="sm" icon={History} onClick={onHistory}>
                {t("membership.actions.history")}
              </AppButton>
              <a href={`/admin/engineering/permissions?cid=${encodeURIComponent(member.user_cid)}`}>
                <AppButton variant="secondary" size="sm" icon={Eye}>
                  {t("membership.detail.viewEffectiveAccess")}
                </AppButton>
              </a>
            </div>
          </div>
        </section>
      </div>
    </AppModal>
  );
}

/* ── Renew / Reactivate ─────────────────────────────────────────────────── */

function RenewModal({ member, isReactivate, t, lang, fmtDate, onClose, onConfirm }) {
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

function ConfirmModal({ state, t, onClose, onConfirm }) {
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

function HistoryModal({ member, t, lang, fmtDate, onClose }) {
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

  const eventLabel = (action) => {
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
                      {eventLabel(ev.action)}
                    </p>
                    {ev.note && (
                      <p className="text-[10px] mt-0.5" style={{ color: "var(--text-tertiary)" }}>
                        {ev.note}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold" style={{ color: "var(--text-secondary)" }}>
                      {fmtDate(ev.created_at)}
                    </p>
                    <p className="text-[9px]" style={{ color: "var(--text-tertiary)" }}>
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
