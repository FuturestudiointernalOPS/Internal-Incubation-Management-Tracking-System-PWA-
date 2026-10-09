"use client";

import { useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { formatLocaleDate } from "@/lib/constants";
import { useApi } from "@/lib/hooks/useApi";
import { AlertCircle, Check, Clock, FileText, GraduationCap, Plus, RefreshCw, TrendingUp } from "lucide-react";
import AppCard from "@/components/ui/AppCard";
import AppButton from "@/components/ui/AppButton";
import AppStatusBadge from "@/components/ui/AppStatusBadge";
import PageHero from "@/components/ui/PageHero";
import KpiCard from "@/components/ui/KpiCard";
import SectionHead from "@/components/ui/SectionHead";
import ParticipantCommandCalendar from "@/components/ui/ParticipantCommandCalendar";
import { Skeleton } from "@/components/ui/Skeleton";

const EMPTY_HOME = { payload: null, failure: false };
const pickHome = response => response?.success ? { payload: response, failure: false } : EMPTY_HOME;
const pickCourses = response => response?.success ? (response.courses || []).map(entry => ({ ...entry.course, progress: entry.progress, certificate: entry.certificate })) : [];
const pickAssignments = response => response?.success ? response.assignments || [] : null;

function SectionHeader({ letter, title, description, href, action }) {
  return <SectionHead letter={letter} tone="o" title={title} subtitle={description} action={href && <Link className="stf-link-btn" href={href}>{action}</Link>} />;
}
function Metric({ label, value, icon }) {
  return <KpiCard label={label} value={value} icon={icon} />;
}

export default function ParticipantDashboardHome() {
  const { t, lang } = useI18n();
  const { data: home, loading, error, refresh } = useApi("/api/participant/home", { defaultValue: EMPTY_HOME, transform: pickHome });
  const data = home.payload;
  const { data: assignments, loading: assignmentsLoading } = useApi(data?.primaryProgram?.id ? `/api/participant/assignments?program_id=${encodeURIComponent(data.primaryProgram.id)}` : null, { defaultValue: null, transform: pickAssignments });
  const { data: courses, error: courseError } = useApi(data ? "/api/lms/my-learning" : null, { defaultValue: [], transform: pickCourses });
  const [addRequest, setAddRequest] = useState(0);
  if (loading && !data) return <div className="space-y-5"><Skeleton className="h-36 w-full" /><Skeleton className="h-96 w-full" /></div>;
  if (error || !data) return <AppCard><p className="text-sm text-[var(--text-secondary)]">{t("participantMisc.dashboardHome.failedToLoad")}</p><AppButton className="mt-3" icon={RefreshCw} onClick={refresh}>{t("common.retry")}</AppButton></AppCard>;
  const { participant, primaryProgram, actionCenter = {}, calendarEvents = [] } = data;
  const metrics = primaryProgram?.metrics || {};
  const overdue = actionCenter.overdue || [];
  const dueSoon = actionCenter.dueSoon || [];
  const pending = actionCenter.pendingSubmissions || [];
  const nextSessions = [...(actionCenter.upcomingSessions || [])].sort((a, b) => new Date(a.date) - new Date(b.date)).slice(0, 3);
  const lessonCompletion = courses.length ? Math.round(courses.reduce((sum, course) => sum + Number(course.progress?.percent || 0), 0) / courses.length) : null;

  const attention = (items, title, Icon, tone, review = false) => <AppCard>
    <h2 className="flex items-center gap-2 text-sm font-bold text-[var(--text-primary)]"><Icon className="h-4 w-4" style={{ color: tone }} />{title} ({items.length})</h2>
    <div className="mt-3 divide-y divide-[var(--border-primary)]">{items.length ? items.slice(0, 5).map(item => <div key={item.id} className="flex justify-between items-center gap-3 py-3"><div className="min-w-0"><p className="text-sm font-bold text-[var(--text-primary)]">{item.title || t("participantMisc.dashboardHome.deliverableNumber", { id: item.deliverableId })}</p><p className="mt-1 text-xs text-[var(--text-secondary)]">{review ? t("participant.template.awaitingCorrection") : item.dueDate ? formatLocaleDate(item.dueDate, { day: "numeric", month: "short" }, lang) : primaryProgram?.name}</p></div>{review ? <AppStatusBadge status={item.status} label={t("participantMisc.assignments.statusAwaitingReview")} /> : <Link href={item.programId ? `/participant/${item.programId}` : "/participant/assignments"} className="shrink-0 text-xs font-bold text-[var(--brand-orange)]">{t("participant.template.submit")}</Link>}</div>) : <p className="py-5 text-center text-xs text-[var(--text-secondary)]">{t("participant.template.nothingDue")}</p>}</div>
  </AppCard>;
  return <div className="stf participant-home max-w-[1500px] mx-auto space-y-6">
    <PageHero
      kicker={formatLocaleDate(new Date(), { weekday: "long", day: "numeric", month: "long", year: "numeric" }, lang)}
      title={t("participant.template.welcome", { name: participant?.name?.split(" ")[0] || t("participant.defaultName") })}
      subtitle={primaryProgram ? `${primaryProgram.name} · ${t("participant.activeSession")} · ${t("participantMisc.dashboardHome.weekOf", { current: primaryProgram.currentWeek, total: primaryProgram.durationWeeks || "?" })}` : t("participant.noProgramsDesc")}
      action={<button type="button" className="stf-btn pr" onClick={() => setAddRequest(previous => previous + 1)}><Plus size={15} /> {t("participant.template.newReminder")}</button>}
    />
    <div className="stf-grid c4"><Metric label={t("participant.programCompletion")} value={`${metrics.programCompletion || 0}%`} icon={TrendingUp} /><Metric label={t("participant.attendance")} value={`${metrics.attendanceRate || 0}%`} icon={Check} /><Metric label={t("participant.template.approvedAssignments")} value={assignmentsLoading ? t("common.loading") : assignments ? `${assignments.filter(item => item.submission?.status === "approved").length} / ${assignments.length}` : t("participant.template.notAvailable")} icon={FileText} /><Metric label={t("participant.kpiAchievement")} value={`${metrics.kpiCompletion || 0}%`} icon={TrendingUp} /></div>
    <ParticipantCommandCalendar events={calendarEvents} addRequest={addRequest} />
    <AppCard><h2 className="text-sm font-bold text-[var(--text-primary)]">{t("participant.yourProgress")}</h2><div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mt-4">{[["program", metrics.programCompletion || 0], ["assignments", metrics.assignmentCompletion || 0], ["attendance", metrics.attendanceRate || 0], ["courses", lessonCompletion]].map(([key, value]) => <div key={key}><div className="flex justify-between text-xs text-[var(--text-secondary)]"><span>{t(`participant.template.progressLabels.${key}`)}</span><span>{value === null ? t("participant.template.notAvailable") : `${value}%`}</span></div><div className="mt-2 h-1.5 rounded-full bg-surface-3 overflow-hidden"><div className="h-full participant-progress-fill" style={{ width: `${Math.min(100, Math.max(0, value || 0))}%` }} /></div></div>)}</div></AppCard>
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">{attention(overdue, t("participant.overdue"), AlertCircle, "var(--chart-danger)")}{attention(dueSoon, t("participant.dueSoon"), Clock, "var(--chart-warning)")}{attention(pending, t("participant.pending"), FileText, "var(--chart-info)", true)}</div>
    <AppCard><Link href="/participant/announcements" className="flex items-center justify-between gap-3 text-sm font-bold text-[var(--brand-orange)]"><span>{t("participant.announcements")}</span><span>{t("participant.announcementHub.open")}</span></Link></AppCard>
    <section><SectionHeader letter="A" title={t("navigation.learning")} description={t("participant.template.learningHint")} href="/participant/learning" action={t("participant.template.allCourses")} /><div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <AppCard><h3 className="text-sm font-bold text-[var(--text-primary)]">{t("participant.template.courses")}</h3><div className="mt-3 space-y-2">{courses.length ? courses.slice(0, 4).map(course => <Link key={course.id} href={`/participant/learning/${course.id}`} className="flex items-center gap-3 rounded-lg border border-[var(--border-primary)] p-3 hover:bg-surface-2"><GraduationCap className="h-4 w-4 text-[var(--brand-orange)]" /><div><p className="text-sm font-bold text-[var(--text-primary)]">{course.title}</p><p className="mt-1 text-xs text-[var(--text-secondary)]">{t("participant.template.lessonCount", { completed: course.progress?.completedLessons || 0, total: course.progress?.totalLessons || 0 })}</p></div></Link>) : <p className="py-5 text-xs text-[var(--text-secondary)]">{t(courseError ? "errors.networkError" : "participant.template.noCourses")}</p>}</div></AppCard>
      <AppCard><h3 className="text-sm font-bold text-[var(--text-primary)]">{t("participant.template.nextSessions")}</h3><div className="mt-3 divide-y divide-[var(--border-primary)]">{nextSessions.length ? nextSessions.map(session => <Link key={session.id} href={`/participant/${session.programId}?session=${encodeURIComponent(session.id)}#session-${session.id}`} className="block py-3"><p className="text-sm font-bold text-[var(--text-primary)]">{session.title}</p><p className="mt-1 text-xs text-[var(--text-secondary)]">{formatLocaleDate(session.date, { day: "numeric", month: "short" }, lang)}{session.time ? ` · ${session.time.slice(0, 5)}` : ""}</p></Link>) : <p className="py-5 text-xs text-[var(--text-secondary)]">{t("participant.template.noSessions")}</p>}</div></AppCard>
    </div></section>
  </div>;
}
