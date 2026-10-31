"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useApi } from "@/lib/hooks/useApi";
import { useRouter } from "next/navigation";
import AppButton from "./AppButton";
import AppCard from "./AppCard";
import AppEmptyState from "./AppEmptyState";
import AppInput from "./AppInput";
import AppStatusBadge from "./AppStatusBadge";
import CourseThumb from "@/components/lms/CourseThumb";
import OrganizationPortalHeader from "./OrganizationPortalHeader";
import PageHero from "./PageHero";

export default function OrganizationLmsPortal({ organization, onBrandChanged }) {
  const { t } = useI18n();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const read = {
    cache: false,
    fetchOptions: {
      cache: "no-store",
      headers: { "X-Organization-Id": organization.id },
    },
  };
  const result = useApi("/api/org/lms", read);
  const data = result.data;
  const valid = data?.success && data.organizationId === organization.id;
  const normalizedSearch = search.trim().toLocaleLowerCase();
  const catalog = (data?.catalog || []).filter((course) =>
    `${course.title || ""} ${course.description || ""}`.toLocaleLowerCase().includes(normalizedSearch),
  );
  const enrollments = (data?.learning?.enrollments || []).filter((enrollment) =>
    `${enrollment.title || ""} ${enrollment.description || ""}`.toLocaleLowerCase().includes(normalizedSearch),
  );

  return <div className="space-y-6">
    <OrganizationPortalHeader organization={organization} activePage="lms" onBrandChanged={onBrandChanged} />
    <PageHero
      title={t("common.organizationPortal.lms.title")}
      subtitle={t("common.organizationPortal.lms.readOnly")}
    />
    {result.loading && <AppEmptyState title={t("common.loading")} />}
    {!result.loading && result.error && <AppEmptyState
      title={t("errors.somethingWrong")}
      action={<AppButton onClick={result.refresh}>{t("common.retry")}</AppButton>}
    />}
    {!result.loading && !result.error && !valid && <AppEmptyState
      title={t(data?.error || "errors.insufficientPermissions")}
      action={<AppButton onClick={() => router.push("/o/select")}>{t("common.organizationPortal.choose")}</AppButton>}
    />}
    {valid && (data.permissions.catalog || data.permissions.learning) && <AppInput
      label={t("common.organizationPortal.lms.searchCourses")}
      placeholder={t("common.organizationPortal.lms.searchPlaceholder")}
      icon={Search}
      value={search}
      onChange={(event) => setSearch(event.target.value)}
    />}
    {valid && data.permissions.catalog && <section className="space-y-4">
      <h2 className="text-xl font-black text-[var(--text-primary)]">{t("common.organizationPortal.lms.catalog")}</h2>
      {catalog.length
        ? <div className="stf-grid">{catalog.map((course) => <AppCard key={course.id}>
          <CourseThumb
            src={course.thumbnail_url}
            alt=""
            className="-mx-6 -mt-6 mb-4 h-40 w-[calc(100%+3rem)] rounded-t-[14px]"
            iconClassName="h-10 w-10"
          />
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-lg font-black text-[var(--text-primary)]">{course.title}</h3>
            <AppStatusBadge status={course.status} label={t(`status.${course.status}`)} />
          </div>
          <p className="mt-3 text-sm text-[var(--text-secondary)]">{course.description || t("common.noData")}</p>
          <p className="mt-4 text-xs text-[var(--text-secondary)]">
            {t(`common.organizationPortal.lms.source.${course.access_source}`)}
          </p>
        </AppCard>)}</div>
        : <AppEmptyState title={normalizedSearch ? t("common.noResults") : t("common.organizationPortal.lms.noCourses")} />}
    </section>}
    {valid && data.permissions.learning && <section className="space-y-4">
      <h2 className="text-xl font-black text-[var(--text-primary)]">{t("common.organizationPortal.lms.myLearning")}</h2>
      {enrollments.length
        ? <div className="stf-grid">{enrollments.map((enrollment) => <AppCard key={enrollment.enrollment_id}>
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-lg font-black text-[var(--text-primary)]">{enrollment.title}</h3>
            <AppStatusBadge status={enrollment.status} label={t(`status.${enrollment.status}`)} />
          </div>
          <p className="mt-3 text-sm text-[var(--text-secondary)]">
            {t("common.organizationPortal.lms.progress", {
              completed: Number(enrollment.completed_required_lessons || 0),
              total: Number(enrollment.required_lessons || 0),
            })}
          </p>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            {t("common.organizationPortal.lms.enrolled", {
              date: enrollment.enrolled_at ? new Date(enrollment.enrolled_at).toLocaleDateString() : t("common.unknown"),
            })}
          </p>
          {enrollment.course_id && <AppButton
            className="mt-4"
            onClick={() => router.push(`/o/${encodeURIComponent(organization.code)}/lms/${encodeURIComponent(enrollment.course_id)}`)}
          >
            {t("common.organizationPortal.lms.openCourse")}
          </AppButton>}
        </AppCard>)}</div>
        : <AppEmptyState title={normalizedSearch ? t("common.noResults") : t("common.organizationPortal.lms.noEnrollments")} />}
      {!!data.learning.attempts.length && <div className="space-y-3">
        <h3 className="text-lg font-bold text-[var(--text-primary)]">{t("common.organizationPortal.lms.assessmentResults")}</h3>
        <div className="stf-grid">{data.learning.attempts.map((attempt) => <AppCard key={`${attempt.assessment_id}:${attempt.completed_at}:${attempt.score}`}>
          <h4 className="font-bold text-[var(--text-primary)]">{attempt.assessment_title}</h4>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            {t("common.organizationPortal.lms.score", {
              score: Number(attempt.score || 0),
              total: Number(attempt.total_points || 0),
            })}
          </p>
          <AppStatusBadge status={attempt.passed ? "completed" : "pending"} label={t(attempt.passed ? "status.completed" : "status.pending")} />
        </AppCard>)}</div>
      </div>}
      {!!data.learning.certificates.length && <div className="space-y-3">
        <h3 className="text-lg font-bold text-[var(--text-primary)]">{t("common.organizationPortal.lms.certificates")}</h3>
        <div className="stf-grid">{data.learning.certificates.map((certificate) => <AppCard key={certificate.id}>
          <h4 className="font-bold text-[var(--text-primary)]">{certificate.course_title}</h4>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">{certificate.certificate_number}</p>
          <AppStatusBadge status={certificate.status} label={t(`status.${certificate.status}`)} />
        </AppCard>)}</div>
      </div>}
    </section>}
  </div>;
}
