"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { useSafeBack } from "@/lib/useSafeBack";
import { useApi } from "@/lib/hooks/useApi";
import SubmitHeader from "@/components/platform/runs/submit/SubmitHeader";
import RunInfoCard from "@/components/platform/runs/submit/RunInfoCard";
import SubmissionNotices from "@/components/platform/runs/submit/SubmissionNotices";
import SubmitFormSections from "@/components/platform/runs/submit/SubmitFormSections";
import SubmitFooterActions from "@/components/platform/runs/submit/SubmitFooterActions";
import SubmitSuccess from "@/components/platform/runs/submit/SubmitSuccess";
import SubmitLoading from "@/components/platform/runs/submit/SubmitLoading";
import SubmitError from "@/components/platform/runs/submit/SubmitError";

// ─── Module-scope readers ────────────────────────────────────────────────────
// The reading hook keys its internal work on these, so they are made once here
// rather than rebuilt on every render.

const EMPTY_OBJECT = {};
const EMPTY_LIST = [];

/** The run and the person's own submission, whole: both are read from one body. */
const pickRunPayload = (response) => (response?.success ? response : null);
const pickFormPayload = (response) => (response?.success ? response : null);

export default function SubmitFormPage() {
  const params = useParams();
  const router = useRouter();
  const goBack = useSafeBack("/admin/platform/runs");
  const { t } = useI18n();
  const runId = params.runId;

  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(null);
  const [notification, setNotification] = useState(null);

  // Run + form definition, read through the shared hook: it owns the cache, the
  // cache-first paint and the discarding of a stale answer, so the page keeps no
  // copy of its own and reads its data during render.
  const {
    data: runPayload,
    loading: runLoading,
    error: runError,
    status: runStatus,
  } = useApi(
    runId ? `/api/platform/form-runs?id=${runId}&participant=true` : null,
    { defaultValue: null, transform: pickRunPayload, deps: [runId] },
  );
  const run = runPayload?.run || null;

  const {
    data: formPayload,
    loading: formLoading,
    error: formError,
    status: formStatus,
  } = useApi(
    run?.form_id ? `/api/platform/forms?id=${run.form_id}` : null,
    { defaultValue: null, transform: pickFormPayload, deps: [run?.form_id] },
  );
  const form = formPayload?.form || null;
  const sections = formPayload?.sections ?? EMPTY_LIST;
  const fields = formPayload?.fields ?? EMPTY_LIST;

  // The stored submission, and what this screen's own writes replaced it with.
  // A save or a submit answers with the stored row, so it goes here rather than
  // over the read: nothing is copied, and a background re-read cannot undo it.
  const [savedSubmission, setSavedSubmission] = useState(null);
  const submission = savedSubmission || runPayload?.submission || null;

  // The answers are a DERIVED BASE PLUS EDITS: what the server has stored, and
  // what the person typed, recorded against the field it changes. Nothing is
  // copied into state, so no effect has to notice the answers arriving - which is
  // what would erase an edit typed in the moment before the read answered.
  const [answerEdits, setAnswerEdits] = useState(EMPTY_OBJECT);
  const answers = { ...(submission?.data || EMPTY_OBJECT), ...answerEdits };

  // Form state
  const [errors, setErrors] = useState(EMPTY_OBJECT);

  // A section is open until it is CLOSED, so the closed ones are what is
  // recorded. Copied the other way round, a section that arrives after the read
  // would be shut until an effect opened it.
  const [closedSections, setClosedSections] = useState(EMPTY_OBJECT);

  const notify = (message) => { setNotification(message); setTimeout(() => setNotification(null), 3000); };

  // The read's outcome, derived. A payload that says it failed carries its own
  // message, and a request that never got an answer is the network's.
  const readFailure = runError || formError || null;
  const error =
    runStatus !== null && !run && !readFailure
      ? t(runPayload?.error || "") || t("platformMisc.runSubmitDetail.runNotFound")
      : formStatus !== null && !form && !readFailure
        ? t("platformMisc.runSubmitDetail.formNotFound")
        : readFailure
          ? t(readFailure) || t("platformMisc.runSubmitDetail.runNotFound")
          : null;

  // One render passes with the run known and its form not yet asked for: the
  // hook's flag rises in the effect, which is after that render.
  const formPending = Boolean(run?.form_id) && formStatus === null && !formError;
  const loading = runLoading || formLoading || formPending;

  const updateField = (fieldId, value) => {
    setAnswerEdits((previousEdits) => ({ ...previousEdits, [fieldId]: value }));
    // Clear error for this field
    setErrors((previousErrors) => {
      const nextErrors = { ...previousErrors };
      delete nextErrors[fieldId];
      return nextErrors;
    });
  };

  const validate = () => {
    const newErrors = {};
    fields.forEach((field) => {
      if (field.required && (!answers[field.id] || (typeof answers[field.id] === "string" && !answers[field.id].trim()))) {
        newErrors[field.id] = t("platformMisc.runSubmitDetail.fieldRequired", { label: field.label });
      }
      // Validate based on field type and validation rules
      if (answers[field.id] && field.validation) {
        const validation = field.validation;
        if (field.field_type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(answers[field.id])) {
          newErrors[field.id] = t("platformMisc.runSubmitDetail.invalidEmail");
        }
        if (validation.minLength && String(answers[field.id]).length < validation.minLength) {
          newErrors[field.id] = t("platformMisc.runSubmitDetail.minLength", { count: validation.minLength });
        }
        if (validation.maxLength && String(answers[field.id]).length > validation.maxLength) {
          newErrors[field.id] = t("platformMisc.runSubmitDetail.maxLength", { count: validation.maxLength });
        }
        if (validation.min !== undefined && Number(answers[field.id]) < validation.min) {
          newErrors[field.id] = t("platformMisc.runSubmitDetail.minValue", { value: validation.min });
        }
        if (validation.max !== undefined && Number(answers[field.id]) > validation.max) {
          newErrors[field.id] = t("platformMisc.runSubmitDetail.maxValue", { value: validation.max });
        }
        if (validation.pattern && !new RegExp(validation.pattern).test(answers[field.id])) {
          newErrors[field.id] = validation.message || t("platformMisc.runSubmitDetail.invalidFormat");
        }
      }
    });
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSaveDraft = async () => {
    setSaving(true);
    try {
      const response = await fetch("/api/platform/form-runs?action=submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ run_id: parseInt(runId), data: answers, status: "draft" }),
      });
      const data = await response.json();
      if (data.success) {
        setSavedSubmission(data.submission);
        notify(t("platformMisc.runSubmitDetail.draftSaved"));
      } else {
        notify(t((data.error || t("platformMisc.runSubmitDetail.saveDraftFailed")) || "") || (data.error || t("platformMisc.runSubmitDetail.saveDraftFailed")));
      }
    } catch (_) {}
    setSaving(false);
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const response = await fetch("/api/platform/form-runs?action=submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ run_id: parseInt(runId), data: answers, status: "submitted" }),
      });
      const data = await response.json();
      if (data.success) {
        setSavedSubmission(data.submission);
        setSuccess(true);
        notify(t("platformMisc.runSubmitDetail.submissionReceived"));
      } else {
        notify(t((data.error || t("platformMisc.runSubmitDetail.submitFailed")) || "") || (data.error || t("platformMisc.runSubmitDetail.submitFailed")));
      }
    } catch (_) {}
    setSaving(false);
  };

  const isSubmitted = submission?.status === "submitted" || submission?.status === "approved" || submission?.status === "rejected" || submission?.status === "revision_requested";
  const isApproved = submission?.status === "approved";
  const isRejected = submission?.status === "rejected";
  const needsRevision = submission?.status === "revision_requested";
  const isDraft = submission?.status === "draft";

  // ─── SUCCESS STATE ───
  if (success) {
    return <SubmitSuccess t={t} run={run} submission={submission} router={router} />;
  }

  // ─── LOADING ───
  if (loading) {
    return <SubmitLoading />;
  }

  // ─── ERROR ───
  if (error) {
    return <SubmitError t={t} error={error} goBack={goBack} />;
  }

  // ─── FORM ───
  return (
    <div className="min-h-screen">
      {notification && (
        <div className="fixed bottom-6 right-6 z-[500] px-5 py-3 rounded-xl bg-emerald-500 text-black text-[10px] font-bold uppercase animate-in">
          {notification}
        </div>
      )}

      {/* Header */}
      <SubmitHeader
        t={t}
        form={form}
        goBack={goBack}
        isDraft={isDraft}
        isSubmitted={isSubmitted}
        isApproved={isApproved}
        isRejected={isRejected}
        needsRevision={needsRevision}
      />

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Run info */}
        {run && <RunInfoCard t={t} run={run} />}

        {/* Already submitted notice / revision notice */}
        <SubmissionNotices
          t={t}
          isSubmitted={isSubmitted}
          needsRevision={needsRevision}
          isApproved={isApproved}
          isRejected={isRejected}
          submission={submission}
        />

        {/* Form fields by section */}
        <SubmitFormSections
          t={t}
          sections={sections}
          fields={fields}
          closedSections={closedSections}
          setClosedSections={setClosedSections}
          answers={answers}
          errors={errors}
          isSubmitted={isSubmitted}
          needsRevision={needsRevision}
          updateField={updateField}
        />

        {/* Action buttons */}
        {fields.length > 0 && !isSubmitted && (
          <SubmitFooterActions
            t={t}
            saving={saving}
            needsRevision={needsRevision}
            handleSaveDraft={handleSaveDraft}
            handleSubmit={handleSubmit}
          />
        )}
      </div>
    </div>
  );
}
