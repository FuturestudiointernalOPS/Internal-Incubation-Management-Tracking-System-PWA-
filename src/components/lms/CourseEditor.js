"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Rocket, Archive, Trash2, Save, AlertCircle, Users, Pencil } from "lucide-react";
import AppButton from "@/components/ui/AppButton";
import AppCard from "@/components/ui/AppCard";
import CourseStatusBadge from "./CourseStatusBadge";
import CourseFormFields from "./CourseFormFields";
import SectionsManager from "./SectionsManager";
import CourseView from "./CourseView";
import EnrollModal from "./EnrollModal";
import { notify } from "./notify";
import { useI18n } from "@/lib/i18n";
import { useDialogs } from "@/components/ui/DialogProvider";
import { usePermissions } from "@/lib/PermissionProvider";
import { useApi } from "@/lib/hooks/useApi";

/**
 * Course workspace. Opening a course shows a READ-ONLY presentation: the first
 * lesson video (click to launch) on the left, and on its right the course name,
 * description and full curriculum (sections → lessons → assessments). Pressing
 * "Edit" switches to the authoring surface (metadata form + sections/lessons/
 * assessments); Save or Cancel returns to the presentation. Publishing,
 * archiving, deleting and enrolling stay in the top bar (Edit / Learners /
 * status actions). Server-side authorization is enforced by every API call
 * (lms.view / edit / publish / delete / enroll).
 */

// ─── Module-scope readers ────────────────────────────────────────────────────
// The reading hook keys its internal work on these, so they are built once here
// rather than on every render.

const EMPTY_COURSE_READ = { payload: null, failure: null };

/**
 * The course, together with the reason it is missing. A refusal carries the
 * server's own key and both it and a request that never answered are translated
 * where they are shown.
 */
const pickCourse = (data) =>
  data?.success
    ? { payload: data, failure: null }
    : { payload: null, failure: data?.error || null };

/**
 * The values the metadata form starts from. The form shows these with the
 * person's own edits laid over them, so nothing is copied into state when the
 * read arrives.
 */
const formBase = (course) => ({
  title: course?.title || "",
  description: course?.description || "",
  thumbnail_url: course?.thumbnail_url || "",
  visibility: course?.visibility || "public",
  is_free: course?.is_free !== false,
  price: course?.price,
});

