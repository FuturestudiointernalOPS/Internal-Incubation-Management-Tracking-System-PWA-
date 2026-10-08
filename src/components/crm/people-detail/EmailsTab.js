"use client";

import { Mail } from "lucide-react";
import { formatLabel, formatLocaleDate } from "@/lib/constants";
import { EMAIL_TYPE_KEYS, EMAIL_STATUS_STYLES, EMAIL_STATUS_LABEL_KEYS } from "./constants";

/**
 * Emails tab — the person's history from the SHARED delivery log.
 */
export default function EmailsTab({ emails, t, lang }) {
  return (
    <div className="space-y-4">
      <p className="text-[11px] text-[var(--text-secondary)]">{t("crm.people.emailsDesc")}</p>
      {emails.length === 0 ? (
        <div className="bg-primary border border-[var(--border-primary)] rounded-2xl p-8 text-center">
          <Mail className="w-8 h-8 mx-auto mb-2 text-[var(--text-secondary)]" />
          <p className="text-sm font-bold">{t("crm.people.emailsEmpty")}</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {emails.map((email) => (
            <div key={email.id} className="bg-primary border border-[var(--border-primary)] rounded-xl p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-bold">
                  {EMAIL_TYPE_KEYS.includes(email.email_type)
                    ? t(`crm.emailTypes.${email.email_type}`)
                    : formatLabel(email.email_type)}
                </p>
                <span className={`shrink-0 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full ${EMAIL_STATUS_STYLES[email.status] || "bg-white/5 text-[var(--text-secondary)]"}`}>
                  {EMAIL_STATUS_LABEL_KEYS[email.status] ? t(EMAIL_STATUS_LABEL_KEYS[email.status]) : formatLabel(email.status)}
                </span>
              </div>
              <p className="text-[10px] text-[var(--text-secondary)] mt-1">
                {email.recipient || t("crm.people.emailsNoRecipient")}
                {email.provider ? ` · ${email.provider}` : ""}
                {` · ${formatLocaleDate(email.sent_at || email.created_at, { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" }, lang)}`}
              </p>
              {email.error && (
                <p className="text-[10px] text-rose-400 mt-1">{email.error}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
