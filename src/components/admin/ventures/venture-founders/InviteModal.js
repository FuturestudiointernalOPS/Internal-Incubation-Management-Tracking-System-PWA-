"use client";

import { UserPlus, X, Loader2, Send } from "lucide-react";

export default function InviteModal({
  setShowInviteModal,
  inviteForm,
  setInviteForm,
  inviting,
  handleInvite,
  t,
  ventureRoles,
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-3xl p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-orange/10 flex items-center justify-center">
              <UserPlus className="w-5 h-5 text-[var(--brand-orange)]" />
            </div>
            <div>
              <h2 className="text-sm font-black text-[var(--text-primary)]">{t("vadmin.founders.inviteMember")}</h2>
              <p className="text-[10px] text-[var(--text-secondary)]">{t("vadmin.founders.inviteModalSubtitle")}</p>
            </div>
          </div>
          <button onClick={() => setShowInviteModal(false)} className="p-2 hover:bg-white/5 rounded-lg">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-1.5 block">{t("vadmin.founders.emailLabel")}</label>
            <input
              type="email"
              value={inviteForm.email}
              onChange={(event) => setInviteForm((previous) => ({ ...previous, email: event.target.value }))}
              placeholder={t("vadmin.founders.emailPlaceholder")}
              className="w-full bg-primary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-sm font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)] transition-all"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-1.5 block">{t("vadmin.founders.nameLabel")}</label>
            <input
              type="text"
              value={inviteForm.name}
              onChange={(event) => setInviteForm((previous) => ({ ...previous, name: event.target.value }))}
              placeholder={t("vadmin.founders.namePlaceholder")}
              className="w-full bg-primary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-sm font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)] transition-all"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-1.5 block">{t("vadmin.founders.roleLabel")}</label>
            <select
              value={inviteForm.role}
              onChange={(event) => setInviteForm((previous) => ({ ...previous, role: event.target.value }))}
              className="w-full bg-primary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-sm font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)] transition-all"
            >
              {ventureRoles.map((ventureRole) => (
                <option key={ventureRole} value={ventureRole}>{ventureRole.replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase())}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => setShowInviteModal(false)}
            className="flex-1 py-3 rounded-xl border border-[var(--border-primary)] text-[10px] font-bold uppercase tracking-widest hover:bg-tertiary transition-all"
          >
            {t("vadmin.founders.cancel")}
          </button>
          <button
            onClick={handleInvite}
            disabled={inviting}
            className="flex-1 py-3 bg-[var(--brand-orange)] text-black rounded-xl text-[10px] font-bold uppercase tracking-widest hover:brightness-110 transition-all disabled:opacity-30 flex items-center justify-center gap-2"
          >
            {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {inviting ? t("vadmin.founders.sending") : t("vadmin.founders.sendInvitation")}
          </button>
        </div>
      </div>
    </div>
  );
}
