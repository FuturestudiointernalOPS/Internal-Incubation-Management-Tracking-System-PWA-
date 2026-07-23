"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Save,
  Loader2,
  Upload,
  Trash2,
  Plus,
  X,
  Building2,
  Briefcase,
  User,
  Users,
  FileText,
  Shield,
  Link as LinkIcon,
  Globe,
  MapPin,
  Calendar,
  Phone,
  Linkedin,
  ChevronRight,
  Rocket,
} from "lucide-react";

// ─── Constants ───────────────────────────────────────────────────────────────

const TOTAL_STEPS = 6;

const STEP_CONFIG = {
  1: {
    title: "Startup Identity",
    subtitle: "Tell us about your startup",
    icon: Building2,
  },
  2: {
    title: "Business Information",
    subtitle: "Legal and operational details",
    icon: Briefcase,
  },
  3: {
    title: "Founder Information",
    subtitle: "Who's leading the startup",
    icon: User,
  },
  4: {
    title: "Team Information",
    subtitle: "Your team structure",
    icon: Users,
  },
  5: {
    title: "Supporting Documents",
    subtitle: "Upload key documents",
    icon: FileText,
  },
  6: {
    title: "Review & Submit",
    subtitle: "Review everything before submitting",
    icon: CheckCircle2,
  },
};

const INDUSTRIES = [
  "fintech",
  "healthtech",
  "cleantech",
  "edtech",
  "agritech",
  "ecommerce",
  "saas",
  "ai_ml",
  "blockchain",
  "biotech",
  "mobility",
  "proptech",
  "logistics",
  "entertainment",
  "other",
];

const BUSINESS_STAGES = [
  { value: "idea", label: "Idea / Concept" },
  { value: "validation", label: "Validation" },
  { value: "early_traction", label: "Early Traction" },
  { value: "growth", label: "Growth" },
  { value: "scaling", label: "Scaling" },
];

const LEGAL_STRUCTURES = [
  "Sole Proprietorship",
  "Partnership",
  "Limited Liability Company (LLC)",
  "Corporation (Inc.)",
  "Non-Profit",
  "Cooperative",
  "Other",
];

const DOCUMENT_TYPES = [
  { value: "business_registration", label: "Business Registration", accept: ".pdf,.png,.jpg,.jpeg" },
  { value: "pitch_deck", label: "Pitch Deck", accept: ".pdf,.pptx,.ppt" },
  { value: "business_plan", label: "Business Plan", accept: ".pdf,.doc,.docx" },
  { value: "financial_docs", label: "Financial Documents", accept: ".pdf,.xls,.xlsx" },
  { value: "other", label: "Other Supporting Documents", accept: ".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx,.ppt,.pptx" },
];

// ─── Helper: get auth session from localStorage ──────────────────────────

