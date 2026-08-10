"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2, Send, CheckCircle2, AlertTriangle, FileText, Clock, Info, ChevronDown, ChevronUp, Star, Globe, Mail } from "lucide-react";

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
  const [successConfig, setSuccessConfig] = useState(null);
  const [notification, setNotification] = useState(null);
  const [run, setRun] = useState(null);
  const [form, setForm] = useState(null);
  const [sections, setSections] = useState([]);
  const [fields, setFields] = useState([]);
  const [formData, setFormData] = useState({});
  const [errors, setErrors] = useState({});
  const [expandedSections, setExpandedSections] = useState({});
  const [lang, setLang] = useState("en");

  useEffect(() => { setLang(localStorage.getItem("impactos_lang") || "en"); }, []);

  const switchLang = (l) => { setLang(l); localStorage.setItem("impactos_lang", l); };

  const notify = (msg) => { setNotification(msg); setTimeout(() => setNotification(null), 3000); };

  useEffect(() => {
    loadRun();
  }, []);

  const loadRun = async () => {
    try {
      const res = await fetch(`/api/s/public-run?slug=${runId}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Run not found");
      setRun(data.run);
      setSections(data.sections || []);
      setFields(data.fields || []);
      setForm({ name: data.run.form_name || data.run.name, description: data.run.form_description || data.run.description });
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
        body: JSON.stringify({ slug: runId, data: formData }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccess(true);
        if (data.success_message) {
          setSuccessConfig({ message: data.success_message, redirect_url: data.redirect_url });
        }
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
    const baseClass = "w-full rounded-xl px-4 py-3 text-sm font-medium outline-none bg-slate-800 border text-slate-100 placeholder:text-slate-400";
    const errClass = hasError ? "border-red-500" : "border-slate-600 focus:border-orange-500";
    const inputClass = `${baseClass} ${errClass}`;

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
            <select value={phoneData.code} onChange={(e) => { const cnt = COUNTRY_CODES.find(c => c.code === e.target.value); updatePhone({ country: cnt?.name || "", code: e.target.value }); }} disabled={isDisabled} className="w-[150px] shrink-0 rounded-xl px-2 py-3 text-sm font-medium outline-none bg-slate-800 border border-slate-600 text-slate-100">
              <option value="">No prefix</option>
              {COUNTRY_CODES.map(c => <option key={c.code} value={c.code}>{c.flag} {c.name} ({c.code})</option>)}
            </select>
            <input type="tel" value={phoneData.number} onChange={(e) => { updatePhone({ number: e.target.value.replace(/[^0-9\s\-()]/g, "") }); }} placeholder={field.placeholder || "90 84 78 20"} disabled={isDisabled} className={`${inputClass} flex-1`} />
          </div>
        );
      }
      case "select": case "radio":
        return (
          <select value={value} onChange={(e) => updateField(field.id, e.target.value)} disabled={isDisabled} className={`${inputClass} [&>option]:bg-slate-800 [&>option]:text-slate-100 appearance-none`}>
            <option value="">Select...</option>
            {(field.options || []).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        );
      case "rating": {
        const opts = (Array.isArray(field.options) && field.options.length > 0) ? field.options : [{ label: "1", value: "1" }, { label: "2", value: "2" }, { label: "3", value: "3" }, { label: "4", value: "4" }, { label: "5", value: "5" }];
        return (
          <div className="space-y-2">
            <p className="text-xs text-slate-500">Select a rating:</p>
            <div className="flex gap-3 flex-wrap">
              {opts.map(o => (
                <button key={o.value} type="button" onClick={() => updateField(field.id, o.value)} disabled={isDisabled}
                  className={`min-w-[56px] px-4 py-3 rounded-xl text-base font-bold border-2 transition-all ${
                    value === o.value
                      ? "bg-orange-500 text-white border-orange-500 scale-110 shadow-lg shadow-orange-500/30"
                      : "bg-slate-700 text-slate-200 border-slate-500 hover:border-orange-400 hover:text-orange-400 hover:bg-slate-600"
                  }`}
                >{o.label}</button>
              ))}
            </div>
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

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-orange-500" /></div>;
  if (error) return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><div className="text-center"><AlertTriangle className="w-10 h-10 mx-auto text-red-500 mb-3" /><p className="text-slate-100 font-bold">{error}</p></div></div>;

  const resolvePlaceholders = (template) => {
    if (!template) return null;
    let result = template;
    // Resolve by field label placeholders
    for (const f of fields) {
      const rawLabel = (f.label || "").toLowerCase();
      const safeKey = rawLabel.replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
      const value = formData[f.id] != null ? String(formData[f.id]) : "";
      result = result.replace(new RegExp(`\\{\\{${safeKey}\\}\\}`, "gi"), value);
      result = result.replace(new RegExp(`\\{\\{field_${f.id}\\}\\}`, "gi"), value);
    }
    // Common special placeholders
    const nameField = fields.find(f => (f.label || "").toLowerCase().includes("name"));
    const emailField = fields.find(f => (f.label || "").toLowerCase().includes("email"));
    if (nameField) {
      const nameVal = String(formData[nameField.id] || "");
      result = result.replace(/\{\{submitter_name\}\}/gi, nameVal);
      result = result.replace(/\{\{name\}\}/gi, nameVal);
    }
    if (emailField) {
      result = result.replace(/\{\{submitter_email\}\}/gi, String(formData[emailField.id] || ""));
    }
    result = result.replace(/\{\{form_name\}\}/gi, form?.name || "");
    result = result.replace(/\{\{group_name\}\}/gi, run?.group_name || "");
    result = result.replace(/\{\{organization\}\}/gi, "ImpactOS");
    return result;
  };

  if (success) {
    const successMessage = successConfig?.message 
      ? resolvePlaceholders(successConfig.message) 
      : null;
    
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-4"><CheckCircle2 className="w-8 h-8 text-emerald-500" /></div>
          <h1 className="text-xl font-black text-slate-100 mb-2">Submission Received</h1>
          {successMessage ? (
            <div className="text-slate-300 text-sm space-y-3 mt-4 leading-relaxed" dangerouslySetInnerHTML={{ __html: successMessage.replace(/\n/g, "<br/>") }} />
          ) : (
            <p className="text-slate-400 text-sm">Thank you! Your response has been recorded.</p>
          )}
          {successConfig?.redirect_url && (
            <a href={successConfig.redirect_url} className="inline-block mt-6 px-6 py-3 bg-orange-500 text-black rounded-xl text-sm font-bold hover:bg-orange-400 transition-colors">
              Continue
            </a>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950">
      {notification && <div className="fixed bottom-6 right-6 z-[500] px-5 py-3 rounded-xl bg-orange-500 text-white text-xs font-black uppercase">{notification}</div>}
      <div className="max-w-2xl mx-auto p-6 space-y-8">
        {/* Branding */}
        <div className="flex flex-col items-center">
          <img src="/brand/logo_full.png" alt="Future Studio" className="h-12 object-contain mb-0" />
        </div>

        {/* Language Selector */}
        <div className="flex justify-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 border border-slate-700">
            <Globe className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Language</span>
            <select
              value={lang}
              onChange={(e) => switchLang(e.target.value)}
              className="bg-transparent text-[10px] font-black uppercase text-slate-200 outline-none cursor-pointer"
            >
              <option value="en">English</option>
              <option value="fr">Francais</option>
            </select>
          </div>
        </div>

        {/* Header */}
        <div>
          <h1 className="text-2xl font-black uppercase text-slate-100">{form?.name || run?.name}</h1>
          {form?.description && <p className="text-sm text-slate-400 mt-2">{form.description}</p>}
          {run?.closes_at && <p className="text-xs text-slate-400 mt-2 flex items-center gap-1"><Clock className="w-3 h-3" /> Closes {new Date(run.closes_at).toLocaleDateString()}</p>}
        </div>

        {/* Sections & Fields */}
        {sections.map(sec => {
          const sectionFields = fields.filter(f => String(f.section_id) === String(sec.id));
          if (sectionFields.length === 0) return null;
          const isExpanded = expandedSections[sec.id] !== false;
          return (
            <div key={sec.id} className="space-y-3">
              <button onClick={() => setExpandedSections(prev => ({ ...prev, [sec.id]: !prev[sec.id] }))} className="flex items-center gap-2 w-full text-left">
                {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                <h2 className="text-base font-black uppercase text-slate-100">{sec.title}</h2>
              </button>
              {isExpanded && (
                <div className="space-y-4">
                  {sectionFields.map(f => (
                    <div key={f.id} className="space-y-1.5">
                      <label className="text-sm font-bold text-slate-200 flex items-center gap-1">
                        {f.label} {f.required && <span className="text-red-400">*</span>}
                      </label>
                      {f.help_text && <p className="text-xs text-slate-500">{f.help_text}</p>}
                      {renderField(f)}
                      {errors[f.id] && <p className="text-xs text-red-400 font-bold">{errors[f.id]}</p>}
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
            <label className="text-sm font-bold text-slate-200 flex items-center gap-1">{f.label} {f.required && <span className="text-red-400">*</span>}</label>
            {renderField(f)}
          </div>
        ))}

        {/* Submit */}
        {!success && run?.status === "active" && (
          <div className="pt-4">
            <button onClick={handleSubmit} disabled={saving} className="w-full px-6 py-4 rounded-xl bg-orange-500 text-white text-sm font-black uppercase hover:bg-orange-600 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
              <Send className="w-4 h-4" /> {saving ? "Submitting..." : "Submit"}
            </button>
          </div>
        )}

        {/* Footer */}
        <div className="text-center pt-4 border-t border-slate-800">
          <a href="mailto:info@futurestudio.bj" className="inline-flex items-center gap-1.5 text-[10px] font-medium text-slate-500 hover:text-orange-400 transition-colors">
            <Mail className="w-3 h-3" /> info@futurestudio.bj
          </a>
        </div>
      </div>
    </div>
  );
}
