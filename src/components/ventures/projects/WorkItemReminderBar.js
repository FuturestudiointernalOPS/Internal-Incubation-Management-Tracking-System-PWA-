"use client";

import React, { useState } from "react";
import { AlertTriangle, Loader2, Mail, Send } from "lucide-react";
import { useApi } from "@/lib/hooks/useApi";
import { useI18n } from "@/lib/i18n";
import { useDialogs } from "@/components/ui/DialogProvider";
import AppButton from "@/components/ui/AppButton";

/**
 * Reminders for ONE work item.
 *
 * Shows exactly who a reminder would reach, and who it could not — because the
 * common case in a tracker is an owner who is only a NAME (Amina, David, Grace),
 * with no account and therefore no address. Reporting "sent" for that would be a
 * lie, so each person is listed with their address or with the reason there is
 * none, and an address can be recorded or changed right here.
 *
 * Recording an address creates NOTHING: no contact, no member, no platform
 * access. It is an address to write to, against the name the tracker wrote.
 */
export default function WorkItemReminderBar({ ventureId, item, onChanged }) {
  const { t } = useI18n();
  const { prompt, alert } = useDialogs();

  const [sending, setSending] = useState(false);
  const [savingEmail, setSavingEmail] = useState(null);
  const [outcome, setOutcome] = useState(null);

  // The recipients a reminder would reach are a READ, so they come through the
  // shared hook like every other read on the platform.
  const { data, loading, refresh } = useApi(
    ventureId && item?.id
      ? `/api/ventures/${ventureId}/reminders?work_item=${encodeURIComponent(item.id)}`
      : null,
    { deps: [ventureId, item?.id], defaultValue: null },
  );
  const recipients = Array.isArray(data?.recipients) ? data.recipients : [];

  /** Add or change the address on file for one assignee name. */
  const setEmail = async (entry, { editing = false } = {}) => {
    const value = await prompt({
      title: t(editing ? "venture.reminders.editEmailTitle" : "venture.reminders.addEmailTitle"),
      message: t(editing ? "venture.reminders.editEmailMessage" : "venture.reminders.addEmailMessage", {
        name: entry.name,
      }),
      hint: t("venture.reminders.addEmailHint"),
      inputLabel: t("venture.reminders.email"),
      inputType: "email",
      placeholder: "name@example.com",
      defaultValue: editing && entry.email ? entry.email : "",
      confirmLabel: t("common.save"),
      required: true,
      validate: (input) =>
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(input || "").trim())
          ? null
          : t("venture.reminders.invalidEmail"),
    });
    if (!value) return;

    const key = `${entry.role}:${entry.name}`;
    setSavingEmail(key);
    setOutcome(null);
    try {
      const res = await fetch(`/api/ventures/${ventureId}/reminders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set_assignee_email", display_name: entry.name, email: value }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok || !payload?.success) {
        await alert({ message: payload?.error || t("errors.generic"), tone: "danger" });
        return;
      }
      refresh();
      onChanged?.();
    } finally {
      setSavingEmail(null);
    }
  };

  const send = async () => {
    setSending(true);
    setOutcome(null);
    try {
      const res = await fetch(`/api/ventures/${ventureId}/reminders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send", work_item: item.id }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok || !payload?.success) {
        await alert({ message: payload?.error || t("errors.generic"), tone: "danger" });
        return;
      }
      setOutcome(payload.outcome);
      refresh();
      onChanged?.();
    } finally {
      setSending(false);
    }
  };

  const list = recipients;
  const reachable = list.filter((entry) => entry.email).length;
  const unreachableCount = Array.isArray(outcome?.unreachable) ? outcome.unreachable.length : 0;

  return (
    <div className="space-y-3 rounded-lg border border-[var(--border-primary)] bg-[var(--surface-1)] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[9px] font-black uppercase tracking-widest text-[var(--text-tertiary)]">
          {t("venture.reminders.title")}
        </p>
        <AppButton
          variant="primary"
          size="sm"
          icon={sending ? Loader2 : Send}
          loading={sending}
          disabled={loading || reachable === 0 || Boolean(savingEmail)}
          onClick={send}
        >
          {t("venture.reminders.send")}
        </AppButton>
      </div>

      {loading ? (
        <p className="text-[10px] text-[var(--text-tertiary)]">{t("common.loading")}</p>
      ) : list.length === 0 ? (
        <p className="text-[10px] text-[var(--text-tertiary)]">{t("venture.reminders.noPeople")}</p>
      ) : (
        <ul className="space-y-1.5">
          {list.map((entry) => {
            const rowKey = `${entry.role}:${entry.name}`;
            const busy = savingEmail === rowKey;
            return (
              <li key={rowKey} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                <span className="text-[var(--text-primary)] font-semibold">{entry.name}</span>
                <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-[var(--surface-2)] text-[var(--text-tertiary)]">
                  {t(`venture.reminders.role.${entry.role}`)}
                </span>
                {entry.email ? (
                  <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-[var(--text-secondary)] inline-flex items-center gap-1">
                      <Mail className="w-3 h-3" /> {entry.email}
                    </span>
                    <button
                      type="button"
                      disabled={busy || sending}
                      onClick={() => setEmail(entry, { editing: true })}
                      className="text-[9px] font-black uppercase tracking-widest text-[var(--brand-orange)] hover:underline disabled:opacity-50"
                    >
                      {busy ? t("common.loading") : t("venture.reminders.editEmail")}
                    </button>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-400">
                      <AlertTriangle className="w-3 h-3" />
                      {t(`venture.reminders.reason.${entry.reason}`)}
                    </span>
                    <button
                      type="button"
                      disabled={busy || sending}
                      onClick={() => setEmail(entry, { editing: false })}
                      className="text-[9px] font-black uppercase tracking-widest text-[var(--brand-orange)] hover:underline disabled:opacity-50"
                    >
                      {busy ? t("common.loading") : t("venture.reminders.addEmail")}
                    </button>
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {outcome?.no_recipients && (
        <p className="text-[10px] text-amber-400">{t("venture.reminders.nobodyReachable")}</p>
      )}
      {outcome && !outcome.no_recipients && (
        <div className="space-y-1">
          <p className="text-[10px] text-[var(--text-secondary)]">
            {t("venture.reminders.sentCount", { count: outcome.sent })}
            {outcome.failed?.length > 0 && ` · ${t("venture.reminders.failedCount", { count: outcome.failed.length })}`}
            {unreachableCount > 0 && ` · ${t("venture.reminders.skippedNoEmail", { count: unreachableCount })}`}
          </p>
          {outcome.sent > 0 && outcome.failed?.length === 0 ? (
            <p className="text-[10px] text-[var(--text-secondary)]">{t("venture.reminders.sendSuccessHint")}</p>
          ) : null}
          {outcome.failed?.[0]?.error ? (
            <p className="text-[10px] text-amber-400">
              {t("venture.reminders.failedReason", { reason: outcome.failed[0].error })}
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
