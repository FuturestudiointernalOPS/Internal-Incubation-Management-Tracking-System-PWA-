"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AppButton from "./AppButton";
import AppCard from "./AppCard";
import AppInput from "./AppInput";
import AppStatusBadge from "./AppStatusBadge";
import CourseThumb from "@/components/lms/CourseThumb";
import OrganizationPortalHeader from "./OrganizationPortalHeader";
import PageHero from "./PageHero";
import { useI18n } from "@/lib/i18n";

const COURSE_IDS = ["leadership", "digital", "impact"];
const VENTURE_IDS = ["greenloop", "kawa"];

export default function OrganizationPortalPreview({ organizationCode, programId, view }) {
  const { t } = useI18n();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [selectedVenture, setSelectedVenture] = useState(null);
  const organization = {
    id: "local-preview",
    code: organizationCode,
    name: t("common.organizationPortal.preview.workspace"),
    modules: ["programs", "lms", "venture"],
    branding: { displayName: t("common.organizationPortal.preview.workspace") },
    brandingEditable: false,
  };
  const courses = COURSE_IDS.map((id) => ({
    id,
    title: t(`common.organizationPortal.preview.course.${id}.title`),
    description: t(`common.organizationPortal.preview.course.${id}.description`),
  }));
  const ventures = VENTURE_IDS.map((id, index) => ({
    id,
    name: t(`common.organizationPortal.preview.venture.${id}.name`),
    description: t(`common.organizationPortal.preview.venture.${id}.description`),
    code: t(`common.organizationPortal.preview.venture.${id}.code`),
    status: index === 0 ? "active" : "in_progress",
    industry: t(`common.organizationPortal.preview.venture.${id}.industry`),
    stage: t(`common.organizationPortal.preview.venture.${id}.stage`),
  }));
  const normalizedSearch = search.trim().toLocaleLowerCase();
  const filteredCourses = courses.filter((course) =>
    `${course.title} ${course.description}`.toLocaleLowerCase().includes(normalizedSearch),
  );
  const filteredVentures = ventures.filter((venture) =>
    `${venture.name} ${venture.code} ${venture.industry}`.toLocaleLowerCase().includes(normalizedSearch),
  );
  const base = `/o/${encodeURIComponent(organizationCode)}`;

  function navigate(path) {
    router.push(`${path}?preview=1`);
  }

  return <div className="space-y-6">
    <OrganizationPortalHeader
      organization={organization}
      activePage={view === "lms-course" ? "lms" : view}
      previewMode
    />
    <div role="status" className="rounded-lg border border-[var(--border-primary)] bg-surface-2 px-4 py-3 text-sm text-[var(--text-secondary)]">
      {t("common.organizationPortal.preview.banner")}
    </div>

    {view === "home" && <>
      <PageHero
        kicker={t("common.organizationPortal.home")}
        title={t("common.organizationPortal.welcome", { name: organization.name })}
        subtitle={t("common.organizationPortal.homeHint")}
      />
      <section aria-label={t("common.organizationPortal.modules")} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {["programs", "lms", "venture"].map((module) => (
          <AppCard key={module}>
            <h2 className="text-lg font-black text-[var(--text-primary)]">{t(`common.organizationPortal.module.${module}`)}</h2>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">{t(`common.organizationPortal.moduleDescription.${module}`)}</p>
            <AppButton className="mt-4" onClick={() => navigate(`${base}/${module}`)}>
              {t("common.organizationPortal.openModule")}
            </AppButton>
          </AppCard>
        ))}
      </section>
    </>}

    {view === "lms" && <>
      <PageHero title={t("common.organizationPortal.lms.title")} subtitle={t("common.organizationPortal.lms.readOnly")} />
      <AppInput
        label={t("common.organizationPortal.lms.searchCourses")}
        placeholder={t("common.organizationPortal.lms.searchPlaceholder")}
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      <section className="space-y-4">
        <h2 className="text-xl font-black text-[var(--text-primary)]">{t("common.organizationPortal.lms.catalog")}</h2>
        <div className="stf-grid">
          {filteredCourses.map((course, index) => (
            <AppCard key={course.id}>
              <CourseThumb
                className="-mx-6 -mt-6 mb-4 h-40 w-[calc(100%+3rem)] rounded-t-[14px]"
                iconClassName="h-10 w-10"
              />
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-lg font-black text-[var(--text-primary)]">{course.title}</h3>
                <AppStatusBadge status="active" label={t("common.organizationPortal.states.active")} />
              </div>
              <p className="mt-3 text-sm text-[var(--text-secondary)]">{course.description}</p>
              <p className="mt-4 text-xs text-[var(--text-secondary)]">{t("common.organizationPortal.lms.source.owned")}</p>
              <AppButton className="mt-4" onClick={() => navigate(`${base}/lms/${course.id}`)}>
                {t("common.organizationPortal.lms.openCourse")}
              </AppButton>
              {index === 0 && <p className="mt-3 text-sm text-[var(--text-secondary)]">
                {t("common.organizationPortal.lms.progress", { completed: 2, total: 5 })}
              </p>}
            </AppCard>
          ))}
          {!filteredCourses.length && <p className="text-sm text-[var(--text-secondary)]">{t("common.noResults")}</p>}
        </div>
      </section>
    </>}

    {view === "lms-course" && (() => {
      const course = courses.find((item) => item.id === programId) || courses[0];
      return <>
        <PageHero
          title={course.title}
          subtitle={course.description}
          action={<AppButton variant="secondary" onClick={() => navigate(`${base}/lms`)}>{t("common.organizationPortal.lms.backToLearning")}</AppButton>}
        />
        <AppCard>
          <h2 className="text-xl font-black text-[var(--text-primary)]">{t("common.organizationPortal.lms.lessons")}</h2>
          <div className="mt-4 divide-y divide-[var(--border-primary)]">
            {[1, 2, 3].map((lesson, index) => (
              <div key={lesson} className="flex flex-wrap items-center justify-between gap-3 py-4">
                <div>
                  <h3 className="font-bold text-[var(--text-primary)]">
                    {t(`common.organizationPortal.preview.lesson.${lesson}`)}
                  </h3>
                  <p className="mt-1 text-sm text-[var(--text-secondary)]">
                    {t("common.organizationPortal.lms.lessonDuration", { minutes: 8 + index * 4 })}
                  </p>
                </div>
                <AppStatusBadge status={index === 0 ? "completed" : "pending"} label={t(index === 0 ? "common.organizationPortal.lms.completedLesson" : "common.organizationPortal.lms.notCompleted")} />
              </div>
            ))}
          </div>
          <p className="mt-3 text-sm text-[var(--text-secondary)]">{t("common.organizationPortal.lms.readOnlyProgress")}</p>
        </AppCard>
      </>;
    })()}

    {view === "venture" && <>
      <PageHero title={t("common.organizationPortal.venture.title")} subtitle={t("common.organizationPortal.venture.readOnly")} />
      <section className="space-y-4">
        <h2 className="text-xl font-black text-[var(--text-primary)]">{t("common.organizationPortal.venture.assigned")}</h2>
        <AppInput
          label={t("common.organizationPortal.venture.search")}
          placeholder={t("common.organizationPortal.venture.searchPlaceholder")}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <div className="stf-grid">
          {filteredVentures.map((venture) => (
            <AppCard key={venture.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-black text-[var(--text-primary)]">{venture.name}</h3>
                  <p className="mt-1 text-xs text-[var(--text-secondary)]">{venture.code}</p>
                </div>
                <AppStatusBadge
                  status={venture.status}
                  label={t(venture.status === "active" ? "common.organizationPortal.states.active" : "common.organizationPortal.states.in progress")}
                />
              </div>
              <p className="mt-3 text-sm text-[var(--text-secondary)]">{t("common.organizationPortal.venture.assignment.assigned")}</p>
              <p className="mt-2 text-sm text-[var(--text-secondary)]">{venture.industry} · {venture.stage}</p>
              <AppButton className="mt-4" onClick={() => setSelectedVenture(venture)}>
                {t("common.organizationPortal.venture.details")}
              </AppButton>
            </AppCard>
          ))}
          {!filteredVentures.length && <p className="text-sm text-[var(--text-secondary)]">{t("common.noResults")}</p>}
        </div>
      </section>
      {selectedVenture && <AppCard>
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-xl font-black text-[var(--text-primary)]">{selectedVenture.name}</h2>
          <AppButton variant="secondary" onClick={() => setSelectedVenture(null)}>{t("common.close")}</AppButton>
        </div>
        <p className="mt-3 text-sm text-[var(--text-secondary)]">{selectedVenture.description}</p>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          <PreviewDetail label={t("common.organizationPortal.venture.industry")} value={selectedVenture.industry} />
          <PreviewDetail label={t("common.organizationPortal.venture.stage")} value={selectedVenture.stage} />
        </dl>
      </AppCard>}
    </>}

    {view === "programs" && <>
      <PageHero title={t("common.organizationPortal.programmes")} subtitle={t("common.organizationPortal.preview.programsDescription")} />
      <div className="stf-grid">
        {[1, 2].map((item) => (
          <AppCard key={item}>
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-lg font-black text-[var(--text-primary)]">{t(`common.organizationPortal.preview.program.${item}.title`)}</h2>
              <AppStatusBadge status={item === 1 ? "active" : "planned"} label={t(`common.organizationPortal.states.${item === 1 ? "active" : "planned"}`)} />
            </div>
            <p className="mt-3 text-sm text-[var(--text-secondary)]">{t(`common.organizationPortal.preview.program.${item}.description`)}</p>
            <p className="mt-4 text-sm text-[var(--text-secondary)]">{t("common.organizationPortal.cohorts")}: {2026 + item - 1}</p>
            <AppButton className="mt-4" variant="secondary" disabled>{t("common.organizationPortal.details")}</AppButton>
          </AppCard>
        ))}
      </div>
    </>}
  </div>;
}

function PreviewDetail({ label, value }) {
  return <div>
    <dt className="text-xs font-bold text-[var(--text-secondary)]">{label}</dt>
    <dd className="mt-1 text-sm text-[var(--text-primary)]">{value}</dd>
  </div>;
}
