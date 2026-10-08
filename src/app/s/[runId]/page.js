"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { Loader2, AlertTriangle } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useApi } from "@/lib/hooks/useApi";
import {
  translateBatch,
  loadKkiapayScript,
  requestPaymentVerification,
  detectFormLanguage,
} from "@/lib/publicRunClient";
import PublicSubmitView from "@/components/platform/s/PublicSubmitView";
import PublicSubmitPayment from "@/components/platform/s/PublicSubmitPayment";
import PublicSubmitSuccess from "@/components/platform/s/PublicSubmitSuccess";

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

  // ─── The payment step of a PAID Execution ─────────────────────────────────
  if (payment) {
    return (
      <PublicSubmitPayment
        t={t}
        payment={payment}
        checkout={checkout}
        payStage={payStage}
        payAccessUrl={payAccessUrl}
        payEmail={payEmail}
        resendEmail={resendEmail}
        resendNotice={resendNotice}
        retryPayment={retryPayment}
        pollPayment={pollPayment}
        setResendEmail={setResendEmail}
        handleResend={handleResend}
      />
    );
  }

  if (success) {
    return (
      <PublicSubmitSuccess
        t={t}
        successConfig={successConfig}
        fields={fields}
        formData={formData}
        form={form}
        run={run}
      />
    );
  }

  return (
    <PublicSubmitView
      t={t}
      form={form}
      run={run}
      notification={notification}
      lang={lang}
      translating={translating}
      switchLang={switchLang}
      sections={sections}
      fields={fields}
      currentSection={currentSection}
      formData={formData}
      errors={errors}
      success={success}
      saving={saving}
      updateField={updateField}
      setSectionChoice={setSectionChoice}
      raw={raw}
      handleSubmit={handleSubmit}
      paidRun={paidRun}
      checkout={checkout}
      consent={consent}
      setConsent={setConsent}
    />
  );
}
