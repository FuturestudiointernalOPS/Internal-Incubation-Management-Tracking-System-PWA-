"use client";

import { useState } from "react";
import {
  Building2, Mail, Lock, User, Globe, Link, CheckCircle2, Loader2, ArrowLeft,
  ArrowRight, Target, DollarSign, MapPin, TrendingUp, FileText,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";

const STEPS = [
  { id: "account", label: "Account", icon: User },
  { id: "organization", label: "Organization", icon: Building2 },
  { id: "preferences", label: "Preferences", icon: Target },
  { id: "experience", label: "Experience", icon: FileText },
  { id: "review", label: "Review", icon: CheckCircle2 },
];

const INDUSTRIES = ["EdTech","AI/ML","FinTech","HealthTech","AgriTech","CleanTech","Logistics","E-Commerce","SaaS","Renewable Energy"];
const COUNTRIES = ["CD","KE","NG","ZA","GH","RW","UG","TZ","EG","MA","SN","CI","CM"];
const STAGES = ["Pre-Seed","Seed","Series A","Series B","Growth"];

export default function InvestorWizardPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [orgName, setOrgName] = useState("");
  const [biography, setBiography] = useState("");
  const [website, setWebsite] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [industries, setIndustries] = useState([]);
  const [countries, setCountries] = useState([]);
  const [stages, setStages] = useState([]);
  const [ticketMin, setTicketMin] = useState("");
  const [ticketMax, setTicketMax] = useState("");
  const [investmentExperience, setInvestmentExperience] = useState("");
  const [priorInvestments, setPriorInvestments] = useState("");

  // Derived during render instead of stored: the figure is a pure function of
  // the answers above, so keeping a copy in state cost an extra render pass and
  // left the one frame where the bar lagged behind what had just been typed.
  const completion = Math.round(
    ([name && email && password, orgName, industries.length > 0, investmentExperience]
      .filter(Boolean).length /
      4) *
      100,
  );

  const toggleArray = (items, setItems, item) => {
    setItems(items.includes(item) ? items.filter(entry => entry !== item) : [...items, item]);
  };

  const validateStep = () => {
    setError("");
    if (step === 0) {
      if (!name || !email || !password) return "Name, email, and password are required.";
      if (password !== confirmPassword) return "Passwords do not match.";
      if (password.length < 6) return "Password must be at least 6 characters.";
    }
    if (step === 1 && !orgName) return "Organization name is required.";
    if (step === 2) {
      if (industries.length === 0) return "Select at least one industry.";
      if (countries.length === 0) return "Select at least one country.";
    }
    return null;
  };

  const nextStep = () => {
    const err = validateStep();
    if (err) { setError(err); return; }
    if (step < 4) setStep(step + 1);
  };
  const prevStep = () => { if (step > 0) setStep(step - 1); setError(""); };

  const handleSubmit = async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/investor/register", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name, email, password,
          organization_name: orgName, biography, website, linkedin,
          industries, countries, startup_stages: stages,
          ticket_size_min: ticketMin ? parseInt(ticketMin) : null,
          ticket_size_max: ticketMax ? parseInt(ticketMax) : null,
          investment_experience: `${investmentExperience}\n\nPrior: ${priorInvestments}`,
        }),
      });
      const data = await response.json();
      if (data.success) setSuccess(true);
      else setError(t(data.error || "Registration failed.") || data.error || "Registration failed.");
    } catch (_) { setError("Network error."); }
    setLoading(false);
  };

  if (success) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8 text-emerald-400" />
          </div>
          <h1 className="text-2xl font-black text-[var(--text-primary)] uppercase">{t("wizard.submitted")}</h1>
          <p className="text-sm text-[var(--text-secondary)]">{t("wizard.submittedDesc")}</p>
          <button onClick={() => router.push("/login")} className="px-6 py-3 bg-[var(--brand-orange)] text-white text-xs font-black uppercase tracking-wider rounded-xl">{t("wizard.goToLogin")}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center p-4">
      <div className="w-full max-w-2xl space-y-6">
        <button onClick={() => router.push("/login")} className="flex items-center gap-2 text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--brand-orange)] uppercase"><ArrowLeft className="w-4 h-4" /> Back</button>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-black text-[var(--text-primary)] uppercase tracking-tighter">{t("wizard.title")}</h1>
            <span className="text-xs font-bold text-[var(--brand-orange)]">{completion}%</span>
          </div>
          <div className="flex gap-1">
            {STEPS.map((stepItem, stepIndex) => (
              <div key={stepItem.id} className={`flex-1 h-1 rounded-full ${stepIndex <= step ? "bg-[var(--brand-orange)]" : "bg-[var(--surface-3)]"}`} />
            ))}
          </div>
        </div>

        {error && <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs font-bold text-rose-400 text-center">{error}</div>}

        <div className="bg-[var(--surface-1)] border border-[var(--border-primary)] rounded-2xl p-6 space-y-4 min-h-[320px]">
          <div className="flex items-center gap-2 mb-4">
            {(() => { const currentStep = STEPS[step]; return <><currentStep.icon className="w-5 h-5 text-[var(--brand-orange)]" /><h2 className="text-sm font-black text-[var(--text-primary)] uppercase">{t(`wizard.${currentStep.id}`)}</h2></>; })()}
          </div>

          {step === 0 && (<div className="space-y-3">
            <div className="relative"><User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)]" /><input type="text" value={name} onChange={event => setName(event.target.value)} placeholder={t("wizard.fullName") + " *"} className="w-full pl-11 pr-4 py-3 bg-[var(--surface-2)] border rounded-xl text-sm font-bold text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none focus:border-[var(--brand-orange)]/60" /></div>
            <div className="relative"><Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)]" /><input type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder={t("wizard.email") + " *"} className="w-full pl-11 pr-4 py-3 bg-[var(--surface-2)] border rounded-xl text-sm font-bold text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none focus:border-[var(--brand-orange)]/60" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="relative"><Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)]" /><input type="password" value={password} onChange={event => setPassword(event.target.value)} placeholder={t("wizard.password") + " *"} className="w-full pl-11 pr-4 py-3 bg-[var(--surface-2)] border rounded-xl text-sm font-bold text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none focus:border-[var(--brand-orange)]/60" /></div>
              <input type="password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} placeholder={t("wizard.confirm") + " *"} className="px-4 py-3 bg-[var(--surface-2)] border rounded-xl text-sm font-bold text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none focus:border-[var(--brand-orange)]/60" />
            </div>
          </div>)}

          {step === 1 && (<div className="space-y-3">
            <div className="relative"><Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)]" /><input value={orgName} onChange={event => setOrgName(event.target.value)} placeholder={t("wizard.orgName") + " *"} className="w-full pl-11 pr-4 py-3 bg-[var(--surface-2)] border rounded-xl text-sm font-bold text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none focus:border-[var(--brand-orange)]/60" /></div>
            <textarea value={biography} onChange={event => setBiography(event.target.value)} rows={3} placeholder={t("wizard.bio")} className="w-full px-4 py-3 bg-[var(--surface-2)] border rounded-xl text-sm font-bold text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none focus:border-[var(--brand-orange)]/60 resize-none" />
            <div className="grid grid-cols-2 gap-3">
              <div className="relative"><Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)]" /><input value={website} onChange={event => setWebsite(event.target.value)} placeholder={t("wizard.website")} className="w-full pl-11 pr-4 py-3 bg-[var(--surface-2)] border rounded-xl text-sm font-bold text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none" /></div>
              <div className="relative"><Link className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)]" /><input value={linkedin} onChange={event => setLinkedin(event.target.value)} placeholder={t("wizard.linkedin")} className="w-full pl-11 pr-4 py-3 bg-[var(--surface-2)] border rounded-xl text-sm font-bold text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none" /></div>
            </div>
          </div>)}

          {step === 2 && (<div className="space-y-4">
            <div><label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("wizard.industries")} *</label><div className="flex flex-wrap gap-1.5 mt-1.5">{INDUSTRIES.map(industry=>(<button key={industry} onClick={()=>toggleArray(industries,setIndustries,industry)} className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase ${industries.includes(industry)?"bg-[var(--brand-orange)] text-white":"bg-[var(--surface-3)] text-[var(--text-secondary)]"}`}>{industry}</button>))}</div></div>
            <div><label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] flex items-center gap-1"><MapPin className="w-3 h-3"/> {t("wizard.countries")} *</label><div className="flex flex-wrap gap-1.5 mt-1.5">{COUNTRIES.map(country=>(<button key={country} onClick={()=>toggleArray(countries,setCountries,country)} className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase ${countries.includes(country)?"bg-[var(--brand-orange)] text-white":"bg-[var(--surface-3)] text-[var(--text-secondary)]"}`}>{country}</button>))}</div></div>
            <div><label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] flex items-center gap-1"><TrendingUp className="w-3 h-3"/> {t("wizard.stages")}</label><div className="flex flex-wrap gap-1.5 mt-1.5">{STAGES.map(stage=>(<button key={stage} onClick={()=>toggleArray(stages,setStages,stage)} className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase ${stages.includes(stage)?"bg-[var(--brand-orange)] text-white":"bg-[var(--surface-3)] text-[var(--text-secondary)]"}`}>{stage}</button>))}</div></div>
            <div><label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]"><DollarSign className="w-3 h-3 inline"/> {t("wizard.ticketSize")}</label><div className="grid grid-cols-2 gap-3 mt-1.5"><input type="number" value={ticketMin} onChange={event=>setTicketMin(event.target.value)} placeholder={t("wizard.min")} className="px-4 py-2.5 bg-[var(--surface-2)] border rounded-xl text-sm font-bold outline-none"/><input type="number" value={ticketMax} onChange={event=>setTicketMax(event.target.value)} placeholder={t("wizard.max")} className="px-4 py-2.5 bg-[var(--surface-2)] border rounded-xl text-sm font-bold outline-none"/></div></div>
          </div>)}

          {step === 3 && (<div className="space-y-3">
            <div><label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("wizard.investExperience")}</label><textarea value={investmentExperience} onChange={event=>setInvestmentExperience(event.target.value)} rows={3} placeholder={t("wizard.investExperienceDesc")} className="w-full px-4 py-3 bg-[var(--surface-2)] border rounded-xl text-sm font-bold text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none resize-none"/></div>
            <div><label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("wizard.priorPortfolio")}</label><textarea value={priorInvestments} onChange={event=>setPriorInvestments(event.target.value)} rows={2} placeholder={t("wizard.priorPortfolioDesc")} className="w-full px-4 py-3 bg-[var(--surface-2)] border rounded-xl text-sm font-bold text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none resize-none"/></div>
          </div>)}

          {step === 4 && (<div className="space-y-4">
            <h3 className="text-sm font-black text-[var(--text-primary)] uppercase">{t("wizard.reviewProfile")}</h3>
            <div className="grid grid-cols-2 gap-3 text-xs">
              {[["Name",name],["Email",email],["Organization",orgName],["Industries",industries.join(", ")],["Countries",countries.join(", ")],["Stages",stages.join(", ")||"Any"],["Ticket",ticketMin&&ticketMax?`$${ticketMin}–$${ticketMax}`:"—"],["Experience",investmentExperience?"Provided":"—"]].map(([label, value], index)=>(<div key={index} className="p-3 rounded-lg bg-[var(--surface-3)]"><p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{label}</p><p className="text-xs font-bold text-[var(--text-primary)] mt-0.5">{value||"—"}</p></div>))}
            </div>
            <p className="text-[10px] text-[var(--text-tertiary)] text-center">{t("wizard.reviewMessage")}</p>
          </div>)}
        </div>

        <div className="flex justify-between">
          <button onClick={prevStep} disabled={step===0} className="flex items-center gap-2 px-5 py-3 text-xs font-black text-[var(--text-secondary)] uppercase rounded-xl hover:bg-[var(--surface-3)] disabled:opacity-30"><ArrowLeft className="w-4 h-4"/> {t("wizard.previous")}</button>
          {step < 4 ? (
            <button onClick={nextStep} className="flex items-center gap-2 px-5 py-3 bg-[var(--brand-orange)] text-white text-xs font-black uppercase rounded-xl">{t("wizard.next")} <ArrowRight className="w-4 h-4"/></button>
          ) : (
            <button onClick={handleSubmit} disabled={loading} className="flex items-center gap-2 px-6 py-3 bg-[var(--brand-orange)] text-white text-xs font-black uppercase rounded-xl disabled:opacity-60">{loading?<><Loader2 className="w-4 h-4 animate-spin"/>{t("wizard.submitting")}</>:t("wizard.submitForReview")}</button>
          )}
        </div>
      </div>
    </div>
  );
}
