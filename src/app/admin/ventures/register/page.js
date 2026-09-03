"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Rocket,
  ArrowLeft,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Building2,
  User,
  Mail,
  Phone,
  Globe,
  FileText,
  ChevronRight,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useSafeBack } from "@/lib/useSafeBack";

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
  { value: "idea", label: "Idea", description: "Concept stage, pre-MVP" },
  { value: "validation", label: "Validation", description: "Market validation in progress" },
  { value: "early_traction", label: "Early Traction", description: "First customers / users" },
  { value: "growth", label: "Growth", description: "Scaling operations" },
  { value: "scaling", label: "Scaling", description: "Expanding to new markets" },
];

const INITIAL_FORM = {
  company_name: "",
  registration_number: "",
  industry: "",
  business_stage: "",
  description: "",
  website: "",
  logo_url: "",
  founder_email: "",
  founder_name: "",
  founder_phone: "",
  founder_title: "",
};

export default function RegisterVenturePage() {
  const router = useRouter();
  const goBack = useSafeBack("/admin/ventures");
  const { t } = useI18n();
  const [form, setForm] = useState(INITIAL_FORM);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState([]);
  const [success, setSuccess] = useState(null);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    // Clear errors when user corrects a field
    setErrors([]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrors([]);
    setSuccess(null);

    try {
      const res = await fetch("/api/ventures/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok) {
        const errorList = [];
        if (data.errors) {
          errorList.push(...data.errors);
        }
        if (data.conflicts) {
          errorList.push(...data.conflicts);
        }
        if (data.error) {
          errorList.push(data.error);
        }
        setErrors(errorList.length > 0 ? errorList : [t("vadmin.register.registrationFailed")]);
        return;
      }

      setSuccess(data);

      // Auto-redirect to venture dashboard after 2 seconds
      setTimeout(() => {
        router.push(`/admin/ventures/${data.venture.venture_id}`);
      }, 2000);
    } catch (e) {
      setErrors([t("vadmin.register.networkError")]);
    } finally {
      setLoading(false);
    }
  };

  // Success state
  if (success) {
    return (
      <>
        <div className="max-w-2xl mx-auto py-20 text-center">
          <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10 text-emerald-500" />
          </div>
          <h2 className="text-2xl font-black text-[var(--text-primary)] mb-2">
            {t("vadmin.register.successTitle")}
          </h2>
          <p className="text-slate-400 mb-6">
            {t("vadmin.register.successMessage", { company: success.venture.company_name })}
          </p>

          <div className="card max-w-md mx-auto text-left mb-8 space-y-3">
            <div className="flex items-center justify-between p-3 bg-tertiary rounded-xl">
              <span className="text-[10px] font-bold text-slate-500 uppercase">{t("vadmin.register.ventureId")}</span>
              <span className="text-sm font-black text-[var(--brand-orange)]">{success.venture.venture_id}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-tertiary rounded-xl">
              <span className="text-[10px] font-bold text-slate-500 uppercase">{t("vadmin.register.company")}</span>
              <span className="text-sm font-bold text-[var(--text-primary)]">{success.venture.company_name}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-tertiary rounded-xl">
              <span className="text-[10px] font-bold text-slate-500 uppercase">{t("vadmin.register.founder")}</span>
              <span className="text-sm font-bold text-[var(--text-primary)]">{success.founder.name}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-tertiary rounded-xl">
              <span className="text-[10px] font-bold text-slate-500 uppercase">{t("vadmin.register.invitation")}</span>
              <span className={`text-sm font-bold ${success.invitation.email_sent ? "text-emerald-500" : "text-amber-500"}`}>
                {success.invitation.email_sent ? t("vadmin.register.invitationSent") : t("vadmin.register.invitationPending")}
              </span>
            </div>
          </div>

          <p className="text-[10px] text-slate-500">
            {t("vadmin.register.redirecting")}
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="max-w-3xl mx-auto space-y-8 pb-20">
        {/* Header */}
        <div className="flex items-center gap-4">
          <button
            onClick={goBack}
            className="p-2 rounded-lg hover:bg-tertiary transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <Rocket className="w-5 h-5 text-[var(--brand-orange)]" />
              <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">
                Venture OS
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">
              {t("vadmin.register.title")}
            </h1>
          </div>
        </div>

        {/* Error display */}
        {errors.length > 0 && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 space-y-1">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-rose-500" />
              <span className="text-[10px] font-black text-rose-500 uppercase tracking-wider">
                {t("vadmin.register.errorsTitle")}
              </span>
            </div>
            {errors.map((err, i) => (
              <p key={i} className="text-[11px] text-rose-400 pl-6">
                • {t(err || "") || err}
              </p>
            ))}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Section 1: Company Information */}
          <div className="card space-y-6">
            <div className="flex items-center gap-3 pb-4 border-b border-[var(--border-primary)]">
              <div className="w-8 h-8 rounded-xl bg-[var(--brand-orange)]/10 flex items-center justify-center">
                <Building2 className="w-4 h-4 text-[var(--brand-orange)]" />
              </div>
              <div>
                <h2 className="text-sm font-black uppercase tracking-tight text-[var(--text-primary)]">
                  {t("vadmin.register.companyInfoTitle")}
                </h2>
                <p className="text-[9px] text-slate-500">{t("vadmin.register.stepOf", { current: 1, total: 2 })}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Company Name */}
              <div className="md:col-span-2">
                <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">
                  {t("vadmin.register.companyName")} <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.company_name}
                  onChange={(e) => handleChange("company_name", e.target.value)}
                  placeholder={t("vadmin.register.companyNamePlaceholder")}
                  className="w-full px-4 py-3 bg-tertiary border border-[var(--border-primary)] rounded-xl text-sm text-[var(--text-primary)] placeholder-slate-600 focus:outline-none focus:border-[var(--brand-orange)]/50 transition-all"
                  required
                />
              </div>

              {/* Registration Number */}
              <div>
                <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">
                  {t("vadmin.register.registrationNumber")}
                </label>
                <input
                  type="text"
                  value={form.registration_number}
                  onChange={(e) => handleChange("registration_number", e.target.value)}
                  placeholder={t("vadmin.register.registrationNumberPlaceholder")}
                  className="w-full px-4 py-3 bg-tertiary border border-[var(--border-primary)] rounded-xl text-sm text-[var(--text-primary)] placeholder-slate-600 focus:outline-none focus:border-[var(--brand-orange)]/50 transition-all"
                />
              </div>

              {/* Website */}
              <div>
                <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">
                  {t("vadmin.register.website")}
                </label>
                <input
                  type="url"
                  value={form.website}
                  onChange={(e) => handleChange("website", e.target.value)}
                  placeholder="https://example.com"
                  className="w-full px-4 py-3 bg-tertiary border border-[var(--border-primary)] rounded-xl text-sm text-[var(--text-primary)] placeholder-slate-600 focus:outline-none focus:border-[var(--brand-orange)]/50 transition-all"
                />
              </div>

              {/* Industry */}
              <div>
                <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">
                  {t("vadmin.register.industry")} <span className="text-rose-500">*</span>
                </label>
                <select
                  value={form.industry}
                  onChange={(e) => handleChange("industry", e.target.value)}
                  className="w-full px-4 py-3 bg-tertiary border border-[var(--border-primary)] rounded-xl text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--brand-orange)]/50 transition-all"
                  required
                >
                  <option value="">{t("vadmin.register.selectIndustry")}</option>
                  {INDUSTRIES.map((ind) => (
                    <option key={ind} value={ind.toLowerCase()}>{ind}</option>
                  ))}
                </select>
              </div>

              {/* Business Stage */}
              <div>
                <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">
                  {t("vadmin.register.businessStage")} <span className="text-rose-500">*</span>
                </label>
                <select
                  value={form.business_stage}
                  onChange={(e) => handleChange("business_stage", e.target.value)}
                  className="w-full px-4 py-3 bg-tertiary border border-[var(--border-primary)] rounded-xl text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--brand-orange)]/50 transition-all"
                  required
                >
                  <option value="">{t("vadmin.register.selectStage")}</option>
                  {BUSINESS_STAGES.map((stage) => (
                    <option key={stage.value} value={stage.value}>
                      {t(`vadmin.register.stageOptions.${stage.value}`)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Description */}
              <div className="md:col-span-2">
                <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">
                  {t("vadmin.register.descriptionLabel")}
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) => handleChange("description", e.target.value)}
                  placeholder={t("vadmin.register.descriptionPlaceholder")}
                  rows={3}
                  className="w-full px-4 py-3 bg-tertiary border border-[var(--border-primary)] rounded-xl text-sm text-[var(--text-primary)] placeholder-slate-600 focus:outline-none focus:border-[var(--brand-orange)]/50 transition-all resize-none"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Founder Information */}
          <div className="card space-y-6">
            <div className="flex items-center gap-3 pb-4 border-b border-[var(--border-primary)]">
              <div className="w-8 h-8 rounded-xl bg-[var(--brand-orange)]/10 flex items-center justify-center">
                <User className="w-4 h-4 text-[var(--brand-orange)]" />
              </div>
              <div>
                <h2 className="text-sm font-black uppercase tracking-tight text-[var(--text-primary)]">
                  {t("vadmin.register.founderInfoTitle")}
                </h2>
                <p className="text-[9px] text-slate-500">{t("vadmin.register.stepOf", { current: 2, total: 2 })}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Founder Name */}
              <div>
                <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">
                  {t("vadmin.register.fullName")} <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.founder_name}
                  onChange={(e) => handleChange("founder_name", e.target.value)}
                  placeholder={t("vadmin.register.founderNamePlaceholder")}
                  className="w-full px-4 py-3 bg-tertiary border border-[var(--border-primary)] rounded-xl text-sm text-[var(--text-primary)] placeholder-slate-600 focus:outline-none focus:border-[var(--brand-orange)]/50 transition-all"
                  required
                />
              </div>

              {/* Founder Email */}
              <div>
                <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">
                  {t("vadmin.register.email")} <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="email"
                    value={form.founder_email}
                    onChange={(e) => handleChange("founder_email", e.target.value)}
                    placeholder="john@example.com"
                    className="w-full pl-10 pr-4 py-3 bg-tertiary border border-[var(--border-primary)] rounded-xl text-sm text-[var(--text-primary)] placeholder-slate-600 focus:outline-none focus:border-[var(--brand-orange)]/50 transition-all"
                    required
                  />
                </div>
              </div>

              {/* Founder Phone */}
              <div>
                <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">
                  {t("vadmin.register.phone")}
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="tel"
                    value={form.founder_phone}
                    onChange={(e) => handleChange("founder_phone", e.target.value)}
                    placeholder="+229 00 00 00 00"
                    className="w-full pl-10 pr-4 py-3 bg-tertiary border border-[var(--border-primary)] rounded-xl text-sm text-[var(--text-primary)] placeholder-slate-600 focus:outline-none focus:border-[var(--brand-orange)]/50 transition-all"
                  />
                </div>
              </div>

              {/* Founder Title */}
              <div>
                <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">
                  {t("vadmin.register.founderTitle")}
                </label>
                <input
                  type="text"
                  value={form.founder_title}
                  onChange={(e) => handleChange("founder_title", e.target.value)}
                  placeholder={t("vadmin.register.founderTitlePlaceholder")}
                  className="w-full px-4 py-3 bg-tertiary border border-[var(--border-primary)] rounded-xl text-sm text-[var(--text-primary)] placeholder-slate-600 focus:outline-none focus:border-[var(--brand-orange)]/50 transition-all"
                />
              </div>
            </div>
          </div>

          {/* Submit */}
          <div className="flex items-center justify-end gap-4">
            <button
              type="button"
              onClick={goBack}
              className="px-6 py-3 rounded-xl border border-[var(--border-primary)] text-[10px] font-black uppercase tracking-widest hover:bg-tertiary transition-all"
            >
              {t("vadmin.register.cancel")}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary gap-2 px-8 py-3"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t("vadmin.register.registering")}
                </>
              ) : (
                <>
                  <Rocket className="w-4 h-4" />
                  {t("vadmin.register.title")}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
