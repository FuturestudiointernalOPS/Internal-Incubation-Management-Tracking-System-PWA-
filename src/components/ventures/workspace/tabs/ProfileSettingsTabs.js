"use client";

import { Save, Loader2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useVenture } from "../VentureContext";
import { STAGES, INDUSTRY_FALLBACK, VISIBILITIES } from "../ventureMeta";
import CountrySelect from "@/components/ventures/CountrySelect";
import { countryName } from "@/lib/countries";

/* Profile Tab */
export function ProfileTab() {
  const { t } = useI18n();
  const { form, setForm, saving, handleSave, optionLists, inputStyle, cardStyle } = useVenture();
  return (
    <form onSubmit={handleSave} className="space-y-6">
      <div className="rounded-xl p-6 space-y-4 border" style={cardStyle}>
        <div>
          <label className="block text-sm font-medium mb-1">{t("venture.namePlaceholder")}</label>
          <input value={form.name} onChange={e => setForm({...form, name: e.target.value})}
            className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} required />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">{t("venture.description")}</label>
          <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})}
            className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} rows={3} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">{t("venture.mission")}</label>
            <textarea value={form.mission} onChange={e => setForm({...form, mission: e.target.value})}
              className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} rows={2} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t("venture.vision")}</label>
            <textarea value={form.vision} onChange={e => setForm({...form, vision: e.target.value})}
              className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} rows={2} />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">{t("venture.industry")}</label>
            <input list="venture-industry-options" value={form.industry} onChange={e => setForm({...form, industry: e.target.value})}
              className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} />
            <datalist id="venture-industry-options">
              {(optionLists.industry && optionLists.industry.length ? optionLists.industry : INDUSTRY_FALLBACK).map(i => <option key={i} value={i} />)}
            </datalist>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t("venture.sector")}</label>
            <input value={form.sector} onChange={e => setForm({...form, sector: e.target.value})}
              className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">{t("venture.businessStage")}</label>
          <select value={form.business_stage} onChange={e => setForm({...form, business_stage: e.target.value})}
            className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle}>
            {(optionLists.business_stage && optionLists.business_stage.length ? optionLists.business_stage : STAGES).map(s => <option key={s} value={s}>{t(`venture.stages.${s}`) || s}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">{t("venture.website")}</label>
          <input value={form.website} onChange={e => setForm({...form, website: e.target.value})}
            className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} placeholder="https://" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">{t("venture.country")}</label>
            <CountrySelect
              value={form.country_code || form.country}
              inputStyle={inputStyle}
              onSelect={(code, name) => setForm({ ...form, country_code: code, country: name })}
            />
            {!form.country_code && form.country && (
              <p className="text-[9px] mt-1" style={{ color: "var(--text-tertiary)" }}>
                Saved as “{countryName(form.country)}” — re-select to store a stable country code.
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t("venture.registrationStatus")}</label>
            <select value={form.registration_status} onChange={e => setForm({...form, registration_status: e.target.value})}
              className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle}>
              <option value="">—</option>
              <option value="Not registered">{t("venture.registrationOptions.notRegistered")}</option>
              <option value="Registered">{t("venture.registrationOptions.registered")}</option>
              <option value="Pending registration">{t("venture.registrationOptions.pendingRegistration")}</option>
            </select>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">{t("venture.socialMedia")}</label>
          <div className="space-y-2">
            {[
              { key: "linkedin", label: "LinkedIn", ph: "https://www.linkedin.com/company/example" },
              { key: "instagram", label: "Instagram", ph: "https://www.instagram.com/example" },
              { key: "twitter", label: "X", ph: "https://x.com/example" },
              { key: "facebook", label: "Facebook", ph: "https://www.facebook.com/example" },
            ].map((s) => (
              <div key={s.key} className="flex items-center gap-2">
                <span className="w-24 shrink-0 text-xs" style={{ color: "var(--text-secondary)" }}>{s.label}</span>
                <input
                  type="url"
                  value={form[s.key] || ""}
                  onChange={e => setForm({ ...form, [s.key]: e.target.value })}
                  className="flex-1 px-3 py-2 rounded-lg outline-none border text-sm"
                  style={inputStyle}
                  placeholder={s.ph}
                />
              </div>
            ))}
            <p className="text-[9px]" style={{ color: "var(--text-tertiary)" }}>
              {t("venture.socialPasteUrl") || "Paste the full link to your page — no @username needed."}
            </p>
          </div>
        </div>
      </div>
      <div className="flex justify-end pt-4 border-t" style={{ borderColor: "rgb(255 255 255 / 0.1)" }}>
        <button type="submit" disabled={saving}
          className="flex items-center gap-2 px-6 py-2 rounded-lg text-white disabled:opacity-50 transition-colors"
          style={{ backgroundColor: "var(--brand-orange)" }}>
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {saving ? t("venture.saving") : t("venture.save")}
        </button>
      </div>
    </form>
  );
}

/* Settings Tab */
export function SettingsTab() {
  const { t } = useI18n();
  const { form, setForm, saving, handleSave, optionLists, inputStyle, cardStyle } = useVenture();
  return (
    <form onSubmit={handleSave} className="space-y-6">
      <div className="rounded-xl p-6 space-y-4 border" style={cardStyle}>
        <div>
          <label className="block text-sm font-medium mb-1">{t("venture.status")}</label>
          <p className="text-xs mb-2" style={{ color: "var(--text-secondary)" }}>{t("venture.statusManagedByStaff") || "Status is managed by Future Studio staff."}</p>
          <span className="inline-block text-xs px-2.5 py-1 rounded-full font-medium" style={{ backgroundColor: "rgb(255 255 255 / 0.06)", border: "1px solid rgb(255 255 255 / 0.12)" }}>
            {t(`venture.statuses.${form.status}`) || form.status}
          </span>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">{t("venture.visibility")}</label>
          <select value={form.visibility} onChange={e => setForm({...form, visibility: e.target.value})}
            className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle}>
            {VISIBILITIES.map(v => <option key={v} value={v}>{t(`venture.visibilityOptions.${v}`)}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">{t("venture.language")}</label>
          <select value={form.language} onChange={e => setForm({...form, language: e.target.value})}
            className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle}>
            <option value="en">English</option><option value="fr">Français</option>
          </select>
        </div>
      </div>
      <div className="flex justify-end pt-4 border-t" style={{ borderColor: "rgb(255 255 255 / 0.1)" }}>
        <button type="submit" disabled={saving}
          className="flex items-center gap-2 px-6 py-2 rounded-lg text-white disabled:opacity-50 transition-colors"
          style={{ backgroundColor: "var(--brand-orange)" }}>
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {saving ? t("venture.saving") : t("venture.save")}
        </button>
      </div>
    </form>
  );
}
