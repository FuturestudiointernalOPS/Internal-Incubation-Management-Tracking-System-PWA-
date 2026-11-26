"use client";

import { GraduationCap } from "lucide-react";

/**
 * Learning tab (Phase 7 — CRM trace) — the courses and certificates of one
 * person.
 */
export default function LearningTab({ learning, t }) {
  return (
    <div className="space-y-6">
      {learning === null ? (
        <div className="bg-primary border border-[var(--border-primary)] rounded-2xl p-8 text-center">
          <p className="text-sm font-bold">{t("crm.people.loading")}</p>
        </div>
      ) : learning.courses.length === 0 && learning.certificates.length === 0 ? (
        <div className="bg-primary border border-[var(--border-primary)] rounded-2xl p-8 text-center">
          <GraduationCap className="w-8 h-8 mx-auto mb-2 text-[var(--text-secondary)]" />
          <p className="text-sm font-bold">{t("crm.people.noLearning")}</p>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            <h3 className="text-xs font-black uppercase tracking-widest text-[var(--brand-orange)]">
              {t("crm.people.learningCourses")}
            </h3>
            {learning.courses.map((courseItem) => (
              <div
                key={courseItem.course.id}
                className="flex items-center justify-between gap-3 p-4 rounded-xl border border-[var(--border-primary)] bg-primary"
              >
                <div className="min-w-0">
                  <p className="text-sm font-bold truncate">{courseItem.course.title}</p>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] mt-0.5">
                    {courseItem.progress?.percent || 0}% · {courseItem.progress?.completedLessons || 0} / {courseItem.progress?.totalLessons || 0}{" "}
                    {t("crm.people.lessons").toLowerCase()}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full border ${
                      courseItem.progress?.status === "completed"
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                        : courseItem.progress?.status === "in_progress"
                          ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                          : "bg-tertiary text-[var(--text-secondary)] border-[var(--border-primary)]"
                    }`}
                  >
                    {courseItem.progress?.status === "completed"
                      ? t("crm.people.completedStatus")
                      : courseItem.progress?.status === "in_progress"
                        ? t("status.inProgress")
                        : t("crm.people.notStarted")}
                  </span>
                  {courseItem.certificate && (
                    <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded-full border bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                      {t("crm.people.certificate")} · {courseItem.certificate.certificate_number}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
          {learning.certificates.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-black uppercase tracking-widest text-[var(--brand-orange)]">
                {t("crm.people.learningCertificates")}
              </h3>
              {learning.certificates.map((certificate) => (
                <div
                  key={certificate.certificate_number}
                  className="flex items-center justify-between gap-3 p-4 rounded-xl border border-[var(--border-primary)] bg-primary"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-bold truncate">{certificate.course_title}</p>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] mt-0.5">
                      {certificate.certificate_number} · {certificate.learner_name}
                    </p>
                  </div>
                  <span className="shrink-0 text-[8px] font-black uppercase px-2 py-0.5 rounded-full border bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                    {certificate.status === "valid" ? t("crm.people.certificateValid") : t("crm.people.certificateRevoked")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
