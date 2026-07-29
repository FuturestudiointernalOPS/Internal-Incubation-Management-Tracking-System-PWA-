"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Loader2, Send, Save, ArrowLeft, CheckCircle2, AlertTriangle,
  FileText, Clock, User, Info, ChevronDown, ChevronUp, Star, X,
} from "lucide-react";

const COUNTRY_CODES = [
  { flag: "🇳🇬", name: "Nigeria", code: "+234" },
  { flag: "🇧🇯", name: "Benin", code: "+229" },
  { flag: "🇬🇭", name: "Ghana", code: "+233" },
  { flag: "🇰🇪", name: "Kenya", code: "+254" },
  { flag: "🇿🇦", name: "South Africa", code: "+27" },
  { flag: "🇪🇬", name: "Egypt", code: "+20" },
  { flag: "🇨🇮", name: "Côte d'Ivoire", code: "+225" },
  { flag: "🇸🇳", name: "Senegal", code: "+221" },
  { flag: "🇹🇬", name: "Togo", code: "+228" },
  { flag: "🇨🇲", name: "Cameroon", code: "+237" },
  { flag: "🇷🇼", name: "Rwanda", code: "+250" },
  { flag: "🇺🇬", name: "Uganda", code: "+256" },
  { flag: "🇹🇿", name: "Tanzania", code: "+255" },
  { flag: "🇪🇹", name: "Ethiopia", code: "+251" },
  { flag: "🇫🇷", name: "France", code: "+33" },
  { flag: "🇬🇧", name: "United Kingdom", code: "+44" },
  { flag: "🇺🇸", name: "United States", code: "+1" },
  { flag: "🇨🇦", name: "Canada", code: "+1" },
  { flag: "🇩🇪", name: "Germany", code: "+49" },
  { flag: "🇮🇳", name: "India", code: "+91" },
  { flag: "🇨🇳", name: "China", code: "+86" },
  { flag: "🇦🇪", name: "UAE", code: "+971" },
  { flag: "🇧🇷", name: "Brazil", code: "+55" },
];

const cn = (...classes) => classes.filter(Boolean).join(" ");

const FIELD_TYPES = {
  text: "text",
  textarea: "textarea",
  number: "number",
  email: "email",
  phone: "tel",
  date: "date",
  time: "time",
  select: "select",
  radio: "radio",
  checkbox: "checkbox",
  multiselect: "multiselect",
  file: "file",
  url: "url",
  rating: "rating",
  currency: "number",
  signature: "signature",
  richtext: "richtext",
  hidden: "hidden",
};

