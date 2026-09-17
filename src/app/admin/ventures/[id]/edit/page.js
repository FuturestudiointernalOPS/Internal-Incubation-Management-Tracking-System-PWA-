"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Rocket,
  ArrowLeft,
  Building2,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Save,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useSafeBack } from "@/lib/useSafeBack";
import { useApi } from "@/lib/hooks/useApi";

const EMPTY_OBJECT = {};

/**
 * The stored Venture, shaped into the fields this form edits.
 *
 * Module scope on purpose: the reading hook is handed this shaper. A record that
 * does not carry a field edits as an empty string, which is what the loader used
 * to write into the form itself.
 */
const pickStoredForm = (d) =>
  d?.success && d.venture
    ? {
        company_name: d.venture.company_name || "",
        registration_number: d.venture.registration_number || "",
        industry: d.venture.industry || "",
        business_stage: d.venture.business_stage || "",
        description: d.venture.description || "",
        website: d.venture.website || "",
        logo_url: d.venture.logo_url || "",
      }
    : null;

const INDUSTRIES = [
  "Fintech",
  "Healthtech",
  "Edtech",
  "Cleantech",
  "SaaS",
  "E-commerce",
  "Agritech",
  "Logistics",
  "AI / ML",
  "Blockchain",
  "Media & Entertainment",
  "Real Estate",
  "Other",
];

const BUSINESS_STAGES = [
  { value: "idea", label: "Idea" },
  { value: "validation", label: "Validation" },
  { value: "early_traction", label: "Early Traction" },
  { value: "growth", label: "Growth" },
  { value: "scaling", label: "Scaling" },
];

