"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, Eye, Rocket, Archive, Loader2, BookOpen } from "lucide-react";
import AppButton from "@/components/ui/AppButton";
import AppInput from "@/components/ui/AppInput";
import AppSelect from "@/components/ui/AppSelect";
import AppEmptyState from "@/components/ui/AppEmptyState";
import { TableSkeleton } from "@/components/ui/Skeleton";
import CourseStatusBadge from "./CourseStatusBadge";
import CourseThumb from "./CourseThumb";
import { notify } from "./notify";
import { useI18n } from "@/lib/i18n";
import { formatDate } from "@/lib/constants";
import { useApi } from "@/lib/hooks/useApi";
import { usePermissions } from "@/lib/PermissionProvider";

const STATUS_OPTIONS = [
  { value: "", label: "all" },
  { value: "draft", label: "draft" },
  { value: "published", label: "published" },
  { value: "archived", label: "archived" },
];

// ─── Module-scope readers ────────────────────────────────────────────────────
// The reading hook keys its internal work on these, so they are built once here
// rather than on every render.

const EMPTY_COURSES_READ = { list: [], failure: false };

/**
 * The course list, together with whether the read was refused. Both failures
 * this screen has ever had - the payload refusing and the request never being
 * answered - were shown as the same panel, so the shaper reports the refusal and
 * the panel stays exactly as it was.
 */
const pickCourses = (d) =>
  d?.success
    ? { list: d.courses || [], failure: false }
    : { list: [], failure: true };

/**
 * LMS course-management list: search, status filter, open / publish / archive.
 * Server-side authorization is enforced by every API call (lms.view / publish / edit).
 */
export default function CourseList({ basePath = "/admin/lms/courses" }) {
  const { t } = useI18n();
  const router = useRouter();
  // UI gating only — the server re-checks every call (lms.create / lms.edit).
  // Fails OPEN while the matrix loads, so no action flashes away.
  const { can, loading: permsLoading } = usePermissions();
  const allow = (cap) => (permsLoading ? true : can("lms", cap));
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [busyId, setBusyId] = useState(null);

  // The list is read through the shared hook, ADDRESSED ON THE FILTERS: a filter
  // change is an address change, so the read follows it. Publish and archive
  // re-read through `refresh`, which bypasses the cache.
  const params = new URLSearchParams();
  if (search.trim()) params.set("search", search.trim());
  if (status) params.set("status", status);
  const {
    data: coursesRead,
    loading,
    error: readError,
    status: readStatus,
    refresh,
  } = useApi(`/api/lms/courses?${params.toString()}`, {
    defaultValue: EMPTY_COURSES_READ,
    transform: pickCourses,
    deps: [search, status],
  });
  const courses = coursesRead.list;

  // The loader's failure flag, derived: the payload refusing, the server
  // answering with a status, or a request that never answered.
  const error = Boolean(
    coursesRead.failure || readError || (readStatus !== null && readStatus >= 400),
  );

  const runAction = async (courseId, action, successKey) => {
    setBusyId(courseId);
    try {
      const res = await fetch(`/api/lms/courses/${courseId}/${action}`, {
        method: "POST",
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "lms.errors.saveFailed");
      notify("success", successKey);
      refresh();
    } catch (e) {
      notify("error", e.message || "lms.errors.saveFailed");
    } finally {
      setBusyId(null);
    }
  };

  const confirmPublish = (course) => {
    if (!window.confirm(t("lms.confirm.publish"))) return;
    runAction(course.id, "publish", "lms.courses.published");
  };

  const confirmArchive = (course) => {
    if (!window.confirm(t("lms.confirm.archive"))) return;
    runAction(course.id, "archive", "lms.courses.archived");
  };

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-xl font-black uppercase tracking-tight" style={{ color: "var(--text-primary)" }}>
          {t("lms.courses.title")}
        </h1>
        {allow("create") && (
          <AppButton
            variant="primary"
            icon={Plus}
            onClick={() => router.push(`${basePath}/new`)}
          >
            {t("lms.courses.create")}
          </AppButton>
        )}
      </div>

      {/* Search + filter */}
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <AppInput
          icon={Search}
          placeholder={t("lms.courses.searchPlaceholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <AppSelect
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          options={STATUS_OPTIONS.map((o) => ({
            value: o.value,
            label: o.value === "" ? t("lms.courses.filterAll") : t(`lms.status.${o.label}`),
          }))}
        />
      </div>

      {/* States */}
      {loading ? (
        <div className="mt-6">
          <TableSkeleton rows={4} />
        </div>
      ) : error ? (
        <div className="mt-6 flex flex-col items-center gap-4 py-16">
          <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
            {t("lms.errors.loadFailed")}
          </p>
          <AppButton variant="secondary" onClick={refresh}>
            {t("common.refresh")}
          </AppButton>
        </div>
      ) : courses.length === 0 ? (
        <div className="mt-6">
          <AppEmptyState
            title={search || status ? t("lms.courses.noResults") : t("lms.courses.emptyTitle")}
            description={search || status ? undefined : t("lms.courses.emptyDescription")}
            icon={BookOpen}
            action={
              search || status ? (
                <AppButton
                  variant="secondary"
                  onClick={() => {
                    setSearch("");
                    setStatus("");
                  }}
                >
                  {t("common.clearFilter")}
                </AppButton>
              ) : allow("create") ? (
                <AppButton
                  variant="primary"
                  icon={Plus}
                  onClick={() => router.push(`${basePath}/new`)}
                >
                  {t("lms.courses.create")}
                </AppButton>
              ) : null
            }
          />
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {courses.map((course) => (
            <div
              key={course.id}
              className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-xl border"
              style={{
                background: "var(--surface-1)",
                borderColor: "var(--border-primary)",
              }}
            >
              <CourseThumb
                src={course.thumbnail_url}
                alt={course.title}
                className="w-14 h-14 rounded-xl"
                iconClassName="w-6 h-6"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p
                    className="text-sm font-black tracking-tight truncate"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {course.title}
                  </p>
                  <CourseStatusBadge status={course.status} />
                </div>
                <p className="text-[10px] font-bold uppercase tracking-wider mt-1" style={{ color: "var(--text-tertiary)" }}>
                  {t("lms.fields.updatedAt")}: {formatDate(course.updated_at)}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <AppButton
                  variant="secondary"
                  size="sm"
                  icon={Eye}
                  onClick={() => router.push(`${basePath}/${course.id}`)}
                >
                  {t("lms.courses.open")}
                </AppButton>
                {allow("edit") && course.status === "draft" && (
                  <AppButton
                    variant="success"
                    size="sm"
                    icon={Rocket}
                    loading={busyId === course.id}
                    onClick={() => confirmPublish(course)}
                  >
                    {t("lms.courses.publish")}
                  </AppButton>
                )}
                {allow("edit") && course.status === "published" && (
                  <AppButton
                    variant="secondary"
                    size="sm"
                    icon={Archive}
                    loading={busyId === course.id}
                    onClick={() => confirmArchive(course)}
                  >
                    {t("lms.courses.archive")}
                  </AppButton>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin" style={{ color: "var(--brand-orange)" }} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
