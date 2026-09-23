"use client";

import { useState, useMemo } from "react";
import {
  User, Building2, Globe, Link, Save, Loader2,
  Target, DollarSign, MapPin, TrendingUp, ArrowLeft,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useSafeBack } from "@/lib/useSafeBack";
import AppCard from "@/components/ui/AppCard";
import AppButton from "@/components/ui/AppButton";
import GlobalToast from "@/components/ui/GlobalToast";
import { useApi } from "@/lib/hooks/useApi";

// ─── Read shaping (module scope: built once, never per render) ───────────

const pickInvestorProfile = (response) =>
  response?.success ? response.profile || null : null;

// The values the two forms start from. They are a pure shaping of what was
// stored, so the forms are the stored profile with the person's own edits laid
// over it - nothing is copied into state when the read answers, and a re-read
// cannot wipe what someone is in the middle of typing.
const EMPTY_PROFILE_FORM = {
  orgName: "",
  biography: "",
  website: "",
  linkedin: "",
  industries: [],
  countries: [],
  stages: [],
  ticketMin: "",
  ticketMax: "",
  philosophy: "",
};

const profileToForm = (storedProfile) =>
  storedProfile
    ? {
        orgName: storedProfile.organization_name || "",
        biography: storedProfile.biography || "",
        website: storedProfile.website || "",
        linkedin: storedProfile.linkedin || "",
        industries: storedProfile.industries || [],
        countries: storedProfile.countries || [],
        stages: storedProfile.startup_stages || [],
        ticketMin: storedProfile.ticket_size_min || "",
        ticketMax: storedProfile.ticket_size_max || "",
        philosophy: storedProfile.investment_philosophy || "",
      }
    : EMPTY_PROFILE_FORM;

const INDUSTRY_OPTIONS = [
  "FinTech", "HealthTech", "AgriTech", "EdTech", "CleanTech",
  "Logistics", "E-Commerce", "SaaS", "AI/ML", "Renewable Energy",
];
const STAGE_OPTIONS = ["Pre-Seed", "Seed", "Series A", "Series B", "Growth"];
const COUNTRY_OPTIONS = ["CD", "KE", "NG", "ZA", "GH", "RW", "UG", "TZ", "EG", "MA"];

