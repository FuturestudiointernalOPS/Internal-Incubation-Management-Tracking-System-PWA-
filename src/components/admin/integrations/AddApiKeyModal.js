"use client";

import { useI18n } from "@/lib/i18n";
import { X, Plus, Copy, Trash2, AlertCircle, Zap } from "lucide-react";

const API_SCOPES = [
  "ventures:read", "ventures:write",
  "projects:read", "projects:write",
  "founders:read", "founders:write",
  "documents:read", "documents:write",
  "investment:read",
  "webhooks:manage",
  "*",
];

export default function AddApiKeyModal({
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
          <h2 className="text-lg font-black tracking-tight">{t("adminMisc.integrations.generateApiKey")}</h2>
          <button onClick={onClose} className="p-2 hover:bg-[var(--surface-2)] rounded-lg"><X size={16} /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-1 block">{t("adminMisc.integrations.nameRequired")}</label>
            <input type="text" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder={t("adminMisc.integrations.apiKeyNamePlaceholder")} className="w-full px-4 py-2.5 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg text-sm text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-[var(--brand-orange)]" />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-1 block">{t("adminMisc.integrations.description")}</label>
            <textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder={t("adminMisc.integrations.descriptionPlaceholder")} rows={2} className="w-full px-4 py-2.5 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg text-sm text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-[var(--brand-orange)]" />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-1 block">{t("adminMisc.integrations.scopesRequired")}</label>
            <div className="flex flex-wrap gap-2">
              {["ventures:read", "ventures:write", "projects:read", "projects:write", "founders:read", "founders:write", "documents:read", "documents:write", "investment:read", "webhooks:manage", "*"].map((scope) => (
                <button key={scope} onClick={() => { /* handled by parent */ }} className={`text-[10px] font-bold uppercase px-3 py-1.5 rounded-lg border transition-colors`}>
                  {scope}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-1 block">{t("adminMisc.integrations.expiresAtOptional")}</label>
            <input type="datetime-local" className="w-full px-4 py-2.5 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--brand-orange)]" />
          </div>
          <button disabled className="w-full py-2.5 bg-[var(--brand-orange)] text-black rounded-xl text-sm font-bold hover:opacity-90 disabled:opacity-50 transition-opacity">
            {t("adminMisc.integrations.generateKey")}
          </button>
        </div>
      </div>
    </div>
  );
}