export default function SubmitFormPage() {
  const params = useParams();
  const router = useRouter();
  const runId = params.runId;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [notification, setNotification] = useState(null);

  // Run + Form data
  const [run, setRun] = useState(null);
  const [form, setForm] = useState(null);
  const [sections, setSections] = useState([]);
  const [fields, setFields] = useState([]);
  const [existingSubmission, setExistingSubmission] = useState(null);

  // Form state
  const [formData, setFormData] = useState({});
  const [errors, setErrors] = useState({});
  const [expandedSections, setExpandedSections] = useState({});

  const notify = (msg) => { setNotification(msg); setTimeout(() => setNotification(null), 3000); };

  useEffect(() => {
    loadRun();
  }, [runId]);

  const loadRun = async () => {
    setLoading(true);
    setError(null);
    try {
      // Load run detail + user's submission (participant endpoint)
      const runRes = await fetch(`/api/platform/form-runs?id=${runId}&participant=true`);
      const runData = await runRes.json();
      if (!runData.success) throw new Error(runData.error || "Run not found");
      setRun(runData.run);

      // Set existing submission if any
      if (runData.submission) {
        setExistingSubmission(runData.submission);
        if (runData.submission.data) {
          setFormData(runData.submission.data);
        }
      }

      // Load form definition (participant can access single form)
      const formRes = await fetch(`/api/platform/forms?id=${runData.run.form_id}`);
      const formData = await formRes.json();
      if (!formData.success) throw new Error("Form not found");
      setForm(formData.form);
      setSections(formData.sections || []);
      setFields(formData.fields || []);

      // Initialize expanded sections
      const expanded = {};
      (formData.sections || []).forEach((s) => { expanded[s.id] = true; });
      setExpandedSections(expanded);

    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  const updateField = (fieldId, value) => {
    setFormData((prev) => ({ ...prev, [fieldId]: value }));
    // Clear error for this field
    setErrors((prev) => {
      const next = { ...prev };
      delete next[fieldId];
      return next;
    });
  };

  const validate = () => {
    const newErrors = {};
    fields.forEach((f) => {
      if (f.required && (!formData[f.id] || (typeof formData[f.id] === "string" && !formData[f.id].trim()))) {
        newErrors[f.id] = `${f.label} is required`;
      }
      // Validate based on field type and validation rules
      if (formData[f.id] && f.validation) {
        const v = f.validation;
        if (f.field_type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData[f.id])) {
          newErrors[f.id] = "Please enter a valid email";
        }
        if (v.minLength && String(formData[f.id]).length < v.minLength) {
          newErrors[f.id] = `Minimum ${v.minLength} characters`;
        }
        if (v.maxLength && String(formData[f.id]).length > v.maxLength) {
          newErrors[f.id] = `Maximum ${v.maxLength} characters`;
        }
        if (v.min !== undefined && Number(formData[f.id]) < v.min) {
          newErrors[f.id] = `Minimum value is ${v.min}`;
        }
        if (v.max !== undefined && Number(formData[f.id]) > v.max) {
          newErrors[f.id] = `Maximum value is ${v.max}`;
        }
        if (v.pattern && !new RegExp(v.pattern).test(formData[f.id])) {
          newErrors[f.id] = v.message || "Invalid format";
        }
      }
    });
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSaveDraft = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/platform/form-runs?action=submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ run_id: parseInt(runId), data: formData, status: "draft" }),
      });
      const data = await res.json();
      if (data.success) {
        setExistingSubmission(data.submission);
        notify("Draft saved");
      } else {
        notify(data.error || "Failed to save draft");
      }
    } catch (_) {}
    setSaving(false);
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/platform/form-runs?action=submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ run_id: parseInt(runId), data: formData, status: "submitted" }),
      });
      const data = await res.json();
      if (data.success) {
        setExistingSubmission(data.submission);
        setSuccess(true);
        notify("Submission received!");
      } else {
        notify(data.error || "Failed to submit");
      }
    } catch (_) {}
    setSaving(false);
  };

  const isSubmitted = existingSubmission?.status === "submitted" || existingSubmission?.status === "approved" || existingSubmission?.status === "rejected" || existingSubmission?.status === "revision_requested";
  const isApproved = existingSubmission?.status === "approved";
  const isRejected = existingSubmission?.status === "rejected";
  const needsRevision = existingSubmission?.status === "revision_requested";
  const isDraft = existingSubmission?.status === "draft";

  const renderField = (field) => {
    const value = formData[field.id] || field.default_value || "";
    const hasError = errors[field.id];
    const isDisabled = isSubmitted && !needsRevision;

    const baseInputClass = "w-full rounded-xl px-4 py-3 text-[11px] font-bold outline-none bg-primary border text-[var(--text-primary)] transition-colors";
    const normalBorder = hasError ? "border-rose-500" : "border-[var(--border-primary)] focus:border-[var(--brand-orange)]";
    const inputClass = cn(baseInputClass, normalBorder, isDisabled && "opacity-60 cursor-not-allowed");

    switch (field.field_type) {
      case "textarea":
      case "richtext":
        return (
          <textarea
            value={value}
            onChange={(e) => updateField(field.id, e.target.value)}
            rows={4}
            placeholder={field.placeholder || ""}
            disabled={isDisabled}
            className={cn(inputClass, "resize-none")}
          />
        );

      case "number":
      case "currency":
        return (
          <input
            type="number"
            value={value}
            onChange={(e) => updateField(field.id, e.target.value)}
            placeholder={field.placeholder || ""}
            disabled={isDisabled}
            className={inputClass}
            min={field.validation?.min}
            max={field.validation?.max}
          />
        );

      case "email":
        return (
          <input
            type="email"
            value={value}
            onChange={(e) => updateField(field.id, e.target.value)}
            placeholder={field.placeholder || "email@example.com"}
            disabled={isDisabled}
            className={inputClass}
          />
        );

      case "phone": {
        // Parse existing value: "+234 90847820" → prefix "+234", number "90847820"
        const phoneVal = value || "";
        const prefixMatch = phoneVal.match(/^(\+\d{1,4})\s?(.*)/);
        const currentPrefix = prefixMatch ? prefixMatch[1] : "";
        const currentNumber = prefixMatch ? prefixMatch[2] : phoneVal;
        const selectedCountry = COUNTRY_CODES.find((c) => c.code === currentPrefix);
        return (
          <div className="flex gap-2">
            <select
              value={selectedCountry ? currentPrefix : ""}
              onChange={(e) => {
                const newPrefix = e.target.value;
                updateField(field.id, newPrefix ? `${newPrefix} ${currentNumber}`.trim() : currentNumber);
              }}
              disabled={isDisabled}
              className="w-[140px] shrink-0 rounded-xl px-2 py-3 text-[10px] font-bold outline-none bg-primary border border-[var(--border-primary)] text-[var(--text-primary)]"
            >
              <option value="">No prefix</option>
              {COUNTRY_CODES.map((c) => (
                <option key={c.code + c.name} value={c.code}>{c.flag} {c.name} ({c.code})</option>
              ))}
            </select>
            <input
              type="tel"
              value={currentNumber}
              onChange={(e) => {
                const num = e.target.value.replace(/[^0-9\s\-()]/g, "");
                updateField(field.id, currentPrefix ? `${currentPrefix} ${num}`.trim() : num);
              }}
              placeholder={field.placeholder || "90 84 78 20"}
              disabled={isDisabled}
              className={inputClass + " flex-1"}
            />
          </div>
        );
      }

      case "date":
        return (
          <input
            type="date"
            value={value}
            onChange={(e) => updateField(field.id, e.target.value)}
            disabled={isDisabled}
            className={inputClass}
          />
        );

      case "time":
        return (
          <input
            type="time"
            value={value}
            onChange={(e) => updateField(field.id, e.target.value)}
            disabled={isDisabled}
            className={inputClass}
          />
        );

      case "url":
        return (
          <input
            type="url"
            value={value}
            onChange={(e) => updateField(field.id, e.target.value)}
            placeholder={field.placeholder || "https://"}
            disabled={isDisabled}
            className={inputClass}
          />
        );

      case "select": {
        const options = field.options || [];
        return (
          <select
            value={value}
            onChange={(e) => updateField(field.id, e.target.value)}
            disabled={isDisabled}
            className={inputClass}
          >
            <option value="">{field.placeholder || "Select..."}</option>
            {options.map((opt, i) => (
              <option key={i} value={opt.value || opt}>{opt.label || opt}</option>
            ))}
          </select>
        );
      }

      case "radio": {
        const options = field.options || [];
        return (
          <div className="space-y-2">
            {options.map((opt, i) => (
              <label key={i} className={cn("flex items-center gap-2 text-[11px] font-bold text-[var(--text-primary)]", isDisabled && "opacity-60")}>
                <input
                  type="radio"
                  name={`field-${field.id}`}
                  value={opt.value || opt}
                  checked={String(value) === String(opt.value || opt)}
                  onChange={(e) => updateField(field.id, e.target.value)}
                  disabled={isDisabled}
                  className="accent-[var(--brand-orange)]"
                />
                {opt.label || opt}
              </label>
            ))}
          </div>
        );
      }

      case "checkbox": {
        const checked = value === true || value === "true" || value === "on";
        return (
          <label className={cn("flex items-center gap-2 text-[11px] font-bold text-[var(--text-primary)]", isDisabled && "opacity-60")}>
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => updateField(field.id, e.target.checked)}
              disabled={isDisabled}
              className="accent-[var(--brand-orange)]"
            />
            {field.label}
          </label>
        );
      }

      case "multiselect": {
        const options = field.options || [];
        const selected = Array.isArray(value) ? value : [];
        return (
          <div className="space-y-2">
            {options.map((opt, i) => {
              const optValue = opt.value || opt;
              const isChecked = selected.includes(optValue);
              return (
                <label key={i} className={cn("flex items-center gap-2 text-[11px] font-bold text-[var(--text-primary)]", isDisabled && "opacity-60")}>
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={(e) => {
                      const next = e.target.checked
                        ? [...selected, optValue]
                        : selected.filter((v) => v !== optValue);
                      updateField(field.id, next);
                    }}
                    disabled={isDisabled}
                    className="accent-[var(--brand-orange)]"
                  />
                  {opt.label || opt}
                </label>
              );
            })}
          </div>
        );
      }

      case "rating": {
        const max = field.validation?.max || 5;
        const current = parseInt(value) || 0;
        return (
          <div className={cn("flex items-center gap-1", isDisabled && "opacity-60")}>
            {Array.from({ length: max }, (_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => !isDisabled && updateField(field.id, String(i + 1))}
                className={cn("transition-colors", i < current ? "text-[var(--brand-orange)]" : "text-[var(--text-secondary)]")}
              >
                <Star className={cn("w-5 h-5", i < current ? "fill-current" : "")} />
              </button>
            ))}
          </div>
        );
      }

      case "file":
        return (
          <div className={cn("p-3 rounded-xl border border-dashed border-[var(--border-primary)] text-center", isDisabled && "opacity-60")}>
            <input
              type="file"
              onChange={(e) => updateField(field.id, e.target.files?.[0]?.name || "")}
              disabled={isDisabled}
              className="text-[10px] text-[var(--text-secondary)]"
            />
            {value && <p className="text-[10px] font-bold text-[var(--text-primary)] mt-1">{typeof value === "string" ? value : "File selected"}</p>}
          </div>
        );

      case "hidden":
        return <input type="hidden" value={value} />;

      default: // text
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => updateField(field.id, e.target.value)}
            placeholder={field.placeholder || ""}
            disabled={isDisabled}
            className={inputClass}
          />
        );
    }
  };

  // ─── SUCCESS STATE ───
  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8 text-emerald-500" />
          </div>
          <div>
            <h1 className="text-lg font-black uppercase text-[var(--text-primary)]">Submission Received</h1>
            <p className="text-[11px] text-[var(--text-secondary)] mt-2">
              {run?.settings?.confirmation_message || "Thank you for your submission! We will review it shortly."}
            </p>
          </div>
          {existingSubmission && (
            <div className="p-4 rounded-xl bg-secondary border border-[var(--border-primary)] text-left space-y-1">
              <p className="text-[9px] font-black uppercase text-[var(--text-secondary)]">Submission Details</p>
              <p className="text-[11px] font-bold text-[var(--text-primary)]">Status: <span className="text-[var(--brand-orange)]">{existingSubmission.status?.toUpperCase()}</span></p>
              <p className="text-[10px] text-[var(--text-secondary)]">Submitted: {new Date(existingSubmission.submitted_at || existingSubmission.updated_at).toLocaleString()}</p>
            </div>
          )}
          <button onClick={() => router.push("/platform/runs/submit")} className="px-6 py-3 rounded-xl bg-[var(--brand-orange)] text-black text-[10px] font-black uppercase hover:brightness-110">
            Back to My Submissions
          </button>
        </div>
      </div>
    );
  }

  // ─── LOADING ───
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-[var(--brand-orange)]" />
      </div>
    );
  }

  // ─── ERROR ───
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center space-y-4">
          <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto" />
          <h1 className="text-sm font-black uppercase text-[var(--text-primary)]">Error</h1>
          <p className="text-[11px] text-[var(--text-secondary)]">{error}</p>
          <button onClick={() => router.back()} className="px-4 py-2 rounded-xl bg-tertiary text-[var(--text-primary)] text-[10px] font-black uppercase">Go Back</button>
        </div>
      </div>
    );
  }

  // ─── FORM ───
  return (
    <div className="min-h-screen">
      {notification && (
        <div className="fixed bottom-6 right-6 z-[500] px-5 py-3 rounded-xl bg-emerald-500 text-black text-[10px] font-black uppercase animate-in">
          {notification}
        </div>
      )}

      {/* Header */}
      <div className="sticky top-0 z-30 bg-secondary border-b border-[var(--border-primary)]">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="text-[10px] font-black uppercase text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center gap-1">
              <ArrowLeft className="w-3 h-3" /> Back
            </button>
            <span className="text-[var(--text-secondary)] opacity-30">|</span>
            <FileText className="w-4 h-4 text-[var(--brand-orange)]" />
            <h1 className="text-sm font-black uppercase text-[var(--text-primary)]">{form?.name || "Form"}</h1>
          </div>
          <div className="flex items-center gap-2">
            {isDraft && <span className="px-2 py-0.5 rounded bg-slate-500/10 text-slate-500 text-[8px] font-black uppercase">DRAFT</span>}
            {isSubmitted && <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-500 text-[8px] font-black uppercase">SUBMITTED</span>}
            {isApproved && <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 text-[8px] font-black uppercase">APPROVED</span>}
            {isRejected && <span className="px-2 py-0.5 rounded bg-rose-500/10 text-rose-500 text-[8px] font-black uppercase">REJECTED</span>}
            {needsRevision && <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-500 text-[8px] font-black uppercase">REVISION REQUESTED</span>}
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Run info */}
        {run && (
          <div className="p-4 rounded-2xl bg-secondary border border-[var(--border-primary)] space-y-2">
            <h2 className="text-sm font-black uppercase text-[var(--text-primary)]">{run.name}</h2>
            {run.description && <p className="text-[10px] text-[var(--text-secondary)]">{run.description}</p>}
            {run.settings?.instructions && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-[var(--brand-orange)]/5 border border-[var(--brand-orange)]/10">
                <Info className="w-3.5 h-3.5 text-[var(--brand-orange)] shrink-0 mt-0.5" />
                <p className="text-[10px] text-[var(--text-primary)] font-bold whitespace-pre-wrap">{run.settings.instructions}</p>
              </div>
            )}
            {(run.opens_at || run.closes_at) && (
              <div className="flex items-center gap-2 text-[9px] text-[var(--text-secondary)]">
                <Clock className="w-3 h-3" />
                {run.opens_at && <span>Opens: {new Date(run.opens_at).toLocaleString()}</span>}
                {run.closes_at && <span>• Closes: {new Date(run.closes_at).toLocaleString()}</span>}
              </div>
            )}
          </div>
        )}

        {/* Already submitted notice */}
        {isSubmitted && !needsRevision && (
          <div className="p-4 rounded-2xl bg-blue-500/5 border border-blue-500/10 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-[11px] font-black uppercase text-blue-500">Already Submitted</p>
              <p className="text-[10px] text-[var(--text-secondary)] mt-1">
                You submitted this form on {new Date(existingSubmission.submitted_at || existingSubmission.updated_at).toLocaleString()}.
                {isApproved && " It has been approved."}
                {isRejected && " It has been rejected. Contact your program manager for more information."}
              </p>
            </div>
          </div>
        )}

        {needsRevision && (
          <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/10 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-[11px] font-black uppercase text-amber-500">Revision Requested</p>
              <p className="text-[10px] text-[var(--text-secondary)] mt-1">
                A reviewer has requested changes. Please update your submission and resubmit.
              </p>
            </div>
          </div>
        )}

        {/* Form fields by section */}
        {sections.length > 0 ? (
          sections.map((section) => {
            const sectionFields = fields.filter((f) => f.section_id === section.id);
            if (sectionFields.length === 0) return null;
            const isExpanded = expandedSections[section.id] !== false;

            return (
              <div key={section.id} className="rounded-2xl bg-secondary border border-[var(--border-primary)] overflow-hidden">
                <button
                  type="button"
                  onClick={() => setExpandedSections((prev) => ({ ...prev, [section.id]: !isExpanded }))}
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-tertiary/50 transition-colors"
                >
                  <div className="text-left">
                    <h3 className="text-[12px] font-black uppercase text-[var(--text-primary)]">{section.title}</h3>
                    {section.description && <p className="text-[9px] text-[var(--text-secondary)] mt-0.5">{section.description}</p>}
                  </div>
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-[var(--text-secondary)]" /> : <ChevronDown className="w-4 h-4 text-[var(--text-secondary)]" />}
                </button>
                {isExpanded && (
                  <div className="px-5 pb-5 space-y-4 border-t border-[var(--border-primary)] pt-4">
                    {sectionFields.map((field) => (
                      <div key={field.id} className="space-y-1.5">
                        <label className="flex items-center gap-1 text-[10px] font-black uppercase text-[var(--text-primary)]">
                          {field.label}
                          {field.required && <span className="text-rose-500">*</span>}
                        </label>
                        {field.help_text && <p className="text-[9px] text-[var(--text-secondary)]">{field.help_text}</p>}
                        {renderField(field)}
                        {errors[field.id] && (
                          <p className="text-[9px] font-bold text-rose-500 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            {errors[field.id]}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        ) : (
          // Fields without sections
          <div className="rounded-2xl bg-secondary border border-[var(--border-primary)] p-5 space-y-4">
            {fields.map((field) => (
              <div key={field.id} className="space-y-1.5">
                <label className="flex items-center gap-1 text-[10px] font-black uppercase text-[var(--text-primary)]">
                  {field.label}
                  {field.required && <span className="text-rose-500">*</span>}
                </label>
                {field.help_text && <p className="text-[9px] text-[var(--text-secondary)]">{field.help_text}</p>}
                {renderField(field)}
                {errors[field.id] && (
                  <p className="text-[9px] font-bold text-rose-500 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    {errors[field.id]}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Empty form */}
        {fields.length === 0 && (
          <div className="py-16 text-center">
            <FileText className="w-8 h-8 mx-auto text-[var(--text-secondary)] opacity-30" />
            <p className="text-[12px] font-bold text-[var(--text-secondary)] mt-3">This form has no fields yet.</p>
          </div>
        )}

        {/* Action buttons */}
        {fields.length > 0 && !isSubmitted && (
          <div className="sticky bottom-4 z-20">
            <div className="flex items-center gap-3 p-3 rounded-2xl bg-secondary border border-[var(--border-primary)] shadow-lg">
              <button
                onClick={handleSaveDraft}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-3 rounded-xl bg-tertiary text-[var(--text-primary)] text-[10px] font-black uppercase hover:bg-tertiary/80 disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                {saving ? "Saving..." : "Save Draft"}
              </button>
              <button
                onClick={handleSubmit}
                disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[var(--brand-orange)] text-black text-[10px] font-black uppercase hover:brightness-110 disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                {saving ? "Submitting..." : needsRevision ? "Resubmit" : "Submit"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
