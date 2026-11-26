"use client";

import { MessageCircle } from "lucide-react";
import { useI18n } from "@/lib/i18n";

/**
 * WhatsApp action for one contact.
 *
 * The decision is NOT taken here: the API sends the contact with a
 * `whatsapp` object ({ allowed, reason, number }) computed by the shared rule,
 * so this button can never offer a conversation the platform would refuse.
 *
 * Allowed → a `wa.me` link: WhatsApp opens with the number and a short,
 * editable message prefilled. The person sends it from their own phone, which
 * is why no server credential and no approved template are involved.
 * Refused → a disabled control whose tooltip carries the reason.
 */
export default function WhatsAppAction({ contact, compact = false }) {
  const { t } = useI18n();

  const state = contact?.whatsapp || null;
  const allowed = Boolean(state?.allowed && state?.number);

  const message = t("crm.whatsapp.defaultMessage", { name: contact?.name || "" });
  const href = allowed
    ? `https://wa.me/${String(state.number).replace(/\D/g, "")}?text=${encodeURIComponent(message)}`
    : null;

  const reasonKey = {
    no_consent: "crm.whatsapp.consentRequired",
    invalid_phone: "crm.whatsapp.invalidPhone",
    inactive: "crm.whatsapp.inactive",
    no_contact: "crm.whatsapp.inactive",
  }[state?.reason] || "crm.whatsapp.unavailable";

  const title = allowed ? t("crm.whatsapp.open") : t(reasonKey);

  if (allowed) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        title={title}
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
        className={
          compact
            ? "inline-flex p-2.5 rounded-lg border border-[var(--border-primary)] text-emerald-500 hover:border-emerald-500/40 hover:text-emerald-400 transition-all"
            : "inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--border-primary)] text-emerald-500 text-[10px] font-bold uppercase tracking-widest hover:border-emerald-500/40 hover:text-emerald-400 transition-colors"
        }
      >
        <MessageCircle className="w-4 h-4" />
        {!compact && t("crm.whatsapp.title")}
      </a>
    );
  }

  return (
    <button
      type="button"
      disabled
      title={title}
      aria-label={title}
      className={
        compact
          ? "inline-flex p-2.5 rounded-lg border border-[var(--border-primary)] text-[var(--text-tertiary)] opacity-50 cursor-not-allowed"
          : "inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--border-primary)] text-[var(--text-tertiary)] text-[10px] font-bold uppercase tracking-widest opacity-50 cursor-not-allowed"
      }
    >
      <MessageCircle className="w-4 h-4" />
      {!compact && t("crm.whatsapp.title")}
    </button>
  );
}
