"use client";

import Link from "next/link";
import { User, Clock, Send, Mail, ArrowLeft } from "lucide-react";
import { ROLE_LABELS, INVITATION_STATUS_LABELS } from "./constants";

/**
 * Identity header of the CRM person detail: back links, name/email, current
 * and past role pills, the invitation status and the invite/resend action.
 * Presentational only — every action is a prop from the page.
 */
export default function PersonHeader({
  contact,
  currentRoles,
  pastRoles,
  invitationStatus,
  inviting,
  inviteMessage,
  t,
  onBack,
  onInvite,
}) {
  return (
    <>
      {/* Back links */}
      <nav className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <button onClick={onBack} className="inline-flex items-center gap-2 text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest hover:text-[var(--brand-orange)] transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" />
          {t("crm.backToPrevious")}
        </button>
        <Link href="/admin/crm" className="inline-flex items-center gap-2 text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest hover:text-[var(--brand-orange)] transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" />
          {t("crm.people.backToCrmDashboard")}
        </Link>
      </nav>

      {/* Identity Header */}
      <div className="bg-primary border border-[var(--border-primary)] rounded-2xl p-6">
        <div className="flex items-start gap-4 flex-wrap">
          <div className="w-14 h-14 rounded-xl bg-brand-orange/10 flex items-center justify-center shrink-0">
            <User className="w-6 h-6 text-[var(--brand-orange)]" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-black uppercase tracking-tight">{contact.name}</h1>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              {contact.email} {contact.phone ? "· " + contact.phone : ""}
            </p>
            <div className="flex flex-wrap gap-1.5 mt-3">
              {currentRoles.map(roleAssignment => (
                <span key={roleAssignment.id} className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-brand-orange/10 text-[var(--brand-orange)]">
                  {t(ROLE_LABELS[roleAssignment.role] || "") || roleAssignment.role}
                </span>
              ))}
              {pastRoles.length > 0 && (
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-tertiary text-[var(--text-secondary)]">
                  {t("crm.people.previousCount", { count: pastRoles.length })}
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-col items-end gap-2 shrink-0">
            <span
              className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
                invitationStatus === "activated"
                  ? "bg-emerald-500/10 text-emerald-400"
                  : invitationStatus === "sent"
                    ? "bg-orange-500/10 text-orange-400"
                    : invitationStatus === "expired"
                      ? "bg-rose-500/10 text-rose-400"
                      : "bg-white/5 text-[var(--text-tertiary)]"
              }`}
            >
              {t(INVITATION_STATUS_LABELS[invitationStatus] || "") || invitationStatus}
            </span>

            {invitationStatus === "activated" ? (
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">
                {t("crm.contacts.invitationActivated") || "Activated"}
              </span>
            ) : (
              <button
                onClick={onInvite}
                disabled={inviting}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--brand-orange)] text-black text-[10px] font-bold uppercase tracking-widest hover:brightness-110 transition-all disabled:opacity-40"
              >
                {inviting ? <Clock className="w-3.5 h-3.5 animate-spin" /> : invitationStatus === "not_invited" ? <Send className="w-3.5 h-3.5" /> : <Mail className="w-3.5 h-3.5" />}
                {inviting
                  ? t("crm.contacts.sending")
                  : invitationStatus === "not_invited"
                    ? t("crm.contacts.inviteUser") || "Invite User"
                    : t("crm.contacts.resendActivation") || "Resend Invitation"}
              </button>
            )}

            {inviteMessage && (
              <p
                className={`text-[10px] font-bold ${
                  inviteMessage.type === "success" ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                {inviteMessage.text}
              </p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
