"use client";

import React, { useRef, useState } from "react";
import { AlertTriangle, CalendarClock, ChevronDown, Loader2, Mail, Paperclip, Send, Trash2, X } from "lucide-react";
import { useApi } from "@/lib/hooks/useApi";
import { useI18n } from "@/lib/i18n";
import { notify } from "@/lib/notify";
import { useDialogs } from "@/components/ui/DialogProvider";
import AppButton from "@/components/ui/AppButton";
import AppInput from "@/components/ui/AppInput";
import AppSelect from "@/components/ui/AppSelect";
import AppTextarea from "@/components/ui/AppTextarea";
import IdentifyPersonModal from "./IdentifyPersonModal";

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
 *
 * The manager may also WRITE the reminder — its subject, its message — and attach
 * ONE file. Leaving those blank sends the standard wording, which is what most
 * reminders are; filling them in sends their own words unchanged, so a chase can
 * carry the context only the person sending it has.
 */
export default function WorkItemReminderBar({ ventureId, item, onChanged }) {
  const { t } = useI18n();
  const { prompt, alert } = useDialogs();

  const fileInputRef = useRef(null);
  const [sending, setSending] = useState(false);
  const [savingEmail, setSavingEmail] = useState(null);
  const [outcome, setOutcome] = useState(null);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [attachment, setAttachment] = useState(null); // { path, name }
  const [uploading, setUploading] = useState(false);
  const [identifying, setIdentifying] = useState(null);
  // The whole form folds: a work item shows one "Reminder" line until opened.
  const [open, setOpen] = useState(false);
  const [scheduleTrigger, setScheduleTrigger] = useState("finish");
  const [scheduleDays, setScheduleDays] = useState("3");
  const [scheduling, setScheduling] = useState(false);

  // The recipients a reminder would reach are a READ, so they come through the
  // shared hook like every other read on the platform.
  const { data, loading, refresh } = useApi(
    ventureId && item?.id
      ? `/api/ventures/${ventureId}/reminders?work_item=${encodeURIComponent(item.id)}`
      : null,
    { deps: [ventureId, item?.id], defaultValue: null },
  );
  const recipients = Array.isArray(data?.recipients) ? data.recipients : [];
  // Rules written for THIS item: the scheduled reminders the sweep will send.
  const itemRules = (Array.isArray(data?.rules) ? data.rules : []).filter(
    (rule) => rule.scope === "work_item" && `${rule.work_item_kind}:${rule.work_item_id}` === item?.id,
  );

  /** Schedule the reminder N days before the start/finish; the sweep sends it. */
  const schedule = async () => {
    setScheduling(true);
    try {
      const res = await fetch(`/api/ventures/${ventureId}/reminders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_rule",
          scope: "work_item",
          work_item: item.id,
          trigger: scheduleTrigger,
          days_before: Number(scheduleDays),
          notify_owner: true,
          notify_supporting: true,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok || !payload?.success) {
        await alert({ message: t(payload?.error || "errors.somethingWrong"), tone: "danger" });
        return;
      }
      notify("success", t("venture.reminders.scheduledToast", { days: scheduleDays }));
      refresh();
      onChanged?.();
    } finally {
      setScheduling(false);
    }
  };

  const removeRule = async (ruleId) => {
    const res = await fetch(`/api/ventures/${ventureId}/reminders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete_rule", rule_id: ruleId }),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok || !payload?.success) {
      await alert({ message: t(payload?.error || "errors.somethingWrong"), tone: "danger" });
      return;
    }
    refresh();
  };

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
        await alert({ message: t(payload?.error || "errors.somethingWrong"), tone: "danger" });
        return;
      }
      refresh();
      onChanged?.();
    } finally {
      setSavingEmail(null);
    }
  };

  /** Store the ONE file this reminder carries. Uploading is separate from sending. */
  const attachFile = async (file) => {
    if (!file) return;
    setUploading(true);
    setOutcome(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/ventures/${ventureId}/reminders/upload`, { method: "POST", body: form });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok || !payload?.success) {
        await alert({ message: t(payload?.error || "errors.somethingWrong"), tone: "danger" });
        return;
      }
      setAttachment({ path: payload.path, name: payload.name || file.name });
    } finally {
      setUploading(false);
      // So choosing the SAME file again after removing it still fires a change.
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  /**
   * Say out loud what the send did.
   *
   * The block under the recipient list carries the detail, but a manager who
   * pressed Send and looked away must not have to hunt for the answer. A send
   * that reached nobody, or reached some and failed the rest, is reported as a
   * failure — never as a success.
   */
  const announceSend = (result) => {
    if (!result) {
      notify("error", t("errors.somethingWrong"));
      return;
    }
    const sent = Number(result.sent) || 0;
    const failed = Array.isArray(result.failed) ? result.failed.length : 0;

    if (sent > 0) {
      if (failed > 0) {
        notify("error", t("venture.reminders.sentWithFailures", { sent, failed }));
      } else if (result.attachment_dropped) {
        notify("warning", t("venture.reminders.sentWithoutFile", { count: sent }));
      } else {
        notify("success", t("venture.reminders.sentToast", { count: sent }));
      }
      return;
    }
    if (failed > 0) {
      notify("error", t("venture.reminders.sendFailed"));
      return;
    }
    notify("error", t("venture.reminders.nobodyReachable"));
  };

  const send = async () => {
    setSending(true);
    setOutcome(null);
    try {
      const res = await fetch(`/api/ventures/${ventureId}/reminders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send",
          work_item: item.id,
          subject: subject.trim() || null,
          body: message.trim() || null,
          attachment_path: attachment?.path || null,
          attachment_name: attachment?.name || null,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok || !payload?.success) {
        await alert({ message: t(payload?.error || "errors.somethingWrong"), tone: "danger" });
        return;
      }
      setOutcome(payload.outcome);
      // The words and the file went out with the message — clearing them keeps
      // the next send from silently repeating them.
      setSubject("");
      setMessage("");
      setAttachment(null);
      refresh();
      onChanged?.();
      announceSend(payload.outcome);
    } catch {
      // A request that never completed has no payload to report: say so instead
      // of letting the button fall back to idle with nothing shown.
      await alert({ message: t("venture.reminders.sendFailed"), tone: "danger" });
    } finally {
      setSending(false);
    }
  };

  const list = recipients;
  const reachable = list.filter((entry) => entry.email).length;
  const unreachableCount = Array.isArray(outcome?.unreachable) ? outcome.unreachable.length : 0;
  const busy = sending || uploading;

  return (
    <div className="rounded-lg border border-[var(--border-primary)] bg-[var(--surface-1)] p-3">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <span className="text-[9px] font-black uppercase tracking-widest text-[var(--text-tertiary)]">
          {t("venture.reminders.title")}
          {itemRules.length > 0 ? ` · ${itemRules.length}` : ""}
        </span>
        <ChevronDown className={`w-4 h-4 text-[var(--text-tertiary)] transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
    <div className="space-y-3 pt-3">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <AppButton
          variant="primary"
          size="sm"
          icon={sending ? Loader2 : Send}
          loading={sending}
          disabled={loading || reachable === 0 || Boolean(savingEmail) || uploading}
          onClick={send}
        >
          {t("venture.reminders.send")}
        </AppButton>
      </div>

      {/* SCHEDULE — N days before, sent by the sweep, with the date added to the
          recipient's calendar (.ics + Google Calendar link in the mail). */}
      <div className="space-y-2 rounded-lg border border-[var(--border-primary)] p-3">
        <p className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-[var(--text-tertiary)]">
          <CalendarClock className="w-3 h-3" /> {t("venture.reminders.scheduleTitle")}
        </p>
        <div className="grid grid-cols-2 gap-3">
          <AppSelect
            label={t("venture.reminders.scheduleTrigger")}
            value={scheduleTrigger}
            onChange={(event) => setScheduleTrigger(event.target.value)}
            options={[
              { value: "finish", label: t("venture.reminders.triggerFinish") },
              { value: "start", label: t("venture.reminders.triggerStart") },
            ]}
          />
          <AppInput
            label={t("venture.reminders.scheduleDays")}
            type="number"
            min={1}
            max={60}
            value={scheduleDays}
            onChange={(event) => setScheduleDays(event.target.value)}
          />
        </div>
        <AppButton variant="secondary" size="sm" icon={scheduling ? Loader2 : CalendarClock} loading={scheduling} disabled={scheduling || !scheduleDays} onClick={schedule}>
          {t("venture.reminders.schedule")}
        </AppButton>
        <p className="text-[10px] text-[var(--text-tertiary)]">{t("venture.reminders.calendarHint")}</p>
        {itemRules.map((rule) => (
          <div key={rule.id} className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
            <span>{t("venture.reminders.ruleLine", { days: rule.days_before, trigger: t(rule.trigger === "start" ? "venture.reminders.triggerStart" : "venture.reminders.triggerFinish") })}</span>
            <button type="button" aria-label={t("common.delete")} onClick={() => removeRule(rule.id)} className="text-rose-400">
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>

      {/* The reminder goes TO the owner (and supporting people); a copy also
          reaches whoever runs the Venture, so a chase is never invisible to the
          Lead Manager. Only an activity carries that copy. */}
      {item?.kind === "activity" ? (
        <p className="text-[10px] text-[var(--text-tertiary)]">{t("venture.reminders.ccHint")}</p>
      ) : null}

      {/* WHAT THE MESSAGE SAYS — blank means the standard wording. */}
      <div className="grid grid-cols-1 gap-3">
        <AppInput
          label={t("venture.reminders.subjectLabel")}
          value={subject}
          placeholder={t("venture.reminders.subjectPlaceholder")}
          disabled={busy}
          onChange={(event) => setSubject(event.target.value)}
        />
        <AppTextarea
          label={t("venture.reminders.messageLabel")}
          rows={3}
          value={message}
          placeholder={t("venture.reminders.messagePlaceholder")}
          disabled={busy}
          onChange={(event) => setMessage(event.target.value)}
        />

        {/* ONE FILE — chosen by the picker, stored before the send. */}
        <div className="space-y-1">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg"
            className="hidden"
            onChange={(event) => attachFile(event.target.files?.[0])}
          />
          {attachment ? (
            <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
              <span className="inline-flex items-center gap-1 text-[var(--text-secondary)]">
                <Paperclip className="w-3 h-3" /> {attachment.name}
              </span>
              <button
                type="button"
                disabled={busy}
                onClick={() => setAttachment(null)}
                className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-rose-400 hover:underline disabled:opacity-50"
              >
                <X className="w-3 h-3" /> {t("venture.reminders.removeAttachment")}
              </button>
            </span>
          ) : (
            <AppButton
              variant="secondary"
              size="sm"
              icon={uploading ? Loader2 : Paperclip}
              loading={uploading}
              disabled={busy}
              onClick={() => fileInputRef.current?.click()}
            >
              {t("venture.reminders.attachFile")}
            </AppButton>
          )}
          <p className="text-[10px] text-[var(--text-tertiary)]">{t("venture.reminders.attachHint")}</p>
        </div>
      </div>

      {loading ? (
        <p className="text-[10px] text-[var(--text-tertiary)]">{t("common.loading")}</p>
      ) : list.length === 0 ? (
        <p className="text-[10px] text-[var(--text-tertiary)]">{t("venture.reminders.noPeople")}</p>
      ) : (
        <ul className="space-y-1.5">
          {list.map((entry) => {
            const rowKey = `${entry.role}:${entry.name}`;
            const rowBusy = savingEmail === rowKey;
            return (
              <li key={rowKey} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                <span className="text-[var(--text-primary)] font-semibold">{entry.name}</span>
                <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-[var(--surface-2)] text-[var(--text-tertiary)]">
                  {t(`venture.reminders.role.${entry.role}`)}
                </span>
                {entry.email ? (
                  <span className="inline-flex flex-col gap-y-0.5">
                    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="text-[var(--text-secondary)] inline-flex items-center gap-1">
                        <Mail className="w-3 h-3" /> {entry.email}
                      </span>
                      {entry.cid ? (
                        // The address comes from the person's own record, so editing
                        // one here would change nothing. The People screen is where
                        // this person is identified or let go.
                        <span className="text-[9px] font-black uppercase tracking-widest text-[var(--text-tertiary)]">
                          {t("venture.people.fromRecord")}
                        </span>
                      ) : (
                        <button
                          type="button"
                          disabled={rowBusy || busy}
                          onClick={() => setEmail(entry, { editing: true })}
                          className="text-[9px] font-black uppercase tracking-widest text-[var(--brand-orange)] hover:underline disabled:opacity-50"
                        >
                          {rowBusy ? t("common.loading") : t("venture.reminders.editEmail")}
                        </button>
                      )}
                    </span>
                    {entry.alternative_email ? (
                      <span className="text-[10px] text-amber-400">
                        {t("venture.people.alternative", { email: entry.alternative_email })}
                      </span>
                    ) : null}
                  </span>
                ) : (
                  <span className="inline-flex flex-wrap items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-400">
                      <AlertTriangle className="w-3 h-3" />
                      {t(`venture.reminders.reason.${entry.reason}`)}
                    </span>
                    <button
                      type="button"
                      disabled={rowBusy || busy}
                      onClick={() => setEmail(entry, { editing: false })}
                      className="text-[9px] font-black uppercase tracking-widest text-[var(--brand-orange)] hover:underline disabled:opacity-50"
                    >
                      {rowBusy ? t("common.loading") : t("venture.reminders.addEmail")}
                    </button>
                    {/* An address typed by hand is a workaround; naming the
                        PERSON is the fix, and it makes every mention of their
                        name reachable at once. Offered wherever the identity is
                        what is missing or broken — never where the recorded
                        address is simply unusable, which is an edit. */}
                    {entry.reason !== "invalid_on_file" && (
                      <button
                        type="button"
                        disabled={rowBusy || busy}
                        onClick={() => setIdentifying(entry)}
                        className="text-[9px] font-black uppercase tracking-widest text-[var(--brand-orange)] hover:underline disabled:opacity-50"
                      >
                        {t("venture.reminders.identifyPerson")}
                      </button>
                    )}
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
          {outcome.attachment_dropped ? (
            <p className="text-[10px] text-amber-400">{t("venture.reminders.attachmentDropped")}</p>
          ) : null}
        </div>
      )}

    </div>
      )}

      {identifying && (
        <IdentifyPersonModal
          ventureId={ventureId}
          person={identifying}
          onClose={() => setIdentifying(null)}
          onIdentified={() => {
            refresh();
            onChanged?.();
          }}
        />
      )}
    </div>
  );
}
