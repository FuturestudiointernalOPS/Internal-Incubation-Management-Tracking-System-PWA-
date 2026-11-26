"use client";

import { X } from "lucide-react";

export function GroupInviteModal({
  t,
  showInviteModal,
  inviteForm,
  setInviteForm,
  isProcessing,
  onClose,
  onInvite,
}) {
  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm">
      <div className="card w-full max-w-sm space-y-6 border-brand-orange/30 max-h-[85vh] overflow-y-auto">
        <div className="flex justify-between items-center">
          <h3 className="text-xl font-bold uppercase">
            {t("crm.contacts.inviteTo")}: {showInviteModal.name}
          </h3>
          <button onClick={onClose}>
            <X className="w-6 h-6" />
          </button>
        </div>
        <div className="space-y-4">
          <input
            value={inviteForm.name}
            onChange={(event) => setInviteForm({ ...inviteForm, name: event.target.value })}
            placeholder={t("crm.contacts.fullName")}
            className="w-full bg-primary border border-[var(--border-primary)] rounded-xl p-4 font-bold outline-none focus:border-[var(--brand-orange)]"
          />
          <input
            type="email"
            value={inviteForm.email}
            onChange={(event) => setInviteForm({ ...inviteForm, email: event.target.value })}
            placeholder={t("crm.contacts.email")}
            className="w-full bg-primary border border-[var(--border-primary)] rounded-xl p-4 font-bold outline-none focus:border-[var(--brand-orange)]"
          />
          <input
            type="tel"
            value={inviteForm.phone}
            onChange={(event) => setInviteForm({ ...inviteForm, phone: event.target.value })}
            placeholder={t("crm.contacts.phone")}
            className="w-full bg-primary border border-[var(--border-primary)] rounded-xl p-4 font-bold outline-none focus:border-[var(--brand-orange)]"
          />
          <select
            value={inviteForm.role}
            onChange={(event) => setInviteForm({ ...inviteForm, role: event.target.value })}
            className="w-full bg-primary border border-[var(--border-primary)] rounded-xl p-4 text-xs font-bold outline-none focus:border-[var(--brand-orange)]"
          >
            <option value="participant">{t("crm.contacts.roleParticipant")}</option>
            <option value="member">{t("crm.contacts.roleMember")}</option>
            <option value="staff">{t("crm.contacts.roleStaff")}</option>
            <option value="intern">{t("crm.contacts.roleIntern")}</option>
          </select>
          <button
            onClick={onInvite}
            disabled={!inviteForm.email.trim() || isProcessing}
            className="btn btn-primary w-full py-4 font-bold uppercase disabled:opacity-50"
          >
            {isProcessing ? t("crm.contacts.processing") : t("crm.contacts.invite")}
          </button>
        </div>
      </div>
    </div>
  );
}
