"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2, Send, CheckCircle2, AlertTriangle, FileText, Clock, Info, ChevronDown, ChevronUp, Star } from "lucide-react";

const cn = (...classes) => classes.filter(Boolean).join(" ");

const COUNTRY_CODES = [
  { flag: "🇳🇬", name: "Nigeria", code: "+234" }, { flag: "🇧🇯", name: "Benin", code: "+229" },
  { flag: "🇬🇭", name: "Ghana", code: "+233" }, { flag: "🇰🇪", name: "Kenya", code: "+254" },
  { flag: "🇿🇦", name: "South Africa", code: "+27" }, { flag: "🇪🇬", name: "Egypt", code: "+20" },
  { flag: "🇫🇷", name: "France", code: "+33" }, { flag: "🇬🇧", name: "UK", code: "+44" },
  { flag: "🇺🇸", name: "USA", code: "+1" }, { flag: "🇩🇪", name: "Germany", code: "+49" },
  { flag: "🇮🇳", name: "India", code: "+91" }, { flag: "🇦🇪", name: "UAE", code: "+971" },
];

export default function PublicSubmitPage() {
  const params = useParams();
  const runId = params.runId;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [notification, setNotification] = useState(null);
  const [run, setRun] = useState(null);
  const [form, setForm] = useState(null);
  const [sections, setSections] = useState([]);
  const [fields, setFields] = useState([]);
  const [formData, setFormData] = useState({});
  const [errors, setErrors] = useState({});
  const [expandedSections, setExpandedSections] = useState({});

  const notify = (msg) => { setNotification(msg); setTimeout(() => setNotification(null), 3000); };

  useEffect(() => {
    loadRun();
  }, []);

  const loadRun = async () => {
    try {
      const res = await fetch(`/api/s/public-run?id=${runId}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Run not found");
      setRun(data.run);
      setSections(data.sections || []);
      setFields(data.fields || []);
      setForm({ name: data.run.form_name, description: data.run.form_description });
      // Expand all sections by default
      const expanded = {};
      (data.sections || []).forEach(s => { expanded[s.id] = true; });
      setExpandedSections(expanded);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  const updateField = (fieldId, value) => {
    setFormData(prev => ({ ...prev, [fieldId]: value }));
    setErrors(prev => ({ ...prev, [fieldId]: null }));
  };

  const validate = () => {
    const newErrors = {};
    for (const f of fields) {
      if (f.required && (!formData[f.id] || (typeof formData[f.id] === "string" && !formData[f.id].trim()))) {
        newErrors[f.id] = "This field is required";
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) { notify("Please fill all required fields"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/s/public-submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ run_id: parseInt(runId), data: formData }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccess(true);
        notify("Submission received!");
      } else {
        notify(data.error || "Failed to submit");
      }
    } catch (_) { notify("Submission failed"); }
    setSaving(false);
  };

  const renderField = (field) => {
    const value = formData[field.id] || "";
    const hasError = errors[field.id];
    const isDisabled = success;
    const baseInputClass = "w-full rounded-xl px-4 py-3 text-[12px] font-bold outline-none bg-white/5 border text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]";
    const normalBorder = hasError ? "border-rose-500" : "border-[var(--border-primary)] focus:border-[var(--brand-orange)]";
    const inputClass = `${baseInputClass} ${normalBorder}`;

    switch (field.field_type) {
      case "textarea":
        return <textarea value={value} onChange={(e) => updateField(field.id, e.target.value)} placeholder={field.placeholder || ""} disabled={isDisabled} rows={3} className={`${inputClass} resize-none`} />;
      case "email":
        return <input type="email" value={value} onChange={(e) => updateField(field.id, e.target.value)} placeholder={field.placeholder || "email@example.com"} disabled={isDisabled} className={inputClass} />;
      case "phone": {
        let phoneData = { country: "", code: "", number: "" };
        const raw = value || "";
        if (typeof raw === "string" && raw.startsWith("{")) { try { phoneData = JSON.parse(raw); } catch (_) {} }
        else { const m = raw.match(/^(\+\d{1,4})\s?(.*)/); phoneData = { country: "", code: m ? m[1] : "", number: m ? m[2] : raw }; }
        const updatePhone = (updates) => { updateField(field.id, JSON.stringify({ ...phoneData, ...updates })); };
        return (
          <div className="flex gap-2">
            <select value={phoneData.code} onChange={(e) => { const cnt = COUNTRY_CODES.find(c => c.code === e.target.value); updatePhone({ country: cnt?.name || "", code: e.target.value }); }} disabled={isDisabled} className="w-[150px] shrink-0 rounded-xl px-2 py-3 text-[11px] font-bold outline-none bg-primary border border-[var(--border-primary)] text-[var(--text-primary)]">
              <option value="">No prefix</option>
              {COUNTRY_CODES.map(c => <option key={c.code} value={c.code}>{c.flag} {c.name} ({c.code})</option>)}
            </select>
            <input type="tel" value={phoneData.number} onChange={(e) => { updatePhone({ number: e.target.value.replace(/[^0-9\s\-()]/g, "") }); }} placeholder={field.placeholder || "90 84 78 20"} disabled={isDisabled} className={`${inputClass} flex-1`} />
          </div>
        );
      }
      case "select": case "radio":
        return (
          <select value={value} onChange={(e) => updateField(field.id, e.target.value)} disabled={isDisabled} className={inputClass}>
            <option value="">Select...</option>
            {(field.options || []).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        );
      case "rating": {
        const opts = field.options || [{ label: "1", value: "1" }, { label: "2", value: "2" }, { label: "3", value: "3" }, { label: "4", value: "4" }, { label: "5", value: "5" }];
        return (
          <div className="flex gap-2 flex-wrap">
            {opts.map(o => (
              <button key={o.value} onClick={() => updateField(field.id, o.value)} disabled={isDisabled}
                className={`px-4 py-2 rounded-xl text-[11px] font-bold border transition-all ${value === o.value ? "bg-[var(--brand-orange)] text-black border-[var(--brand-orange)]" : "bg-primary border-[var(--border-primary)] text-[var(--text-secondary)] hover:border-[var(--text-primary)]"}`}
              >{o.label}</button>
            ))}
          </div>
        );
      }
      case "number": case "currency":
        return <input type="number" value={value} onChange={(e) => updateField(field.id, e.target.value)} placeholder={field.placeholder || "0"} disabled={isDisabled} className={inputClass} />;
      case "date": return <input type="date" value={value} onChange={(e) => updateField(field.id, e.target.value)} disabled={isDisabled} className={inputClass} />;
      case "url": return <input type="url" value={value} onChange={(e) => updateField(field.id, e.target.value)} placeholder={field.placeholder || "https://"} disabled={isDisabled} className={inputClass} />;
      default:
        return <input type="text" value={value} onChange={(e) => updateField(field.id, e.target.value)} placeholder={field.placeholder || ""} disabled={isDisabled} className={inputClass} />;
    }
  };

  if (loading) return <div className="min-h-screen bg-primary flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-[var(--brand-orange)]" /></div>;
  if (error) return <div className="min-h-screen bg-primary flex items-center justify-center"><div className="text-center"><AlertTriangle className="w-10 h-10 mx-auto text-rose-500 mb-3" /><p className="text-[var(--text-primary)] font-bold">{error}</p></div></div>;

  if (success) {
    return (
      <div className="min-h-screen bg-primary flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-4"><CheckCircle2 className="w-8 h-8 text-emerald-500" /></div>
          <h1 className="text-xl font-black text-[var(--text-primary)] mb-2">Submission Received</h1>
          <p className="text-[var(--text-secondary)] text-sm">Thank you! Your response has been recorded.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-primary">
      {notification && <div className="fixed bottom-6 right-6 z-[500] px-5 py-3 rounded-xl bg-[var(--brand-orange)] text-black text-[10px] font-black uppercase">{notification}</div>}
      <div className="max-w-2xl mx-auto p-6 space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-black uppercase text-[var(--text-primary)]">{form?.name || run?.name}</h1>
          {form?.description && <p className="text-[12px] text-[var(--text-secondary)] mt-2">{form.description}</p>}
          {run?.closes_at && <p className="text-[10px] text-[var(--text-secondary)] mt-2 flex items-center gap-1"><Clock className="w-3 h-3" /> Closes {new Date(run.closes_at).toLocaleDateString()}</p>}
        </div>

        {/* Sections & Fields */}
        {sections.map(sec => {
          const sectionFields = fields.filter(f => String(f.section_id) === String(sec.id));
          if (sectionFields.length === 0) return null;
          const isExpanded = expandedSections[sec.id] !== false;
          return (
            <div key={sec.id} className="space-y-3">
              <button onClick={() => setExpandedSections(prev => ({ ...prev, [sec.id]: !prev[sec.id] }))} className="flex items-center gap-2 w-full text-left">
                {isExpanded ? <ChevronUp className="w-4 h-4 text-[var(--text-secondary)]" /> : <ChevronDown className="w-4 h-4 text-[var(--text-secondary)]" />}
                <h2 className="text-sm font-black uppercase text-[var(--text-primary)]">{sec.title}</h2>
              </button>
              {isExpanded && (
                <div className="space-y-4">
                  {sectionFields.map(f => (
                    <div key={f.id} className="space-y-1.5">
                      <label className="text-[11px] font-bold text-[var(--text-primary)] flex items-center gap-1">
                        {f.label} {f.required && <span className="text-rose-500">*</span>}
                      </label>
                      {f.help_text && <p className="text-[9px] text-[var(--text-secondary)]">{f.help_text}</p>}
                      {renderField(f)}
                      {errors[f.id] && <p className="text-[9px] text-rose-500 font-bold">{errors[f.id]}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {/* Orphan fields */}
        {fields.filter(f => !f.section_id).map(f => (
          <div key={f.id} className="space-y-1.5">
            <label className="text-[11px] font-bold text-[var(--text-primary)] flex items-center gap-1">{f.label} {f.required && <span className="text-rose-500">*</span>}</label>
            {renderField(f)}
          </div>
        ))}

        {/* Submit */}
        {!success && run?.status === "active" && (
          <div className="pt-4">
            <button onClick={handleSubmit} disabled={saving} className="w-full px-6 py-4 rounded-xl bg-[var(--brand-orange)] text-black text-[12px] font-black uppercase hover:brightness-110 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
              <Send className="w-4 h-4" /> {saving ? "Submitting..." : "Submit"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
