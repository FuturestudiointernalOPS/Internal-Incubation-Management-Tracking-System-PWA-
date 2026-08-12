"use client";

import { useState } from "react";
import { Building2, Mail, Lock, User, Globe, Link, CheckCircle2, Loader2, ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";

export default function InvestorRegisterPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [form, setForm] = useState({
    name: "", email: "", password: "", confirmPassword: "",
    organization_name: "", biography: "", website: "", linkedin: "",
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!form.name || !form.email || !form.password) {
      setError(t("investorMisc.register.errorRequiredFields"));
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError(t("investorMisc.register.errorPasswordsMismatch"));
      return;
    }
    if (form.password.length < 6) {
      setError(t("investorMisc.register.errorPasswordTooShort"));
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/investor/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          password: form.password,
          organization_name: form.organization_name,
          biography: form.biography,
          website: form.website,
          linkedin: form.linkedin,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccess(true);
      } else {
        setError(data.error || t("investorMisc.register.errorRegistrationFailed"));
      }
    } catch (_) {
      setError(t("investorMisc.register.errorNetwork"));
    }
    setLoading(false);
  };

  if (success) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8 text-emerald-400" />
          </div>
          <h1 className="text-2xl font-black text-[var(--text-primary)] uppercase">{t("investorMisc.register.submittedTitle")}</h1>
          <p className="text-sm text-[var(--text-secondary)]">
            {t("investorMisc.register.submittedDescription")}
          </p>
          <button onClick={() => router.push("/login")}
            className="px-6 py-3 bg-[var(--brand-orange)] text-white text-xs font-black uppercase tracking-wider rounded-xl hover:bg-[var(--brand-orange)]/90">
            {t("investorMisc.register.goToLogin")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center p-4">
      <div className="w-full max-w-lg space-y-8">
        <button onClick={() => router.push("/login")}
          className="flex items-center gap-2 text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--brand-orange)] uppercase">
          <ArrowLeft className="w-4 h-4" /> {t("investorMisc.register.backToLogin")}
        </button>

        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-[var(--brand-orange)]/10 border border-[var(--brand-orange)]/20 flex items-center justify-center mx-auto">
            <Building2 className="w-7 h-7 text-[var(--brand-orange)]" />
          </div>
          <h1 className="text-2xl font-black text-[var(--text-primary)] uppercase tracking-tighter">{t("investorMisc.register.title")}</h1>
          <p className="text-sm text-[var(--text-secondary)]">
            {t("investorMisc.register.subtitle")}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs font-bold text-rose-400 text-center">
              {error}
            </div>
          )}

          <div className="space-y-3">
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)]" />
              <input type="text" name="name" value={form.name} onChange={handleChange}
                placeholder={t("investorMisc.register.fullNamePlaceholder")} required
                className="w-full pl-11 pr-4 py-3 bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl text-sm font-bold text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none focus:border-[var(--brand-orange)]/60" />
            </div>

            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)]" />
              <input type="email" name="email" value={form.email} onChange={handleChange}
                placeholder={t("investorMisc.register.emailPlaceholder")} required
                className="w-full pl-11 pr-4 py-3 bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl text-sm font-bold text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none focus:border-[var(--brand-orange)]/60" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)]" />
                <input type="password" name="password" value={form.password} onChange={handleChange}
                  placeholder={t("investorMisc.register.passwordPlaceholder")} required minLength={6}
                  className="w-full pl-11 pr-4 py-3 bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl text-sm font-bold text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none focus:border-[var(--brand-orange)]/60" />
              </div>
              <input type="password" name="confirmPassword" value={form.confirmPassword} onChange={handleChange}
                placeholder={t("investorMisc.register.confirmPasswordPlaceholder")} required
                className="px-4 py-3 bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl text-sm font-bold text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none focus:border-[var(--brand-orange)]/60" />
            </div>
          </div>

          <div className="border-t border-[var(--border-primary)] pt-4 space-y-3">
            <p className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest">{t("investorMisc.register.organizationLabel")}</p>
            <div className="relative">
              <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)]" />
              <input type="text" name="organization_name" value={form.organization_name} onChange={handleChange}
                placeholder={t("investorMisc.register.organizationPlaceholder")}
                className="w-full pl-11 pr-4 py-3 bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl text-sm font-bold text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none focus:border-[var(--brand-orange)]/60" />
            </div>
            <textarea name="biography" value={form.biography} onChange={handleChange}
              rows={2} placeholder={t("investorMisc.register.biographyPlaceholder")}
              className="w-full px-4 py-3 bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl text-sm font-bold text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none focus:border-[var(--brand-orange)]/60 resize-none" />
            <div className="grid grid-cols-2 gap-3">
              <div className="relative">
                <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)]" />
                <input type="url" name="website" value={form.website} onChange={handleChange}
                  placeholder={t("investorMisc.register.websitePlaceholder")}
                  className="w-full pl-11 pr-4 py-3 bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl text-sm font-bold text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none focus:border-[var(--brand-orange)]/60" />
              </div>
              <div className="relative">
                <Link className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)]" />
                <input type="url" name="linkedin" value={form.linkedin} onChange={handleChange}
                  placeholder={t("investorMisc.register.linkedinPlaceholder")}
                  className="w-full pl-11 pr-4 py-3 bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl text-sm font-bold text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none focus:border-[var(--brand-orange)]/60" />
              </div>
            </div>
          </div>

          <button type="submit" disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-3.5 bg-[var(--brand-orange)] text-white text-xs font-black uppercase tracking-wider rounded-xl hover:bg-[var(--brand-orange)]/90 disabled:opacity-60 transition-all">
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> {t("investorMisc.register.submitting")}</> : t("investorMisc.register.submitButton")}
          </button>

          <p className="text-center text-[10px] text-[var(--text-tertiary)]">
            {t("investorMisc.register.alreadyRegistered")}{" "}
            <button type="button" onClick={() => router.push("/login")}
              className="text-[var(--brand-orange)] font-bold hover:underline">{t("investorMisc.register.loginLink")}</button>
          </p>
        </form>
      </div>
    </div>
  );
}
