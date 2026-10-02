"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { Loader2, Send, AlertTriangle, Clock } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useApi } from "@/lib/hooks/useApi";
import BrandingLogo from "@/components/public/run-submit/BrandingLogo";
import ContactFooter from "@/components/public/run-submit/ContactFooter";
import LanguageSelector from "@/components/public/run-submit/LanguageSelector";
import SectionsStepper from "@/components/public/run-submit/SectionsStepper";
import ConsentCard from "@/components/public/run-submit/ConsentCard";
import PaymentStep from "@/components/public/run-submit/PaymentStep";
import SubmissionSuccess from "@/components/public/run-submit/SubmissionSuccess";

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

// ─── Kkiapay's PLAIN web SDK (not the React package) ─────────────────────────
// Loaded once per page, and the widget is opened with `key` + `partnerId`.
const KKIAPAY_SCRIPT_URL = "https://cdn.kkiapay.me/k.js";

function loadKkiapayScript() {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.openKkiapayWidget) return Promise.resolve(true);
  if (!window.__kkiapayCheckoutScript) {
    window.__kkiapayCheckoutScript = new Promise((resolve) => {
      const script = document.createElement("script");
      script.src = KKIAPAY_SCRIPT_URL;
      script.async = true;
      script.onload = () => resolve(Boolean(window.openKkiapayWidget));
      script.onerror = () => resolve(false);
      document.head.appendChild(script);
    });
  }
  return window.__kkiapayCheckoutScript;
}

/**
 * Ask the SERVER to re-verify a payment with the provider (fire-and-forget).
 *
 * The Kkiapay notification is the primary path, but it can be missed — and a
 * real payment must not stay stuck on "en cours" because of it. The payer's own
 * tab is a second, independent way to reach the truth, but the BROWSER never
 * decides: it only asks, and the server answers with the verified result.
 */