function getStoredSession() {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// ─── Main Wizard Component ─────────────────────────────────────────────────

export default function StartupProfileWizard() {
  const { id } = useParams();
  const router = useRouter();
  const ventureId = id;

  // ── State ──
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [completion, setCompletion] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [lastSaved, setLastSaved] = useState(null);
  const [saveStatus, setSaveStatus] = useState("idle"); // idle | saving | saved | error
  const [documents, setDocuments] = useState([]);

  // Step data
  const [step1, setStep1] = useState({ startup_name: "", tagline: "", logo: "", industry: "", business_stage: "", website: "" });
  const [step2, setStep2] = useState({ registration_number: "", country: "", city: "", address: "", legal_structure: "", year_founded: "", description: "" });
  const [step3, setStep3] = useState({ founders: [{ name: "", email: "", phone: "", position: "", biography: "", linkedin: "" }] });
  const [step4, setStep4] = useState({ team_size: 1, members: [] });
  const [step5, setStep5] = useState({});

  // Validation
  const [stepErrors, setStepErrors] = useState({});

  // Upload
  const [uploading, setUploading] = useState(false);

  // Autosave timer
  const autosaveTimer = useRef(null);
  const lastSavedData = useRef(null);

  // ── Initialize: load saved profile ──
  useEffect(() => {
    const stored = getStoredSession();
    setSession(stored);
    if (stored) loadProfile();
    else setLoading(false);
  }, []);

  const loadProfile = async () => {
    try {
      const res = await fetch(`/api/ventures/${ventureId}/startup-profile`);
      const data = await res.json();

      if (!data.success) {
        setError(data.error || "Failed to load profile");
        setLoading(false);
        return;
      }

      // Restore step data
      if (data.steps) {
        if (data.steps[1]?.data) setStep1({ ...data.steps[1].data });
        if (data.steps[2]?.data) setStep2({ ...data.steps[2].data });
        if (data.steps[3]?.data) setStep3({ ...data.steps[3].data });
        if (data.steps[4]?.data) setStep4({ ...data.steps[4].data });
        if (data.steps[5]?.data) setStep5({ ...data.steps[5].data });
      }

      // Restore progress
      if (data.progress) {
        setCurrentStep(data.progress.current_step || 1);
        setCompletion(data.progress.completion_percentage || 0);
        setIsCompleted(data.progress.is_completed || false);
      }

      // Restore submission status
      if (data.profile) {
        setIsSubmitted(data.profile.is_submitted || false);
      }

      // Restore documents
      if (data.documents) {
        setDocuments(data.documents);
      }

      setLoading(false);
    } catch (e) {
      setError("Failed to load startup profile. Please try again.");
      setLoading(false);
    }
  };

  // ── Autosave ──
  const getStepData = useCallback((step) => {
    switch (step) {
      case 1: return step1;
      case 2: return step2;
      case 3: return step3;
      case 4: return step4;
      case 5: return step5;
      default: return {};
    }
  }, [step1, step2, step3, step4, step5]);

  const saveStep = useCallback(async (step, data) => {
    if (!session) return;
    setSaveStatus("saving");
    try {
      const res = await fetch(`/api/ventures/${ventureId}/startup-profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step, data }),
      });
      const result = await res.json();
      if (result.success) {
        setCompletion(result.completion_percentage || 0);
        setLastSaved(new Date());
        setSaveStatus("saved");
        if (result.validation_errors?.length > 0) {
          setStepErrors((prev) => ({ ...prev, [step]: result.validation_errors }));
        } else {
          setStepErrors((prev) => ({ ...prev, [step]: [] }));
        }
        lastSavedData.current = JSON.stringify(data);
      } else {
        setSaveStatus("error");
      }
    } catch {
      setSaveStatus("error");
    }
  }, [session, ventureId]);

  // Debounced autosave
  useEffect(() => {
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    const data = getStepData(currentStep);
    const serialized = JSON.stringify(data);
    if (serialized === lastSavedData.current) return;

    autosaveTimer.current = setTimeout(() => {
      saveStep(currentStep, data);
    }, 1500); // < 2 seconds as required

    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
  }, [step1, step2, step3, step4, step5, currentStep, getStepData, saveStep]);

  // ── Navigation ──
  const goToStep = (step) => {
    // Save current step before navigating
    const data = getStepData(currentStep);
    saveStep(currentStep, data);
    setCurrentStep(step);
    setStepErrors({});
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const goNext = () => {
    if (currentStep < TOTAL_STEPS) goToStep(currentStep + 1);
  };

  const goPrev = () => {
    if (currentStep > 1) goToStep(currentStep - 1);
  };

  // ── Step 3: Founder management ──
  const addFounder = () => {
    setStep3((prev) => ({
      ...prev,
      founders: [...prev.founders, { name: "", email: "", phone: "", position: "", biography: "", linkedin: "" }],
    }));
  };

  const removeFounder = (index) => {
    if (step3.founders.length <= 1) return;
    setStep3((prev) => ({
      ...prev,
      founders: prev.founders.filter((_, i) => i !== index),
    }));
  };

  const updateFounder = (index, field, value) => {
    setStep3((prev) => {
      const founders = [...prev.founders];
      founders[index] = { ...founders[index], [field]: value };
      return { ...prev, founders };
    });
  };

  // ── Step 4: Team members ──
  const addTeamMember = () => {
    setStep4((prev) => ({
      ...prev,
      members: [...(prev.members || []), { name: "", role: "", department: "" }],
    }));
  };

  const removeTeamMember = (index) => {
    setStep4((prev) => ({
      ...prev,
      members: prev.members.filter((_, i) => i !== index),
    }));
  };

  const updateTeamMember = (index, field, value) => {
    setStep4((prev) => {
      const members = [...(prev.members || [])];
      members[index] = { ...members[index], [field]: value };
      return { ...prev, members };
    });
  };

  // ── Step 5: Document upload ──
  const handleFileUpload = async (documentType, file) => {
    // Validate file type client-side
    const allowedExtensions = [".pdf", ".png", ".jpg", ".jpeg", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx"];
    const ext = "." + file.name.split(".").pop().toLowerCase();
    if (!allowedExtensions.includes(ext)) {
      setStepErrors((prev) => ({
        ...prev,
        5: [...(prev[5] || []), `Invalid file type: ${ext}. Allowed: ${allowedExtensions.join(", ")}`],
      }));
      return;
    }

    setUploading(true);
    try {
      // Upload to Vercel Blob
      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "upload",
          file_name: file.name,
          file_type: file.type,
        }),
      });
      const uploadData = await uploadRes.json();

      if (!uploadData.url) {
        // Fallback: save document metadata directly if upload to blob fails
        const docUrl = URL.createObjectURL(file);
        await fetch(`/api/ventures/${ventureId}/startup-profile`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "upload_document",
            document_type: documentType,
            file_name: file.name,
            file_size: file.size,
            file_type: file.type,
            file_url: docUrl,
          }),
        });
      } else {
        await fetch(`/api/ventures/${ventureId}/startup-profile`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "upload_document",
            document_type: documentType,
            file_name: file.name,
            file_size: file.size,
            file_type: file.type,
            file_url: uploadData.url,
          }),
        });
      }

      // Refresh documents list
      const profileRes = await fetch(`/api/ventures/${ventureId}/startup-profile`);
      const profileData = await profileRes.json();
      if (profileData.success) {
        setDocuments(profileData.documents || []);
      }

      setUploading(false);
    } catch (e) {
      setStepErrors((prev) => ({
        ...prev,
        5: [...(prev[5] || []), "Upload failed. Please try again."],
      }));
      setUploading(false);
    }
  };

  const deleteDocument = async (docId) => {
    try {
      await fetch(`/api/ventures/${ventureId}/startup-profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete_document", document_id: docId }),
      });
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
    } catch {
      // ignore
    }
  };

  // ── Step 6: Submit ──
  const handleSubmit = async () => {
    setSubmitting(true);
    setSubmitError(null);

    // Save all steps first
    for (let s = 1; s <= 5; s++) {
      await saveStep(s, getStepData(s));
    }

    try {
      const res = await fetch(`/api/ventures/${ventureId}/startup-profile/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();

      if (data.success) {
        setIsSubmitted(true);
        setCompletion(100);
        setSubmitting(false);
      } else {
        if (data.step_errors) {
          setStepErrors(data.step_errors);
        }
        setSubmitError(data.error || "Submission failed. Please fix errors and try again.");
        setSubmitting(false);
      }
    } catch (e) {
      setSubmitError("Network error. Please try again.");
      setSubmitting(false);
    }
  };

  // ── Render helpers ──

  const renderProgressBar = () => (
    <div className="w-full bg-tertiary rounded-full h-2 overflow-hidden">
      <div
        className="h-full bg-gradient-to-r from-[var(--brand-orange)] to-orange-400 rounded-full transition-all duration-500 ease-out"
        style={{ width: `${completion}%` }}
      />
    </div>
  );

  const renderStepIndicator = () => (
    <div className="flex items-center gap-2 overflow-x-auto pb-2">
      {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((step) => {
        const stepConfig = STEP_CONFIG[step];
        const Icon = stepConfig.icon;
        const isActive = currentStep === step;
        const isPast = completion >= ((step - 1) / TOTAL_STEPS) * 100;
        return (
          <button
            key={step}
            onClick={() => goToStep(step)}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
              isActive
                ? "bg-[var(--brand-orange)]/10 text-[var(--brand-orange)] border border-[var(--brand-orange)]/30"
                : isPast
                  ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                  : "bg-tertiary text-slate-500 border border-[var(--border-primary)] hover:border-slate-500/30"
            }`}
          >
            <Icon className="w-3 h-3" />
            <span className="hidden sm:inline">{stepConfig.title}</span>
            <span className="sm:hidden">{step}</span>
          </button>
        );
      })}
    </div>
  );

  const renderSaveIndicator = () => {
    if (saveStatus === "idle") return null;
    const icons = {
      saving: <Loader2 className="w-3 h-3 animate-spin text-amber-400" />,
      saved: <CheckCircle2 className="w-3 h-3 text-emerald-400" />,
      error: <AlertCircle className="w-3 h-3 text-rose-400" />,
    };
    const labels = {
      saving: "Saving...",
      saved: lastSaved ? `Saved ${lastSaved.toLocaleTimeString()}` : "Saved",
      error: "Save failed",
    };
    return (
      <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-500">
        {icons[saveStatus]}
        {labels[saveStatus]}
      </div>
    );
  };

  // ── Render step content ──

  const renderStep1 = () => (
    <div className="space-y-6">
      <div>
        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">
          Startup Name <span className="text-rose-500">*</span>
        </label>
        <input
          type="text"
          value={step1.startup_name}
          onChange={(e) => setStep1((p) => ({ ...p, startup_name: e.target.value }))}
          placeholder="e.g., TechFlow Inc."
          className="w-full bg-tertiary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-sm font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)] transition-all"
        />
        {(stepErrors[1] || []).filter((e) => e.toLowerCase().includes("startup name")).map((e, i) => (
          <p key={i} className="text-[9px] font-bold text-rose-400 mt-1 flex items-center gap-1">
            <AlertCircle className="w-2.5 h-2.5" /> {e}
          </p>
        ))}
      </div>

      <div>
        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Tagline</label>
        <input
          type="text"
          value={step1.tagline}
          onChange={(e) => setStep1((p) => ({ ...p, tagline: e.target.value }))}
          placeholder="A short description of what you do"
          className="w-full bg-tertiary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-sm font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)] transition-all"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">
            Industry <span className="text-rose-500">*</span>
          </label>
          <select
            value={step1.industry}
            onChange={(e) => setStep1((p) => ({ ...p, industry: e.target.value }))}
            className="w-full bg-tertiary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-sm font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)] transition-all"
          >
            <option value="">Select industry</option>
            {INDUSTRIES.map((ind) => (
              <option key={ind} value={ind}>{ind.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}</option>
            ))}
          </select>
          {(stepErrors[1] || []).filter((e) => e.toLowerCase().includes("industry")).map((e, i) => (
            <p key={i} className="text-[9px] font-bold text-rose-400 mt-1">{e}</p>
          ))}
        </div>

        <div>
          <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">
            Business Stage <span className="text-rose-500">*</span>
          </label>
          <select
            value={step1.business_stage}
            onChange={(e) => setStep1((p) => ({ ...p, business_stage: e.target.value }))}
            className="w-full bg-tertiary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-sm font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)] transition-all"
          >
            <option value="">Select stage</option>
            {BUSINESS_STAGES.map((bs) => (
              <option key={bs.value} value={bs.value}>{bs.label}</option>
            ))}
          </select>
          {(stepErrors[1] || []).filter((e) => e.toLowerCase().includes("business stage")).map((e, i) => (
            <p key={i} className="text-[9px] font-bold text-rose-400 mt-1">{e}</p>
          ))}
        </div>
      </div>

      <div>
        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Website (optional)</label>
        <div className="relative">
          <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="url"
            value={step1.website}
            onChange={(e) => setStep1((p) => ({ ...p, website: e.target.value }))}
            placeholder="https://example.com"
            className="w-full bg-tertiary border border-[var(--border-primary)] rounded-xl pl-10 pr-4 py-3 text-sm font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)] transition-all"
          />
        </div>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6">
      <div>
        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Company Registration Number (optional)</label>
        <input
          type="text"
          value={step2.registration_number}
          onChange={(e) => setStep2((p) => ({ ...p, registration_number: e.target.value }))}
          placeholder="e.g., RC-2024-001"
          className="w-full bg-tertiary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-sm font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)] transition-all"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">
            Country <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            value={step2.country}
            onChange={(e) => setStep2((p) => ({ ...p, country: e.target.value }))}
            placeholder="e.g., Benin"
            className="w-full bg-tertiary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-sm font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)] transition-all"
          />
          {(stepErrors[2] || []).filter((e) => e.toLowerCase().includes("country")).map((e, i) => (
            <p key={i} className="text-[9px] font-bold text-rose-400 mt-1">{e}</p>
          ))}
        </div>

        <div>
          <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">City (optional)</label>
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={step2.city}
              onChange={(e) => setStep2((p) => ({ ...p, city: e.target.value }))}
              placeholder="e.g., Cotonou"
              className="w-full bg-tertiary border border-[var(--border-primary)] rounded-xl pl-10 pr-4 py-3 text-sm font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)] transition-all"
            />
          </div>
        </div>
      </div>

      <div>
        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Address (optional)</label>
        <input
          type="text"
          value={step2.address}
          onChange={(e) => setStep2((p) => ({ ...p, address: e.target.value }))}
          placeholder="Full business address"
          className="w-full bg-tertiary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-sm font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)] transition-all"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">
            Legal Structure <span className="text-rose-500">*</span>
          </label>
          <select
            value={step2.legal_structure}
            onChange={(e) => setStep2((p) => ({ ...p, legal_structure: e.target.value }))}
            className="w-full bg-tertiary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-sm font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)] transition-all"
          >
            <option value="">Select legal structure</option>
            {LEGAL_STRUCTURES.map((ls) => (
              <option key={ls} value={ls}>{ls}</option>
            ))}
          </select>
          {(stepErrors[2] || []).filter((e) => e.toLowerCase().includes("legal")).map((e, i) => (
            <p key={i} className="text-[9px] font-bold text-rose-400 mt-1">{e}</p>
          ))}
        </div>

        <div>
          <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">
            Year Founded <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="number"
              min={1900}
              max={new Date().getFullYear()}
              value={step2.year_founded}
              onChange={(e) => setStep2((p) => ({ ...p, year_founded: e.target.value }))}
              placeholder="e.g., 2024"
              className="w-full bg-tertiary border border-[var(--border-primary)] rounded-xl pl-10 pr-4 py-3 text-sm font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)] transition-all"
            />
          </div>
          {(stepErrors[2] || []).filter((e) => e.toLowerCase().includes("year")).map((e, i) => (
            <p key={i} className="text-[9px] font-bold text-rose-400 mt-1">{e}</p>
          ))}
        </div>
      </div>

      <div>
        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Company Description (optional)</label>
        <textarea
          value={step2.description}
          onChange={(e) => setStep2((p) => ({ ...p, description: e.target.value }))}
          rows={3}
          placeholder="Tell us about your company's mission and vision"
          className="w-full bg-tertiary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-sm font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)] transition-all resize-none"
        />
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-6">
      {(stepErrors[3] || []).map((e, i) => (
        <div key={i} className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span className="text-[10px] font-bold text-rose-400">{e}</span>
        </div>
      ))}

      {step3.founders.map((founder, index) => (
        <div key={index} className="p-5 bg-tertiary rounded-2xl border border-[var(--border-primary)] space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-[10px] font-black text-[var(--text-primary)] uppercase tracking-widest">
              Founder {index + 1}
            </h4>
            {step3.founders.length > 1 && (
              <button
                onClick={() => removeFounder(index)}
                className="p-1.5 text-rose-500 hover:bg-rose-500/10 rounded-lg transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1 block">
                Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={founder.name}
                onChange={(e) => updateFounder(index, "name", e.target.value)}
                placeholder="Full name"
                className="w-full bg-primary border border-[var(--border-primary)] rounded-xl px-3 py-2.5 text-xs font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)] transition-all"
              />
            </div>
            <div>
              <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1 block">
                Email <span className="text-rose-500">*</span>
              </label>
              <input
                type="email"
                value={founder.email}
                onChange={(e) => updateFounder(index, "email", e.target.value)}
                placeholder="email@example.com"
                className="w-full bg-primary border border-[var(--border-primary)] rounded-xl px-3 py-2.5 text-xs font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)] transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1 block">
                Phone <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                <input
                  type="tel"
                  value={founder.phone}
                  onChange={(e) => updateFounder(index, "phone", e.target.value)}
                  placeholder="+229 00 00 00 00"
                  className="w-full bg-primary border border-[var(--border-primary)] rounded-xl pl-10 pr-3 py-2.5 text-xs font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)] transition-all"
                />
              </div>
            </div>
            <div>
              <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1 block">
                Position <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={founder.position}
                onChange={(e) => updateFounder(index, "position", e.target.value)}
                placeholder="e.g., CEO, CTO"
                className="w-full bg-primary border border-[var(--border-primary)] rounded-xl px-3 py-2.5 text-xs font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)] transition-all"
              />
            </div>
          </div>

          <div>
            <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1 block">Biography</label>
            <textarea
              value={founder.biography}
              onChange={(e) => updateFounder(index, "biography", e.target.value)}
              rows={2}
              placeholder="Brief professional background"
              className="w-full bg-primary border border-[var(--border-primary)] rounded-xl px-3 py-2.5 text-xs font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)] transition-all resize-none"
            />
          </div>

          <div>
            <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1 block">LinkedIn (optional)</label>
            <div className="relative">
              <Linkedin className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
              <input
                type="url"
                value={founder.linkedin}
                onChange={(e) => updateFounder(index, "linkedin", e.target.value)}
                placeholder="https://linkedin.com/in/..."
                className="w-full bg-primary border border-[var(--border-primary)] rounded-xl pl-10 pr-3 py-2.5 text-xs font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)] transition-all"
              />
            </div>
          </div>
        </div>
      ))}

      <button
        onClick={addFounder}
        className="flex items-center gap-2 text-[9px] font-black text-[var(--brand-orange)] uppercase tracking-widest hover:underline"
      >
        <Plus className="w-3.5 h-3.5" /> Add Another Founder
      </button>
    </div>
  );

  const renderStep4 = () => (
    <div className="space-y-6">
      <div className="max-w-xs">
        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">
          Team Size <span className="text-rose-500">*</span>
        </label>
        <input
          type="number"
          min={1}
          value={step4.team_size}
          onChange={(e) => setStep4((p) => ({ ...p, team_size: parseInt(e.target.value) || 1 }))}
          className="w-full bg-tertiary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-sm font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)] transition-all"
        />
        {(stepErrors[4] || []).filter((e) => e.toLowerCase().includes("team size")).map((e, i) => (
          <p key={i} className="text-[9px] font-bold text-rose-400 mt-1">{e}</p>
        ))}
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Team Members (optional)</label>
          <button
            onClick={addTeamMember}
            className="flex items-center gap-1 text-[8px] font-black text-[var(--brand-orange)] uppercase tracking-wider hover:underline"
          >
            <Plus className="w-3 h-3" /> Add Member
          </button>
        </div>

        {(step4.members || []).length === 0 && (
          <p className="text-[10px] text-slate-500 italic py-4 text-center border-2 border-dashed border-[var(--border-primary)] rounded-xl">
            No team members added yet. Click "Add Member" to include key team members.
          </p>
        )}

        <div className="space-y-3">
          {(step4.members || []).map((member, index) => (
            <div key={index} className="flex items-start gap-3 p-4 bg-tertiary rounded-xl border border-[var(--border-primary)]">
              <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3">
                <input
                  type="text"
                  value={member.name}
                  onChange={(e) => updateTeamMember(index, "name", e.target.value)}
                  placeholder="Name"
                  className="w-full bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-2 text-[10px] font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)] transition-all"
                />
                <input
                  type="text"
                  value={member.role}
                  onChange={(e) => updateTeamMember(index, "role", e.target.value)}
                  placeholder="Role"
                  className="w-full bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-2 text-[10px] font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)] transition-all"
                />
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={member.department}
                    onChange={(e) => updateTeamMember(index, "department", e.target.value)}
                    placeholder="Department"
                    className="w-full bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-2 text-[10px] font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)] transition-all"
                  />
                  <button
                    onClick={() => removeTeamMember(index)}
                    className="p-2 text-rose-500 hover:bg-rose-500/10 rounded-lg transition-all shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderStep5 = () => {
    const getDocsByType = (type) => documents.filter((d) => d.document_type === type);

    return (
      <div className="space-y-6">
        {(stepErrors[5] || []).map((e, i) => (
          <div key={i} className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span className="text-[10px] font-bold text-rose-400">{e}</span>
          </div>
        ))}

        {DOCUMENT_TYPES.map((docType) => {
          const uploaded = getDocsByType(docType.value);
          return (
            <div key={docType.value} className="p-5 bg-tertiary rounded-2xl border border-[var(--border-primary)]">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h4 className="text-[10px] font-black text-[var(--text-primary)] uppercase tracking-widest">
                    {docType.label}
                  </h4>
                  <p className="text-[8px] text-slate-500 mt-0.5">Accepted: {docType.accept}</p>
                </div>
                <label className="cursor-pointer px-3 py-2 bg-[var(--brand-orange)] text-black rounded-xl text-[8px] font-black uppercase tracking-widest hover:brightness-110 transition-all flex items-center gap-1.5">
                  <Upload className="w-3 h-3" />
                  {uploading ? "Uploading..." : "Upload"}
                  <input
                    type="file"
                    accept={docType.accept}
                    className="hidden"
                    disabled={uploading}
                    onChange={(e) => {
                      if (e.target.files[0]) {
                        handleFileUpload(docType.value, e.target.files[0]);
                        e.target.value = "";
                      }
                    }}
                  />
                </label>
              </div>

              {uploaded.length === 0 && (
                <p className="text-[10px] text-slate-500 italic">No files uploaded yet.</p>
              )}

              {uploaded.length > 0 && (
                <div className="space-y-2">
                  {uploaded.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between p-3 bg-primary rounded-xl border border-[var(--border-primary)]">
                      <div className="flex items-center gap-3 min-w-0">
                        <FileText className="w-4 h-4 text-[var(--brand-orange)] shrink-0" />
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold text-[var(--text-primary)] truncate">{doc.file_name}</p>
                          <p className="text-[8px] text-slate-500">
                            {doc.file_size ? `${(doc.file_size / 1024).toFixed(0)} KB` : ""}
                            {doc.uploaded_at ? ` · ${new Date(doc.uploaded_at).toLocaleDateString()}` : ""}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => deleteDocument(doc.id)}
                        className="p-1.5 text-rose-500 hover:bg-rose-500/10 rounded-lg transition-all shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const renderStep6 = () => {
    const allSteps = [
      { num: 1, title: "Startup Identity", data: step1, fields: ["startup_name", "industry", "business_stage", "website"] },
      { num: 2, title: "Business Information", data: step2, fields: ["registration_number", "country", "city", "legal_structure", "year_founded"] },
      { num: 3, title: "Founder Information", data: step3, fields: ["founders"] },
      { num: 4, title: "Team Information", data: step4, fields: ["team_size", "members"] },
      { num: 5, title: "Supporting Documents", data: { documents }, fields: ["documents"] },
    ];

    const renderField = (label, value) => {
      if (!value) return null;
      return (
        <div className="flex items-start gap-2">
          <span className="text-[8px] font-black text-slate-500 uppercase tracking-wider min-w-[120px] shrink-0">{label}</span>
          <span className="text-xs font-bold text-[var(--text-primary)]">{value}</span>
        </div>
      );
    };

    const hasStepError = (stepNum) => {
      return stepErrors[stepNum] && stepErrors[stepNum].length > 0;
    };

    return (
      <div className="space-y-6">
        {isSubmitted ? (
          <div className="text-center py-12">
            <div className="w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-10 h-10 text-emerald-400" />
            </div>
            <h2 className="text-2xl font-black text-[var(--text-primary)] tracking-tight mb-2">
              Profile Submitted!
            </h2>
            <p className="text-sm text-slate-500 max-w-md mx-auto">
              Your startup profile has been submitted successfully. The Venture OS team will review your information.
            </p>
            <button
              onClick={() => router.push(`/admin/ventures/${ventureId}`)}
              className="mt-8 px-6 py-3 bg-[var(--brand-orange)] text-black rounded-xl text-[10px] font-black uppercase tracking-widest hover:brightness-110 transition-all"
            >
              View Venture Dashboard
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-black text-[var(--text-primary)] uppercase tracking-wider">
                Review Your Profile
              </h3>
              <span className="text-[9px] font-bold text-slate-500">{completion}% Complete</span>
            </div>
            {renderProgressBar()}

            {submitError && (
              <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span className="text-[10px] font-bold text-rose-400">{submitError}</span>
              </div>
            )}

            {allSteps.map((step) => {
              const StepIcon = STEP_CONFIG[step.num].icon;
              const hasErr = hasStepError(step.num);
              return (
                <div key={step.num} className={`p-5 rounded-2xl border ${
                  hasErr ? "border-rose-500/30 bg-rose-500/5" : "border-[var(--border-primary)] bg-tertiary"
                }`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <StepIcon className={`w-4 h-4 ${hasErr ? "text-rose-400" : "text-[var(--brand-orange)]"}`} />
                      <h4 className={`text-[10px] font-black uppercase tracking-widest ${hasErr ? "text-rose-400" : "text-[var(--text-primary)]"}`}>
                        {step.title}
                      </h4>
                      {hasErr && <span className="text-[8px] font-bold text-rose-400">({stepErrors[step.num].length} errors)</span>}
                    </div>
                    <button
                      onClick={() => goToStep(step.num)}
                      className="text-[8px] font-black text-[var(--brand-orange)] uppercase tracking-wider hover:underline flex items-center gap-1"
                    >
                      Edit <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>

                  {step.num === 1 && (
                    <div className="space-y-1 text-xs">
                      {renderField("Startup Name", step1.startup_name)}
                      {renderField("Industry", step1.industry?.replace(/_/g, " "))}
                      {renderField("Stage", step1.business_stage?.replace(/_/g, " "))}
                      {renderField("Website", step1.website)}
                    </div>
                  )}

                  {step.num === 2 && (
                    <div className="space-y-1 text-xs">
                      {renderField("Registration #", step2.registration_number)}
                      {renderField("Country", step2.country)}
                      {renderField("City", step2.city)}
                      {renderField("Legal Structure", step2.legal_structure)}
                      {renderField("Year Founded", step2.year_founded)}
                    </div>
                  )}

                  {step.num === 3 && (
                    <div className="space-y-2">
                      {(step3.founders || []).map((f, i) => (
                        <div key={i} className="flex items-center gap-3 p-2 bg-primary rounded-lg">
                          <div className="w-8 h-8 rounded-full bg-[var(--brand-orange)]/10 flex items-center justify-center text-[10px] font-black text-[var(--brand-orange)]">
                            {f.name?.charAt(0) || "?"}
                          </div>
                          <div className="text-xs">
                            <p className="font-bold text-[var(--text-primary)]">{f.name}</p>
                            <p className="text-[9px] text-slate-500">{f.email} · {f.position}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {step.num === 4 && (
                    <div className="space-y-1 text-xs">
                      {renderField("Team Size", step4.team_size)}
                      {renderField("Members", (step4.members || []).length > 0 ? `${step4.members.length} members added` : "None added")}
                    </div>
                  )}

                  {step.num === 5 && (
                    <div className="space-y-1 text-xs">
                      {renderField("Documents", documents.length > 0 ? `${documents.length} file(s) uploaded` : "No files uploaded")}
                    </div>
                  )}
                </div>
              );
            })}

            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full py-4 bg-[var(--brand-orange)] text-black rounded-xl text-[10px] font-black uppercase tracking-widest hover:brightness-110 transition-all disabled:opacity-30 flex items-center justify-center gap-2"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Rocket className="w-4 h-4" />
              )}
              {submitting ? "Submitting..." : "Submit Startup Profile"}
            </button>
          </>
        )}
      </div>
    );
  };

  // ── Render step content by number ──
  const renderStepContent = () => {
    switch (currentStep) {
      case 1: return renderStep1();
      case 2: return renderStep2();
      case 3: return renderStep3();
      case 4: return renderStep4();
      case 5: return renderStep5();
      case 6: return renderStep6();
      default: return null;
    }
  };

  const currentStepConfig = STEP_CONFIG[currentStep];
  const StepIcon = currentStepConfig?.icon;

  // ── Loading state ──
  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-[var(--brand-orange)] mx-auto mb-4" />
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Loading wizard...</p>
        </div>
      </div>
    );
  }

  // ── Error state ──
  if (error) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center p-6">
        <div className="w-full max-w-md text-center">
          <AlertCircle className="w-12 h-12 text-rose-400 mx-auto mb-4" />
          <h2 className="text-lg font-black text-[var(--text-primary)] mb-2">Error</h2>
          <p className="text-sm text-slate-500 mb-6">{error}</p>
          <button
            onClick={() => router.push(`/admin/ventures/${ventureId}`)}
            className="px-6 py-3 bg-[var(--brand-orange)] text-black rounded-xl text-[10px] font-black uppercase tracking-widest hover:brightness-110 transition-all"
          >
            Back to Venture
          </button>
        </div>
      </div>
    );
  }

  // ── Main render ──
  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full bg-[var(--brand-orange)]" />
              <span className="text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-[0.3em]">
                Venture OS — Startup Profile Wizard
              </span>
            </div>
            <h1 className="text-2xl font-black text-[var(--text-primary)] tracking-tight">
              {currentStepConfig?.title || "Wizard"}
            </h1>
            <p className="text-xs text-slate-500 mt-1">{currentStepConfig?.subtitle}</p>
          </div>
          <button
            onClick={() => router.push(`/admin/ventures/${ventureId}`)}
            className="text-[9px] font-bold text-slate-500 hover:text-[var(--text-primary)] transition-all flex items-center gap-1"
          >
            <X className="w-3.5 h-3.5" /> Close
          </button>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500">{completion}% Complete</span>
            {renderSaveIndicator()}
          </div>
          {renderProgressBar()}
        </div>

        {/* Step Indicator */}
        {renderStepIndicator()}

        {/* Step Content */}
        {isSubmitted ? (
          <div className="card p-8">
            {renderStepContent()}
          </div>
        ) : (
          <div className="card p-6 md:p-8">
            {renderStepContent()}
          </div>
        )}

        {/* Navigation */}
        {!isSubmitted && currentStep < 6 && (
          <div className="flex items-center justify-between">
            <button
              onClick={goPrev}
              disabled={currentStep === 1}
              className="px-5 py-3 rounded-xl border border-[var(--border-primary)] text-[9px] font-black uppercase tracking-widest hover:bg-tertiary transition-all disabled:opacity-20 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Previous
            </button>

            <div className="text-[9px] font-bold text-slate-500">
              Step {currentStep} of {TOTAL_STEPS}
            </div>

            <button
              onClick={goNext}
              className="px-5 py-3 bg-[var(--brand-orange)] text-black rounded-xl text-[9px] font-black uppercase tracking-widest hover:brightness-110 transition-all flex items-center gap-2"
            >
              Next <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Navigation for Step 6 */}
        {!isSubmitted && currentStep === 6 && (
          <div className="flex items-center justify-between">
            <button
              onClick={goPrev}
              className="px-5 py-3 rounded-xl border border-[var(--border-primary)] text-[9px] font-black uppercase tracking-widest hover:bg-tertiary transition-all flex items-center gap-2"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Previous
            </button>

            <div className="text-[9px] font-bold text-slate-500">
              Step 6 of 6 — Review
            </div>

            <div />
          </div>
        )}
      </div>
    </div>
  );
}
