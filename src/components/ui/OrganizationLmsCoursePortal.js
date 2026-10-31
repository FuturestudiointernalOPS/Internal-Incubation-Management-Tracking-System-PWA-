"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { useApi } from "@/lib/hooks/useApi";
import EmbeddedVideo from "@/components/lms/EmbeddedVideo";
import CourseThumb from "@/components/lms/CourseThumb";
import RichTextContent from "@/components/ui/RichTextContent";
import AppButton from "./AppButton";
import AppCard from "./AppCard";
import AppEmptyState from "./AppEmptyState";
import AppStatusBadge from "./AppStatusBadge";
import OrganizationPortalHeader from "./OrganizationPortalHeader";
import PageHero from "./PageHero";

export default function OrganizationLmsCoursePortal({ organization, courseId, onBrandChanged }) {
  const { t } = useI18n();
  const router = useRouter();
  const [selectedLessonId, setSelectedLessonId] = useState(null);
  const result = useApi(`/api/org/lms/${encodeURIComponent(courseId)}`, {
    cache: false,
    fetchOptions: {
      cache: "no-store",
      headers: { "X-Organization-Id": organization.id },
    },
  });
  const data = result.data;
  const valid = data?.success && data.organizationId === organization.id;
  const lessons = data?.sections?.flatMap((section) => section.lessons || []) || [];
  const selectedLesson = lessons.find((lesson) => String(lesson.id) === String(selectedLessonId))
    || lessons[0]
    || null;
  const base = `/o/${encodeURIComponent(organization.code)}/lms`;

  return <div className="space-y-6">
    <OrganizationPortalHeader organization={organization} activePage="lms" onBrandChanged={onBrandChanged} />
    <AppButton variant="secondary" onClick={() => router.push(base)}>
      {t("common.organizationPortal.lms.backToLearning")}
    </AppButton>
    {result.loading && <AppEmptyState title={t("common.loading")} />}
    {!result.loading && result.error && <AppEmptyState
      title={t("errors.somethingWrong")}
      action={<AppButton onClick={result.refresh}>{t("common.retry")}</AppButton>}
    />}
    {!result.loading && !result.error && !valid && <AppEmptyState
      title={t(data?.error || "errors.insufficientPermissions")}
      action={<AppButton onClick={() => router.push("/o/select")}>{t("common.organizationPortal.choose")}</AppButton>}
    />}
    {valid && <div className="space-y-6">
      <PageHero
        title={data.course.title}
        subtitle={t("common.organizationPortal.lms.courseContent")}
      />
      {data.course.thumbnail_url && <CourseThumb
        src={data.course.thumbnail_url}
        alt=""
        className="h-40 w-full rounded-xl object-cover sm:h-56"
      />}
      {data.course.description && <AppCard>
        <RichTextContent value={data.course.description} className="text-sm text-[var(--text-secondary)]" />
      </AppCard>}
      <AppCard>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-bold text-[var(--text-primary)]">{t("common.organizationPortal.lms.progress")}</h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              {t("common.organizationPortal.lms.progress", {
                completed: data.progress.completedRequired,
                total: data.progress.totalRequired,
              })}
            </p>
          </div>
          <AppStatusBadge
            status={data.enrollment.status}
            label={t(`status.${data.enrollment.status}`)}
          />
        </div>
        <div
          className="mt-4 h-2 overflow-hidden rounded-full bg-surface-3"
          role="progressbar"
          aria-label={t("common.organizationPortal.lms.progress")}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={data.progress.percent}
        >
          <div className="h-full rounded-full bg-brand-orange" style={{ width: `${data.progress.percent}%` }} />
        </div>
      </AppCard>

      {selectedLesson && <section className="space-y-4" aria-label={t("common.organizationPortal.lms.lessonContent")}>
        <h2 className="text-xl font-black text-[var(--text-primary)]">{selectedLesson.title}</h2>
        {selectedLesson.youtube_video_id
          ? <EmbeddedVideo
            key={selectedLesson.youtube_video_id}
            videoId={selectedLesson.youtube_video_id}
            title={selectedLesson.title}
            playLabel={t("common.organizationPortal.lms.playLesson")}
            className="w-full"
          />
          : null}
        {selectedLesson.description
          ? <AppCard><RichTextContent value={selectedLesson.description} className="text-sm text-[var(--text-secondary)]" /></AppCard>
          : !selectedLesson.youtube_video_id && <AppEmptyState title={t("common.organizationPortal.lms.noLessonContent")} />}
      </section>}

      <section className="space-y-4" aria-label={t("common.organizationPortal.lms.lessons")}>
        <h2 className="text-xl font-black text-[var(--text-primary)]">{t("common.organizationPortal.lms.lessons")}</h2>
        {data.sections.map((section) => <AppCard key={section.id}>
          <h3 className="text-lg font-bold text-[var(--text-primary)]">{section.title}</h3>
          {section.description && <p className="mt-2 text-sm text-[var(--text-secondary)]">{section.description}</p>}
          <div className="mt-4 space-y-2">
            {section.lessons.map((lesson) => {
              const isSelected = String(selectedLesson?.id) === String(lesson.id);
              const isComplete = lesson.progress_status === "completed";
              return <button
                type="button"
                key={lesson.id}
                aria-pressed={isSelected}
                onClick={() => setSelectedLessonId(lesson.id)}
                className={`flex w-full items-center justify-between gap-3 rounded-lg border p-3 text-left transition-colors ${isSelected ? "border-[var(--brand-orange)] bg-surface-2" : "border-[var(--border-primary)] hover:bg-surface-2"}`}
              >
                <span className="min-w-0">
                  <span className="block font-semibold text-[var(--text-primary)]">{lesson.title}</span>
                  <span className="mt-1 block text-xs text-[var(--text-secondary)]">
                    {lesson.duration_minutes
                      ? t("common.organizationPortal.lms.lessonDuration", { minutes: lesson.duration_minutes })
                      : lesson.is_required ? t("common.organizationPortal.lms.requiredLesson") : t("common.organizationPortal.lms.optionalLesson")}
                  </span>
                </span>
                <AppStatusBadge
                  status={isComplete ? "completed" : "pending"}
                  label={t(isComplete ? "common.organizationPortal.lms.completedLesson" : "common.organizationPortal.lms.notCompleted")}
                />
              </button>;
            })}
          </div>
        </AppCard>)}
        {!lessons.length && <AppEmptyState title={t("common.organizationPortal.lms.noLessons")} />}
      </section>
      <p className="text-sm text-[var(--text-secondary)]">{t("common.organizationPortal.lms.readOnlyProgress")}</p>
    </div>}
  </div>;
}