function requestPaymentVerification(reference, email, transactionId = null) {
  if (!reference || !email) return;
  fetch("/api/public/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "verify",
      reference,
      email,
      ...(transactionId ? { transactionId } : {}),
    }),
  }).catch(() => {});
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
  checkout: null,
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
    // A PAID Execution carries its course and its price (decided server-side).
    checkout: payload.checkout || null,
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

  const [consent, setConsent] = useState(false);
  const [payment, setPayment] = useState(null);
  const [payStage, setPayStage] = useState("idle");
  const [payEmail, setPayEmail] = useState(null);
  const [payAccessUrl, setPayAccessUrl] = useState(null);
  const payTimer = useRef(null);

  const stopPayPolling = useCallback(() => {
    if (payTimer.current) clearTimeout(payTimer.current);
    payTimer.current = null;
  }, []);

  useEffect(() => () => stopPayPolling(), [stopPayPolling]);

  /**
   * The SERVER is the only thing that knows whether the money settled — the
   * browser never decides. Polling starts as soon as the window opens, so a
   * missing or renamed browser callback cannot strand the payer on "opening".
   */
  const pollPayment = useCallback((reference, email) => {
    const startedAt = Date.now();
    let verifyTick = 0;
    const tick = async () => {
      try {
        const response = await fetch(
          `/api/public/checkout?reference=${encodeURIComponent(reference)}&email=${encodeURIComponent(email)}`,
        );
        const payload = await response.json();
        // The window is open and we are now asking the server: the wait is a
        // CONFIRMATION of the payment, never "opening" the window again.
        setPayStage((stage) => (stage === "opening" ? "confirming" : stage));
        if (payload.success && payload.payment === "paid") {
          // Ask for the access link: served only inside the short window, so
          // past it the email is the door (and we say so).
          try {
            const accessResponse = await fetch("/api/public/checkout", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "access", reference, email }),
            });
            const accessPayload = await accessResponse.json();
            if (accessPayload.success && accessPayload.served && accessPayload.url) {
              setPayAccessUrl(accessPayload.url);
            }
          } catch (_) {}
          setPayStage("success");
          return;
        }
        if (payload.success && ["failed", "cancelled"].includes(payload.payment)) {
          setPayStage("failed");
          return;
        }
      } catch (_) {
        // A transient poll failure must not abort the wait.
      }
      // Still not settled: ask the SERVER to re-check with the provider, so a
      // missed notification cannot leave a REAL payment stuck on "en cours".
      // Every third tick (~9s) is plenty; the server is the one that decides.
      if (verifyTick % 3 === 0) requestPaymentVerification(reference, email);
      verifyTick += 1;
      if (Date.now() - startedAt >= 2 * 60 * 1000) {
        setPayStage("pending");
        return;
      }
      payTimer.current = setTimeout(tick, 3000);
    };
    tick();
  }, []);

  const openPaymentWindow = useCallback(
    async (context, email) => {
      setPayStage("opening");
      const ready = await loadKkiapayScript();
      if (!ready || !context.payment?.key) {
        setPayStage("unavailable");
        return;
      }

      // The plain SDK's own listeners. The server is asked regardless.
      if (typeof window.addSuccessListener === "function") {
        window.addSuccessListener((result) => {
          const transactionId = result?.transactionId || result?.transaction_id || null;
          if (transactionId && context.reference) {
            // Recorded as a trace… and handed to the server to re-verify at once.
            requestPaymentVerification(context.reference, email, transactionId);
          }
          setPayStage("confirming");
          stopPayPolling();
          pollPayment(context.reference, email);
        });
      }
      if (typeof window.addFailedListener === "function") {
        window.addFailedListener(() => {
          stopPayPolling();
          setPayStage("failed");
        });
      }

      window.openKkiapayWidget({
        amount: context.amount,
        key: context.payment.key,
        sandbox: context.payment.sandbox,
        email,
        partnerId: context.reference,
      });

      stopPayPolling();
      pollPayment(context.reference, email);
    },
    [pollPayment, stopPayPolling],
  );

  const [resendEmail, setResendEmail] = useState("");
  const [resendNotice, setResendNotice] = useState(null);

  /**
   * The fallback door. The answer is always the same shape, whether or not a
   * registration exists, so this cannot be used to discover who is registered.
   */
  const handleResend = async () => {
    if (!resendEmail.trim()) return;
    try {
      await fetch("/api/public/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resend", email: resendEmail.trim() }),
      });
    } catch (_) {
      // The response is neutral by design; nothing to surface either way.
    }
    setResendNotice(t("forms.existingResendSent"));
  };

  const retryPayment = async () => {
    if (!payment?.reference || !payEmail) return;
    await openPaymentWindow(payment, payEmail);
  };

  // The read goes through the shared hook, which owns the cache, the cache-first
  // paint and the discarding of a stale answer. One root value per run, built once
  // rather than on every render.
  const pickRun = useMemo(() => pickPublicRun(runId), [runId]);
  const runRead = useApi(
    runId ? `/api/s/public-run?slug=${encodeURIComponent(runId)}` : null,
    { defaultValue: EMPTY_RUN, transform: pickRun },
  );
  const raw = runRead.data;

  // ─── The paid Execution ───────────────────────────────────────────────────
  // When this run sells a course, the same submission also captures the
  // registration and the payment follows, here, in this page.
  // Derived AFTER the read: `raw` is the read's own result.
  const checkout = raw.checkout;
  const paidRun = Boolean(checkout && !checkout.misconfigured);

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
    // A paid registration records personal data, so consent is asked BEFORE the
    // capture — and it is the server that enforces it too.
    if (paidRun && !consent) { notify(t("forms.consentRequired")); return; }
    setSaving(true);
    try {
      const response = await fetch("/api/s/public-submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: runId,
          data: formData,
          consent: paidRun ? consent : undefined,
          language: lang,
          invitation_token: new URLSearchParams(window.location.search).get("invitation") || undefined,
        }),
      });
      const payload = await response.json();
      if (payload.success) {
        localStorage.removeItem(`form_draft_${runId}`);

        // One submission = one registration. A paid Execution continues into
        // payment; an EXISTING registration is answered NEUTRALLY (no reference)
        // and offers the TWO exits: sign in, or be emailed a fresh link.
        const next = payload.checkout;
        if (next?.reference && next?.email) {
          setPayment(next);
          setPayEmail(next.email);
          setSuccess(true);
          await openPaymentWindow(next, next.email);
        } else if (next?.existing) {
          setPayment(next);
          setPayStage("existing");
          setSuccess(true);
        } else if (next?.failed) {
          setPayment({ failed: true });
          setPayStage("unavailable");
          setSuccess(true);
        } else {
          setSuccess(true);
        }

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

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-orange-500" /></div>;
  if (error) return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><div className="text-center"><AlertTriangle className="w-10 h-10 mx-auto text-red-500 mb-3" /><p className="text-slate-100 font-bold">{error}</p></div></div>;

  // The sections that actually carry fields: an empty section is never a step.
  const validSections = sections.filter((sec) =>
    fields.some((field) => String(field.section_id) === String(sec.id)),
  );

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

  // ─── The payment step of a PAID Execution ─────────────────────────────────
  if (payment) {
    const displayAmount = payment.display_amount ?? checkout?.course?.amount ?? 0;
    const amountLabel = `${Number(displayAmount).toLocaleString()} ${
      payment.currency || checkout?.course?.currency || ""
    }`.trim();

    return (
      <PaymentStep
        t={t}
        payStage={payStage}
        amountLabel={amountLabel}
        payAccessUrl={payAccessUrl}
        payment={payment}
        resendEmail={resendEmail}
        resendNotice={resendNotice}
        onRetryPayment={retryPayment}
        onCheckAgain={() =>
          payment.reference && payEmail && pollPayment(payment.reference, payEmail)
        }
        onResendEmailChange={setResendEmail}
        onResend={handleResend}
      />
    );
  }

  if (success) {
    const successMessage = successConfig?.message 
      ? resolvePlaceholders(successConfig.message) 
      : null;
    
    return (
      <SubmissionSuccess
        t={t}
        successMessage={successMessage}
        redirectUrl={successConfig?.redirect_url}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-950">
      {notification && <div className="fixed bottom-6 right-6 z-[500] px-5 py-3 rounded-xl bg-orange-500 text-white text-xs font-black uppercase">{notification}</div>}
      <div className="max-w-2xl mx-auto p-6 space-y-8">
        {/* Branding */}
        <BrandingLogo className="h-12 w-auto object-contain mb-0" />

        {/* Language Selector */}
        <LanguageSelector
          t={t}
          lang={lang}
          translating={translating}
          onLangChange={switchLang}
        />

        {/* Header */}
        <div>
          <h1 className="text-2xl font-black uppercase text-slate-100">{form?.name || run?.name}</h1>
          {form?.description && <p className="text-sm text-slate-400 mt-2">{form.description}</p>}
          {run?.closes_at && <p className="text-xs text-slate-400 mt-2 flex items-center gap-1"><Clock className="w-3 h-3" /> {t("forms.closes")} {new Date(run.closes_at).toLocaleDateString()}</p>}
        </div>

        {/* The run's own instructions — the same text the internal form shows. */}
        {run?.settings?.instructions && (
          <div className="p-4 rounded-2xl border border-orange-500/20 bg-orange-500/5">
            <p className="text-xs font-medium text-slate-200 whitespace-pre-wrap">{run.settings.instructions}</p>
          </div>
        )}

        {/* Sections — step-by-step navigation */}
        <SectionsStepper
          validSections={validSections}
          fields={fields}
          currentSection={currentSection}
          formData={formData}
          errors={errors}
          disabled={success}
          saving={saving}
          onFieldChange={updateField}
          onStep={(direction) =>
            setSectionChoice((prev) => {
              const from = prev ?? raw.draftSection;
              return direction < 0
                ? Math.max(0, from - 1)
                : Math.min(validSections.length - 1, from + 1);
            })
          }
          onSubmit={handleSubmit}
          t={t}
        />

        {/* A PAID Execution: the price, and the consent the capture requires */}
        {paidRun && run?.status === "active" && !success && (
          <ConsentCard
            t={t}
            checkout={checkout}
            consent={consent}
            onConsentChange={setConsent}
          />
        )}

        {/* Submit — only for forms with no sections (single-page layout) */}
        {!success && run?.status === "active" && validSections.length <= 1 && (
          <div className="pt-4">
            <button onClick={handleSubmit} disabled={saving} className="w-full px-6 py-4 rounded-xl bg-orange-500 text-white text-sm font-black uppercase hover:bg-orange-600 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
              <Send className="w-4 h-4" /> {saving ? t("forms.submitting") : t("forms.submit")}
            </button>
          </div>
        )}

        {/* Footer */}
        <ContactFooter className="text-center pt-4 border-t border-slate-800" />
      </div>
    </div>
  );
}
