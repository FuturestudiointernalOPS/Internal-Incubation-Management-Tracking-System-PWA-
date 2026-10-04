"use client";

import { useI18n } from "@/lib/i18n";
import { X, Plus, Zap, Webhook, Key, Trash2 } from "lucide-react";

const WEBHOOK_EVENT_OPTIONS = [
  "startup.created",
  "project.updated",
  "mentoring.session_completed",
  "investment.match_created",
  "document.uploaded",
  "notification.sent",
  "verification.approved",
];

export default function AddWebhookModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  form,
  setForm,
  t,
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[var(--surface-1)] border border-[var(--border-primary)] rounded-xl w-full max-w-lg m-4" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-[var(--border-primary)]">
          <h2 className="text-lg font-black tracking-tight">{t("adminMisc.integrations.createWebhook")}</h2>
          <button onClick={onClose} className="p-2 hover:bg-[var(--surface-2)] rounded-lg"><X size={16} /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-1 block">{t("adminMisc.integrations.nameRequired")}</label>
            <input type="text" value={form.name} onChange={(event) => { /* handled by parent */ }} placeholder="My Webhook" className="w-full px-4 py-2.5 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg text-sm text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-[var(--brand-orange)]" />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-1 block">{t("adminMisc.integrations.callbackUrlRequired")}</label>
            <input type="url" value={form.url} onChange={(event) => { /* handled by parent */ }} placeholder="https://hooks.example.com/notify" className="w-full px-4 py-2.5 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg text-sm text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-[var(--brand-orange)]" />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-1 block">{t("adminMisc.integrations.secretOptional")}</label>
            <input type="text" value={form.secret} onChange={(event) => { /* handled by parent */ }} placeholder="webhook_secret_123" className="w-full px-4 py-2.5 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg text-sm text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-[var(--brand-orange)]" />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-1 block">{t("adminMisc.integrations.eventsRequired")}</label>
            <div className="flex flex-wrap gap-2">
              {["startup.created", "project.updated", "mentoring.session_completed", "investment.match_created", "document.uploaded", "notification.sent", "verification.approved"].map((webhookEvent) => (
                <button key={webhookEvent} onClick={() => { /* handled by parent */ }} className={`text-[10px] font-bold uppercase px-3 py-1.5 rounded-lg border transition-colors`}>
                  {webhookEvent}
                </button>
              ))}
            </div>
          </div>
          <button disabled className="w-full py-2.5 bg-[var(--brand-orange)] text-black rounded-xl text-sm font-bold hover:opacity-90 disabled:opacity-50 transition-opacity">
            {t("adminMisc.integrations.createWebhook")}
          </button>
        </div>
      </div>
    </div>
  );
}