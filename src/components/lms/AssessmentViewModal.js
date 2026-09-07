"use client";

import { HelpCircle, Pencil } from "lucide-react";
import AppModal from "@/components/ui/AppModal";
import AppButton from "@/components/ui/AppButton";
import { useI18n } from "@/lib/i18n";

const letter = (i) => String.fromCharCode(65 + i);

/**
 * Read-only view of one assessment (opened by clicking an assessment in the
 * course editor). Shows the configuration and every question with its options
 * and correct answers. The Edit button hands over to AssessmentModal.
 */
export default function AssessmentViewModal({ isOpen, onClose, onEdit, assessment }) {
  const { t } = useI18n();
  if (!assessment) return null;

  const questions = assessment.questions || [];
  const typeLabel =
    assessment.question_type === "true_false"
      ? t("lms.questions.typeTf")
      : t("lms.questions.typeMc");

  return (
    <AppModal isOpen={isOpen} onClose={onClose} title={t("lms.assessments.title")} size="lg">
      <div className="space-y-5">
        {/* Header */}
        <div>
          <div className="flex items-start gap-3 flex-wrap">
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-black truncate" style={{ color: "var(--text-primary)" }}>
                {assessment.title || "—"}
              </h3>
              <p className="flex items-center gap-2 flex-wrap text-[9px] font-bold uppercase tracking-wider mt-1" style={{ color: "var(--text-tertiary)" }}>
                <span>{typeLabel}</span>
                <span>·</span>
                <span>
                  {questions.length} {t("lms.preview.questions")}
                </span>
                <span>·</span>
                <span>
                  {t("lms.preview.passMark")}:{" "}
                  {assessment.pass_mark != null ? `${assessment.pass_mark}%` : "—"}
                </span>
                <span>·</span>
                <span>{assessment.is_required ? t("lms.assessments.required") : t("lms.assessments.optional")}</span>
              </p>
            </div>
          </div>
          {assessment.description ? (
            <p className="text-xs font-medium mt-3 whitespace-pre-wrap" style={{ color: "var(--text-secondary)" }}>
              {assessment.description}
            </p>
          ) : null}
        </div>

        {/* Questions */}
        <div className="border-t pt-4" style={{ borderColor: "var(--border-primary)" }}>
          {questions.length === 0 ? (
            <p className="text-[10px] font-bold uppercase tracking-wider py-4 text-center" style={{ color: "var(--text-tertiary)" }}>
              {t("lms.assessments.empty")}
            </p>
          ) : (
            <div className="space-y-3">
              {questions.map((q, index) => {
                const isMc = q.question_type !== "true_false";
                const options = Array.isArray(q.options) ? q.options : [];
                const correct = (q.correct_answer || []).map(String);
                return (
                  <div
                    key={q.id}
                    className="rounded-lg border p-3"
                    style={{ background: "var(--surface-2)", borderColor: "var(--border-primary)" }}
                  >
                    <div className="flex items-start gap-2">
                      <HelpCircle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "var(--text-tertiary)" }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold" style={{ color: "var(--text-primary)" }}>
                          {index + 1}. {q.question}
                        </p>
                        <p className="text-[9px] font-bold uppercase tracking-wider mt-0.5" style={{ color: "var(--text-tertiary)" }}>
                          {q.question_type === "true_false" ? t("lms.questions.typeTf") : t("lms.questions.typeMc")} · {q.points || 1}{" "}
                          {t("lms.questions.points")}
                        </p>
                      </div>
                    </div>

                    <div className="mt-2 space-y-1">
                      {isMc ? (
                        options.map((o, oi) => {
                          const isCorrect =
                            correct.includes(String(o.key)) || correct.includes(letter(oi));
                          return (
                            <p
                              key={oi}
                              className={`text-[11px] font-bold ${isCorrect ? "text-emerald-500" : ""}`}
                              style={isCorrect ? undefined : { color: "var(--text-secondary)" }}
                            >
                              {letter(oi)}. {o.text}
                              {isCorrect ? " ✓" : ""}
                            </p>
                          );
                        })
                      ) : (
                        <p className="text-[11px] font-bold text-emerald-500">
                          {t("lms.preview.correctAnswer")}:{" "}
                          {correct.length > 0 ? t(`lms.questions.${correct[0]}`) : "—"}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 pt-2">
          <AppButton variant="ghost" onClick={onClose}>
            {t("common.cancel")}
          </AppButton>
          <AppButton variant="primary" icon={Pencil} onClick={onEdit}>
            {t("lms.assessments.edit")}
          </AppButton>
        </div>
      </div>
    </AppModal>
  );
}
