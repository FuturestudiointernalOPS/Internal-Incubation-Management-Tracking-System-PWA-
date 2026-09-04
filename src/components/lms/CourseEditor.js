"use client";

import { useCallback, useEffect, useState } from "react";
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
export default function CourseEditor({ courseId }) {
  const { t } = useI18n();
  const router = useRouter();
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [details, setDetails] = useState(null);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [validationErrors, setValidationErrors] = useState([]);

  const fetchCourse = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(`/api/lms/courses/${courseId}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "lms.errors.loadFailedCourse");
      setCourse(data.course);
      setDetails({
        title: data.course.title || "",
        description: data.course.description || "",
        thumbnail_url: data.course.thumbnail_url || "",
        visibility: data.course.visibility || "public",
        is_free: data.course.is_free !== false,
        price: data.course.price,
      });
    } catch (e) {
      setLoadError(e.message || "lms.errors.loadFailedCourse");
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    fetchCourse();
  }, [fetchCourse]);

  const startEdit = () => {
    setValidationErrors([]);
    setEditing(true);
  };

  const cancelEdit = async () => {
    setEditing(false);
    setValidationErrors([]);
    // Reload so unsaved edits to the metadata form are discarded.
    await fetchCourse();
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
      await fetchCourse();
    } catch (e) {
      notify("error", e.message || "lms.errors.saveFailed");
    } finally {
      setSaving(false);
    }
  };

  const publish = async () => {
    setValidationErrors([]);
    if (!window.confirm(t("lms.confirm.publish"))) return;
    try {
      const res = await fetch(`/api/lms/courses/${courseId}/publish`, { method: "POST" });
      const data = await res.json();
      if (!data.success) {
        if (data.details && data.details.length) {
          setValidationErrors(data.details.map((d) => d.key));
          notify("error", "lms.errors.publishValidationFailed");
        } else {
          throw new Error(data.error || "lms.errors.saveFailed");
        }
        return;
      }
      notify("success", "lms.courses.published");
      fetchCourse();
    } catch (e) {
      notify("error", e.message || "lms.errors.saveFailed");
    }
  };

  const archive = async () => {
    if (!window.confirm(`${t("lms.confirm.archive")}\n${t("lms.confirm.archiveHint")}`)) return;
    try {
      const res = await fetch(`/api/lms/courses/${courseId}/archive`, { method: "POST" });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "lms.errors.saveFailed");
      notify("success", "lms.courses.archived");
      fetchCourse();
    } catch (e) {
      notify("error", e.message || "lms.errors.saveFailed");
    }
  };

  const remove = async () => {
    if (!window.confirm(`${t("lms.confirm.deleteCourse")}\n${t("lms.confirm.deleteCourseHint")}`)) return;
    try {
      const res = await fetch(`/api/lms/courses/${courseId}`, { method: "DELETE" });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "lms.errors.saveFailed");
      notify("success", "lms.courses.deleted");
      router.push("/admin/lms/courses");
    } catch (e) {
      notify("error", e.message || "lms.errors.saveFailed");
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
        <AppButton variant="secondary" onClick={() => router.push("/admin/lms/courses")}>
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
          onClick={() => router.push("/admin/lms/courses")}
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
              <AppButton variant="primary" icon={Pencil} onClick={startEdit}>
                {t("common.edit")}
              </AppButton>
              <AppButton variant="ghost" icon={Users} onClick={() => setEnrollOpen(true)}>
                {t("lms.enroll.title")}
              </AppButton>
              {course.status === "draft" && (
                <AppButton variant="success" icon={Rocket} onClick={publish}>
                  {t("lms.courses.publish")}
                </AppButton>
              )}
              {course.status === "published" && (
                <AppButton variant="secondary" icon={Archive} onClick={archive}>
                  {t("lms.courses.archive")}
                </AppButton>
              )}
              {course.status === "draft" && (
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
            <CourseFormFields value={details} onChange={setDetails} />
          </AppCard>

          <AppCard padding="md">
            <p className="text-[10px] font-black uppercase tracking-wider mb-3" style={{ color: "var(--text-secondary)" }}>
              {t("lms.preview.content")}
            </p>
            <SectionsManager course={course} onChange={fetchCourse} />
          </AppCard>
        </>
      ) : (
        <CourseView course={course} />
      )}

      <EnrollModal isOpen={enrollOpen} onClose={() => setEnrollOpen(false)} courseId={course.id} />
    </div>
  );
}
