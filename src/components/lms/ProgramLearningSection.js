"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, GraduationCap, Trash2, CheckCircle2, Circle } from "lucide-react";
import AppModal from "@/components/ui/AppModal";
import AppButton from "@/components/ui/AppButton";
import { notify } from "./notify";
import { useI18n } from "@/lib/i18n";

/**
 * PROGRAM LEARNING SECTION (Phase 6 — Program Manager experience)
 *
 * Renders the LMS learning items attached to one week of a Program and lets a
 * Program Manager attach EXISTING courses (never duplicated), toggle
 * REQUIRED/OPTIONAL, and detach. Progress is never shown or stored here — the
 * LMS remains the single source of truth; the participant surfaces read it.
 *
 * Authorization: the API requires lms.assign for mutations (Program Course
 * Assignment permission — distinct from course authoring) and lms.view for
 * reads. The `canEdit` prop only controls visibility; the server enforces.
 */
export default function ProgramLearningSection({
  programId,
  weekNumber,
  sessionId,
  canEdit = false,
}) {
  const { t } = useI18n();
  const [requirements, setRequirements] = useState(null);
  const [summary, setSummary] = useState([]);
  const [showPicker, setShowPicker] = useState(false);
  const [courses, setCourses] = useState([]);
  const [saving, setSaving] = useState(false);

  const fetchRequirements = useCallback(async () => {
    setRequirements(null);
    const params = new URLSearchParams({ program_id: programId });
    if (weekNumber != null && weekNumber !== "") params.set("week_number", weekNumber);
    if (sessionId) params.set("session_id", sessionId);
    if (canEdit) params.set("includeSummary", "1");
    try {
      const res = await fetch(`/api/lms/program-requirements?${params.toString()}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "lms.errors.loadFailed");
      setRequirements(data.requirements || []);
      setSummary(data.summary || []);
    } catch (e) {
      notify("error", e.message || "lms.errors.loadFailed");
      setRequirements([]);
    }
  }, [programId, weekNumber, sessionId, canEdit]);

  useEffect(() => {
    if (programId) fetchRequirements();
  }, [programId, fetchRequirements]);

  const openPicker = async () => {
    setShowPicker(true);
    setCourses(null);
    try {
      const res = await fetch("/api/lms/courses?status=published");
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "lms.errors.loadFailed");
      setCourses(data.courses || []);
    } catch (e) {
      notify("error", e.message || "lms.errors.loadFailed");
      setCourses([]);
    }
  };

  const attach = async (course) => {
    setSaving(true);
    try {
      const res = await fetch("/api/lms/program-requirements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          program_id: programId,
          course_id: course.id,
          week_number: weekNumber != null && weekNumber !== "" ? Number(weekNumber) : null,
          session_id: sessionId || null,
          is_required: true,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "lms.errors.saveFailed");
      notify("success", "lms.programLearning.attached");
      setShowPicker(false);
      fetchRequirements();
    } catch (e) {
      notify("error", e.message || "lms.errors.saveFailed");
    } finally {
      setSaving(false);
    }
  };

  const toggleRequired = async (req) => {
    try {
      const res = await fetch(`/api/lms/program-requirements/${req.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_required: !req.is_required }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "lms.errors.saveFailed");
      notify("success", "lms.programLearning.updated");
      fetchRequirements();
    } catch (e) {
      notify("error", e.message || "lms.errors.saveFailed");
    }
  };

  const detach = async (req) => {
    if (!window.confirm(t("lms.programLearning.confirmDetach"))) return;
    try {
      const res = await fetch(`/api/lms/program-requirements/${req.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "lms.errors.saveFailed");
      notify("success", "lms.programLearning.detached");
      fetchRequirements();
    } catch (e) {
      notify("error", e.message || "lms.errors.saveFailed");
    }
  };

  const availableCourses = (courses || []).filter(
    (c) => !(requirements || []).some((r) => String(r.course_id) === String(c.id)),
  );

  return (
    <div className="space-y-4">
      {/* PHASE 4: LEARNING (LMS) */}
      <div className="flex items-center justify-between pb-3 border-b border-[var(--brand-orange)]/20">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-[var(--brand-orange)]/10 flex items-center justify-center text-[9px] font-black text-[var(--brand-orange)] border border-[var(--brand-orange)]/20 shadow-sm">
            4
          </div>
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--brand-orange)]">
            {t("lms.programLearning.title")}
          </span>
        </div>
        {canEdit && (
          <button
            onClick={openPicker}
            className="text-[9px] font-black text-[var(--brand-orange)] uppercase hover:underline flex items-center gap-1"
          >
            <Plus className="w-3 h-3" /> {t("lms.programLearning.addCourse")}
          </button>
        )}
      </div>

      <div className="space-y-2">
        {requirements === null ? (
          <div className="flex justify-center py-6">
            <div className="w-4 h-4 border-2 border-[var(--brand-orange)] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : requirements.length === 0 ? (
          <div className="py-6 flex flex-col items-center justify-center border-2 border-dashed border-[var(--border-primary)] rounded-2xl opacity-40">
            <GraduationCap className="w-6 h-6 mb-1.5" />
            <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: "var(--text-secondary)" }}>
              {t("lms.programLearning.noLearning")}
            </p>
          </div>
        ) : (
          requirements.map((req) => (
            <div
              key={req.id}
              className="flex items-center justify-between gap-3 p-3 rounded-xl border bg-primary"
              style={{ borderColor: "var(--border-primary)" }}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-[var(--brand-orange)]/10 flex items-center justify-center shrink-0">
                  <GraduationCap className="w-4 h-4 text-[var(--brand-orange)]" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-black uppercase tracking-tight truncate" style={{ color: "var(--text-primary)" }}>
                    {req.title || req.course?.title || req.course_id}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[7px] font-black uppercase tracking-widest ${
                        req.is_required
                          ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                          : "bg-slate-500/10 text-slate-400 border border-slate-500/20"
                      }`}
                    >
                      {req.is_required ? t("lms.programLearning.required") : t("lms.programLearning.optional")}
                    </span>
                    {req.course?.status && (
                      <span className="text-[8px] font-bold uppercase tracking-widest" style={{ color: "var(--text-tertiary)" }}>
                        {t(`lms.status.${req.course.status}`)}
                      </span>
                    )}
                    {canEdit &&
                      summary.find((s) => String(s.requirement_id) === String(req.id)) &&
                      (() => {
                        const s = summary.find((x) => String(x.requirement_id) === String(req.id));
                        return (
                          <span className="text-[8px] font-bold uppercase tracking-widest" style={{ color: "var(--text-tertiary)" }}>
                            {t("lms.programLearning.enrolledCount", { n: s.enrolled })}
                            {s.completed > 0 ? ` · ${t("lms.programLearning.completedCount", { n: s.completed })}` : ""}
                          </span>
                        );
                      })()}
                  </div>
                </div>
              </div>
              {canEdit && (
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => toggleRequired(req)}
                    title={req.is_required ? t("lms.programLearning.makeOptional") : t("lms.programLearning.makeRequired")}
                    className="p-1.5 rounded-lg transition-all"
                    style={{ color: req.is_required ? "var(--brand-orange)" : "var(--text-tertiary)" }}
                  >
                    {req.is_required ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Circle className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    onClick={() => detach(req)}
                    className="p-1.5 rounded-lg text-rose-500/40 hover:text-rose-500 transition-all"
                    title={t("lms.programLearning.detach")}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Course picker */}
      <AppModal
        isOpen={showPicker}
        onClose={() => setShowPicker(false)}
        title={t("lms.programLearning.pickTitle")}
        size="lg"
      >
        <div className="space-y-2 max-h-[60vh] sm:max-h-[420px] overflow-y-auto pr-1">
          {courses === null ? (
            <div className="flex justify-center py-10">
              <div className="w-5 h-5 border-2 border-[var(--brand-orange)] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : availableCourses.length === 0 ? (
            <p className="text-[10px] font-bold uppercase tracking-wider text-center py-8" style={{ color: "var(--text-tertiary)" }}>
              {t("lms.programLearning.noAvailable")}
            </p>
          ) : (
            availableCourses.map((course) => (
              <div
                key={course.id}
                className="flex items-center justify-between gap-3 p-3 rounded-xl border"
                style={{ background: "var(--surface-2)", borderColor: "var(--border-primary)" }}
              >
                <div className="min-w-0">
                  <p className="text-xs font-bold truncate" style={{ color: "var(--text-primary)" }}>
                    {course.title}
                  </p>
                  <p className="text-[9px] font-bold uppercase tracking-wider mt-0.5" style={{ color: "var(--text-tertiary)" }}>
                    {course.is_free
                      ? t("lms.programLearning.free")
                      : `${t("lms.programLearning.paid")} · ${Number(course.price || 0).toLocaleString()}`}
                  </p>
                </div>
                <AppButton variant="primary" size="sm" loading={saving} onClick={() => attach(course)}>
                  {t("lms.programLearning.attach")}
                </AppButton>
              </div>
            ))
          )}
        </div>
      </AppModal>
    </div>
  );
}
