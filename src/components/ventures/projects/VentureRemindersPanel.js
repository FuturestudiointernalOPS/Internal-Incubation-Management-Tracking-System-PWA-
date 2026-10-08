"use client";

import React, { useState } from "react";
import { BellRing, Loader2, Plus, Trash2 } from "lucide-react";
import { useApi } from "@/lib/hooks/useApi";
import { useI18n } from "@/lib/i18n";
import { useDialogs } from "@/components/ui/DialogProvider";
import AppButton from "@/components/ui/AppButton";
import AppSelect from "@/components/ui/AppSelect";
import AppModal from "@/components/ui/AppModal";

/**
 * Automatic reminders for ONE Venture: the rules, and what has been sent.
 *
 * `days_before` is editable on every rule because it is a setting — nothing here
 * hardcodes "3 days". The trigger and the recipients are the rule's own, and a
 * rule can be paused without being deleted.
 *
 * History shows manual and automatic sends together, which is the question a
 * manager actually asks: was this chased, when, by whom, did it arrive.
 */
export default function VentureRemindersPanel({ ventureId }) {
  const { t } = useI18n();
  const { confirm, alert } = useDialogs();

  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ trigger: "finish", days_before: 2, work_item_kind: "activity", notify_owner: true, notify_supporting: true });

  const { data, loading, refresh } = useApi(`/api/ventures/${ventureId}/reminders`, {
    deps: [ventureId],
    defaultValue: null,
  });
  const rules = Array.isArray(data?.rules) ? data.rules : [];
  const history = Array.isArray(data?.history) ? data.history : [];

  const post = async (body) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/ventures/${ventureId}/reminders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        await alert({ message: data?.error || t("errors.generic"), tone: "danger" });
        return false;
      }
      refresh();
      return true;
    } finally {
      setBusy(false);
    }
  };

  const addRule = async () => {
    const ok = await post({
      action: "add_rule",
      scope: "venture",
      trigger: form.trigger,
      days_before: Number(form.days_before),
      work_item_kind: form.work_item_kind,
      notify_owner: form.notify_owner,
      notify_supporting: form.notify_supporting,
    });
    if (ok) setAdding(false);
  };

  const addStandard = async () => {
    setBusy(true);
    try {
      await post({ action: "add_rule", scope: "venture", trigger: "start", days_before: 3, notify_owner: true, notify_supporting: true });
      await post({ action: "add_rule", scope: "venture", trigger: "finish", days_before: 2, notify_owner: true, notify_supporting: true });
    } finally {
      setBusy(false);
    }
  };

  const toggleRule = (rule) => post({ action: "toggle_rule", rule_id: rule.id, is_active: !rule.is_active });

  const removeRule = async (rule) => {
    if (!(await confirm({ message: t("venture.reminders.confirmDeleteRule"), tone: "danger" }))) return;
    await post({ action: "delete_rule", rule_id: rule.id });
  };

  const fmt = (value) => (value ? new Date(value).toLocaleString() : "—");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-black text-[var(--text-primary)] flex items-center gap-2">
          <BellRing className="w-4 h-4 text-[var(--brand-orange)]" />
          {t("venture.reminders.rulesTitle")}
        </h2>
        <div className="flex items-center gap-2">
          {rules.length === 0 && !loading && (
            <AppButton variant="secondary" size="sm" icon={BellRing} loading={busy} onClick={addStandard}>
              {t("venture.reminders.addStandard")}
            </AppButton>
          )}
          <AppButton variant="primary" size="sm" icon={Plus} onClick={() => setAdding(true)}>
            {t("venture.reminders.addRule")}
          </AppButton>
        </div>
      </div>

      {loading ? (
        <p className="text-[10px] text-[var(--text-tertiary)]">{t("common.loading")}</p>
      ) : rules.length === 0 ? (
        <p className="text-xs text-[var(--text-secondary)]">{t("venture.reminders.noRules")}</p>
      ) : (
        <ul className="space-y-1.5">
          {rules.map((rule) => (
            <li
              key={rule.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-[var(--border-primary)] bg-[var(--surface-1)] px-3 py-2 text-xs"
            >
              <span className="font-semibold text-[var(--text-primary)]">
                {t("venture.reminders.ruleLine", { days: rule.days_before, trigger: t(`venture.reminders.trigger.${rule.trigger}`) })}
              </span>
              <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-[var(--surface-2)] text-[var(--text-tertiary)]">
                {t(`venture.projects.kind.${rule.work_item_kind || "activity"}`)}
              </span>
              <span className="text-[var(--text-secondary)]">
                {[rule.notify_owner ? t("venture.reminders.role.owner") : null, rule.notify_supporting ? t("venture.reminders.role.supporting") : null]
                  .filter(Boolean)
                  .join(" + ")}
              </span>
              {rule.scope === "work_item" && (
                <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-[var(--surface-2)] text-[var(--text-tertiary)]">
                  {t("venture.reminders.thisItem")}
                </span>
              )}
              <span className="ml-auto flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => toggleRule(rule)}
                  disabled={busy}
                  className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded ${
                    rule.is_active ? "text-emerald-400 hover:bg-emerald-500/10" : "text-[var(--text-tertiary)] hover:bg-[var(--surface-2)]"
                  }`}
                >
                  {rule.is_active ? t("venture.reminders.active") : t("venture.reminders.paused")}
                </button>
                <button
                  type="button"
                  onClick={() => removeRule(rule)}
                  disabled={busy}
                  className="text-rose-400 hover:bg-rose-500/10 p-1 rounded"
                  aria-label={t("common.delete")}
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      <div>
        <h3 className="text-xs font-black uppercase tracking-widest text-[var(--text-secondary)] mb-2">
          {t("venture.reminders.historyTitle")}
        </h3>
        {history.length === 0 ? (
          <p className="text-xs text-[var(--text-tertiary)]">{t("venture.reminders.noHistory")}</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-[var(--border-primary)]">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-[var(--surface-2)] text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                  <th className="p-2">{t("venture.reminders.colWhen")}</th>
                  <th className="p-2">{t("venture.reminders.colWork")}</th>
                  <th className="p-2">{t("venture.reminders.colWhy")}</th>
                  <th className="p-2">{t("venture.reminders.colTo")}</th>
                  <th className="p-2">{t("venture.reminders.colStatus")}</th>
                </tr>
              </thead>
              <tbody>
                {history.slice(0, 40).map((row) => (
                  <tr key={row.id} className="border-t border-[var(--border-primary)]">
                    <td className="p-2 text-[var(--text-secondary)] whitespace-nowrap">{fmt(row.sent_at || row.created_at)}</td>
                    <td className="p-2 text-[var(--text-primary)]">
                      {row.work_item_ref ? <span className="text-[var(--brand-orange)] font-bold mr-1">{row.work_item_ref}</span> : null}
                      <span className="break-words">{row.work_item_title || "—"}</span>
                    </td>
                    <td className="p-2 text-[var(--text-secondary)] whitespace-nowrap">
                      {row.mode === "manual" ? t("venture.reminders.modeManual") : t(`venture.reminders.trigger.${row.trigger}`)}
                    </td>
                    <td className="p-2 text-[var(--text-secondary)]">{row.recipient_email}</td>
                    <td className="p-2 whitespace-nowrap">
                      <span className={row.status === "sent" ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>
                        {row.status === "sent" ? t("venture.reminders.statusSent") : t("venture.reminders.statusFailed")}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AppModal isOpen={adding} onClose={() => setAdding(false)} title={t("venture.reminders.addRule")} size="sm">
        <div className="space-y-4">
          <AppSelect
            label={t("venture.reminders.triggerLabel")}
            value={form.trigger}
            onChange={(event) => setForm({ ...form, trigger: event.target.value })}
            options={[
              { value: "start", label: t("venture.reminders.trigger.start") },
              { value: "finish", label: t("venture.reminders.trigger.finish") },
            ]}
          />
          <AppSelect
            label={t("venture.reminders.kindLabel")}
            value={form.work_item_kind}
            onChange={(event) => setForm({ ...form, work_item_kind: event.target.value })}
            options={[
              { value: "activity", label: t("venture.projects.kind.activity") },
              { value: "milestone", label: t("venture.projects.kind.milestone") },
              { value: "deliverable", label: t("venture.projects.kind.deliverable") },
            ]}
          />
          <label className="block space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider ml-1 text-[var(--text-secondary)]">
              {t("venture.reminders.daysBefore")}
            </span>
            <input
              type="number"
              min={0}
              max={60}
              value={form.days_before}
              onChange={(event) => setForm({ ...form, days_before: event.target.value })}
              className="w-full px-3 py-2 rounded-lg outline-none border bg-[var(--surface-1)] text-sm text-[var(--text-primary)] border-[var(--border-primary)]"
            />
          </label>
          <div className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-wider ml-1 text-[var(--text-secondary)]">
              {t("venture.reminders.recipients")}
            </p>
            {[
              ["notify_owner", t("venture.reminders.role.owner")],
              ["notify_supporting", t("venture.reminders.role.supporting")],
            ].map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 text-xs text-[var(--text-primary)]">
                <input
                  type="checkbox"
                  checked={form[key]}
                  onChange={(event) => setForm({ ...form, [key]: event.target.checked })}
                />
                {label}
              </label>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <AppButton variant="secondary" size="sm" onClick={() => setAdding(false)}>
              {t("common.cancel")}
            </AppButton>
            <AppButton variant="primary" size="sm" icon={busy ? Loader2 : Plus} loading={busy} onClick={addRule}>
              {t("venture.reminders.addRule")}
            </AppButton>
          </div>
        </div>
      </AppModal>
    </div>
  );
}