export default function EditVenturePage({ params }) {
  const router = useRouter();
  const { id } = React.use(params);
  const goBack = useSafeBack(`/admin/ventures/${id}`);
  const { t } = useI18n();
  const [saving, setSaving] = useState(false);
  // The save's own outcome. It belongs to the write, not to the read, so it is
  // kept apart from the read's failure below.
  const [saveError, setSaveError] = useState(null);
  const [success, setSuccess] = useState(null);

  // The stored Venture, through the shared hook: it owns the cache, the
  // cache-first paint and the discarding of a stale answer, so the page keeps no
  // copy of its own and reads during render.
  const {
    data: storedForm,
    loading,
    error: readFailure,
  } = useApi(id ? `/api/ventures/${id}` : null, {
    defaultValue: null,
    transform: pickStoredForm,
    deps: [id],
  });

  // The form is a DERIVED BASE PLUS EDITS: what the server has stored, and what
  // the person typed, recorded against the field it changes. Nothing is copied
  // into state, so no effect has to notice the stored values arriving - which is
  // what would erase a field edited in the moment before they did.
  const [edits, setEdits] = useState(EMPTY_OBJECT);
  const form = storedForm ? { ...storedForm, ...edits } : null;

  // Which failure the panel below reports: a request that never got an answer is
  // the network's, and a read that came back without a Venture is the server's.
  const loadFailure = readFailure
    ? t("vadmin.edit.loadFailed")
    : form
      ? null
      : t("vadmin.edit.ventureNotFoundError");

  const handleChange = (field, value) => {
    setEdits((previous) => ({ ...previous, [field]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    setSuccess(null);

    try {
      const res = await fetch(`/api/ventures/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok) {
        setSaveError(t((data.error || t("vadmin.edit.saveFailed")) || "") || (data.error || t("vadmin.edit.saveFailed")));
        return;
      }

      setSuccess(t("vadmin.edit.saveSuccess"));

      // Redirect back to venture detail after 1.5s
      setTimeout(() => {
        router.push(`/admin/ventures/${id}`);
      }, 1500);
    } catch {
      setSaveError(t("vadmin.edit.networkError"));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-[var(--brand-orange)]" />
        </div>
      </>
    );
  }

  if (loadFailure) {
    return (
      <>
        <div className="text-center py-20">
          <AlertTriangle className="w-12 h-12 text-rose-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">{t("vadmin.edit.ventureNotFound")}</h2>
          <p className="text-slate-500 mb-6">{loadFailure}</p>
          <button onClick={() => router.push("/admin/ventures")} className="btn btn-primary">
            {t("vadmin.edit.backToVentures")}
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="max-w-3xl mx-auto space-y-8 pb-20">
        {/* Header */}
        <div className="flex items-center gap-4">
          <button onClick={goBack} className="p-2 rounded-lg hover:bg-tertiary transition-all">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <Rocket className="w-5 h-5 text-[var(--brand-orange)]" />
              <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">
                {t("vadmin.edit.ventureOs")}
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">
              {t("vadmin.edit.title")}
            </h1>
          </div>
        </div>

        {/* Success message */}
        {success && (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            <span className="text-sm font-bold text-emerald-500">{success}</span>
          </div>
        )}

        {/* Error message */}
        {saveError && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-500" />
            <span className="text-sm font-bold text-rose-500">{saveError}</span>
          </div>
        )}

        {/* Edit Form */}
        {form && (
          <div className="card space-y-6">
            <div className="flex items-center gap-3 pb-4 border-b border-[var(--border-primary)]">
              <div className="w-8 h-8 rounded-xl bg-[var(--brand-orange)]/10 flex items-center justify-center">
                <Building2 className="w-4 h-4 text-[var(--brand-orange)]" />
              </div>
              <div>
                <h2 className="text-sm font-black uppercase tracking-tight text-[var(--text-primary)]">
                  {t("vadmin.edit.companyInformation")}
                </h2>
                <p className="text-[9px] text-slate-500">{t("vadmin.edit.ventureId", { id })}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">
                  {t("vadmin.edit.companyName")}
                </label>
                <input
                  type="text"
                  value={form.company_name}
                  onChange={(e) => handleChange("company_name", e.target.value)}
                  className="w-full px-4 py-3 bg-tertiary border border-[var(--border-primary)] rounded-xl text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--brand-orange)]/50 transition-all"
                />
              </div>

              <div>
                <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">
                  {t("vadmin.edit.registrationNumber")}
                </label>
                <input
                  type="text"
                  value={form.registration_number}
                  onChange={(e) => handleChange("registration_number", e.target.value)}
                  className="w-full px-4 py-3 bg-tertiary border border-[var(--border-primary)] rounded-xl text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--brand-orange)]/50 transition-all"
                />
              </div>

              <div>
                <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">
                  {t("vadmin.edit.website")}
                </label>
                <input
                  type="url"
                  value={form.website}
                  onChange={(e) => handleChange("website", e.target.value)}
                  className="w-full px-4 py-3 bg-tertiary border border-[var(--border-primary)] rounded-xl text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--brand-orange)]/50 transition-all"
                />
              </div>

              <div>
                <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">
                  {t("vadmin.edit.industry")}
                </label>
                <select
                  value={form.industry}
                  onChange={(e) => handleChange("industry", e.target.value)}
                  className="w-full px-4 py-3 bg-tertiary border border-[var(--border-primary)] rounded-xl text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--brand-orange)]/50 transition-all"
                >
                  {INDUSTRIES.map((ind) => (
                    <option key={ind} value={ind.toLowerCase()}>{ind}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">
                  {t("vadmin.edit.businessStage")}
                </label>
                <select
                  value={form.business_stage}
                  onChange={(e) => handleChange("business_stage", e.target.value)}
                  className="w-full px-4 py-3 bg-tertiary border border-[var(--border-primary)] rounded-xl text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--brand-orange)]/50 transition-all"
                >
                  {BUSINESS_STAGES.map((stage) => (
                    <option key={stage.value} value={stage.value}>{t(`vadmin.edit.stageOptions.${stage.value}`)}</option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">
                  {t("vadmin.edit.description")}
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) => handleChange("description", e.target.value)}
                  rows={4}
                  className="w-full px-4 py-3 bg-tertiary border border-[var(--border-primary)] rounded-xl text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--brand-orange)]/50 transition-all resize-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-4 pt-4 border-t border-[var(--border-primary)]">
              <button
                type="button"
                onClick={goBack}
                className="px-6 py-3 rounded-xl border border-[var(--border-primary)] text-[10px] font-black uppercase tracking-widest hover:bg-tertiary transition-all"
              >
                {t("vadmin.edit.cancel")}
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="btn btn-primary gap-2 px-8 py-3"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {t("vadmin.edit.saving")}
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    {t("vadmin.edit.saveChanges")}
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
