"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import AppModal from "@/components/ui/AppModal";
import AppInput from "@/components/ui/AppInput";
import AppButton from "@/components/ui/AppButton";
import { useI18n } from "@/lib/i18n";
import { notify } from "./notify";

const letter = (i) => String.fromCharCode(65 + i);

/**
 * Question authoring modal. The question type is NOT chosen here — it is set
 * at the assessment level: new questions inherit the assessment's type, and
 * editing an existing question keeps its stored type (legacy rows).
 */
export default function QuestionModal({ isOpen, onClose, onSaved, mode, assessmentId, assessmentType, question }) {
  const { t } = useI18n();
  const type = question?.question_type || assessmentType || "multiple_choice";
  const mcType = type === "multiple_choice";

  const [text, setText] = useState(question?.question || "");
  const [options, setOptions] = useState(() => {
    if (question && mcType) {
      const opts = question.options || [];
      if (opts.length > 0) return opts.map((o) => ({ text: o.text || "" }));
    }
    return [{ text: "" }, { text: "" }];
  });
  const [correct, setCorrect] = useState(() => {
    if (question && question.correct_answer && question.correct_answer.length) {
      return String(question.correct_answer[0]);
    }
    return "";
  });
  const [points, setPoints] = useState(question?.points || 1);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  const addOption = () => setOptions((prev) => [...prev, { text: "" }]);
  const updateOption = (index, value) =>
    setOptions((prev) => prev.map((o, i) => (i === index ? { text: value } : o)));
  const removeOption = (index) => {
    setOptions((prev) => prev.filter((_, i) => i !== index));
    const removedLetter = letter(index);
    setCorrect((prev) => (prev === removedLetter ? "" : prev));
  };

  const validate = () => {
    const next = {};
    if (!text.trim()) next.text = "lms.errors.questionTextRequired";
    if (mcType) {
      if (options.filter((o) => o.text.trim()).length < 2) next.options = "lms.errors.mcOptionsRequired";
      if (!correct) next.correct = "lms.errors.correctAnswerRequired";
    } else if (!correct) {
      next.correct = "lms.errors.correctAnswerRequired";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const save = async () => {
    if (!validate()) return;
    if (mode !== "edit" && !assessmentId) {
      notify("error", "lms.errors.assessmentNotFound");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        question: text,
        options: mcType ? options.map((o, i) => ({ key: letter(i), text: o.text })) : [],
        correctAnswer: correct ? [correct] : [],
        points: points || 1,
      };
      const url =
        mode === "edit" ? `/api/lms/questions/${question.id}` : `/api/lms/assessments/${assessmentId}/questions`;
      const res = await fetch(url, {
        method: mode === "edit" ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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
      title={mode === "edit" ? t("lms.questions.edit") : t("lms.questions.add")}
      size="lg"
    >
      <div className="space-y-5">
        <AppInput
          label={t("lms.questions.text")}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t("lms.questions.textPlaceholder")}
          error={errors.text ? t(errors.text) : undefined}
        />

        {mcType ? (
          <div className="space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-wider ml-1" style={{ color: "var(--text-secondary)" }}>
              {t("lms.questions.options")}
            </p>
            {options.map((option, index) => (
              <div key={index} className="flex items-center gap-3">
                <span
                  className="w-8 h-8 shrink-0 flex items-center justify-center rounded-lg text-xs font-black"
                  style={{ background: "var(--surface-3)", color: "var(--text-secondary)" }}
                >
                  {letter(index)}
                </span>
                <AppInput
                  value={option.text}
                  onChange={(e) => updateOption(index, e.target.value)}
                  placeholder={t("lms.questions.optionTextPlaceholder")}
                  className="flex-1"
                />
                <button
                  type="button"
                  onClick={() => removeOption(index)}
                  disabled={options.length <= 2}
                  className="p-2 rounded-lg transition-colors disabled:opacity-30"
                  style={{ color: "var(--text-tertiary)" }}
                  title={t("common.remove")}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            <AppButton variant="secondary" size="sm" icon={Plus} onClick={addOption}>
              {t("lms.questions.addOption")}
            </AppButton>
            {errors.options && (
              <p className="text-[10px] font-bold text-rose-500 uppercase tracking-wider mt-1">
                {t(errors.options)}
              </p>
            )}

            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider ml-1 mb-2" style={{ color: "var(--text-secondary)" }}>
                {t("lms.questions.correctAnswer")}
              </p>
              <div className="space-y-2">
                {options.map((option, index) => (
                  <label
                    key={index}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer border"
                    style={{
                      background: "var(--surface-2)",
                      borderColor:
                        correct === letter(index) ? "var(--brand-orange)" : "var(--border-primary)",
                    }}
                  >
                    <input
                      type="radio"
                      name="correct"
                      checked={correct === letter(index)}
                      onChange={() => setCorrect(letter(index))}
                      className="w-4 h-4"
                      style={{ accentColor: "var(--brand-orange)" }}
                    />
                    <span className="text-xs font-bold truncate" style={{ color: "var(--text-primary)" }}>
                      {letter(index)}. {option.text || "—"}
                    </span>
                  </label>
                ))}
              </div>
              {errors.correct && (
                <p className="text-[10px] font-bold text-rose-500 uppercase tracking-wider mt-1">
                  {t(errors.correct)}
                </p>
              )}
            </div>
          </div>
        ) : (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider ml-1 mb-2" style={{ color: "var(--text-secondary)" }}>
              {t("lms.questions.correctAnswer")}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {["true", "false"].map((val) => (
                <label
                  key={val}
                  className="flex items-center gap-3 px-4 py-3 rounded-lg cursor-pointer border"
                  style={{
                    background: "var(--surface-2)",
                    borderColor: correct === val ? "var(--brand-orange)" : "var(--border-primary)",
                  }}
                >
                  <input
                    type="radio"
                    name="correct-tf"
                    checked={correct === val}
                    onChange={() => setCorrect(val)}
                    className="w-4 h-4"
                    style={{ accentColor: "var(--brand-orange)" }}
                  />
                  <span className="text-xs font-black uppercase tracking-wider" style={{ color: "var(--text-primary)" }}>
                    {t(`lms.questions.${val}`)}
                  </span>
                </label>
              ))}
            </div>
            {errors.correct && (
              <p className="text-[10px] font-bold text-rose-500 uppercase tracking-wider mt-1">
                {t(errors.correct)}
              </p>
            )}
          </div>
        )}

        <AppInput
          label={t("lms.questions.points")}
          type="number"
          min="1"
          value={points}
          onChange={(e) => setPoints(e.target.value)}
        />

        <div className="flex justify-end gap-3 pt-2">
          <AppButton variant="ghost" onClick={onClose}>
            {t("common.cancel")}
          </AppButton>
          <AppButton variant="primary" loading={saving} onClick={save}>
            {t("common.save")}
          </AppButton>
        </div>
      </div>
    </AppModal>
  );
}
