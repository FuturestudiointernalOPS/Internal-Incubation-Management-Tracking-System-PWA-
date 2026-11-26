"use client";

import Link from "next/link";
import { Award, GraduationCap } from "lucide-react";
import AppCard from "@/components/ui/AppCard";
import KpiCard from "@/components/ui/KpiCard";
import SectionHead from "@/components/ui/SectionHead";

/**
 * The LEARNING section — shown only to a person holding a live course
 * enrolment. A suspended enrolment grants no access, so it is neither listed
 * nor counted here (the same rule the course screens enforce).
 */
export default function LearningSection({ block, t }) {
  const { courses = [] } = block;
  const lessons = courses.reduce(
    (totals, course) => ({
      completed: totals.completed + course.completedLessons,
      total: totals.total + course.totalLessons,
    }),
    { completed: 0, total: 0 },
  );
  const certified = courses.filter((course) => course.certificateIssued).length;

  return (
    <section>
      <SectionHead
        letter="A"
        tone="o"
        title={t("member.dashboard.section.learning.title")}
        subtitle={t("member.dashboard.section.learning.subtitle")}
        action={
          <Link className="stf-link-btn" href="/member/participant/learning">
            {t("member.dashboard.seeAll")}
          </Link>
        }
      />

      <div className="stf-grid c4">
        <KpiCard
          label={t("member.dashboard.kpi.courses")}
          value={courses.length}
          icon={GraduationCap}
        />
        <KpiCard
          label={t("member.dashboard.kpi.lessons")}
          value={`${lessons.completed} / ${lessons.total}`}
          icon={GraduationCap}
        />
        <KpiCard
          label={t("member.dashboard.kpi.certificates")}
          value={certified}
          icon={Award}
        />
      </div>

      <div className="stf-grid c2">
        {courses.map((course) => {
          const href = course.continueLessonId
            ? `/member/participant/learning/${course.id}/lessons/${course.continueLessonId}`
            : `/member/participant/learning/${course.id}`;
          return (
            <AppCard key={course.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-bold text-[var(--text-primary)]">
                    {course.title}
                  </h3>
                  <p className="mt-1 text-xs text-[var(--text-secondary)]">
                    {t("participant.template.lessonCount", {
                      completed: course.completedLessons,
                      total: course.totalLessons,
                    })}
                  </p>
                </div>
                {course.certificateIssued && (
                  <span className="stf-tag g shrink-0">
                    {t("member.dashboard.section.learning.certified")}
                  </span>
                )}
              </div>

              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-3">
                <div
                  className="h-full rounded-full bg-[var(--progress-fill)]"
                  style={{ width: `${Math.min(100, Math.max(0, Number(course.percent) || 0))}%` }}
                />
              </div>

              <Link className="stf-link-btn mt-3 inline-block" href={href}>
                {course.complete
                  ? t("member.dashboard.section.learning.review")
                  : t("member.dashboard.section.learning.resume")}
              </Link>
            </AppCard>
          );
        })}
      </div>
    </section>
  );
}
