"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import { Loader2, Send, CheckCircle2, AlertTriangle, Clock, Globe, Mail } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import AppPhoneInput from "@/components/ui/AppPhoneInput";
import { useApi } from "@/lib/hooks/useApi";

// ─── Translation helper via MyMemory (free, no API key needed) ───
async function translateText(text, sourceLang, targetLang) {
  if (!text || !text.trim()) return text;
  if (sourceLang === targetLang) return text;
  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${sourceLang}|${targetLang}`;
    const response = await fetch(url);
    const payload = await response.json();
    return payload?.responseData?.translatedText || text;
  } catch (_) { return text; }
}

async function translateBatch(strings, sourceLang, targetLang) {
  const results = [];
  for (const str of strings) {
    results.push(await translateText(str, sourceLang, targetLang));
  }
  return results;
}

// ─── What the screen starts from (module scope: built once per run) ──────────

const EMPTY_RUN = {
  run: null,
  form: null,
  sections: [],
  fields: [],
  originalLang: "en",
  draftData: {},
  draftSection: 0,
  failure: null,
};

/** The form's own language, guessed from the accents in its content. */
function detectFormLanguage(strings) {
  const allText = strings.filter(Boolean).join(" ").toLowerCase();
  const frenchChars = (allText.match(/[éèêëàâîïôûùçœ]/g) || []).length;
  return frenchChars > 2 ? "fr" : "en";
}

/**
 * The run, its form, and THIS visit's saved draft — everything the screen starts
 * from, shaped where the answer arrives. The draft belongs here rather than in a
 * second effect because it is a fact about the browser, and the answer is the only
 * moment the browser is the one asking.
 */
const pickPublicRun = (slug) => (payload) => {
  // A run that is not there is the same answer as a refusal, and the screen shows
  // the server's own message for it - which is what the loader did by throwing.
  if (!payload?.success || !payload.run) {
    return { ...EMPTY_RUN, failure: payload?.error || "Run not found" };
  }

  const form = {
    name: payload.run.form_name || payload.run.name,
    description: payload.run.form_description || payload.run.description,
  };
  const sections = payload.sections || [];
  const fields = payload.fields || [];

  let draftData = {};
  let draftSection = 0;
  try {
    const saved = localStorage.getItem(`form_draft_${slug}`);
    if (saved) {
      const draft = JSON.parse(saved);
      if (draft.formData && typeof draft.formData === "object") {
        draftData = draft.formData;
      }
      if (typeof draft.currentSection === "number" && draft.currentSection >= 0) {
        draftSection = draft.currentSection;
      }
    }
  } catch {
    // A browser with storage disabled simply has no draft.
  }

  return {
    run: payload.run,
    form,
    sections,
    fields,
    originalLang: detectFormLanguage([
      form.name,
      form.description,
      ...sections.map((section) => section.title || ""),
      ...fields.flatMap((field) => [field.label, field.help_text, field.placeholder].filter(Boolean)),
    ]),
    draftData,
    draftSection,
    failure: null,
  };
};





export default function PublicSubmitPage() {
  const params = useParams();
  const runId = params.runId;
  const { t, lang, switchLang } = useI18n();
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [successConfig, setSuccessConfig] = useState(null);
  const [notification, setNotification] = useState(null);
  const [errors, setErrors] = useState({});

  // The read goes through the shared hook, which owns the cache, the cache-first
  // paint and the discarding of a stale answer. One root value per run, built once
  // rather than on every render.
  const pickRun = useMemo(() => pickPublicRun(runId), [runId]);
  const runRead = useApi(
    runId ? `/api/s/public-run?slug=${encodeURIComponent(runId)}` : null,
    { defaultValue: EMPTY_RUN, transform: pickRun },
  );
  const raw = runRead.data;
  const run = raw.run;
  const loading = runRead.loading;
  const error = raw.failure
    ? t(raw.failure) || raw.failure
    : runRead.error || null;

  // ─── Translation: the form's texts in the interface's language ───
  //
  // A translation is an OVERRIDE keyed on the language it was made for, so a
  // language switch needs no clearing, no second copy of the form and no effect
  // that writes state - and the raw payload stays the thing everything is restored
  // from, which is what the four refs used to hold.
  const [translated, setTranslated] = useState(null);
  const tr = translated && translated.lang === lang ? translated : null;
  const form = tr?.form || raw.form;
  const sections = tr?.sections || raw.sections;
  const fields = tr?.fields || raw.fields;
  // A translation is owed while the interface language differs from the form's own
  // and the one for that language is not in hand.
  const translating =
    Boolean(raw.form) &&
    lang !== raw.originalLang &&
    (!translated || translated.lang !== lang);

  // ─── The visitor's typing, over the draft the read brought with it ───
  const [dataEdits, setDataEdits] = useState(null);
  const formData = dataEdits ?? raw.draftData;
  const [sectionChoice, setSectionChoice] = useState(null);
  const currentSection = sectionChoice ?? raw.draftSection;

  const notify = (msg) => { setNotification(msg); setTimeout(() => setNotification(null), 3000); };

  // The form's OWN language decides the interface for a visitor who has not chosen
  // one: someone opening a French form should read it in French. It writes the
  // LANGUAGE store rather than state, so no render is cascaded from here.
  useEffect(() => {
    if (!raw.form || raw.originalLang === "en") return;
    let chosen = null;
    try { chosen = localStorage.getItem("impactos_lang"); } catch { chosen = null; }
    if (!chosen) switchLang(raw.originalLang);
  }, [raw.form, raw.originalLang, switchLang]);

  // Ask for the translation while one is owed for the language in force.
  useEffect(() => {
    if (!raw.form || lang === raw.originalLang) return;
    if (translated && translated.lang === lang) return;
    let cancelled = false;
    (async () => {
      const srcLang = raw.originalLang || "en";
      try {
        const [tForm, tSections, tLabels, tHelp, tPlaceholders] = await Promise.all([
          translateBatch([raw.form?.name || "", raw.form?.description || ""], srcLang, lang),
          translateBatch(raw.sections.map(section => section.title || ""), srcLang, lang),
          translateBatch(raw.fields.map(field => field.label || ""), srcLang, lang),
          translateBatch(raw.fields.map(field => field.help_text || ""), srcLang, lang),
          translateBatch(raw.fields.map(field => field.placeholder || ""), srcLang, lang),
        ]);
        if (cancelled) return;
        setTranslated({
          lang,
          form: { name: tForm[0], description: tForm[1] },
          sections: raw.sections.map((section, i) => ({ ...section, title: tSections[i] || section.title })),
          fields: raw.fields.map((field, i) => ({
            ...field,
            label: tLabels[i] || field.label,
            help_text: tHelp[i] || field.help_text,
            placeholder: tPlaceholders[i] || field.placeholder,
          })),
        });
      } catch (error) { console.error("Translation failed:", error); }
    })();
    return () => { cancelled = true; };
  }, [raw, lang, translated]);

  // Auto-save currentSection to localStorage
  useEffect(() => {
    try {
      const existing = JSON.parse(localStorage.getItem(`form_draft_${runId}`) || "{}");
      existing.currentSection = currentSection;
      existing.lastSaved = Date.now();
      localStorage.setItem(`form_draft_${runId}`, JSON.stringify(existing));
    } catch (_) {}
  }, [currentSection, runId]);

  const updateField = (fieldId, value) => {
    setDataEdits((prev) => {
      const newData = { ...(prev ?? raw.draftData), [fieldId]: value };
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
    for (const field of fields) {
      if (field.required && (!formData[field.id] || (typeof formData[field.id] === "string" && !formData[field.id].trim()))) {
        newErrors[field.id] = t("forms.fieldRequired");
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) { notify(t("forms.requiredFields")); return; }
    setSaving(true);
    try {
      const response = await fetch("/api/s/public-submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: runId,
          data: formData,
          invitation_token: new URLSearchParams(window.location.search).get("invitation") || undefined,
        }),
      });
      const payload = await response.json();
      if (payload.success) {
        localStorage.removeItem(`form_draft_${runId}`);
        setSuccess(true);
        if (payload.success_message) {
          setSuccessConfig({ message: payload.success_message, redirect_url: payload.redirect_url });
        }
        notify(t("forms.submissionReceived"));
      } else {
        notify(t((payload.error || t("forms.submitFailed")) || "") || (payload.error || t("forms.submitFailed")));
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
        return <textarea value={value} onChange={(event) => updateField(field.id, event.target.value)} placeholder={field.placeholder || ""} disabled={isDisabled} rows={3} className={`${inputClass} resize-none`} />;
      case "email":
        return <input type="email" value={value} onChange={(event) => updateField(field.id, event.target.value)} placeholder={field.placeholder || "email@example.com"} disabled={isDisabled} className={inputClass} />;
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
          <select value={value} onChange={(event) => updateField(field.id, event.target.value)} disabled={isDisabled} className={`${inputClass} [&>option]:bg-slate-800 [&>option]:text-slate-100 appearance-none`}>
            <option value="">{t("forms.selectOption")}</option>
            {(field.options || []).map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        );
      case "rating": {
        const opts = (Array.isArray(field.options) && field.options.length > 0) ? field.options : [{ label: "1", value: "1" }, { label: "2", value: "2" }, { label: "3", value: "3" }, { label: "4", value: "4" }, { label: "5", value: "5" }];
        return (
          <div className="space-y-2">
            <p className="text-xs text-slate-500">{t("forms.selectRating")}</p>
            <div className="flex gap-3 flex-wrap">
              {opts.map(option => (
                <button key={option.value} type="button" onClick={() => updateField(field.id, option.value)} disabled={isDisabled}
                  className={`min-w-[56px] px-4 py-3 rounded-xl text-base font-bold border-2 transition-all ${
                    value === option.value
                      ? "bg-orange-500 text-white border-orange-500 scale-110 shadow-lg shadow-orange-500/30"
                      : "bg-slate-700 text-slate-200 border-slate-500 hover:border-orange-400 hover:text-orange-400 hover:bg-slate-600"
                  }`}
                >{option.label}</button>
              ))}
            </div>
          </div>
        );
      }
      case "number": case "currency":
        return <input type="number" value={value} onChange={(event) => updateField(field.id, event.target.value)} placeholder={field.placeholder || "0"} disabled={isDisabled} className={inputClass} />;
      case "date": return <input type="date" value={value} onChange={(event) => updateField(field.id, event.target.value)} disabled={isDisabled} className={inputClass} />;
      case "url": return <input type="url" value={value} onChange={(event) => updateField(field.id, event.target.value)} placeholder={field.placeholder || "https://"} disabled={isDisabled} className={inputClass} />;
      default:
        return <input type="text" value={value} onChange={(event) => updateField(field.id, event.target.value)} placeholder={field.placeholder || ""} disabled={isDisabled} className={inputClass} />;
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
    for (const field of fields) {
      const rawLabel = (field.label || "").toLowerCase();
      const safeKey = rawLabel.replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
      const value = formData[field.id] != null ? escapeHtml(String(formData[field.id])) : "";
      result = result.replace(new RegExp(`\\{\\{${safeKey}\\}\\}`, "gi"), value);
      result = result.replace(new RegExp(`\\{\\{field_${field.id}\\}\\}`, "gi"), value);
    }
    // Common special placeholders (all dynamic values escaped)
    const nameField = fields.find(field => (field.label || "").toLowerCase().includes("name"));
    const emailField = fields.find(field => (field.label || "").toLowerCase().includes("email"));
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
            <Image src="/brand/logo_full.png" alt="Future Studio" width={1018} height={1024} className="h-12 w-auto object-contain mb-0" />
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
          <Image src="/brand/logo_full.png" alt="Future Studio" width={1018} height={1024} className="h-12 w-auto object-contain mb-0" />
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
              onChange={(event) => switchLang(event.target.value)}
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
          const validSections = sections.filter(sec => fields.some(field => String(field.section_id) === String(sec.id)));
          if (validSections.length <= 1) {
            // Single section — render all fields directly
            return (
              <div className="space-y-4">
                {fields.filter(field => !field.section_id || sections.some(section => String(section.id) === String(field.section_id))).map(field => (
                  <div key={field.id} className="space-y-1.5">
                    <label className="text-sm font-bold text-slate-200 flex items-center gap-1">
                      {field.label} {field.required && <span className="text-red-400">*</span>}
                    </label>
                    {field.help_text && <p className="text-xs text-slate-500">{field.help_text}</p>}
                    {renderField(field)}
                    {errors[field.id] && <p className="text-xs text-red-400 font-bold">{errors[field.id]}</p>}
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
          const secFields = fields.filter(field => {
            if (currentSection === 0 && !field.section_id) return true;
            return String(field.section_id) === String(sec.id);
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
                <span className="text-[10px] font-bold text-slate-500 ml-2">{currentSection + 1}/{validSections.length}</span>
              </div>

              {/* Section title */}
              <div>
                <h2 className="text-lg font-black uppercase text-slate-100">{sec.title}</h2>
                {sec.description && <p className="text-xs text-slate-400 mt-1">{sec.description}</p>}
              </div>

              {/* Fields */}
              <div className="space-y-4">
                {secFields.map(field => (
                  <div key={field.id} className="space-y-1.5">
                    <label className="text-sm font-bold text-slate-200 flex items-center gap-1">
                      {field.label} {field.required && <span className="text-red-400">*</span>}
                    </label>
                    {field.help_text && <p className="text-xs text-slate-500">{field.help_text}</p>}
                    {renderField(field)}
                    {errors[field.id] && <p className="text-xs text-red-400 font-bold">{errors[field.id]}</p>}
                  </div>
                ))}
              </div>

              {/* Navigation buttons */}
              <div className="flex gap-3 pt-2">
                {!isFirst && (
                  <button
                    onClick={() => setSectionChoice(prev => Math.max(0, (prev ?? raw.draftSection) - 1))}
                    className="px-5 py-2.5 rounded-xl bg-slate-800 border border-slate-600 text-slate-300 text-xs font-black uppercase hover:bg-slate-700 transition-colors"
                  >
                    ← {t("common.previous") || "Previous"}
                  </button>
                )}
                {!isLast ? (
                  <button
                    onClick={() => setSectionChoice(prev => Math.min(validSections.length - 1, (prev ?? raw.draftSection) + 1))}
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
        {!success && run?.status === "active" && sections.filter(sec => fields.some(field => String(field.section_id) === String(sec.id))).length <= 1 && (
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