export default function InvestorProfilePage() {
  const { t } = useI18n();
  const goBack = useSafeBack("/investor");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [activeTab, setActiveTab] = useState("profile");

  // The profile is read through the shared hook, which owns the cache, the
  // cache-first paint and the discarding of a stale answer.
  const {
    data: profile,
    loading,
    setData: setProfile,
  } = useApi("/api/investor/profile", {
    defaultValue: null,
    transform: pickInvestorProfile,
  });

  // ─── The two forms: the stored profile, plus the person's edits ───
  // One `edits` bag for both tabs, so switching tab cannot lose the other tab's
  // unsaved typing - which is what the eleven separate states expressed.
  const [edits, setEdits] = useState({});
  const baseForm = useMemo(() => profileToForm(profile), [profile]);
  const field = (name) => edits[name] ?? baseForm[name];
  const setField = (name, value) =>
    setEdits((previousEdits) => ({ ...previousEdits, [name]: value }));
  const toggleField = (name, item) => {
    const current = field(name);
    setField(
      name,
      current.includes(item)
        ? current.filter((option) => option !== item)
        : [...current, item],
    );
  };


  const saveProfile = async () => {
    setSaving(true);
    try {
      const response = await fetch("/api/investor/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organization_name: field("orgName"),
          biography: field("biography"),
          website: field("website"),
          linkedin: field("linkedin"),
        }),
      });
      const data = await response.json();
      if (data.success) {
        setToast({ type: "success", message: t("investorMisc.profile.saved") });
        setProfile(data.profile);
      } else {
        setToast({ type: "error", message: t(data.error || "") || data.error });
      }
    } catch (_) {}
    setSaving(false);
  };

  const savePreferences = async () => {
    setSaving(true);
    try {
      const response = await fetch("/api/investor/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          industries: field("industries"),
          countries: field("countries"),
          startup_stages: field("stages"),
          ticket_size_min: field("ticketMin") ? parseFloat(field("ticketMin")) : null,
          ticket_size_max: field("ticketMax") ? parseFloat(field("ticketMax")) : null,
          investment_philosophy: field("philosophy"),
        }),
      });
      const data = await response.json();
      if (data.success) {
        setToast({ type: "success", message: t("investorMisc.profile.preferencesSaved") });
      } else {
        setToast({ type: "error", message: t(data.error || "") || data.error });
      }
    } catch (_) {}
    setSaving(false);
  };

  if (loading) {
    return (
      <>
        <div className="min-h-[60vh] flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[var(--brand-orange)]" />
        </div>
      </>
    );
  }

  return (
    <>
      <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-6">
        <GlobalToast toast={toast} onClose={() => setToast(null)} />

        <div className="flex items-center gap-4">
          <button onClick={goBack} className="p-2 hover:text-[var(--brand-orange)]">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-black text-[var(--text-primary)] uppercase tracking-tighter">
              {t("investorMisc.profile.title")}
            </h1>
            <p className="text-xs text-[var(--text-secondary)]">
              {profile?.approval_status === "approved" ? t("investorMisc.profile.approved") : profile?.approval_status?.replace("_", " ") || t("investorMisc.profile.pending")}
            </p>
          </div>
        </div>

        {/* TABS */}
        <div className="flex gap-1 border-b border-[var(--border-primary)]">
          {[
            { id: "profile", label: t("investorMisc.profile.profile"), icon: User },
            { id: "preferences", label: t("investorMisc.profile.preferences"), icon: Target },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-[10px] font-black uppercase tracking-wider transition-colors relative ${
                activeTab === tab.id ? "text-[var(--brand-orange)]" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--brand-orange)]" />
              )}
            </button>
          ))}
        </div>

        {/* PROFILE TAB */}
        {activeTab === "profile" && (
          <div className="space-y-4">
            <AppCard padding="lg">
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("investorMisc.profile.organizationName")}</label>
                  <div className="relative mt-1.5">
                    <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)]" />
                    <input value={field("orgName")} onChange={event => setField("orgName", event.target.value)}
                      placeholder={t("investorMisc.profile.orgNamePlaceholder")}
                      className="w-full pl-10 pr-4 py-2.5 bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl text-sm font-bold text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none focus:border-[var(--brand-orange)]/60" />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("investorMisc.profile.biography")}</label>
                  <textarea value={field("biography")} onChange={event => setField("biography", event.target.value)}
                    rows={3} placeholder={t("investorMisc.profile.bioPlaceholder")}
                    className="w-full mt-1.5 px-4 py-2.5 bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl text-sm font-bold text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none focus:border-[var(--brand-orange)]/60 resize-none" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("investorMisc.profile.website")}</label>
                    <div className="relative mt-1.5">
                      <Globe className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)]" />
                      <input value={field("website")} onChange={event => setField("website", event.target.value)}
                        placeholder="https://..."
                        className="w-full pl-10 pr-4 py-2.5 bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl text-sm font-bold text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none focus:border-[var(--brand-orange)]/60" />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("investorMisc.profile.linkedin")}</label>
                    <div className="relative mt-1.5">
                      <Link className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)]" />
                      <input value={field("linkedin")} onChange={event => setField("linkedin", event.target.value)}
                        placeholder="linkedin.com/in/..."
                        className="w-full pl-10 pr-4 py-2.5 bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl text-sm font-bold text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none focus:border-[var(--brand-orange)]/60" />
                    </div>
                  </div>
                </div>
              </div>
            </AppCard>
            <AppButton variant="primary" icon={Save} onClick={saveProfile} disabled={saving} className="w-full">
              {saving ? t("investorMisc.profile.saving") : t("investorMisc.profile.saveProfile")}
            </AppButton>
          </div>
        )}

        {/* PREFERENCES TAB */}
        {activeTab === "preferences" && (
          <div className="space-y-4">
            <AppCard padding="lg">
              <div className="space-y-5">
                {/* Industries */}
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("investorMisc.profile.industries")}</label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {INDUSTRY_OPTIONS.map(industry => (
                      <button key={industry} onClick={() => toggleField("industries", industry)}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
                          field("industries").includes(industry)
                            ? "bg-[var(--brand-orange)] text-white"
                            : "bg-[var(--surface-3)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                        }`}>
                        {industry}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Countries */}
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] flex items-center gap-1.5">
                    <MapPin className="w-3 h-3" /> {t("investorMisc.profile.countries")}
                  </label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {COUNTRY_OPTIONS.map(country => (
                      <button key={country} onClick={() => toggleField("countries", country)}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
                          field("countries").includes(country)
                            ? "bg-[var(--brand-orange)] text-white"
                            : "bg-[var(--surface-3)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                        }`}>
                        {country}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Stages */}
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] flex items-center gap-1.5">
                    <TrendingUp className="w-3 h-3" /> {t("investorMisc.profile.startupStages")}
                  </label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {STAGE_OPTIONS.map(stage => (
                      <button key={stage} onClick={() => toggleField("stages", stage)}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
                          field("stages").includes(stage)
                            ? "bg-[var(--brand-orange)] text-white"
                            : "bg-[var(--surface-3)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                        }`}>
                        {stage}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Ticket Size */}
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] flex items-center gap-1.5">
                    <DollarSign className="w-3 h-3" /> {t("investorMisc.profile.ticketSize")}
                  </label>
                  <div className="grid grid-cols-2 gap-3 mt-2">
                    <input value={field("ticketMin")} onChange={event => setField("ticketMin", event.target.value)}
                      type="number" placeholder={t("investorMisc.profile.min")}
                      className="px-4 py-2.5 bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl text-sm font-bold text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none focus:border-[var(--brand-orange)]/60" />
                    <input value={field("ticketMax")} onChange={event => setField("ticketMax", event.target.value)}
                      type="number" placeholder={t("investorMisc.profile.max")}
                      className="px-4 py-2.5 bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl text-sm font-bold text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none focus:border-[var(--brand-orange)]/60" />
                  </div>
                </div>

                {/* Philosophy */}
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("investorMisc.profile.investmentPhilosophy")}</label>
                  <textarea value={field("philosophy")} onChange={event => setField("philosophy", event.target.value)}
                    rows={2} placeholder={t("investorMisc.profile.philosophyPlaceholder")}
                    className="w-full mt-2 px-4 py-2.5 bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl text-sm font-bold text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none focus:border-[var(--brand-orange)]/60 resize-none" />
                </div>
              </div>
            </AppCard>
            <AppButton variant="primary" icon={Save} onClick={savePreferences} disabled={saving} className="w-full">
              {saving ? t("investorMisc.profile.saving") : t("investorMisc.profile.savePreferences")}
            </AppButton>
          </div>
        )}
      </div>
    </>
  );
}
