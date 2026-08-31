"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  PlayCircle,
  CheckCircle2,
  XCircle,
  ChevronLeft,
  ChevronRight,
  Send,
  AlertCircle,
  RotateCcw,
  HelpCircle,
} from "lucide-react";
import AppButton from "@/components/ui/AppButton";
import { notify } from "./notify";
import { useI18n } from "@/lib/i18n";

/**
 * LEARNER ASSESSMENT (Phase 4).
 *
 * Views:
 *   entry   — title, question count, pass mark, attempt history, Start/Try Again
 *   taking  — one question at a time (radio options), prev/next, indicator,
 *             Submit on the last question. Answers are client state only:
 *             a refresh returns to the entry view and creates NO attempt.
 *   result  — score, PASS/Not Passed (text + icon), correct count,
 *             Try Again (failed) / Continue Course (passed).
 *
 * Scoring + pass/fail are computed server-side (never trusted from the client).
 */
export default function AssessmentTake({ courseId, assessmentId }) {
  const { t } = useI18n();
  const router = useRouter();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [view, setView] = useState("entry");
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [attempts, setAttempts] = useState([]);
  const [validationError, setValidationError] = useState(null);

  const fetchAssessment = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/lms/assessments/${assessmentId}/take`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "lms.assessment.unavailable");
      setData(json);
      setAttempts(json.attempts || []);
    } catch (e) {
      setError(e.message || "lms.assessment.unavailable");
    } finally {
      setLoading(false);
    }
  }, [assessmentId]);

  useEffect(() => {
    fetchAssessment();
  }, [fetchAssessment]);

  const questions = useMemo(() => data?.questions || [], [data]);
  const question = questions[index];

  const selectAnswer = (questionId, answer) => {
    setAnswers((prev) => ({ ...prev, [questionId]: answer }));
    setValidationError(null);
  };

  const submit = async () => {
    // Client-side guard: every question must have an answer.
    const missing = questions.find((q) => answers[q.id] == null);
    if (missing) {
      setValidationError("lms.errors.answerRequired");
      setIndex(questions.findIndex((q) => q.id === missing.id));
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        answers: questions.map((q) => ({ questionId: q.id, answer: answers[q.id] })),
      };
      const res = await fetch(`/api/lms/assessments/${assessmentId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "lms.assessment.submitFailed");
      if (json.courseCompleted && json.certificate) {
        notify("success", "lms.certificate.courseCompleted");
      }
      setResult(json);
      setAttempts((prev) => [...prev, json.attempt]);
      setView("result");
    } catch (e) {
      notify("error", e.message === "lms.errors.answerRequired" ? e.message : "lms.assessment.submitFailed");
    } finally {
      setSubmitting(false);
    }
  };

  const start = () => {
    setIndex(0);
    setAnswers({});
    setValidationError(null);
    setView("taking");
  };

  const goToCourse = () => router.push(`/participant/learning/${courseId}`);

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <div className="w-6 h-6 border-2 border-[var(--brand-orange)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center gap-4 py-24 text-center">
        <AlertCircle className="w-8 h-8 text-rose-500" />
        <p className="text-xs font-bold uppercase tracking-wider max-w-sm" style={{ color: "var(--text-secondary)" }}>
          {t(error === "lms.errors.notEnrolled" ? "lms.assessment.noAccess" : error || "lms.assessment.unavailable")}
        </p>
        <AppButton variant="secondary" onClick={goToCourse}>
          {t("lms.learning.title")}
        </AppButton>
      </div>
    );
  }

  const { assessment } = data;
  const passMark = assessment.pass_mark != null ? Number(assessment.pass_mark) : 70;

  if (view === "result" && result) {
    const passed = result.attempt.passed;
    return (
      <div className="max-w-xl mx-auto">
        <ResultCard
          t={t}
          result={result}
          passed={passed}
          passMark={passMark}
          onTryAgain={start}
          onContinue={goToCourse}
          attempts={attempts}
        />
      </div>
    );
  }

  if (view === "taking" && question) {
    return (
      <div className="max-w-xl mx-auto space-y-4">
        {/* Progress header */}
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-black uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
            {t("lms.assessment.questionOf", { current: index + 1, total: questions.length })}
          </p>
          <span className="text-[10px] font-black uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
            {t("lms.assessment.passMark", { mark: passMark })}
          </span>
        </div>

        {/* Question indicator */}
        <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("lms.assessment.questionsCount", { count: questions.length })}>
          {questions.map((q, i) => {
            const isAnswered = answers[q.id] != null;
            const isCurrent = i === index;
            return (
              <button
                key={q.id}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`${i + 1}${isAnswered ? ` ${t("lms.assessment.passed").toLowerCase()}` : ""}`}
                className="w-7 h-7 rounded-lg text-[10px] font-black transition-colors"
                style={{
                  background: isCurrent ? "var(--brand-orange)" : isAnswered ? "var(--surface-3)" : "transparent",
                  color: isCurrent ? "#000" : isAnswered ? "var(--text-primary)" : "var(--text-tertiary)",
                  border: "1px solid var(--border-primary)",
                }}
              >
                {i + 1}
              </button>
            );
          })}
        </div>

        {/* Question card */}
        <div className="rounded-xl border p-6" style={{ background: "var(--surface-1)", borderColor: "var(--border-primary)" }}>
          <h2 className="text-sm font-black tracking-tight" style={{ color: "var(--text-primary)" }}>
            {question.question}
          </h2>
          <div className="mt-5 space-y-2.5" role="radiogroup" aria-label={question.question}>
            {question.question_type === "true_false" ? (
              ["true", "false"].map((val) => (
                <OptionRow
                  key={val}
                  label={t(`lms.questions.${val}`)}
                  selected={answers[question.id] === val}
                  onSelect={() => selectAnswer(question.id, val)}
                />
              ))
            ) : (
              (question.options || []).map((option) => (
                <OptionRow
                  key={option.key}
                  letter={option.key}
                  label={option.text}
                  selected={answers[question.id] === option.key}
                  onSelect={() => selectAnswer(question.id, option.key)}
                />
              ))
            )}
          </div>
        </div>

        {validationError && (
          <p className="text-[10px] font-bold uppercase tracking-wider text-rose-500" role="alert">
            {t(validationError)}
          </p>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between gap-3">
          <AppButton variant="secondary" icon={ChevronLeft} disabled={index === 0} onClick={() => setIndex((i) => i - 1)}>
            {t("lms.assessment.previous")}
          </AppButton>
          {index < questions.length - 1 ? (
            <AppButton variant="primary" icon={ChevronRight} onClick={() => setIndex((i) => i + 1)}>
              {t("lms.assessment.next")}
            </AppButton>
          ) : (
            <AppButton variant="primary" icon={Send} loading={submitting} onClick={submit}>
              {t("lms.assessment.submit")}
            </AppButton>
          )}
        </div>
      </div>
    );
  }

  // ─── Entry view ──────────────────────────────────────────────────────────
  const passed = data.passed;
  const bestPercent = attempts.length
    ? Math.max(...attempts.map((a) => (a.total_points > 0 ? Math.round((a.score / a.total_points) * 100) : 0)))
    : null;

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <button
        type="button"
        onClick={goToCourse}
        className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest self-start transition-colors"
        style={{ color: "var(--text-tertiary)" }}
      >
        ← {t("lms.learning.title")}
      </button>

      <div className="rounded-xl border p-6" style={{ background: "var(--surface-1)", borderColor: "var(--border-primary)" }}>
        <div className="flex items-center gap-2 mb-1">
          <HelpCircle className="w-4 h-4" style={{ color: "var(--brand-blue)" }} />
          <p className="text-[10px] font-black uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
            {t("lms.assessment.title")}
          </p>
        </div>
        <h1 className="text-lg font-black tracking-tight" style={{ color: "var(--text-primary)" }}>
          {assessment.title}
        </h1>
        {assessment.description && (
          <p className="text-xs mt-2" style={{ color: "var(--text-secondary)" }}>
            {assessment.description}
          </p>
        )}

        <div className="flex flex-wrap gap-4 mt-4 text-[10px] font-black uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
          <span>{t("lms.assessment.questionsCount", { count: questions.length })}</span>
          <span>{t("lms.assessment.passMark", { mark: passMark })}</span>
          {!assessment.is_required && <span>{t("lms.lessons.optional")}</span>}
        </div>

        {passed && (
          <div className="mt-4 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" style={{ color: "var(--chart-success)" }} />
            <p className="text-xs font-black uppercase tracking-wider" style={{ color: "var(--chart-success)" }}>
              {t("lms.assessment.passed")}
              {bestPercent != null ? ` · ${t("lms.assessment.bestScore", { score: bestPercent })}` : ""}
            </p>
          </div>
        )}

        <div className="mt-5">
          {passed ? (
            <AppButton variant="secondary" icon={RotateCcw} onClick={start}>
              {t("lms.assessment.retake")}
            </AppButton>
          ) : attempts.length > 0 ? (
            <AppButton variant="primary" icon={RotateCcw} onClick={start}>
              {t("lms.assessment.tryAgain")}
            </AppButton>
          ) : (
            <AppButton variant="primary" icon={PlayCircle} onClick={start}>
              {t("lms.assessment.start")}
            </AppButton>
          )}
        </div>
      </div>

      {/* Attempt history */}
      <div className="rounded-xl border p-5" style={{ background: "var(--surface-1)", borderColor: "var(--border-primary)" }}>
        <p className="text-[10px] font-black uppercase tracking-wider mb-3" style={{ color: "var(--text-secondary)" }}>
          {t("lms.assessment.attempts")}
        </p>
        {attempts.length === 0 ? (
          <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
            {t("lms.assessment.noAttempts")}
          </p>
        ) : (
          <div className="space-y-1.5">
            {attempts.map((a) => {
              const percent = a.total_points > 0 ? Math.round((a.score / a.total_points) * 100) : 0;
              return (
                <div key={`${a.attempt_number}-${a.completed_at}`} className="flex items-center gap-3 text-xs">
                  {a.passed ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: "var(--chart-success)" }} />
                  ) : (
                    <XCircle className="w-4 h-4 shrink-0" style={{ color: "var(--chart-danger)" }} />
                  )}
                  <span className="font-bold flex-1" style={{ color: "var(--text-primary)" }}>
                    {t("lms.assessment.attempt", { n: a.attempt_number })} — {percent}%
                  </span>
                  <span
                    className="text-[9px] font-black uppercase tracking-wider"
                    style={{ color: a.passed ? "var(--chart-success)" : "var(--chart-danger)" }}
                  >
                    {a.passed ? t("lms.assessment.passed") : t("lms.assessment.failed")}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function OptionRow({ letter, label, selected, onSelect }) {
  return (
    <label
      className="flex items-center gap-3 px-4 py-3 rounded-lg border cursor-pointer transition-colors"
      style={{
        background: "var(--surface-2)",
        borderColor: selected ? "var(--brand-orange)" : "var(--border-primary)",
      }}
    >
      <input
        type="radio"
        checked={selected}
        onChange={onSelect}
        className="w-4 h-4 shrink-0"
        style={{ accentColor: "var(--brand-orange)" }}
      />
      {letter && (
        <span className="w-6 h-6 shrink-0 flex items-center justify-center rounded-md text-[10px] font-black" style={{ background: "var(--surface-3)", color: "var(--text-secondary)" }}>
          {letter}
        </span>
      )}
      <span className="text-xs font-bold" style={{ color: "var(--text-primary)" }}>
        {label}
      </span>
    </label>
  );
}

function ResultCard({ t, result, passed, passMark, onTryAgain, onContinue, attempts }) {
  const { attempt } = result;
  return (
    <div className="rounded-xl border p-8 text-center" style={{ background: "var(--surface-1)", borderColor: "var(--border-primary)" }}>
      <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: "var(--text-secondary)" }}>
        {t("lms.assessment.resultTitle")}
      </p>

      <div
        className="mt-6 mx-auto w-28 h-28 rounded-full flex items-center justify-center border-4"
        style={{
          borderColor: passed ? "var(--chart-success)" : "var(--chart-danger)",
          background: passed ? "rgba(16,185,129,0.08)" : "rgba(239,68,68,0.08)",
        }}
      >
        <span className="text-2xl font-black" style={{ color: passed ? "var(--chart-success)" : "var(--chart-danger)" }}>
          {attempt.percent}%
        </span>
      </div>

      <p className="mt-4 text-sm font-black uppercase tracking-wider" style={{ color: passed ? "var(--chart-success)" : "var(--chart-danger)" }}>
        {passed ? t("lms.assessment.passed") : t("lms.assessment.notPassed")}
      </p>
      <p className="mt-1 text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
        {t("lms.assessment.correct", { correct: attempt.score, total: attempt.total_points })} ·{" "}
        {t("lms.assessment.passMark", { mark: passMark })}
      </p>

      <div className="mt-7 flex justify-center gap-3">
        {passed ? (
          <AppButton variant="primary" icon={CheckCircle2} onClick={onContinue}>
            {t("lms.assessment.continueCourse")}
          </AppButton>
        ) : (
          <>
            <AppButton variant="secondary" icon={RotateCcw} onClick={onTryAgain}>
              {t("lms.assessment.tryAgain")}
            </AppButton>
            <AppButton variant="ghost" onClick={onContinue}>
              {t("lms.learning.title")}
            </AppButton>
          </>
        )}
      </div>

      {attempts.length > 1 && (
        <p className="mt-6 text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
          {t("lms.assessment.attempts")}: {attempts.length}
        </p>
      )}
    </div>
  );
}
