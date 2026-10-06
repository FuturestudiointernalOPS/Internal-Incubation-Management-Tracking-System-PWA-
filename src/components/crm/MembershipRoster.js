"use client";

import {
  Users,
  Shield,
  RefreshCw,
  History,
  Eye,
  RotateCcw,
  Ban,
  UserX,
  AlertTriangle,
} from "lucide-react";
import AppButton from "@/components/ui/AppButton";
import AppEmptyState from "@/components/ui/AppEmptyState";
import { deriveMembershipStatus, EXPIRING_SOON_DAYS } from "@/lib/membership-ui";
import {
  STATUS_STYLE,
  ACCOUNT_STYLE,
  Badge,
} from "@/components/membership/MembershipModals";

export function MembershipRoster({
  t,
  readOnly,
  selectedGroup,
  search,
  statusFilter,
  accountFilter,
  roleFilter,
  filtered,
  loading,
  loadFailed,
  reload,
  fmtDate,
  statusKey,
  accountKey,
  isProtected,
  setDetailMember,
  setRenewMember,
  setConfirmState,
  setHistoryMember,
}) {
  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: "var(--surface-1)", border: "1px solid var(--border-primary)" }}
    >
      <div
        className="px-5 py-3 flex items-center justify-between border-b"
        style={{ borderColor: "var(--border-primary)" }}
      >
        <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--text-secondary)" }}>
          {selectedGroup
            ? `${selectedGroup} — ${filtered.length} ${t("membership.page.membersCount")}`
            : `${t("membership.page.viewAllGroups")} — ${filtered.length} ${t("membership.page.membersCount")}`}
        </p>
      </div>

      {loading ? (
        <div className="p-8 space-y-3">
          {[0, 1, 2, 3].map((index) => (
            <div key={index} className="h-10 rounded-lg animate-pulse" style={{ background: "var(--surface-3)" }} />
          ))}
        </div>
      ) : loadFailed ? (
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
              <tr className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--text-secondary)" }}>
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
              {filtered.map((member, index) => {
                const derived = deriveMembershipStatus(member);
                const isExpired = derived === "expired";
                const isEnded = derived === "ended";
                return (
                  <tr
                    key={`${member.user_cid}|${member.group_name}`}
                    className="border-t"
                    style={{
                      borderColor: "var(--border-primary)",
                      background: index % 2 ? "var(--surface-2)" : "transparent",
                      opacity: isExpired || isEnded ? 0.65 : 1,
                    }}
                  >
                    <td className="px-5 py-3.5">
                      <p className="text-xs font-bold" style={{ color: "var(--text-primary)" }}>
                        {member.name || member.user_cid}
                      </p>
                      <p className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>
                        {member.email || "—"}
                      </p>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
                        {member.role || "—"}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center gap-1.5 text-[10px] font-bold" style={{ color: "var(--text-secondary)" }}>
                        {isProtected(member.group_name) && <Shield className="w-3 h-3" style={{ color: "#F59E0B" }} />}
                        {member.group_name}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge label={statusKey(derived)} style={STATUS_STYLE[derived] || STATUS_STYLE.active} />
                      {derived === "expiringSoon" && (
                        <p className="text-[10px] mt-1" style={{ color: "#F59E0B" }}>
                          {EXPIRING_SOON_DAYS} {t("time.daysUnit")}
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-[10px]" style={{ color: "var(--text-secondary)" }}>
                      {fmtDate(member.started_at)}
                    </td>
                    <td className="px-5 py-3.5 text-[10px]" style={{ color: "var(--text-secondary)" }}>
                      {member.expires_at ? fmtDate(member.expires_at) : t("membership.status.never")}
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge
                        label={accountKey(member.account_status)}
                        style={ACCOUNT_STYLE[String(member.account_status || "").toLowerCase()] || ACCOUNT_STYLE.inactive}
                      />
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1.5">
                        <AppButton variant="ghost" size="sm" icon={Eye} onClick={() => setDetailMember(member)}>
                          {t("membership.actions.view")}
                        </AppButton>
                        {!readOnly && !isExpired && !isEnded && (
                          <>
                            <AppButton variant="ghost" size="sm" icon={RotateCcw} onClick={() => setRenewMember(member)}>
                              {t("membership.actions.renew")}
                            </AppButton>
                            <AppButton
                              variant="ghost"
                              size="sm"
                              icon={Ban}
                              onClick={() => setConfirmState({ member, action: "deactivated" })}
                            >
                              {t("membership.actions.deactivate")}
                            </AppButton>
                            <AppButton
                              variant="ghost"
                              size="sm"
                              icon={UserX}
                              onClick={() => setConfirmState({ member, action: "ended" })}
                            >
                              {t("membership.actions.end")}
                            </AppButton>
                          </>
                        )}
                        {isExpired && (
                          <>
                            {!readOnly && (
                              <AppButton variant="ghost" size="sm" icon={RotateCcw} onClick={() => setRenewMember(member)}>
                                {t("membership.actions.renew")}
                              </AppButton>
                            )}
                            <AppButton variant="ghost" size="sm" icon={History} onClick={() => setHistoryMember(member)}>
                              {t("membership.actions.history")}
                            </AppButton>
                          </>
                        )}
                        {isEnded && (
                          <>
                            {!readOnly && (
                              <AppButton variant="ghost" size="sm" icon={RotateCcw} onClick={() => setRenewMember(member)}>
                                {t("membership.actions.reactivate")}
                              </AppButton>
                            )}
                            <AppButton variant="ghost" size="sm" icon={History} onClick={() => setHistoryMember(member)}>
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
  );
}
