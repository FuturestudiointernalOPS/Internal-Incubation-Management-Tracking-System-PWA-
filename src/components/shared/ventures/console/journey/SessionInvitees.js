"use client";

import React, { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { Loader2, Mail, Plus, X } from "lucide-react";

/**
 * The invitees of ONE booked session: who was told by e-mail, with the two
 * controls the manager needs — add an address, remove one.
 *
 * A guest need not have an ImpactOS account: the invitation is an e-mail. When
 * the address does belong to an account that connected its calendar, the session
 * is pushed to that calendar too (the server decides; this only asks).
 *
 * Self-contained: it owns its input, speaks to the sessions route and tells the
 * panel to refresh (`onChanged`) after a write.
 */
export default function SessionInvitees({ ventureId, session }) {
  const { t } = useI18n();
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  // Local state, seeded from the read: an invite/edit is reflected immediately
  // without a panel-wide refresh round-trip.
  const [invitees, setInvitees] = useState(session.invitees || []);

  const add = async () => {
    const email = draft.trim();
    if (!email || busy) return;
    setBusy(true);
    setFailed(false);
    try {
      const res = await fetch(`/api/ventures/${ventureId}/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add_invitee", session_id: session.id, email }),
      });
      const payload = await res.json().catch(() => ({}));
      if (payload.success) {
        setDraft("");
        if (payload.invitee) {
          const added = payload.invitee;
          setInvitees((prev) => {
            const rest = prev.filter((candidate) => String(candidate.id) !== String(added.id) && candidate.email !== added.email);
            return [...rest, added];
          });
        }
      } else {
        setFailed(true);
      }
    } catch (_) {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (invitee) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/ventures/${ventureId}/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "remove_invitee", invitee_id: invitee.id }),
      });
      const payload = await res.json().catch(() => ({}));
      if (payload.success) setInvitees((prev) => prev.filter((candidate) => String(candidate.id) !== String(invitee.id)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-1">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-slate-500">
          <Mail className="w-3 h-3" /> {t("venture.manager.invitees")}
        </span>
        {invitees.length === 0 && <span className="text-[9px] text-slate-500">—</span>}
        {invitees.map((invitee) => (
          <span key={invitee.id} className="flex items-center gap-1 rounded-full border border-[var(--border-primary)] px-2 py-0.5 text-[9px] text-[var(--text-secondary)]">
            {invitee.name ? `${invitee.name} · ` : ""}{invitee.email}
            <button type="button" aria-label={t("venture.manager.inviteeRemove", { email: invitee.email })} onClick={() => remove(invitee)} disabled={busy} className="text-slate-500 hover:text-[var(--text-primary)]">
              <X className="w-2.5 h-2.5" />
            </button>
          </span>
        ))}
      </div>
      <div className="mt-1 flex items-center gap-1.5">
        <input
          type="email"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); add(); } }}
          placeholder={t("venture.manager.inviteePlaceholder")}
          className="flex-1 min-w-0 px-2 py-1 rounded-lg outline-none border bg-[var(--surface-1)] text-[10px] text-[var(--text-primary)]"
        />
        <button type="button" onClick={add} disabled={busy || !draft.trim()} className="shrink-0 flex items-center gap-1 text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg border border-[var(--border-primary)] text-[var(--brand-orange)] disabled:opacity-50">
          {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />} {t("venture.manager.inviteeAdd")}
        </button>
      </div>
      {failed && <p className="mt-0.5 text-[9px] text-red-500">{t("venture.manager.inviteeFailed")}</p>}
    </div>
  );
}