export default function CourseEditor({ courseId, basePath = "/admin/lms/courses" }) {
  const { t } = useI18n();
  const { confirm } = useDialogs();
  const router = useRouter();
  // UI gating only — the server re-checks every call (lms.edit / lms.delete).
  // Fails OPEN while the matrix loads, so no action flashes away.
  const { can, loading: permsLoading } = usePermissions();
  const allow = (cap) => (permsLoading ? true : can("lms", cap));
  const [edits, setEdits] = useState({});
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [validationErrors, setValidationErrors] = useState([]);

  // The course is read through the shared hook, which owns the cache, the
  // cache-first paint and the discarding of a stale answer, so the workspace
  // keeps no copy of it. Every reload point below re-reads through `refresh`.
  const {
    data: courseRead,
    loading,
    error: readError,
    refresh,
  } = useApi(`/api/lms/courses/${courseId}`, {
    defaultValue: EMPTY_COURSE_READ,
    transform: pickCourse,
    deps: [courseId],
  });
  const course = courseRead.payload?.course || null;

  // The loader showed the server's own key when it refused a payload and the
  // request's message when there was no answer; the panel translates whichever
  // arrives, with the same fallback as before.
  const loadError = courseRead.failure || readError || null;

  // The form is the course the read returned with the person's edits over it:
  // the read's values are the base and `onChange` records the whole form it is
  // handed as the edits, so a background re-read cannot be undone on screen and
  // nothing has to be copied into state when the read arrives.
  const details = { ...formBase(course), ...edits };

  const startEdit = () => {
    setValidationErrors([]);
    setEditing(true);
  };

  const cancelEdit = async () => {
    setEditing(false);
    setValidationErrors([]);
    // The form is the read's values with the edits over them, so discarding the
    // edits is what returns to the course the server holds.
    setEdits({});
    await refresh();
  };

  const saveDetails = async () => {
    setSaving(true);
    setValidationErrors([]);
    try {
      const res = await fetch(`/api/lms/courses/${courseId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(details),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "lms.errors.saveFailed");
      notify("success", "lms.courses.saved");
      setEditing(false);
      setEdits({});
      await refresh();
    } catch (error) {
      notify("error", error.message || "lms.errors.saveFailed");
    } finally {
      setSaving(false);
    }
  };

  const publish = async () => {
    setValidationErrors([]);
    if (!(await confirm({ message: t("lms.confirm.publish") }))) return;
    try {
      const res = await fetch(`/api/lms/courses/${courseId}/publish`, { method: "POST" });
      const data = await res.json();
      if (!data.success) {
        if (data.details && data.details.length) {
          setValidationErrors(data.details.map((detail) => detail.key));
          notify("error", "lms.errors.publishValidationFailed");
        } else {
          throw new Error(data.error || "lms.errors.saveFailed");
        }
        return;
      }
      notify("success", "lms.courses.published");
      refresh();
    } catch (error) {
      notify("error", error.message || "lms.errors.saveFailed");
    }
  };

  const archive = async () => {
    if (!(await confirm({ message: `${t("lms.confirm.archive")}\n${t("lms.confirm.archiveHint")}`, tone: "danger" }))) return;
    try {
      const res = await fetch(`/api/lms/courses/${courseId}/archive`, { method: "POST" });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "lms.errors.saveFailed");
      notify("success", "lms.courses.archived");
      refresh();
    } catch (error) {
      notify("error", error.message || "lms.errors.saveFailed");
    }
  };

  const remove = async () => {
    if (!(await confirm({ message: `${t("lms.confirm.deleteCourse")}\n${t("lms.confirm.deleteCourseHint")}`, tone: "danger" }))) return;
    try {
      const res = await fetch(`/api/lms/courses/${courseId}`, { method: "DELETE" });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "lms.errors.saveFailed");
      notify("success", "lms.courses.deleted");
      router.push(basePath);
    } catch (error) {
      notify("error", error.message || "lms.errors.saveFailed");
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto flex justify-center py-24">
        <div className="w-6 h-6 border-2 border-[var(--brand-orange)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (loadError || !course) {
    return (
      <div className="max-w-4xl mx-auto flex flex-col items-center gap-4 py-24">
        <AlertCircle className="w-8 h-8 text-rose-500" />
        <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
          {t(loadError || "lms.errors.loadFailedCourse")}
        </p>
        <AppButton variant="secondary" onClick={() => router.push(basePath)}>
          {t("lms.courses.backToCourses")}
        </AppButton>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <button
          type="button"
          onClick={() => router.push(basePath)}
          className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest transition-colors self-start"
          style={{ color: "var(--text-tertiary)" }}
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          {t("lms.courses.backToCourses")}
        </button>

        <div className="flex flex-wrap items-center justify-end gap-2">
          {editing ? (
            <>
              <AppButton variant="primary" icon={Save} loading={saving} onClick={saveDetails}>
                {t("lms.courses.save")}
              </AppButton>
              <AppButton variant="ghost" onClick={cancelEdit}>
                {t("common.cancel")}
              </AppButton>
            </>
          ) : (
            <>
              {allow("edit") && (
                <AppButton variant="primary" icon={Pencil} onClick={startEdit}>
                  {t("common.edit")}
                </AppButton>
              )}
              {allow("edit") && (
                <AppButton variant="ghost" icon={Users} onClick={() => setEnrollOpen(true)}>
                  {t("lms.enroll.title")}
                </AppButton>
              )}
              {allow("edit") && course.status === "draft" && (
                <AppButton variant="success" icon={Rocket} onClick={publish}>
                  {t("lms.courses.publish")}
                </AppButton>
              )}
              {allow("edit") && course.status === "published" && (
                <AppButton variant="secondary" icon={Archive} onClick={archive}>
                  {t("lms.courses.archive")}
                </AppButton>
              )}
              {allow("delete") && course.status === "draft" && (
                <AppButton variant="danger" icon={Trash2} onClick={remove}>
                  {t("lms.courses.delete")}
                </AppButton>
              )}
            </>
          )}
        </div>
      </div>

      {/* Publish validation errors */}
      {validationErrors.length > 0 && (
        <div
          className="rounded-xl border p-4"
          style={{ background: "rgba(239,68,68,0.06)", borderColor: "rgba(239,68,68,0.25)" }}
        >
          <p className="text-[10px] font-black uppercase tracking-wider text-rose-500 mb-2">
            {t("lms.errors.publishValidationFailed")}
          </p>
          <ul className="space-y-1">
            {validationErrors.map((key, index) => (
              <li key={index} className="text-xs font-bold" style={{ color: "var(--text-primary)" }}>
                • {t(key)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Presentation or authoring surface */}
      {editing ? (
        <>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-black uppercase tracking-tight truncate" style={{ color: "var(--text-primary)" }}>
              {course.title || "—"}
            </h1>
            <CourseStatusBadge status={course.status} />
          </div>

          <AppCard padding="md">
            <p className="text-[10px] font-black uppercase tracking-wider mb-3" style={{ color: "var(--text-secondary)" }}>
              {t("lms.preview.courseDetails")}
            </p>
            <CourseFormFields value={details} onChange={setEdits} />
          </AppCard>

          <AppCard padding="md">
            <p className="text-[10px] font-black uppercase tracking-wider mb-3" style={{ color: "var(--text-secondary)" }}>
              {t("lms.preview.content")}
            </p>
            <SectionsManager course={course} onChange={refresh} canEdit={allow("edit")} />
          </AppCard>
        </>
      ) : (
        <CourseView course={course} />
      )}

      <EnrollModal isOpen={enrollOpen} onClose={() => setEnrollOpen(false)} courseId={course.id} />
    </div>
  );
}
