"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2, ChevronUp, ChevronDown, HelpCircle } from "lucide-react";
import AppModal from "@/components/ui/AppModal";
import AppInput from "@/components/ui/AppInput";
import AppButton from "@/components/ui/AppButton";
import QuestionModal from "./QuestionModal";
import { notify } from "./notify";
import { useI18n } from "@/lib/i18n";

/**
 * Assessment authoring modal (create + edit) with question management.
 * V1 question types: multiple_choice, true_false. Pass mark = 0–100 (%).
 */
export default function AssessmentModal({
  isOpen,
  onClose,
  onSaved,
  mode,
  courseId,
  sectionId,
  assessment,
}) {
  const { t } = useI18n();
  const [title, setTitle] = useState(assessment?.title || "");
  const [description, setDescription] = useState(assessment?.description || "");
  const [passMark, setPassMark] = useState(
    assessment?.pass_mark != null ? String(assessment.pass_mark) : "",
  );
  const [isRequired, setIsRequired] = useState(assessment ? !!assessment.is_required : true);
  const [questions, setQuestions] = useState(assessment?.questions || []);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [questionModal, setQuestionModal] = useState(null);

  const refreshQuestions = async () => {
    try {
      const res = await fetch(`/api/lms/courses/${courseId}`);
      const data = await res.json();
      if (!data.success) return;
      const fresh = data.course.courseAssessments.find(
        (a) => String(a.id) === String(assessment?.id),
      );
      if (fresh) setQuestions(fresh.questions || []);
    } catch (_) {
      /* non-fatal — parent refetches on close */
    }
  };

  const runQuestionAction = async (action, url, method, body, successKey) => {
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "lms.errors.saveFailed");
      notify("success", successKey);
      refreshQuestions();
    } catch (e) {
      notify("error", e.message || "lms.errors.saveFailed");
    }
  };

  const moveQuestion = (q, direction) =>
    runQuestionAction(
      "move",
      `/api/lms/questions/${q.id}`,
      "PUT",
      { action: "move", direction },
      "lms.courses.saved",
    );

  const deleteQuestion = (q) => {
    if (!window.confirm(t("lms.confirm.deleteQuestion"))) return;
    runQuestionAction("delete", `/api/lms/questions/${q.id}`, "DELETE", null, "lms.courses.saved");
  };

  const save = async () => {
    if (!title.trim()) {
      setErrors({ title: "lms.errors.assessmentTitleRequired" });
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      const payload = {
        title,
        description,
        passMark: passMark === "" ? null : passMark,
        isRequired,
      };
      const url =
        mode === "edit"
          ? `/api/lms/assessments/${assessment.id}`
          : `/api/lms/courses/${courseId}/assessments`;
      const body = mode === "edit" ? payload : { ...payload, sectionId: sectionId || null };
      const res = await fetch(url, {
        method: mode === "edit" ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "lms.errors.saveFailed");
      notify("success", "lms.courses.saved");
      onSaved();
      onClose();
    } catch (e) {
      notify("error", e.message || "lms.errors.saveFailed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppModal
      isOpen={isOpen}
      onClose={onClose}
      title={mode === "edit" ? t("lms.assessments.edit") : t("lms.assessments.add")}
      size="xl"
    >
      <div className="space-y-5">
        <AppInput
          label={t("lms.assessments.name")}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t("lms.assessments.namePlaceholder")}
          error={errors.title ? t(errors.title) : undefined}
        />

        <div className="space-y-2">
          <label
            className="text-[10px] font-bold uppercase tracking-wider ml-1"
            style={{ color: "var(--text-secondary)" }}
          >
            {t("lms.assessments.description")}
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder={t("lms.assessments.descriptionPlaceholder")}
            className="w-full rounded-md py-3 px-4 text-sm font-medium outline-none transition-all border resize-y"
            style={{
              background: "var(--bg-primary)",
              borderColor: "var(--border-primary)",
              color: "var(--text-primary)",
            }}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <AppInput
            label={t("lms.assessments.passMark")}
            type="number"
            min="0"
            max="100"
            value={passMark}
            onChange={(e) => setPassMark(e.target.value)}
            placeholder={t("lms.assessments.passMarkPlaceholder")}
          />
          <label
            className="flex items-center gap-3 self-end pb-3 cursor-pointer"
            style={{ color: "var(--text-secondary)" }}
          >
            <input
              type="checkbox"
              checked={isRequired}
              onChange={(e) => setIsRequired(e.target.checked)}
              className="w-4 h-4"
              style={{ accentColor: "var(--brand-orange)" }}
            />
            <span className="text-[10px] font-bold uppercase tracking-wider">
              {isRequired ? t("lms.assessments.required") : t("lms.assessments.optional")}
            </span>
          </label>
        </div>

        {/* Questions */}
        <div className="border-t pt-4" style={{ borderColor: "var(--border-primary)" }}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
              {t("lms.assessments.questions")} ({questions.length})
            </p>
            <AppButton
              variant="secondary"
              size="sm"
              icon={Plus}
              onClick={() => setQuestionModal({ mode: "create", question: null })}
            >
              {t("lms.assessments.addQuestion")}
            </AppButton>
          </div>

          {questions.length === 0 ? (
            <p className="text-[10px] font-bold uppercase tracking-wider py-6 text-center" style={{ color: "var(--text-tertiary)" }}>
              {t("lms.assessments.emptyHint")}
            </p>
          ) : (
            <div className="space-y-2">
              {questions.map((q, index) => (
                <div
                  key={q.id}
                  className="flex items-center gap-3 p-3 rounded-lg border"
                  style={{ background: "var(--surface-2)", borderColor: "var(--border-primary)" }}
                >
                  <HelpCircle className="w-4 h-4 shrink-0" style={{ color: "var(--text-tertiary)" }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold truncate" style={{ color: "var(--text-primary)" }}>
                      {index + 1}. {q.question}
                    </p>
                    <p className="text-[9px] font-bold uppercase tracking-wider mt-0.5" style={{ color: "var(--text-tertiary)" }}>
                      {q.question_type === "multiple_choice" ? t("lms.questions.typeMc") : t("lms.questions.typeTf")} · {q.points || 1}{" "}
                      {t("lms.questions.points")}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => moveQuestion(q, "up")}
                      className="p-1.5 rounded-lg transition-colors"
                      style={{ color: "var(--text-tertiary)" }}
                      title={t("lms.questions.moveUp")}
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveQuestion(q, "down")}
                      className="p-1.5 rounded-lg transition-colors"
                      style={{ color: "var(--text-tertiary)" }}
                      title={t("lms.questions.moveDown")}
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setQuestionModal({ mode: "edit", question: q })}
                      className="p-1.5 rounded-lg transition-colors"
                      style={{ color: "var(--text-tertiary)" }}
                      title={t("lms.questions.edit")}
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteQuestion(q)}
                      className="p-1.5 rounded-lg transition-colors"
                      style={{ color: "var(--text-tertiary)" }}
                      title={t("lms.questions.delete")}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <AppButton variant="ghost" onClick={onClose}>
            {t("common.cancel")}
          </AppButton>
          <AppButton variant="primary" loading={saving} onClick={save}>
            {t("common.save")}
          </AppButton>
        </div>
      </div>

      {questionModal && (
        <QuestionModal
          isOpen
          onClose={() => setQuestionModal(null)}
          onSaved={refreshQuestions}
          mode={questionModal.mode}
          assessmentId={assessment?.id}
          question={questionModal.question}
        />
      )}
    </AppModal>
  );
}
