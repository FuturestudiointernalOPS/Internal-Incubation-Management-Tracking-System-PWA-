"use client";

import { useState, useRef } from "react";
import { Save, Loader2, Upload, Trash2, ImageIcon } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useVenture } from "../VentureContext";
import { STAGES, INDUSTRY_FALLBACK } from "../ventureMeta";
import CountrySelect from "@/components/shared/ventures/console/CountrySelect";
import { countryName } from "@/lib/countries";
import { isValidSocialLink } from "@/lib/socialLinks";
import VentureBusinessProfileSection from "./VentureBusinessProfileSection";

/* Profile Tab */
export function ProfileTab({ ventureId }) {
  const { t } = useI18n();
  const { form, setForm, saving, handleSave, optionLists, inputStyle, cardStyle } = useVenture();
  const fileInputRef = useRef(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoError, setLogoError] = useState(null);

  const socialInvalid = (key) => !isValidSocialLink(key, form[key]);

  const handleLogoUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLogoError(null);
    setUploadingLogo(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to upload logo");
      }

      setForm((prev) => ({ ...prev, logo_url: data.url }));
    } catch (err) {
      setLogoError(err.message);
    } finally {
      setUploadingLogo(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemoveLogo = () => {
    setForm((prev) => ({ ...prev, logo_url: "" }));
    setLogoError(null);
  };

  const submitProfile = (event) => {
    if (["linkedin", "instagram", "twitter", "facebook"].some(socialInvalid)) {
      event.preventDefault();
      return;
    }
    return handleSave(event);
  };

  return (
    <form onSubmit={submitProfile} className="space-y-6">
      <div className="rounded-xl p-6 space-y-6 border" style={cardStyle}>
        {/* ── Company Logo Upload Section ── */}
        <div className="p-4 rounded-xl border border-[var(--border-primary)] bg-[var(--surface-2)]">
          <label className="block text-sm font-bold text-[var(--text-primary)] mb-2">
            Company Logo
          </label>
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="w-20 h-20 rounded-2xl border border-[var(--border-primary)] bg-[var(--surface-1)] flex items-center justify-center overflow-hidden shrink-0 shadow-sm relative group">
              {form.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={form.logo_url}
                  alt="Company Logo Preview"
                  className="w-full h-full object-contain p-2"
                />
              ) : (
                <div className="text-center p-2 text-[var(--text-secondary)]">
                  <ImageIcon size={28} className="mx-auto mb-1 opacity-40" />
                  <span className="text-[9px] uppercase font-bold tracking-wider opacity-60">No Logo</span>
                </div>
              )}
              {uploadingLogo && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                  <Loader2 size={20} className="animate-spin text-[var(--brand-orange)]" />
                </div>
              )}
            </div>

            <div className="space-y-2 flex-1">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
                onChange={handleLogoUpload}
                className="hidden"
              />
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  disabled={uploadingLogo}
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-[var(--brand-orange)] text-black hover:opacity-90 transition-opacity flex items-center gap-1.5 shadow-sm"
                >
                  <Upload size={13} />
                  <span>{form.logo_url ? "Change Logo" : "Upload Company Logo"}</span>
                </button>

                {form.logo_url && (
                  <button
                    type="button"
                    onClick={handleRemoveLogo}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 transition-colors flex items-center gap-1.5"
                  >
                    <Trash2 size={13} />
                    <span>Remove</span>
                  </button>
                )}
              </div>
              <p className="text-[11px] text-[var(--text-secondary)]">
                Recommended: Square image (PNG, JPG, SVG or WEBP), max 5MB. Displayed across your workspace and in investor diligence reports.
              </p>
              {logoError && (
                <p className="text-xs text-rose-400 font-semibold">{logoError}</p>
              )}
            </div>
          </div>
        </div>

        {/* ── Venture Name ── */}
        <div>
          <label className="block text-sm font-medium mb-1">{t("venture.namePlaceholder")}</label>
          <input
            value={form.name || ""}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            className="w-full px-3 py-2 rounded-lg outline-none border"
            style={inputStyle}
            required
          />
        </div>

        {/* ── Description ── */}
        <div>
          <label className="block text-sm font-medium mb-1">{t("venture.description")}</label>
          <textarea
            value={form.description || ""}
            onChange={(event) => setForm({ ...form, description: event.target.value })}
            className="w-full px-3 py-2 rounded-lg outline-none border"
            style={inputStyle}
            rows={3}
          />
        </div>

        {/* ── Mission & Vision ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">{t("venture.mission")}</label>
            <textarea
              value={form.mission || ""}
              onChange={(event) => setForm({ ...form, mission: event.target.value })}
              className="w-full px-3 py-2 rounded-lg outline-none border"
              style={inputStyle}
              rows={2}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t("venture.vision")}</label>
            <textarea
              value={form.vision || ""}
              onChange={(event) => setForm({ ...form, vision: event.target.value })}
              className="w-full px-3 py-2 rounded-lg outline-none border"
              style={inputStyle}
              rows={2}
            />
          </div>
        </div>

        {/* ── Industry & Sector ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">{t("venture.industry")}</label>
            <input
              list="venture-industry-options"
              value={form.industry || ""}
              onChange={(event) => setForm({ ...form, industry: event.target.value })}
              className="w-full px-3 py-2 rounded-lg outline-none border"
              style={inputStyle}
            />
            <datalist id="venture-industry-options">
              {(optionLists?.industry && optionLists.industry.length ? optionLists.industry : INDUSTRY_FALLBACK).map((ind) => (
                <option key={ind} value={ind} />
              ))}
            </datalist>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t("venture.sector")}</label>
            <input
              value={form.sector || ""}
              onChange={(event) => setForm({ ...form, sector: event.target.value })}
              className="w-full px-3 py-2 rounded-lg outline-none border"
              style={inputStyle}
            />
          </div>
        </div>

        {/* ── Business Stage (Read-only) ── */}
        <div>
          <label className="block text-sm font-medium mb-1">{t("venture.businessStage")}</label>
          <div className="flex items-center gap-3 px-3.5 py-2.5 rounded-lg border bg-[var(--surface-2)]" style={{ borderColor: "var(--border-primary)" }}>
            <span className="font-extrabold uppercase text-xs tracking-wider text-[var(--brand-orange)]">
              {t(`venture.stages.${form.business_stage || 'idea'}`) || form.business_stage || 'Idea'}
            </span>
            <span className="text-[11px] text-[var(--text-secondary)]">
              (Automated by milestones, validation and reporting)
            </span>
          </div>
        </div>

        {/* ── Website ── */}
        <div>
          <label className="block text-sm font-medium mb-1">{t("venture.website")}</label>
          <input
            value={form.website || ""}
            onChange={(event) => setForm({ ...form, website: event.target.value })}
            className="w-full px-3 py-2 rounded-lg outline-none border"
            style={inputStyle}
            placeholder="https://"
          />
        </div>

        {/* ── Country & Registration Status ── */}
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
            <select
              value={form.registration_status || ""}
              onChange={(event) => setForm({ ...form, registration_status: event.target.value })}
              className="w-full px-3 py-2 rounded-lg outline-none border"
              style={inputStyle}
            >
              <option value="">—</option>
              <option value="Not registered">{t("venture.registrationOptions.notRegistered")}</option>
              <option value="Registered">{t("venture.registrationOptions.registered")}</option>
              <option value="Pending registration">{t("venture.registrationOptions.pendingRegistration")}</option>
            </select>
          </div>
        </div>

        {/* ── Social Media ── */}
        <div>
          <label className="block text-sm font-medium mb-1">{t("venture.socialMedia")}</label>
          <div className="space-y-2">
            {[
              { key: "linkedin", label: "LinkedIn", ph: "https://www.linkedin.com/company/example" },
              { key: "instagram", label: "Instagram", ph: "https://www.instagram.com/example" },
              { key: "twitter", label: "X", ph: "https://x.com/example" },
              { key: "facebook", label: "Facebook", ph: "https://www.facebook.com/example" },
            ].map((socialField) => (
              <div key={socialField.key}>
                <div className="flex items-center gap-2">
                  <span className="w-24 shrink-0 text-xs" style={{ color: "var(--text-secondary)" }}>
                    {socialField.label}
                  </span>
                  <input
                    aria-invalid={socialInvalid(socialField.key)}
                    type="url"
                    value={form[socialField.key] || ""}
                    onChange={(event) => setForm({ ...form, [socialField.key]: event.target.value })}
                    className="flex-1 px-3 py-2 rounded-lg outline-none border text-sm"
                    style={inputStyle}
                    placeholder={socialField.ph}
                  />
                </div>
                {socialInvalid(socialField.key) && (
                  <p className="mt-1 ml-[6.5rem] text-[10px] text-rose-400">
                    {t("venture.socialInvalid", { platform: socialField.label })}
                  </p>
                )}
              </div>
            ))}
            <p className="text-[9px]" style={{ color: "var(--text-tertiary)" }}>
              {t("venture.socialPasteUrl") || "Paste the full link to your page — no @username needed."}
            </p>
          </div>
        </div>
      </div>

      {/* ── Business & Legal Identity Section (Organized within Profile) ── */}
      {ventureId && <VentureBusinessProfileSection ventureId={ventureId} />}

      <div className="flex justify-end pt-4 border-t" style={{ borderColor: "var(--border-primary)" }}>
        <button
          type="submit"
          disabled={saving || uploadingLogo}
          className="flex items-center gap-2 px-6 py-2 rounded-xl text-black font-extrabold disabled:opacity-50 transition-colors shadow-sm"
          style={{ backgroundColor: "var(--brand-orange)" }}
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          <span>{saving ? t("venture.saving") : t("venture.save")}</span>
        </button>
      </div>
    </form>
  );
}
