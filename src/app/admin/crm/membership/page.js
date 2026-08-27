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
import { deriveMembershipStatus, sortGroups, EXPIRING_SOON_DAYS } from "@/lib/membership-ui";
import {
  STATUS_STYLE,
  ACCOUNT_STYLE,
  Badge,
  runMembershipAction,
  AddMemberModal,
  RenewModal,
  ConfirmModal,
  HistoryModal,
} from "@/components/membership/MembershipModals";

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
        [...new Set((members || []).map((m) => m.group_name).filter(Boolean))].map((name) => ({
          name,
          isProtected: !!protectedMap[name],
        })),
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

  const handleAction = async () => {
    if (!confirmState) return;
    const ok = await runMembershipAction(confirmState.member, confirmState.action, t);
    if (ok) {
      setConfirmState(null);
      reload();
    }
  };

  const handleRenew = async (expiresAt) => {
    if (!renewMember) return false;
    const ok = await runMembershipAction(renewMember, "renewed", t, {
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
                <div key={i} className="h-10 rounded-lg animate-pulse" style={{ background: "var(--surface-3)" }} />
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
                  <tr className="text-[9px] font-black uppercase tracking-widest" style={{ color: "var(--text-tertiary)" }}>
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
        <ConfirmModal state={confirmState} t={t} onClose={() => setConfirmState(null)} onConfirm={handleAction} />
      )}

      {/* History */}
      {historyMember && (
        <HistoryModal member={historyMember} t={t} lang={lang} fmtDate={fmtDate} onClose={() => setHistoryMember(null)} />
      )}
    </DashboardLayout>
  );
}

/* ── Member Detail (roster-specific) ────────────────────────────────────── */

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
