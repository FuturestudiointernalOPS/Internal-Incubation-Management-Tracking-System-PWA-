"use client";

import { useState, useEffect } from "react";
import {
  User, Building2, Globe, Link, Camera, Save, Loader2,
  Briefcase, Target, DollarSign, MapPin, TrendingUp, ArrowLeft,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useSafeBack } from "@/lib/useSafeBack";
import AppCard from "@/components/ui/AppCard";
import AppButton from "@/components/ui/AppButton";
import GlobalToast from "@/components/ui/GlobalToast";
import { cacheGet, cacheSet } from "@/lib/hooks/useApi";

const INDUSTRY_OPTIONS = [
  "FinTech", "HealthTech", "AgriTech", "EdTech", "CleanTech",
  "Logistics", "E-Commerce", "SaaS", "AI/ML", "Renewable Energy",
];
const STAGE_OPTIONS = ["Pre-Seed", "Seed", "Series A", "Series B", "Growth"];
const COUNTRY_OPTIONS = ["CD", "KE", "NG", "ZA", "GH", "RW", "UG", "TZ", "EG", "MA"];

export default function InvestorProfilePage() {
  const { t } = useI18n();
  const goBack = useSafeBack("/investor");
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [activeTab, setActiveTab] = useState("profile");

  // Profile form
  const [orgName, setOrgName] = useState("");
  const [biography, setBiography] = useState("");
  const [website, setWebsite] = useState("");
  const [linkedin, setLinkedin] = useState("");

  // Preferences form
  const [industries, setIndustries] = useState([]);
  const [countries, setCountries] = useState([]);
  const [stages, setStages] = useState([]);
  const [ticketMin, setTicketMin] = useState("");
  const [ticketMax, setTicketMax] = useState("");
  const [philosophy, setPhilosophy] = useState("");

  useEffect(() => { fetchProfile(); }, []);

  const fetchProfile = async (bypassCache = false) => {
    setLoading(true);
    try {
      const url = "/api/investor/profile";
      const apply = (data) => {
        if (data.success && data.profile) {
          setProfile(data.profile);
          setOrgName(data.profile.organization_name || "");
          setBiography(data.profile.biography || "");
          setWebsite(data.profile.website || "");
          setLinkedin(data.profile.linkedin || "");
          setIndustries(data.profile.industries || []);
          setCountries(data.profile.countries || []);
          setStages(data.profile.startup_stages || []);
          setTicketMin(data.profile.ticket_size_min || "");
          setTicketMax(data.profile.ticket_size_max || "");
          setPhilosophy(data.profile.investment_philosophy || "");
        }
      };
      // Cache-first paint: returning to this page renders instantly from a fresh
      // snapshot while the profile refreshes in the background.
      if (!bypassCache) {
        const cached = cacheGet(url);
        if (cached !== null && cached.success) {
          apply(cached);
          setLoading(false);
        }
      }
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        cacheSet(url, data);
        apply(data);
      }
    } catch (_) {}
    setLoading(false);
  };

  const saveProfile = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/investor/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organization_name: orgName, biography, website, linkedin }),
      });
      const data = await res.json();
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
      const res = await fetch("/api/investor/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          industries, countries, startup_stages: stages,
          ticket_size_min: ticketMin ? parseFloat(ticketMin) : null,
          ticket_size_max: ticketMax ? parseFloat(ticketMax) : null,
          investment_philosophy: philosophy,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setToast({ type: "success", message: t("investorMisc.profile.preferencesSaved") });
      } else {
        setToast({ type: "error", message: t(data.error || "") || data.error });
      }
    } catch (_) {}
    setSaving(false);
  };

  const toggleArray = (arr, setArr, item) => {
    setArr(arr.includes(item) ? arr.filter(i => i !== item) : [...arr, item]);
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
                    <input value={orgName} onChange={e => setOrgName(e.target.value)}
                      placeholder={t("investorMisc.profile.orgNamePlaceholder")}
                      className="w-full pl-10 pr-4 py-2.5 bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl text-sm font-bold text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none focus:border-[var(--brand-orange)]/60" />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("investorMisc.profile.biography")}</label>
                  <textarea value={biography} onChange={e => setBiography(e.target.value)}
                    rows={3} placeholder={t("investorMisc.profile.bioPlaceholder")}
                    className="w-full mt-1.5 px-4 py-2.5 bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl text-sm font-bold text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none focus:border-[var(--brand-orange)]/60 resize-none" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("investorMisc.profile.website")}</label>
                    <div className="relative mt-1.5">
                      <Globe className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)]" />
                      <input value={website} onChange={e => setWebsite(e.target.value)}
                        placeholder="https://..."
                        className="w-full pl-10 pr-4 py-2.5 bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl text-sm font-bold text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none focus:border-[var(--brand-orange)]/60" />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("investorMisc.profile.linkedin")}</label>
                    <div className="relative mt-1.5">
                      <Link className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)]" />
                      <input value={linkedin} onChange={e => setLinkedin(e.target.value)}
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
                    {INDUSTRY_OPTIONS.map(ind => (
                      <button key={ind} onClick={() => toggleArray(industries, setIndustries, ind)}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
                          industries.includes(ind)
                            ? "bg-[var(--brand-orange)] text-white"
                            : "bg-[var(--surface-3)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                        }`}>
                        {ind}
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
                    {COUNTRY_OPTIONS.map(c => (
                      <button key={c} onClick={() => toggleArray(countries, setCountries, c)}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
                          countries.includes(c)
                            ? "bg-[var(--brand-orange)] text-white"
                            : "bg-[var(--surface-3)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                        }`}>
                        {c}
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
                    {STAGE_OPTIONS.map(s => (
                      <button key={s} onClick={() => toggleArray(stages, setStages, s)}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
                          stages.includes(s)
                            ? "bg-[var(--brand-orange)] text-white"
                            : "bg-[var(--surface-3)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                        }`}>
                        {s}
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
                    <input value={ticketMin} onChange={e => setTicketMin(e.target.value)}
                      type="number" placeholder={t("investorMisc.profile.min")}
                      className="px-4 py-2.5 bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl text-sm font-bold text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none focus:border-[var(--brand-orange)]/60" />
                    <input value={ticketMax} onChange={e => setTicketMax(e.target.value)}
                      type="number" placeholder={t("investorMisc.profile.max")}
                      className="px-4 py-2.5 bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl text-sm font-bold text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none focus:border-[var(--brand-orange)]/60" />
                  </div>
                </div>

                {/* Philosophy */}
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("investorMisc.profile.investmentPhilosophy")}</label>
                  <textarea value={philosophy} onChange={e => setPhilosophy(e.target.value)}
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
