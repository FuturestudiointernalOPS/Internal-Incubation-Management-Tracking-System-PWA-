"use client";

import { useState } from "react";
import { ArrowLeft, CheckCircle2, ChevronDown, Circle, XCircle } from "lucide-react";
import AppButton from "@/components/ui/AppButton";
import { useApi } from "@/lib/hooks/useApi";
import { useI18n } from "@/lib/i18n";
import { formatDate } from "@/lib/constants";
import LearnerAvatar from "./LearnerAvatar";

const EMPTY = { detail: null, failure: null };
const pickDetail = (data) =>
  data?.success ? { detail: data.detail, failure: null } : { detail: null, failure: data?.error || "lms.enroll.loadFailed" };

const label = { color: "var(--text-secondary)" };
const muted = { color: "var(--text-tertiary)" };

function SectionTitle({ children }) {
  return (
    <p className="text-[10px] font-black uppercase tracking-widest mb-2" style={label}>
      {children}
    </p>
  );
}

function AnswerLine({ t, given, expected, correct }) {
  const show = (answer) => (answer ? (answer.text ? `${answer.key}. ${answer.text}` : answer.key) : "—");
  const pretty = (answer) =>
    answer && (answer.key === "true" || answer.key === "false") ? t(`lms.questions.${answer.key}`) : show(answer);
  return (
    <div className="text-[11px] space-y-0.5 mt-1">
      <p style={{ color: correct ? "var(--chart-success)" : "var(--chart-danger)" }}>
        {t("lms.enroll.detail.givenAnswer")} : <strong>{given ? pretty(given) : t("lms.enroll.detail.noAnswer")}</strong>
      </p>
      {!correct && (
        <p style={muted}>
          {t("lms.enroll.detail.expectedAnswer")} : <strong style={{ color: "var(--text-primary)" }}>{pretty(expected)}</strong>
        </p>
      )}
    </div>
  );
}

