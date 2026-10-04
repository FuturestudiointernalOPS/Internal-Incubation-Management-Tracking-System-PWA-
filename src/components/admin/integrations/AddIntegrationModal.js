"use client";

import { useI18n } from "@/lib/i18n";
import { X, Plus, Zap, Webhook, Key } from "lucide-react";

const PROVIDER_NAME_KEYS = {
  google_calendar: "adminMisc.integrations.providerNames.google_calendar",
  google_drive: "adminMisc.integrations.providerNames.google_drive",
  microsoft_outlook: "adminMisc.integrations.providerNames.microsoft_outlook",
  slack: "adminMisc.integrations.providerNames.slack",
  zoom: "adminMisc.integrations.providerNames.zoom",
  microsoft_teams: "adminMisc.integrations.providerNames.microsoft_teams",
};

export default function AddIntegrationModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  form,
  setForm,
  providers,
  t,
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[var(--surface-1)] border border-[var(--border-primary)] rounded-xl w-full max-w-md m-4" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-[var(--border-primary)]">
          <h2 className="text-lg font-black tracking-tight">{t("adminMisc.integrations.addIntegration")}</h2>
          <button onClick={onClose} className="p-2 hover:bg-[var(--surface-2)] rounded-lg"><X size={16} /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-1 block">{t("adminMisc.integrations.provider")}</label>
            <select value={form.provider} onChange={(event) => setForm({ ...form, provider: event.target.value })} className="w-full px-4 py-2.5 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--brand-orange)]">
              <option value="">{t("adminMisc.integrations.selectProvider")}</option>
              {providers.map((provider) => (
                <option key={provider.provider_key} value={provider.provider_key}>{provider.name} ({provider.provider_key})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-1 block">{t("adminMisc.integrations.labelOptional")}</label>
            <input type="text" value={form.label} onChange={(event) => setForm({ ...form, label: event.target.value })} placeholder="Internal label" className="w-full px-4 py-2.5 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg text-sm text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-[var(--brand-orange)]" />
          </div>
          <button onClick={onSubmit} disabled={!form.provider || isSubmitting} className="w-full py-2.5 bg-[var(--brand-orange)] text-black rounded-xl text-sm font-bold hover:opacity-90 disabled:opacity-50 transition-opacity">
            {isSubmitting ? "Connecting..." : "Connect"}
          </button>
        </div>
      </div>
    </div>
  );
}