"use client";

import { Save, Loader2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useVenture } from "../VentureContext";
import { STAGES, INDUSTRY_FALLBACK, STATUSES, VISIBILITIES } from "../ventureMeta";

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
        <div>
          <label className="block text-sm font-medium mb-1">{t("venture.northStar")}</label>
          <textarea value={form.north_star} onChange={e => setForm({...form, north_star: e.target.value})}
            className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} rows={2} />
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
            <input value={form.country} onChange={e => setForm({...form, country: e.target.value})}
              className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} />
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
            <input value={form.twitter} onChange={e => setForm({...form, twitter: e.target.value})}
              className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} placeholder={t("venture.twitter")} />
            <input value={form.linkedin} onChange={e => setForm({...form, linkedin: e.target.value})}
              className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} placeholder={t("venture.linkedin")} />
            <input value={form.instagram} onChange={e => setForm({...form, instagram: e.target.value})}
              className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} placeholder={t("venture.instagram")} />
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
          <select value={form.status} onChange={e => setForm({...form, status: e.target.value})}
            className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle}>
            {STATUSES.map(s => <option key={s} value={s}>{t(`venture.statuses.${s}`)}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">{t("venture.businessStage")}</label>
          <select value={form.business_stage} onChange={e => setForm({...form, business_stage: e.target.value})}
            className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle}>
            {(optionLists.business_stage && optionLists.business_stage.length ? optionLists.business_stage : STAGES).map(s => <option key={s} value={s}>{t(`venture.stages.${s}`) || s}</option>)}
          </select>
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
        <div>
          <label className="block text-sm font-medium mb-1">{t("venture.branding")}</label>
          <div className="flex items-center gap-3">
            <input type="color" value={form.brandColor} onChange={e => setForm({...form, brandColor: e.target.value})}
              className="w-12 h-10 rounded border cursor-pointer" style={{ borderColor: "rgb(255 255 255 / 0.15)", backgroundColor: "transparent" }} />
            <input value={form.brandColor} onChange={e => setForm({...form, brandColor: e.target.value})}
              className="flex-1 px-3 py-2 rounded-lg outline-none border font-mono text-sm" style={inputStyle} />
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
