"use client";

import { Send, X } from "lucide-react";

/** The bulk-invite modal: type addresses, preview who they are, then invite. */
export default function InviteFacilitatorsModal({
  t,
  emailCount,
  inviteEmails,
  setInviteEmails,
  invitePreview,
  inviteResults,
  previewing,
  inviting,
  onPreview,
  onInviteAll,
  onClose,
}) {
  return (
    <div className="fixed inset-0 z-[600] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black text-[var(--text-primary)] tracking-tight">{t("pmMisc.facilitators.inviteModalTitle")}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)]"><X className="w-4 h-4" /></button>
        </div>
        <p className="text-[10px] text-[var(--text-secondary)]">{t("pmMisc.facilitators.inviteModalDescription")}</p>
        <textarea
          value={inviteEmails}
          onChange={(event) => setInviteEmails(event.target.value)}
          placeholder={t("pmMisc.facilitators.inviteEmailsPlaceholder")}
          rows={5}
          className="w-full bg-primary border border-[var(--border-primary)] rounded-xl px-3 py-3 text-[11px] font-bold outline-none focus:border-[var(--brand-orange)] resize-y"
        />
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={onPreview}
            disabled={previewing || !emailCount}
            className="px-3 py-2 rounded-lg bg-secondary border border-[var(--border-primary)] text-[10px] font-bold uppercase text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-40"
          >
            {t("pmMisc.facilitators.review")}
          </button>
          <p className="text-[10px] font-medium text-[var(--text-secondary)] text-right">
            {t("pmMisc.facilitators.defaultAccess")} <strong className="text-[var(--text-primary)]">{t("pmMisc.facilitators.fullAccess")}</strong>
          </p>
        </div>

        {invitePreview.length > 0 && !inviteResults && (
          <div className="space-y-2">
            {invitePreview.map((result) => (
              <div key={result.email} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-[var(--border-primary)] bg-primary">
                <div className="min-w-0">
                  <p className="text-[10px] font-bold truncate">{result.email}</p>
                  {result.name && <p className="text-[10px] font-medium text-[var(--text-secondary)]">{result.name}</p>}
                </div>
                <span className={`shrink-0 text-[10px] font-bold uppercase px-2 py-0.5 rounded ${result.status === "conflict" || result.status === "invalid" || result.status === "already_facilitator" ? "bg-rose-500/10 text-rose-400" : "bg-emerald-500/10 text-emerald-400"}`}>
                  {t(`pmMisc.facilitators.inviteStatus_${result.status}`) || result.status}
                </span>
              </div>
            ))}
          </div>
        )}

        {inviteResults && (
          <div className="space-y-2">
            {inviteResults.map((result) => (
              <div key={result.email} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-[var(--border-primary)] bg-primary">
                <div className="min-w-0">
                  <p className="text-[10px] font-bold truncate">{result.name || result.email}</p>
                  <p className="text-[10px] font-medium text-[var(--text-secondary)] truncate">{result.email}</p>
                </div>
                <span className={`shrink-0 text-[10px] font-bold uppercase px-2 py-0.5 rounded ${result.status === "invited" || result.status === "activation_sent" ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"}`}>
                  {t(`pmMisc.facilitators.inviteStatus_${result.status}`) || result.status}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl bg-secondary border border-[var(--border-primary)] text-[10px] font-bold uppercase text-[var(--text-secondary)]">
            {t("pmMisc.facilitators.cancel")}
          </button>
          {!inviteResults && (
            <button
              onClick={onInviteAll}
              disabled={inviting || !emailCount}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--brand-orange)] text-black text-[10px] font-bold uppercase tracking-wide disabled:opacity-40"
            >
              <Send className="w-3.5 h-3.5" /> {t("pmMisc.facilitators.inviteAll")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
