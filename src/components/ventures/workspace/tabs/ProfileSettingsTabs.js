"use client";

import { Save, Loader2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useVenture } from "../VentureContext";
import { STAGES, INDUSTRY_FALLBACK } from "../ventureMeta";
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
          <input value={form.name} onChange={event => setForm({...form, name: event.target.value})}
            className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} required />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">{t("venture.description")}</label>
          <textarea value={form.description} onChange={event => setForm({...form, description: event.target.value})}
            className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} rows={3} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">{t("venture.mission")}</label>
            <textarea value={form.mission} onChange={event => setForm({...form, mission: event.target.value})}
              className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} rows={2} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t("venture.vision")}</label>
            <textarea value={form.vision} onChange={event => setForm({...form, vision: event.target.value})}
              className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} rows={2} />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">{t("venture.industry")}</label>
            <input list="venture-industry-options" value={form.industry} onChange={event => setForm({...form, industry: event.target.value})}
              className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} />
            <datalist id="venture-industry-options">
              {(optionLists.industry && optionLists.industry.length ? optionLists.industry : INDUSTRY_FALLBACK).map(industry => <option key={industry} value={industry} />)}
            </datalist>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t("venture.sector")}</label>
            <input value={form.sector} onChange={event => setForm({...form, sector: event.target.value})}
              className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">{t("venture.businessStage")}</label>
          <select value={form.business_stage} onChange={event => setForm({...form, business_stage: event.target.value})}
            className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle}>
            {(optionLists.business_stage && optionLists.business_stage.length ? optionLists.business_stage : STAGES).map(stage => <option key={stage} value={stage}>{t(`venture.stages.${stage}`) || stage}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">{t("venture.website")}</label>
          <input value={form.website} onChange={event => setForm({...form, website: event.target.value})}
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
            <select value={form.registration_status} onChange={event => setForm({...form, registration_status: event.target.value})}
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
            ].map((socialField) => (
              <div key={socialField.key} className="flex items-center gap-2">
                <span className="w-24 shrink-0 text-xs" style={{ color: "var(--text-secondary)" }}>{socialField.label}</span>
                <input
                  type="url"
                  value={form[socialField.key] || ""}
                  onChange={event => setForm({ ...form, [socialField.key]: event.target.value })}
                  className="flex-1 px-3 py-2 rounded-lg outline-none border text-sm"
                  style={inputStyle}
                  placeholder={socialField.ph}
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
