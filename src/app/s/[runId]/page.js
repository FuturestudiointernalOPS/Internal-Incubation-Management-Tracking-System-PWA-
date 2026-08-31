"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2, Send, CheckCircle2, AlertTriangle, FileText, Clock, Info, ChevronDown, ChevronUp, Star, Globe, Mail } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import AppPhoneInput from "@/components/ui/AppPhoneInput";

const cn = (...classes) => classes.filter(Boolean).join(" ");

// ─── Translation helper via MyMemory (free, no API key needed) ───
async function translateText(text, sourceLang, targetLang) {
  if (!text || !text.trim()) return text;
  if (sourceLang === targetLang) return text;
  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${sourceLang}|${targetLang}`;
    const res = await fetch(url);
    const data = await res.json();
    return data?.responseData?.translatedText || text;
  } catch (_) { return text; }
}

async function translateBatch(strings, sourceLang, targetLang) {
  const results = [];
  for (const str of strings) {
    results.push(await translateText(str, sourceLang, targetLang));
  }
  return results;
}





export default function PublicSubmitPage() {
  const params = useParams();
  const runId = params.runId;
  const { t, lang, switchLang } = useI18n();
  const [loading, setLoading] = useState(true);
  const [translating, setTranslating] = useState(false);
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
  const [currentSection, setCurrentSection] = useState(0); // Multi-section stepper

  // Cache raw originals so we can always restore original language perfectly
  const rawForm = useRef(null);
  const rawSections = useRef([]);
  const rawFields = useRef([]);
  const originalLang = useRef("en"); // Detected form language

  const notify = (msg) => { setNotification(msg); setTimeout(() => setNotification(null), 3000); };

  // Translate form content when language changes
  const translateFormContent = async (targetLang) => {
    if (!rawForm.current) return;
    const srcLang = originalLang.current || "en";
    // If target matches original, restore from cache
    if (targetLang === srcLang) {
      setForm({ ...rawForm.current });
      setSections(rawSections.current.map(s => ({ ...s })));
      setFields(rawFields.current.map(f => ({ ...f })));
      return;
    }
    setTranslating(true);
    try {
      const [tForm, tSections, tLabels, tHelp, tPlaceholders] = await Promise.all([
        translateBatch([rawForm.current?.name || "", rawForm.current?.description || ""], srcLang, targetLang),
        translateBatch(rawSections.current.map(s => s.title || ""), srcLang, targetLang),
        translateBatch(rawFields.current.map(f => f.label || ""), srcLang, targetLang),
        translateBatch(rawFields.current.map(f => f.help_text || ""), srcLang, targetLang),
        translateBatch(rawFields.current.map(f => f.placeholder || ""), srcLang, targetLang),
      ]);
      setForm({ name: tForm[0], description: tForm[1] });
      setSections(rawSections.current.map((s, i) => ({ ...s, title: tSections[i] || s.title })));
      setFields(rawFields.current.map((f, i) => ({
        ...f,
        label: tLabels[i] || f.label,
        help_text: tHelp[i] || f.help_text,
        placeholder: tPlaceholders[i] || f.placeholder,
      })));
    } catch (e) { console.error("Translation failed:", e); }
    setTranslating(false);
  };

  useEffect(() => { loadRun(); }, []);

  // Auto-save currentSection to localStorage
  useEffect(() => {
    try {
      const existing = JSON.parse(localStorage.getItem(`form_draft_${runId}`) || "{}");
      existing.currentSection = currentSection;
      existing.lastSaved = Date.now();
      localStorage.setItem(`form_draft_${runId}`, JSON.stringify(existing));
    } catch (_) {}
  }, [currentSection, runId]);

  // Re-translate when language is switched
  useEffect(() => {
    if (rawForm.current) translateFormContent(lang);
  }, [lang]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadRun = async () => {
    try {
      const res = await fetch(`/api/s/public-run?slug=${runId}`);
      const data = await res.json();
      if (!data.success) throw new Error(t((data.error || "Run not found") || "") || (data.error || "Run not found"));
      const loadedForm = { name: data.run.form_name || data.run.name, description: data.run.form_description || data.run.description };
      setRun(data.run);
      setSections(data.sections || []);
      setFields(data.fields || []);
      setForm(loadedForm);
      // Cache raw originals
      rawForm.current = loadedForm;
      rawSections.current = data.sections || [];
      rawFields.current = data.fields || [];

      // ── Restore saved draft from localStorage ──
      try {
        const draftKey = `form_draft_${runId}`;
        const savedDraft = localStorage.getItem(draftKey);
        if (savedDraft) {
          const draft = JSON.parse(savedDraft);
          if (draft.formData && typeof draft.formData === "object") {
            setFormData(draft.formData);
          }
          if (typeof draft.currentSection === "number" && draft.currentSection >= 0) {
            setCurrentSection(draft.currentSection);
          }
        }
      } catch (_) {}

      // Detect form's original language by scanning content for French characters
      const allText = [
        loadedForm.name, loadedForm.description,
        ...(data.sections || []).map(s => s.title || ""),
        ...(data.fields || []).flatMap(f => [f.label, f.help_text, f.placeholder].filter(Boolean))
      ].join(" ").toLowerCase();
      const frenchChars = (allText.match(/[éèêëàâîïôûùçœ]/g) || []).length;
      const detectedLang = frenchChars > 2 ? "fr" : "en";
      originalLang.current = detectedLang;

      // Set the initial language to match the form's language
      const savedLang = typeof window !== "undefined" ? localStorage.getItem("impactos_lang") : null;
      if (!savedLang && detectedLang !== "en") {
        switchLang(detectedLang);
      } else if (savedLang && savedLang !== "en") {
        translateFormContent(savedLang);
      }
    } catch (e) {
      setError(t(e.message || "") || e.message);
    }
    setLoading(false);
  };

  const updateField = (fieldId, value) => {
    const updated = (prev) => ({ ...prev, [fieldId]: value });
    setFormData(prev => {
      const newData = updated(prev);
      // Auto-save to localStorage
      try {
        const draft = { formData: newData, currentSection, lastSaved: Date.now() };
        localStorage.setItem(`form_draft_${runId}`, JSON.stringify(draft));
      } catch (_) {}
      return newData;
    });
    setErrors(prev => ({ ...prev, [fieldId]: null }));
  };

  const validate = () => {
    const newErrors = {};
    for (const f of fields) {
      if (f.required && (!formData[f.id] || (typeof formData[f.id] === "string" && !formData[f.id].trim()))) {
        newErrors[f.id] = t("forms.fieldRequired");
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) { notify(t("forms.requiredFields")); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/s/public-submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: runId,
          data: formData,
          invitation_token: new URLSearchParams(window.location.search).get("invitation") || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        localStorage.removeItem(`form_draft_${runId}`);
        setSuccess(true);
        if (data.success_message) {
          setSuccessConfig({ message: data.success_message, redirect_url: data.redirect_url });
        }
        notify(t("forms.submissionReceived"));
      } else {
        notify(t((data.error || t("forms.submitFailed")) || "") || (data.error || t("forms.submitFailed")));
      }
    } catch (_) {
      // Network/parse failure — the submission may still have been saved.
      // Never tell the participant it failed when we cannot confirm that.
      notify(t("forms.couldNotConfirm") || "We couldn't confirm your submission. Please check your email — if we received it, you'll hear from us shortly.");
    }
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
      case "phone":
        return (
          <AppPhoneInput
            value={value}
            onChange={(next) => updateField(field.id, next)}
            placeholder={field.placeholder || "90 84 78 20"}
            disabled={isDisabled}
            inputClassName="flex-1 rounded-xl px-4 py-3 text-sm font-medium outline-none border bg-slate-800 text-slate-100 placeholder:text-slate-400 border-slate-600 focus:border-orange-500"
          />
        );
      case "select": case "radio":
        return (
          <select value={value} onChange={(e) => updateField(field.id, e.target.value)} disabled={isDisabled} className={`${inputClass} [&>option]:bg-slate-800 [&>option]:text-slate-100 appearance-none`}>
            <option value="">{t("forms.selectOption")}</option>
            {(field.options || []).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        );
      case "rating": {
        const opts = (Array.isArray(field.options) && field.options.length > 0) ? field.options : [{ label: "1", value: "1" }, { label: "2", value: "2" }, { label: "3", value: "3" }, { label: "4", value: "4" }, { label: "5", value: "5" }];
        return (
          <div className="space-y-2">
            <p className="text-xs text-slate-500">{t("forms.selectRating")}</p>
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

  const escapeHtml = (value) => {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#x27;");
  };

  const resolvePlaceholders = (template) => {
    if (!template) return null;
    let result = template;
    // Resolve by field label placeholders (values are user input — escape them)
    for (const f of fields) {
      const rawLabel = (f.label || "").toLowerCase();
      const safeKey = rawLabel.replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
      const value = formData[f.id] != null ? escapeHtml(String(formData[f.id])) : "";
      result = result.replace(new RegExp(`\\{\\{${safeKey}\\}\\}`, "gi"), value);
      result = result.replace(new RegExp(`\\{\\{field_${f.id}\\}\\}`, "gi"), value);
    }
    // Common special placeholders (all dynamic values escaped)
    const nameField = fields.find(f => (f.label || "").toLowerCase().includes("name"));
    const emailField = fields.find(f => (f.label || "").toLowerCase().includes("email"));
    if (nameField) {
      const nameVal = escapeHtml(String(formData[nameField.id] || ""));
      result = result.replace(/\{\{submitter_name\}\}/gi, nameVal);
      result = result.replace(/\{\{name\}\}/gi, nameVal);
    }
    if (emailField) {
      result = result.replace(/\{\{submitter_email\}\}/gi, escapeHtml(String(formData[emailField.id] || "")));
    }
    result = result.replace(/\{\{form_name\}\}/gi, escapeHtml(form?.name || ""));
    result = result.replace(/\{\{group_name\}\}/gi, escapeHtml(run?.group_name || ""));
    result = result.replace(/\{\{organization\}\}/gi, escapeHtml("ImpactOS"));
    return result;
  };

  if (success) {
    const successMessage = successConfig?.message 
      ? resolvePlaceholders(successConfig.message) 
      : null;
    
    return (
      <div className="min-h-screen bg-slate-950">
        <div className="max-w-2xl mx-auto p-6 space-y-8">
          {/* Branding */}
          <div className="flex flex-col items-center">
            <img src="/brand/logo_full.png" alt="Future Studio" className="h-12 object-contain mb-0" />
          </div>

          <div className="text-center max-w-md mx-auto space-y-6">
            <div className="w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-10 h-10 text-emerald-500" />
            </div>
            
            <div className="space-y-3">
              <h1 className="text-2xl font-black text-white uppercase tracking-tight">{t("forms.submissionReceivedTitle")}</h1>
              <p className="text-slate-400 text-sm leading-relaxed max-w-sm mx-auto">
                {t("forms.thankYouDetail")}
              </p>
            </div>

            {successMessage ? (
              <div className="p-6 rounded-2xl bg-slate-800 border border-slate-700">
                <div className="text-slate-300 text-sm space-y-3 leading-relaxed" dangerouslySetInnerHTML={{ __html: successMessage.replace(/\n/g, "<br/>") }} />
              </div>
            ) : null}

            {successConfig?.redirect_url && /^https?:\/\//i.test(successConfig.redirect_url) && (
              <a href={successConfig.redirect_url} className="inline-block px-8 py-3.5 bg-orange-500 text-black rounded-xl text-sm font-black uppercase tracking-wider hover:bg-orange-400 transition-colors">
                {t("common.continue")}
              </a>
            )}

            <p className="text-[10px] text-slate-500 pt-4">{t("forms.checkEmail")}</p>
          </div>

          {/* Footer */}
          <div className="text-center pt-8 border-t border-slate-800">
            <a href="mailto:info@futurestudio.bj" className="inline-flex items-center gap-1.5 text-[10px] font-medium text-slate-500 hover:text-orange-400 transition-colors">
              <Mail className="w-3 h-3" /> info@futurestudio.bj
            </a>
          </div>
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
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 border border-slate-600">
            {translating ? <Loader2 className="w-3.5 h-3.5 text-orange-400 animate-spin" /> : <Globe className="w-3.5 h-3.5 text-orange-400" />}
            <span className="text-[10px] font-black text-slate-300 uppercase tracking-wider">
              {translating ? "Translating..." : t("common.language")}
            </span>
            <select
              value={lang}
              onChange={(e) => switchLang(e.target.value)}
              disabled={translating}
              className="bg-slate-700 text-[10px] font-black text-white uppercase outline-none cursor-pointer px-2 py-1 rounded border border-slate-500 disabled:opacity-50"
            >
              <option value="en">{t("common.english")}</option>
              <option value="fr">{t("common.french")}</option>
            </select>
          </div>
        </div>

        {/* Header */}
        <div>
          <h1 className="text-2xl font-black uppercase text-slate-100">{form?.name || run?.name}</h1>
          {form?.description && <p className="text-sm text-slate-400 mt-2">{form.description}</p>}
          {run?.closes_at && <p className="text-xs text-slate-400 mt-2 flex items-center gap-1"><Clock className="w-3 h-3" /> {t("forms.closes")} {new Date(run.closes_at).toLocaleDateString()}</p>}
        </div>

        {/* Sections — step-by-step navigation */}
        {(() => {
          const validSections = sections.filter(sec => fields.some(f => String(f.section_id) === String(sec.id)));
          if (validSections.length <= 1) {
            // Single section — render all fields directly
            return (
              <div className="space-y-4">
                {fields.filter(f => !f.section_id || sections.some(s => String(s.id) === String(f.section_id))).map(f => (
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
            );
          }

          // Multi-section — stepper
          const sec = validSections[currentSection];
          if (!sec) return null;
          // Include fields with no section in the FIRST step so they are never
          // dropped or rendered twice (single-section path already covers them).
          const secFields = fields.filter(f => {
            if (currentSection === 0 && !f.section_id) return true;
            return String(f.section_id) === String(sec.id);
          });
          const isLast = currentSection >= validSections.length - 1;
          const isFirst = currentSection === 0;

          return (
            <div className="space-y-6">
              {/* Progress indicator */}
              <div className="flex items-center gap-1">
                {validSections.map((_, i) => (
                  <div key={i} className={`h-1 flex-1 rounded-full ${i <= currentSection ? "bg-orange-500" : "bg-slate-700"}`} />
                ))}
                <span className="text-[9px] font-black text-slate-500 ml-2">{currentSection + 1}/{validSections.length}</span>
              </div>

              {/* Section title */}
              <div>
                <h2 className="text-lg font-black uppercase text-slate-100">{sec.title}</h2>
                {sec.description && <p className="text-xs text-slate-400 mt-1">{sec.description}</p>}
              </div>

              {/* Fields */}
              <div className="space-y-4">
                {secFields.map(f => (
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

              {/* Navigation buttons */}
              <div className="flex gap-3 pt-2">
                {!isFirst && (
                  <button
                    onClick={() => setCurrentSection(prev => Math.max(0, prev - 1))}
                    className="px-5 py-2.5 rounded-xl bg-slate-800 border border-slate-600 text-slate-300 text-xs font-black uppercase hover:bg-slate-700 transition-colors"
                  >
                    ← {t("common.previous") || "Previous"}
                  </button>
                )}
                {!isLast ? (
                  <button
                    onClick={() => setCurrentSection(prev => Math.min(validSections.length - 1, prev + 1))}
                    className="ml-auto px-6 py-2.5 rounded-xl bg-orange-500 text-white text-xs font-black uppercase hover:bg-orange-600 transition-colors"
                  >
                    {t("common.next") || "Next"} →
                  </button>
                ) : (
                  <button
                    onClick={handleSubmit}
                    disabled={saving}
                    className="ml-auto px-8 py-3 rounded-xl bg-orange-500 text-white text-sm font-black uppercase hover:bg-orange-600 disabled:opacity-50 transition-all flex items-center gap-2"
                  >
                    <Send className="w-4 h-4" /> {saving ? t("forms.submitting") : t("forms.submit")}
                  </button>
                )}
              </div>
            </div>
          );
        })()}

        {/* Submit — only for forms with no sections (single-page layout) */}
        {!success && run?.status === "active" && sections.filter(sec => fields.some(f => String(f.section_id) === String(sec.id))).length <= 1 && (
          <div className="pt-4">
            <button onClick={handleSubmit} disabled={saving} className="w-full px-6 py-4 rounded-xl bg-orange-500 text-white text-sm font-black uppercase hover:bg-orange-600 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
              <Send className="w-4 h-4" /> {saving ? t("forms.submitting") : t("forms.submit")}
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
