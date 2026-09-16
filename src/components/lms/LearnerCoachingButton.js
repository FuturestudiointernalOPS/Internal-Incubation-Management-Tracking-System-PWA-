"use client";

import { useCallback, useEffect, useState } from "react";
import { LifeBuoy, XCircle, Loader2 } from "lucide-react";
import AppModal from "@/components/ui/AppModal";
import AppButton from "@/components/ui/AppButton";
import { notify } from "./notify";
import { useI18n } from "@/lib/i18n";

/**
 * ASK FOR COACHING (Phase 8 — learner surface)
 *
 * The blinking call-to-action a learner uses to ask for coaching BEFORE,
 * DURING or AFTER a course. Deliberately visible: coaching support should be
 * discoverable from inside the learning experience, not hidden in a menu.
 *
 * Behaviour:
 *   - `courseId` known (course overview / lesson player) → the request is tied
 *     to that course; `lessonId` adds "right here" context.
 *   - `courseId` unknown (My Learning list) → the learner picks the course.
 *   - The learner's own open/past requests are read back so the button can show
 *     "request pending" and offer a withdrawal instead of duplicating the ask.
 *
 * Access is enforced server-side from the enrollment table — the button never
 * grants anything by itself.
 */
export default function LearnerCoachingButton({ courseId = null, lessonId = null }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [requests, setRequests] = useState([]);
  const [courses, setCourses] = useState(null);
  const [form, setForm] = useState({ courseId: courseId || "", timing: "during", topic: "", message: "" });
  const [saving, setSaving] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const fetchRequests = useCallback(async () => {
    try {
      const res = await fetch("/api/lms/coaching-requests");
      const data = await res.json();
      if (data.success) setRequests(data.requests || []);
    } catch {
      /* the button stays usable even if the status read fails */
    }
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  useEffect(() => {
    setForm((f) => ({ ...f, courseId: courseId || f.courseId || "" }));
  }, [courseId]);

  /** Enrolled courses — only needed when the button has no course context. */
  const loadCourses = async () => {
    if (courses !== null || courseId) return;
    setCourses([]);
    try {
      const res = await fetch("/api/lms/my-learning");
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "lms.learning.loadFailed");
      const list = (data.courses || []).map((entry) => ({
        id: entry.course?.id,
        title: entry.course?.title,
      }));
      setCourses(list);
      setForm((f) => ({ ...f, courseId: f.courseId || list[0]?.id || "" }));
    } catch (e) {
      notify("error", e.message || "lms.errors.loadFailed");
    }
  };

  const openModal = async () => {
    setOpen(true);
    await Promise.all([fetchRequests(), loadCourses()]);
  };

  const activeRequest = (requests || []).find(
    (r) =>
      r.status === "pending" &&
      (!courseId || String(r.course_id) === String(courseId)),
  );

  const submit = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/lms/coaching-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          course_id: form.courseId,
          lesson_id: lessonId || null,
          timing: form.timing,
          topic: form.topic,
          message: form.message,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "lms.errors.saveFailed");
      notify("success", "lms.coaching.requested");
      setOpen(false);
      setForm({ courseId: courseId || "", timing: "during", topic: "", message: "" });
      fetchRequests();
    } catch (e) {
      notify("error", e.message || "lms.errors.saveFailed");
    } finally {
      setSaving(false);
    }
  };

  const cancel = async (id) => {
    if (!window.confirm(t("lms.coaching.confirmCancel"))) return;
    setCancelling(true);
    try {
      const res = await fetch(`/api/lms/coaching-requests/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "lms.errors.saveFailed");
      notify("success", "lms.coaching.cancelled");
      setOpen(false);
      fetchRequests();
    } catch (e) {
      notify("error", e.message || "lms.errors.saveFailed");
    } finally {
      setCancelling(false);
    }
  };

  const canSubmit = !!form.courseId && !saving;

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all motion-reduce:animate-none ${
          activeRequest ? "" : "animate-coaching-blink"
        }`}
        style={
          activeRequest
            ? {
                background: "var(--surface-2)",
                color: "var(--text-secondary)",
                border: "1px solid var(--border-primary)",
              }
            : {
                background: "var(--brand-orange)",
                color: "#fff",
                border: "1px solid transparent",
              }
        }
      >
        <LifeBuoy className="w-3.5 h-3.5 shrink-0" />
        {activeRequest
          ? t("lms.coaching.pendingButton")
          : t("lms.coaching.askButton")}
      </button>

      <AppModal
        isOpen={open}
        onClose={() => setOpen(false)}
        title={t("lms.coaching.modalTitle")}
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-[10px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            {t("lms.coaching.modalHint")}
          </p>

          {!courseId && (
            <div>
              <label
                className="block text-[9px] font-black uppercase tracking-widest mb-1.5"
                style={{ color: "var(--text-secondary)" }}
              >
                {t("lms.coaching.courseLabel")}
              </label>
              {courses === null ? (
                <div className="flex items-center gap-2 text-[10px]" style={{ color: "var(--text-tertiary)" }}>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  {t("common.loading")}
                </div>
              ) : (
                <select
                  value={form.courseId}
                  onChange={(e) => setForm((f) => ({ ...f, courseId: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg outline-none border text-xs"
                  style={{
                    background: "var(--surface-2)",
                    borderColor: "var(--border-primary)",
                    color: "var(--text-primary)",
                  }}
                >
                  {(courses || []).map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.title}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          <div>
            <label
              className="block text-[9px] font-black uppercase tracking-widest mb-1.5"
              style={{ color: "var(--text-secondary)" }}
            >
              {t("lms.coaching.timingLabel")}
            </label>
            <div className="grid grid-cols-3 gap-2">
              {["before", "during", "after"].map((timing) => (
                <button
                  key={timing}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, timing }))}
                  className="py-2 rounded-lg border text-[9px] font-black uppercase tracking-widest transition-all"
                  style={{
                    borderColor:
                      form.timing === timing ? "var(--brand-orange)" : "var(--border-primary)",
                    background:
                      form.timing === timing ? "rgb(255 102 0 / 0.1)" : "transparent",
                    color:
                      form.timing === timing ? "var(--brand-orange)" : "var(--text-secondary)",
                  }}
                >
                  {t(`lms.coaching.timing.${timing}`)}
                </button>
              ))}
            </div>
          </div>

          <input
            value={form.topic}
            onChange={(e) => setForm((f) => ({ ...f, topic: e.target.value }))}
            placeholder={t("lms.coaching.topicPlaceholder")}
            className="w-full px-3 py-2 rounded-lg outline-none border text-xs"
            style={{
              background: "var(--surface-2)",
              borderColor: "var(--border-primary)",
              color: "var(--text-primary)",
            }}
          />

          <textarea
            rows={3}
            value={form.message}
            onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
            placeholder={t("lms.coaching.messagePlaceholder")}
            className="w-full px-3 py-2 rounded-lg outline-none border text-xs"
            style={{
              background: "var(--surface-2)",
              borderColor: "var(--border-primary)",
              color: "var(--text-primary)",
            }}
          />

          {activeRequest && (
            <div
              className="p-3 rounded-xl border text-[10px]"
              style={{ borderColor: "var(--border-primary)", color: "var(--text-secondary)" }}
            >
              <p className="font-black uppercase tracking-widest text-[9px] mb-1" style={{ color: "var(--brand-orange)" }}>
                {t("lms.coaching.pendingButton")}
              </p>
              <p>
                {t("lms.coaching.pendingDetail", {
                  timing: t(`lms.coaching.timing.${activeRequest.timing}`),
                })}
              </p>
              {activeRequest.response_note && (
                <p className="mt-1 italic">{activeRequest.response_note}</p>
              )}
              <button
                type="button"
                onClick={() => cancel(activeRequest.id)}
                disabled={cancelling}
                className="mt-2 inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-rose-500 disabled:opacity-50"
              >
                <XCircle className="w-3 h-3" />
                {t("lms.coaching.cancelRequest")}
              </button>
            </div>
          )}

          {!activeRequest && (
            <div className="flex justify-end gap-2">
              <AppButton variant="secondary" onClick={() => setOpen(false)}>
                {t("common.cancel")}
              </AppButton>
              <AppButton variant="primary" loading={saving} disabled={!canSubmit} onClick={submit}>
                {t("lms.coaching.send")}
              </AppButton>
            </div>
          )}
        </div>
      </AppModal>
    </>
  );
}
