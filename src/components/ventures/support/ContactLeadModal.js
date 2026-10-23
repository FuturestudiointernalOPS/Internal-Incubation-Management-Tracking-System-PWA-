"use client";

import { useState } from "react";
import { Loader2, Send } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import AppModal from "@/components/ui/AppModal";

/**
 * Write to the Venture Leads, from inside ImpactOS.
 *
 * WHY NOT mailto. A mailto link hands the message to the founder's own mail
 * client — the platform never learns a message was composed, nothing is logged,
 * and on a machine with no mail client configured the button does nothing at
 * all. This dialog posts the message to the server, which mails every ACTIVE
 * lead through the studio's own transport, so the founder is told what actually
 * happened and the lead can simply hit Reply (the founder's address travels as
 * Reply-To when it is usable).
 *
 * The recipients are chosen by the server from the assignment rows. This dialog
 * cannot name an address, and never tries to.
 */
export default function ContactLeadModal({ ventureId, leads = [], onClose }) {
  const { t } = useI18n();
  const [message, setMessage] = useState("");
  // WHO to write to: every lead by default, or any one of them. The request sends
  // assignment ids only; the server keeps to the active leads.
  const [selected, setSelected] = useState(() => new Set(leads.map((lead) => String(lead.id))));
  const allSelected = leads.length > 0 && leads.every((lead) => selected.has(String(lead.id)));
  const toggleLead = (id) =>
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(String(id))) next.delete(String(id));
      else next.add(String(id));
      return next;
    });
  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(leads.map((lead) => String(lead.id))));
  const chosen = leads.filter((lead) => selected.has(String(lead.id)));
  const leadName = chosen.length === 1 ? chosen[0].name : null;
  const [sending, setSending] = useState(false);
  const [outcome, setOutcome] = useState(null);
  const [error, setError] = useState(null);

  const submit = async (event) => {
    event.preventDefault();
    const text = message.trim();
    if (!text || sending || chosen.length === 0) return;
    setSending(true);
    setError(null);
    setOutcome(null);
    try {
      const response = await fetch(`/api/ventures/${ventureId}/support/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, recipients: chosen.map((lead) => lead.id) }),
      });
      const payload = await response.json().catch(() => ({}));
      if (payload?.success) {
        setOutcome(payload);
        setMessage("");
      } else {
        // The rate limiter answers in plain words; a refusal answers in a key.
        setError(payload?.error || "errors.somethingWrong");
      }
    } catch {
      setError("errors.networkError");
    } finally {
      setSending(false);
    }
  };

  const unreachable = (outcome?.failed || []).filter((entry) => entry.reason === "no_email");
  const notDelivered = (outcome?.failed || []).filter((entry) => entry.reason !== "no_email");

  return (
    <AppModal
      isOpen
      onClose={onClose}
      title={t("venture.support.contactTitle", { name: leadName || t("venture.support.leadFallback") })}
      size="md"
    >
      {outcome ? (
        <div className="space-y-4">
          <p className="text-sm" style={{ color: "var(--text-primary)" }}>
            {t("venture.support.sent", { count: outcome.sent })}
          </p>
          {!outcome.reply_to_used && (
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
              {t("venture.support.noReplyTo")}
            </p>
          )}
          {unreachable.length > 0 && (
            <p className="text-xs" style={{ color: "var(--stf-warn)" }}>
              {t("venture.support.someUnreachable", {
                names: unreachable.map((entry) => entry.name).filter(Boolean).join(", ") || "—",
              })}
            </p>
          )}
          {notDelivered.length > 0 && (
            <p className="text-xs" style={{ color: "var(--stf-crit)" }}>
              {t("venture.support.someFailed", {
                names: notDelivered.map((entry) => entry.name).filter(Boolean).join(", ") || "—",
              })}
            </p>
          )}
          <div className="flex justify-end">
            <button type="button" className="stf-btn" onClick={onClose}>
              {t("common.close")}
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
            {t("venture.support.contactHint")}
          </p>
          {leads.length > 1 && (
            <fieldset className="space-y-2">
              <legend className="stf-k mb-1">{t("venture.support.recipients")}</legend>
              <label className="flex items-center gap-2 text-sm font-semibold">
                <input type="checkbox" checked={allSelected} onChange={toggleAll} />
                {t("venture.support.everyone", { count: leads.length })}
              </label>
              {leads.map((lead) => (
                <label key={lead.id} className="flex items-center gap-2 text-sm pl-5">
                  <input type="checkbox" checked={selected.has(String(lead.id))} onChange={() => toggleLead(lead.id)} />
                  <span>{lead.name || t("venture.support.unnamed")}</span>
                  {!lead.reachable && (
                    <span className="text-[11px]" style={{ color: "var(--stf-warn)" }}>{t("venture.support.noEmail")}</span>
                  )}
                </label>
              ))}
              {chosen.length === 0 && (
                <p className="text-xs" style={{ color: "var(--stf-crit)" }}>{t("venture.support.chooseRecipient")}</p>
              )}
            </fieldset>
          )}
          <textarea
            className="stf-textarea w-full"
            rows={7}
            maxLength={2000}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder={t("venture.support.messagePlaceholder")}
            required
          />
          {error && (
            <p className="text-xs" style={{ color: "var(--stf-crit)" }}>
              {/* A refusal is an i18n key; the rate limiter answers in plain words. */}
              {t(error)}
            </p>
          )}
          <div className="flex items-center justify-between gap-3">
            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--text-tertiary)" }}>
              {message.trim().length} / 2000
            </span>
            <span className="flex gap-2">
              <button type="button" className="stf-btn rj" onClick={onClose} disabled={sending}>
                {t("common.cancel")}
              </button>
              <button type="submit" className="stf-btn" disabled={sending || !message.trim() || chosen.length === 0}>
                {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                {t("venture.support.send")}
              </button>
            </span>
          </div>
        </form>
      )}
    </AppModal>
  );
}
