"use client";

import { useEffect, useState, use } from "react";
import {
  ArrowLeft,
  Clock,
  Layers,
  PlaySquare,
  Loader2,
  CheckCircle2,
  GraduationCap,
  ListChecks,
  Lock,
} from "lucide-react";
import NextLink from "next/link";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";

/**
 * PUBLIC COURSE DETAIL (Phase 7)
 *
 * Website → Course details → FREE / PAID → CTA. The CTA drives conversion:
 *   - Free course, signed out        → /login?next=/courses/[slug]
 *   - Free course, signed in         → POST /api/public/courses/[slug]
 *     (server-side enrollment, source 'self') → /participant/learning/[courseId]
 *   - Paid course                    → login (then the server refuses until a
 *     verified payment exists — the payment boundary is closed server-side).
 *
 * No YouTube ids, no assessment answers, no learner data is ever rendered here.
 */
export default function PublicCourseDetailPage({ params }) {
  const { slug } = use(params);
  const { t } = useI18n();
  const router = useRouter();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [enrolling, setEnrolling] = useState(false);
  const [enrollError, setEnrollError] = useState(null);
  const [authed, setAuthed] = useState(null);

  useEffect(() => {
    let active = true;
    fetch(`/api/public/courses/${slug}`)
      .then((r) => r.json())
      .then((d) => {
        if (!active) return;
        if (!d.success) throw new Error(d.error || "lms.public.loadFailed");
        setData(d);
      })
      .catch((e) => {
        if (!active) return;
        setError(e.message || "lms.public.loadFailed");
      });
    return () => {
      active = false;
    };
  }, [slug]);

  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((d) => setAuthed(!!(d.authenticated && d.user)))
      .catch(() => setAuthed(false));
  }, []);

  const handleCta = async () => {
    if (!authed) {
      router.push(`/login?next=${encodeURIComponent(`/courses/${slug}`)}`);
      return;
    }
    // Paid: the server enforces the verified-payment boundary (402 until a
    // provider is integrated) — the frontend never grants access.
    setEnrolling(true);
    setEnrollError(null);
    try {
      const res = await fetch(`/api/public/courses/${slug}`, { method: "POST" });
      const d = await res.json();
      if (!d.success) {
        throw new Error(d.error || "lms.public.enrollFailed");
      }
      router.push(`/participant/learning/${d.courseId}`);
    } catch (e) {
      setEnrollError(e.message || "lms.public.enrollFailed");
    } finally {
      setEnrolling(false);
    }
  };

  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-primary)" }}>
        <div className="text-center space-y-3">
          <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--text-tertiary)" }}>
            {t("lms.errors.courseNotFound")}
          </p>
          <NextLink
            href="/courses"
            className="inline-flex items-center gap-1 text-xs font-black uppercase tracking-wider"
            style={{ color: "var(--brand-orange)" }}
          >
            <ArrowLeft className="w-3.5 h-3.5" /> {t("lms.public.backToCourses")}
          </NextLink>
        </div>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-primary)" }}>
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--brand-orange)" }} />
      </main>
    );
  }

  const { course, structure } = data;
  const alreadyEnrolled = data.enrollment?.enrolled === true;
  const paid = course.is_free === false;

  return (
    <main className="min-h-screen" style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }}>
      <div className="max-w-4xl mx-auto px-6 py-10">
        <NextLink
          href="/courses"
          className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest transition-colors"
          style={{ color: "var(--text-tertiary)" }}
        >
          <ArrowLeft className="w-3.5 h-3.5" /> {t("lms.public.backToCourses")}
        </NextLink>

        <div
          className="mt-6 rounded-2xl overflow-hidden border"
          style={{ background: "var(--surface-1)", borderColor: "var(--border-primary)" }}
        >
          <div
            className="aspect-video w-full flex items-center justify-center"
            style={{ background: "var(--surface-3)" }}
          >
            {course.thumbnail_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={course.thumbnail_url} alt={course.title} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
            ) : (
              <GraduationCap className="w-14 h-14" style={{ color: "var(--text-tertiary)" }} />
            )}
          </div>

          <div className="p-8 space-y-6">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                  paid ? "bg-amber-500/10 text-amber-500" : "bg-emerald-500/10 text-emerald-500"
                }`}
              >
                {paid ? `${t("lms.public.paid")} · ${Number(course.price || 0).toLocaleString()}` : t("lms.public.free")}
              </span>
              <span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
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
              </span>
            </div>

            <div>
              <h1 className="text-2xl font-black uppercase tracking-tight">{course.title}</h1>
              {course.description && (
                <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                  {course.description}
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                onClick={handleCta}
                disabled={enrolling}
                className="px-6 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all hover:brightness-110 disabled:opacity-60"
                style={{ background: "var(--brand-orange)", color: "#fff" }}
              >
                {enrolling
                  ? t("lms.public.enrolling")
                  : alreadyEnrolled
                    ? t("lms.public.continueLearning")
                    : paid
                      ? t("lms.public.enrollNow")
                      : t("lms.public.startLearning")}
              </button>
              {alreadyEnrolled && (
                <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-emerald-500">
                  <CheckCircle2 className="w-3.5 h-3.5" /> {t("lms.public.enrolled")}
                </span>
              )}
              {!authed && !alreadyEnrolled && (
                <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
                  {t("lms.public.loginRequired")}
                </span>
              )}
            </div>

            {enrollError && (
              <p className="text-xs font-bold text-rose-500">
                {enrollError === "lms.errors.paidCheckoutUnavailable"
                  ? t("lms.public.paymentUnavailable")
                  : t(enrollError) || enrollError}
              </p>
            )}

            {structure && structure.sections.length > 0 && (
              <div className="pt-4 border-t" style={{ borderColor: "var(--border-primary)" }}>
                <h2 className="text-[10px] font-black uppercase tracking-widest" style={{ color: "var(--text-secondary)" }}>
                  {t("lms.public.whatYouWillLearn")}
                </h2>
                <div className="mt-4 space-y-4">
                  {structure.sections.map((section, i) => (
                    <div key={i} className="space-y-1.5">
                      <p className="text-xs font-black uppercase tracking-tight">
                        {i + 1}. {section.title}
                      </p>
                      <ul className="space-y-1">
                        {section.lessons.map((lesson, j) => (
                          <li
                            key={j}
                            className="flex items-center gap-2 text-[11px]"
                            style={{ color: "var(--text-secondary)" }}
                          >
                            <PlaySquare className="w-3 h-3 shrink-0" style={{ color: "var(--brand-orange)" }} />
                            {lesson.title}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                  {structure.assessments > 0 && (
                    <p
                      className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider"
                      style={{ color: "var(--text-tertiary)" }}
                    >
                      <ListChecks className="w-3.5 h-3.5" />
                      {t("lms.public.assessmentsCount", { count: structure.assessments })}
                    </p>
                  )}
                </div>
              </div>
            )}

            {paid && (
              <p
                className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider pt-2"
                style={{ color: "var(--text-tertiary)" }}
              >
                <Lock className="w-3 h-3" /> {t("lms.public.paidNote")}
              </p>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