function AssessmentBlock({ t, assessment }) {
  const [open, setOpen] = useState(false);
  const attempts = assessment.attempts;
  const last = attempts[attempts.length - 1];
  const passed = attempts.some((attempt) => attempt.passed);
  const best = attempts.length ? Math.max(...attempts.map((attempt) => attempt.percent)) : null;
  const state = passed ? "passed" : attempts.length ? "failed" : "todo";
  const tone = state === "passed" ? "var(--chart-success)" : state === "failed" ? "var(--chart-danger)" : "var(--text-tertiary)";
  const [shown, setShown] = useState(null);
  const attempt = attempts.find((a) => a.attempt_number === shown) || last;

  return (
    <div className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--border-primary)", background: "var(--surface-2)" }}>
      <button
        type="button"
        onClick={() => attempts.length && setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-3 py-2.5 text-left"
        disabled={!attempts.length}
      >
        <span style={{ color: tone }}>
          {state === "passed" ? <CheckCircle2 className="w-4 h-4" /> : state === "failed" ? <XCircle className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-xs font-bold truncate" style={{ color: "var(--text-primary)" }}>{assessment.title}</span>
          <span className="block text-[9px] font-bold uppercase tracking-wider mt-0.5" style={muted}>
            {assessment.chapter || t("lms.sections.courseAssessments")} · {t("lms.assessment.passMark", { mark: assessment.pass_mark ?? 70 })}
          </span>
        </span>
        <span className="text-[10px] font-black uppercase tracking-wider shrink-0" style={{ color: tone }}>
          {t(`lms.enroll.assessmentStates.${state}`)}{best != null ? ` ${best}%` : ""}
          {attempts.length > 1 ? ` · ${t("lms.enroll.attemptsCount", { count: attempts.length })}` : ""}
        </span>
        {attempts.length > 0 && (
          <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} style={muted} />
        )}
      </button>

      {open && attempt && (
        <div className="px-3 pb-3 pt-1 border-t space-y-3" style={{ borderColor: "var(--border-primary)" }}>
          {attempts.length > 1 && (
            <div className="flex flex-wrap gap-1.5 pt-2">
              {attempts.map((a) => (
                <button
                  key={a.attempt_number}
                  type="button"
                  onClick={() => setShown(a.attempt_number)}
                  className="px-2 py-1 rounded-md border text-[9px] font-black uppercase tracking-wider"
                  style={{
                    borderColor: a.attempt_number === attempt.attempt_number ? "var(--brand-orange)" : "var(--border-primary)",
                    color: a.passed ? "var(--chart-success)" : "var(--chart-danger)",
                  }}
                >
                  #{a.attempt_number} · {a.percent}%
                </button>
              ))}
            </div>
          )}
          <p className="text-[10px] font-bold uppercase tracking-wider pt-1" style={muted}>
            {t("lms.enroll.detail.attemptSummary", {
              score: attempt.score,
              total: attempt.total_points,
              percent: attempt.percent,
            })}
            {attempt.completed_at ? ` · ${formatDate(attempt.completed_at)}` : ""}
          </p>
          <ul className="space-y-2">
            {attempt.questions.map((question, index) => (
              <li
                key={question.id}
                className="rounded-md border px-3 py-2"
                style={{
                  borderColor: question.correct ? "var(--border-primary)" : "var(--chart-danger)",
                  background: "var(--surface-1)",
                }}
              >
                <p className="text-xs font-bold flex items-start gap-2" style={{ color: "var(--text-primary)" }}>
                  <span style={{ color: question.correct ? "var(--chart-success)" : "var(--chart-danger)" }}>
                    {question.correct ? "✓" : "✕"}
                  </span>
                  <span>{index + 1}. {question.question}</span>
                </p>
                <AnswerLine t={t} given={question.given} expected={question.expected} correct={question.correct} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** One learner's lessons and assessment results, opened from the roster. */
export default function LearnerDetail({ courseId, enrollment, onBack }) {
  const { t } = useI18n();
  const { data, loading } = useApi(`/api/lms/courses/${courseId}/enrollments/${enrollment.id}`, {
    defaultValue: EMPTY,
    transform: pickDetail,
    deps: [courseId, enrollment.id],
  });
  const detail = data.detail;
  const progress = enrollment.progress || { percent: 0, completedLessons: 0, totalLessons: 0 };
  const learner = enrollment.learner;

  return (
    <div className="space-y-5">
      <AppButton variant="ghost" size="sm" icon={ArrowLeft} onClick={onBack}>
        {t("lms.enroll.detail.back")}
      </AppButton>

      <div className="flex items-center gap-4 flex-wrap">
        <LearnerAvatar learner={learner} fallback={enrollment.user_cid} size={56} />
        <div className="flex-1 min-w-0">
          <p className="text-base font-black truncate" style={{ color: "var(--text-primary)" }}>
            {learner?.name || enrollment.user_cid}
          </p>
          <p className="text-[10px] font-bold uppercase tracking-wider truncate" style={muted}>
            {learner?.email || enrollment.user_cid} · {t(`lms.enroll.statuses.${enrollment.status}`)} · {t("lms.enroll.detail.since")} {formatDate(enrollment.enrolled_at)}
          </p>
        </div>
        <div className="w-full sm:w-56">
          <div className="flex justify-between mb-1">
            <span className="text-[9px] font-black uppercase tracking-wider" style={label}>
              {t("lms.enroll.lessonsDone", { done: progress.completedLessons, total: progress.totalLessons })}
            </span>
            <span className="text-[10px] font-black" style={{ color: "var(--text-primary)" }}>{progress.percent}%</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--surface-3)" }}>
            <div className="h-full rounded-full" style={{ width: `${progress.percent}%`, background: "var(--brand-orange)" }} />
          </div>
        </div>
      </div>

      {loading || !detail ? (
        <div className="flex justify-center py-10">
          <div className="w-5 h-5 border-2 border-[var(--brand-orange)] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          <div>
            <SectionTitle>{t("lms.enroll.detail.lessons")}</SectionTitle>
            <div className="space-y-3">
              {detail.chapters.map((chapter) => {
                const done = chapter.lessons.filter((lesson) => lesson.completed).length;
                return (
                  <div key={chapter.id} className="rounded-lg border" style={{ borderColor: "var(--border-primary)", background: "var(--surface-2)" }}>
                    <div className="flex items-center justify-between px-3 py-2">
                      <p className="text-xs font-black truncate" style={{ color: "var(--text-primary)" }}>{chapter.title}</p>
                      <span className="text-[9px] font-black uppercase tracking-wider shrink-0" style={muted}>
                        {done}/{chapter.lessons.length}
                      </span>
                    </div>
                    <ul className="px-3 pb-2 space-y-1">
                      {chapter.lessons.map((lesson) => (
                        <li key={lesson.id} className="flex items-center gap-2 text-xs">
                          {lesson.completed ? (
                            <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: "var(--chart-success)" }} />
                          ) : (
                            <Circle className="w-4 h-4 shrink-0" style={muted} />
                          )}
                          <span className="flex-1 min-w-0 truncate" style={{ color: lesson.completed ? "var(--text-primary)" : "var(--text-tertiary)" }}>
                            {lesson.title}
                          </span>
                          <span className="text-[9px] font-bold uppercase tracking-wider shrink-0" style={muted}>
                            {lesson.completed
                              ? `${t("lms.enroll.detail.finished")}${lesson.completed_at ? ` · ${formatDate(lesson.completed_at)}` : ""}`
                              : t("lms.enroll.detail.notFinished")}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <SectionTitle>{t("lms.enroll.assessments")}</SectionTitle>
            <div className="space-y-2">
              {detail.assessments.map((assessment) => (
                <AssessmentBlock key={assessment.id} t={t} assessment={assessment} />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
