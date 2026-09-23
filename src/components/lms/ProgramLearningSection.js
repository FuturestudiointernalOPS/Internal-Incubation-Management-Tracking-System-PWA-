"use client";

import { useEffect, useState } from "react";
import { Plus, GraduationCap, Trash2, CheckCircle2, Circle } from "lucide-react";
import AppModal from "@/components/ui/AppModal";
import AppButton from "@/components/ui/AppButton";
import CourseThumb from "./CourseThumb";
import { notify } from "./notify";
import { useI18n } from "@/lib/i18n";
import { useDialogs } from "@/components/ui/DialogProvider";
import { useApi } from "@/lib/hooks/useApi";
import { usePermissions } from "@/lib/PermissionProvider";

// ─── Read shapers (module scope: built once, never per render) ───────────

// The hook keys its internal work on the address alone, so the default and the
// shaper are made once here rather than on every render.
const EMPTY_PROGRAM_LEARNING = { requirements: null, summary: [], failure: null };

/**
 * The week's learning items together with the enrolment summary, and the reason
 * they are missing. A refusal carries the server's own i18n key, which is what
 * the toast already showed.
 */
const pickProgramLearning = (data) =>
  data?.success
    ? { requirements: data.requirements || [], summary: data.summary || [], failure: null }
    : { requirements: [], summary: [], failure: data?.error || "lms.errors.loadFailed" };

/**
 * PROGRAM LEARNING SECTION (Phase 6 — Program Manager experience)
 *
 * Renders the LMS learning items attached to one week of a Program and lets a
 * Program Manager attach EXISTING courses (never duplicated), toggle
 * REQUIRED/OPTIONAL, and detach. Progress is never shown or stored here — the
 * LMS remains the single source of truth; the participant surfaces read it.
 *
 * Authorization: the API requires lms.edit for mutations and lms.view for
 * reads. The `canEdit` prop only says whether this viewer is allowed to manage
 * the program at all; the LMS capabilities decide what of that is reachable, and
 * the server enforces every call. Without the capability check a viewer who is
 * not (or not yet) granted the LMS (a staff team member, or a Program Manager
 * whose profile predates the LMS grant) fired one doomed request per session —
 * and one error toast per session — against a 403.
 */
export default function ProgramLearningSection({
  programId,
  weekNumber,
  sessionId,
  canEdit = false,
}) {
  const { t } = useI18n();
  const { confirm } = useDialogs();
  const { can, permissions, loading: permsLoading } = usePermissions();
  // The shell resolves the capability matrix once per surface and shares it.
  // Until it lands we know nothing about this viewer, so we neither fetch (a
  // request that could only be refused) nor hide the section. A matrix cached
  // on the shell's session counts as known, so this wait is paid once per
  // session rather than on every navigation.
  const matrixKnown = !permsLoading || permissions !== null;
  const canViewLms = matrixKnown ? can("lms", "view") : null;
  const canManageLms = canEdit && (matrixKnown ? can("lms", "edit") : null);
  const [showPicker, setShowPicker] = useState(false);
  const [courses, setCourses] = useState([]);
  const [saving, setSaving] = useState(false);

  // The read goes through the shared hook, which owns the cache, the cache-first
  // paint and the discarding of a stale answer, so the section keeps no copy of
  // its own. It stays unaddressed until the capability is confirmed: without it
  // the call would be refused, and reading before the matrix lands would read
  // twice.
  const params = new URLSearchParams({ program_id: programId });
  if (weekNumber != null && weekNumber !== "") params.set("week_number", weekNumber);
  if (sessionId) params.set("session_id", sessionId);
  if (canManageLms) params.set("includeSummary", "1");
  const { data, error: readError, refresh } = useApi(
    programId && canViewLms === true
      ? `/api/lms/program-requirements?${params.toString()}`
      : null,
    { defaultValue: EMPTY_PROGRAM_LEARNING, transform: pickProgramLearning },
  );

  // The payload's own refusal, or a request that never got an answer. Either
  // way there is nothing to list, so the placeholder must not stand - which is
  // what `null` means here.
  const failure = data.failure || readError || null;
  const requirements = data.requirements === null && failure ? [] : data.requirements;
  const summary = data.summary;

  // The loader raised one error toast per failed read; that is the only job
  // this effect has.
  useEffect(() => {
    if (failure) notify("error", failure);
  }, [failure]);

  const openPicker = async () => {
    setShowPicker(true);
    setCourses(null);
    try {
      const res = await fetch("/api/lms/courses?status=published");
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "lms.errors.loadFailed");
      setCourses(data.courses || []);
    } catch (error) {
      notify("error", error.message || "lms.errors.loadFailed");
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
      refresh();
    } catch (error) {
      notify("error", error.message || "lms.errors.saveFailed");
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
      refresh();
    } catch (error) {
      notify("error", error.message || "lms.errors.saveFailed");
    }
  };

  const detach = async (req) => {
    if (!(await confirm({ message: t("lms.programLearning.confirmDetach"), tone: "danger" }))) return;
    try {
      const res = await fetch(`/api/lms/program-requirements/${req.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "lms.errors.saveFailed");
      notify("success", "lms.programLearning.detached");
      refresh();
    } catch (error) {
      notify("error", error.message || "lms.errors.saveFailed");
    }
  };

  const availableCourses = (courses || []).filter(
    (course) => !(requirements || []).some((requirement) => String(requirement.course_id) === String(course.id)),
  );

  // Not granted the LMS: the section has nothing to show and every call would
  // be refused, so render nothing at all rather than an empty shell.
  if (canViewLms === false) return null;

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
        {canManageLms && (
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
                {req.course?.thumbnail_url ? (
                  <CourseThumb
                    src={req.course.thumbnail_url}
                    alt={req.course.title || req.title || ""}
                    className="w-8 h-8 rounded-lg"
                    iconClassName="w-4 h-4"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-lg bg-[var(--brand-orange)]/10 flex items-center justify-center shrink-0">
                    <GraduationCap className="w-4 h-4 text-[var(--brand-orange)]" />
                  </div>
                )}
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
                    {canManageLms &&
                      summary.find((summaryEntry) => String(summaryEntry.requirement_id) === String(req.id)) &&
                      (() => {
                        const summaryEntry = summary.find((entry) => String(entry.requirement_id) === String(req.id));
                        return (
                          <span className="text-[8px] font-bold uppercase tracking-widest" style={{ color: "var(--text-tertiary)" }}>
                            {t("lms.programLearning.enrolledCount", { n: summaryEntry.enrolled })}
                            {summaryEntry.completed > 0 ? ` · ${t("lms.programLearning.completedCount", { n: summaryEntry.completed })}` : ""}
                          </span>
                        );
                      })()}
                  </div>
                </div>
              </div>
              {canManageLms && (
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
                <div className="flex items-center gap-3 min-w-0">
                  {course.thumbnail_url && (
                    <CourseThumb
                      src={course.thumbnail_url}
                      alt={course.title}
                      className="w-10 h-10 rounded-lg"
                      iconClassName="w-5 h-5"
                    />
                  )}
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
