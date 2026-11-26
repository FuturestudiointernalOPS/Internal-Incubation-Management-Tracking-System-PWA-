"use client";

import Link from "next/link";
import { History, Shield, Eye, Link2 } from "lucide-react";
import AppButton from "@/components/ui/AppButton";
import AppModal from "@/components/ui/AppModal";
import { ACCOUNT_STYLE, STATUS_STYLE, Badge } from "./shared";

/* ── Member Detail (roster-specific) ────────────────────────────────────── */

export function DetailModal({ member, derived, isProtected, t, fmtDate, readOnly, effectiveAccessHref, onClose, onHistory }) {
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
          <p className="text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color: "var(--text-primary)" }}>
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
              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--text-secondary)" }}>
                {t("membership.columns.role")}
              </p>
              <p className="text-xs font-bold mt-1" style={{ color: "var(--text-primary)" }}>
                {member.role || "—"}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--text-secondary)" }}>
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
          <p className="text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color: "var(--text-primary)" }}>
            {t("membership.detail.membershipSection")}
          </p>
          <div
            className="rounded-xl p-4 grid grid-cols-2 md:grid-cols-4 gap-3"
            style={{ background: "var(--surface-2)", border: "1px solid var(--border-primary)" }}
          >
            <div className="col-span-2">
              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--text-secondary)" }}>
                {t("membership.columns.group")}
              </p>
              <p className="text-xs font-bold mt-1 flex items-center gap-1.5" style={{ color: "var(--text-primary)" }}>
                {isProtected && <Shield className="w-3.5 h-3.5" style={{ color: "#F59E0B" }} />}
                {member.group_name}
                {isProtected && (
                  <span
                    className="px-1.5 py-0.5 rounded-md text-[10px] font-bold uppercase"
                    style={{ background: "rgba(245,158,11,0.15)", color: "#F59E0B" }}
                  >
                    {t("membership.page.protected")}
                  </span>
                )}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--text-secondary)" }}>
                {t("membership.columns.membershipStatus")}
              </p>
              <div className="mt-1">
                <Badge label={statusLabel} style={STATUS_STYLE[derived] || STATUS_STYLE.active} />
              </div>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--text-secondary)" }}>
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
          <p className="text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color: "var(--text-primary)" }}>
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
              {!readOnly && effectiveAccessHref && (
                <Link href={`${effectiveAccessHref}?cid=${encodeURIComponent(member.user_cid)}`}>
                  <AppButton variant="secondary" size="sm" icon={Eye}>
                    {t("membership.detail.viewEffectiveAccess")}
                  </AppButton>
                </Link>
              )}
            </div>
          </div>
        </section>
      </div>
    </AppModal>
  );
}
