"use client";

import { useEffect, useState } from "react";
import { GraduationCap, Clock, Layers, PlaySquare, ArrowRight, Loader2 } from "lucide-react";
import NextLink from "next/link";
import { useI18n } from "@/lib/i18n";

/**
 * PUBLIC COURSE CATALOGUE (Phase 7)
 *
 * The public website's discovery surface. Marketing only: course title,
 * description, thumbnail, free/paid + price, lesson/section counts, duration,
 * and a call to action. Authentication, enrollment and learning all stay
 * inside ImpactOS — this page never touches protected LMS data.
 */
export default function PublicCoursesPage() {
  const { t } = useI18n();
  const [courses, setCourses] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch("/api/public/courses")
      .then((r) => r.json())
      .then((d) => {
        if (!d.success) throw new Error(d.error || "lms.public.loadFailed");
        setCourses(d.courses || []);
      })
      .catch((e) => {
        setError(e.message || "lms.public.loadFailed");
        setCourses([]);
      });
  }, []);

  return (
    <main
      className="min-h-screen"
      style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }}
    >
      <div className="max-w-6xl mx-auto px-6 py-10">
        <header className="flex items-center gap-3 pb-8 border-b" style={{ borderColor: "var(--border-primary)" }}>
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "var(--brand-orange)", color: "#fff" }}
          >
            <GraduationCap className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-black uppercase tracking-tight">
              {t("lms.public.catalogTitle")}
            </h1>
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--text-secondary)" }}>
              {t("lms.public.catalogSubtitle")}
            </p>
          </div>
        </header>

        {courses === null ? (
          <div className="flex justify-center py-24">
            <Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--brand-orange)" }} />
          </div>
        ) : courses.length === 0 ? (
          <div className="py-24 text-center">
            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--text-tertiary)" }}>
              {error || t("lms.public.empty")}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 pt-8">
            {courses.map((course) => (
              <NextLink
                key={course.slug}
                href={`/courses/${course.slug}`}
                className="group rounded-2xl overflow-hidden border transition-all hover:-translate-y-0.5"
                style={{
                  background: "var(--surface-1)",
                  borderColor: "var(--border-primary)",
                }}
              >
                <div
                  className="aspect-video w-full flex items-center justify-center"
                  style={{ background: "var(--surface-3)" }}
                >
                  {course.thumbnail_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={course.thumbnail_url}
                      alt={course.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <GraduationCap className="w-10 h-10" style={{ color: "var(--text-tertiary)" }} />
                  )}
                </div>
                <div className="p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                        course.is_free
                          ? "bg-emerald-500/10 text-emerald-500"
                          : "bg-amber-500/10 text-amber-500"
                      }`}
                    >
                      {course.is_free
                        ? t("lms.public.free")
                        : `${t("lms.public.paid")} · ${Number(course.price || 0).toLocaleString()}`}
                    </span>
                  </div>
                  <h2 className="text-sm font-black uppercase tracking-tight">
                    {course.title}
                  </h2>
                  <p
                    className="text-[11px] leading-relaxed line-clamp-2"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {course.description}
                  </p>
                  <div
                    className="flex items-center gap-3 pt-2 text-[9px] font-bold uppercase tracking-wider"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    <span className="flex items-center gap-1">
                      <Layers className="w-3 h-3" /> {course.sections} {t("lms.public.sections").toLowerCase()}
                    </span>
                    <span className="flex items-center gap-1">
                      <PlaySquare className="w-3 h-3" /> {course.lessons} {t("lms.public.lessons").toLowerCase()}
                    </span>
                    {course.duration_minutes > 0 && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {t("lms.public.durationMinutes", { minutes: course.duration_minutes })}
                      </span>
                    )}
                  </div>
                  <div
                    className="flex items-center gap-1 text-[11px] font-black uppercase tracking-wider pt-1 transition-colors"
                    style={{ color: "var(--brand-orange)" }}
                  >
                    {course.is_free ? t("lms.public.startLearning") : t("lms.public.enrollNow")}
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>
              </NextLink>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
