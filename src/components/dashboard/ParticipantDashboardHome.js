"use client";

import { useState } from "react";
import Link from "next/link";
import { usePermissions } from "@/lib/PermissionProvider";
import { useI18n } from "@/lib/i18n";
import { formatLocaleDate } from "@/lib/constants";
import { useApi, useApiMulti } from "@/lib/hooks/useApi";
import { AlertCircle, Award, Check, Clock, FileText, GraduationCap, MessageSquare, Plus, RefreshCw, TrendingUp, Video } from "lucide-react";
import AppCard from "@/components/ui/AppCard";
import AppButton from "@/components/ui/AppButton";
import AppStatusBadge from "@/components/ui/AppStatusBadge";
import ParticipantCommandCalendar from "@/components/ui/ParticipantCommandCalendar";
import { Skeleton } from "@/components/ui/Skeleton";
import { useDialogs } from "@/components/ui/DialogProvider";

const EMPTY_HOME = { payload: null, failure: false };
const pickHome = response => response?.success ? { payload: response, failure: false } : EMPTY_HOME;
const pickCourses = response => response?.success ? (response.courses || []).map(entry => ({ ...entry.course, progress: entry.progress, certificate: entry.certificate })) : [];
const pickAssignments = response => response?.success ? response.assignments || [] : null;
const RITUALS = ["standup", "checkin", "reflect"];
const RITUAL_ENDPOINTS = RITUALS.map(type => ({ key: type, url: `/api/participant/rituals/${type}`, transform: response => response?.success ? response[`${type}s`] || response[`${type}ions`] || [] : [] }));

function SectionHeader({ letter, title, description, href, action }) {
  return <header className="flex flex-wrap justify-between items-center gap-3 mb-4"><div className="flex items-start gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-orange/10 text-xs font-bold text-[var(--brand-orange)]" aria-hidden="true">{letter}</span><div><h2 className="text-lg font-bold text-[var(--text-primary)]">{title}</h2><p className="mt-1 text-xs text-[var(--text-secondary)]">{description}</p></div></div>{href && <Link className="text-xs font-bold text-[var(--brand-orange)] hover:underline" href={href}>{action}</Link>}</header>;
}
function Metric({ label, value, icon: Icon }) {
  return <AppCard padding="sm"><div className="flex justify-between gap-2 text-[var(--text-secondary)]"><span className="text-[10px] font-bold uppercase tracking-wider">{label}</span><Icon className="h-4 w-4" /></div><strong className="block mt-3 text-3xl font-bold font-mono text-[var(--text-primary)]">{value}</strong></AppCard>;
}

export default function ParticipantDashboardHome() {
  const { t, lang } = useI18n();
  const { can } = usePermissions();
  const { alert } = useDialogs();
  const { data: home, loading, error, refresh } = useApi("/api/participant/home", { defaultValue: EMPTY_HOME, transform: pickHome });
  const data = home.payload;
  const { data: assignments, loading: assignmentsLoading } = useApi(data?.primaryProgram?.id ? `/api/participant/assignments?program_id=${encodeURIComponent(data.primaryProgram.id)}` : null, { defaultValue: null, transform: pickAssignments });
  const { data: courses, error: courseError } = useApi(data ? "/api/lms/my-learning" : null, { defaultValue: [], transform: pickCourses });
  const { data: rituals, error: ritualError, loading: ritualsLoading } = useApiMulti(RITUAL_ENDPOINTS, { immediate: Boolean(data?.programs?.length) });
  const [addRequest, setAddRequest] = useState(0);
  const [readIds, setReadIds] = useState([]);
  const [readingId, setReadingId] = useState(null);
  if (loading && !data) return <div className="space-y-5"><Skeleton className="h-36 w-full" /><Skeleton className="h-96 w-full" /></div>;
  if (error || !data) return <AppCard><p className="text-sm text-[var(--text-secondary)]">{t("participantMisc.dashboardHome.failedToLoad")}</p><AppButton className="mt-3" icon={RefreshCw} onClick={refresh}>{t("common.retry")}</AppButton></AppCard>;
  const { participant, primaryProgram, actionCenter = {}, announcements = [], calendarEvents = [] } = data;
  const metrics = primaryProgram?.metrics || {};
  const overdue = actionCenter.overdue || [];
  const dueSoon = actionCenter.dueSoon || [];
  const pending = actionCenter.pendingSubmissions || [];
  const unread = announcements.filter(item => !item.isRead && !readIds.includes(item.id)).length;
  const nextSessions = [...(actionCenter.upcomingSessions || [])].sort((a, b) => new Date(a.date) - new Date(b.date)).slice(0, 3);
  const lessonCompletion = courses.length ? Math.round(courses.reduce((sum, course) => sum + Number(course.progress?.percent || 0), 0) / courses.length) : null;
  const markRead = async id => {
    setReadingId(id);
    try {
      const response = await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, action: "read" }) });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error("Notification read failed");
      setReadIds(previous => [...previous, id]);
      window.dispatchEvent(new Event("notifications:refresh")); refresh();
    } catch (_) { await alert({ message: t("participant.template.readFailed") }); }
    finally { setReadingId(null); }
  };
  const attention = (items, title, Icon, tone, review = false) => <AppCard>
    <h2 className="flex items-center gap-2 text-sm font-bold text-[var(--text-primary)]"><Icon className="h-4 w-4" style={{ color: tone }} />{title} ({items.length})</h2>
    <div className="mt-3 divide-y divide-[var(--border-primary)]">{items.length ? items.slice(0, 5).map(item => <div key={item.id} className="flex justify-between items-center gap-3 py-3"><div className="min-w-0"><p className="text-sm font-bold text-[var(--text-primary)]">{item.title || t("participantMisc.dashboardHome.deliverableNumber", { id: item.deliverableId })}</p><p className="mt-1 text-xs text-[var(--text-secondary)]">{review ? t("participant.template.awaitingCorrection") : item.dueDate ? formatLocaleDate(item.dueDate, { day: "numeric", month: "short" }, lang) : primaryProgram?.name}</p></div>{review ? <AppStatusBadge status={item.status} label={t("participantMisc.assignments.statusAwaitingReview")} /> : <Link href={item.programId ? `/participant/${item.programId}` : "/participant/assignments"} className="shrink-0 text-xs font-bold text-[var(--brand-orange)]">{t("participant.template.submit")}</Link>}</div>) : <p className="py-5 text-center text-xs text-[var(--text-secondary)]">{t("participant.template.nothingDue")}</p>}</div>
  </AppCard>;
  const shortcutItems = [
    ["assignments", FileText, "/participant/assignments"], ["progress", TrendingUp, "/participant/progress"],
    ["followups", Video, "/participant/followups"], ["certificates", Award, "/participant/certificates"], ["messages", MessageSquare, "/participant/messages"],
  ].filter(([key]) => key !== "messages" || can("messaging", "view"));
  return <div className="participant-home max-w-[1500px] mx-auto space-y-6">
    <header className="participant-welcome flex flex-wrap items-center justify-between gap-5 rounded-2xl border border-[var(--border-primary)] p-6 md:p-7">
      <div><p className="text-xs font-bold text-[var(--text-secondary)]">{formatLocaleDate(new Date(), { weekday: "long", day: "numeric", month: "long", year: "numeric" }, lang)}</p><h1 className="mt-2 text-2xl font-bold text-[var(--text-primary)]">{t("participant.template.welcome", { name: participant?.name?.split(" ")[0] || t("participant.defaultName") })}</h1><p className="mt-2 text-sm text-[var(--text-secondary)]">{primaryProgram ? `${primaryProgram.name} · ${t("participant.activeSession")} · ${t("participantMisc.dashboardHome.weekOf", { current: primaryProgram.currentWeek, total: primaryProgram.durationWeeks || "?" })}` : t("participant.noProgramsDesc")}</p></div>
      <AppButton icon={Plus} onClick={() => setAddRequest(previous => previous + 1)}>{t("participant.template.newReminder")}</AppButton>
    </header>
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4"><Metric label={t("participant.programCompletion")} value={`${metrics.programCompletion || 0}%`} icon={TrendingUp} /><Metric label={t("participant.attendance")} value={`${metrics.attendanceRate || 0}%`} icon={Check} /><Metric label={t("participant.template.approvedAssignments")} value={assignmentsLoading ? t("common.loading") : assignments ? `${assignments.filter(item => item.submission?.status === "approved").length} / ${assignments.length}` : t("participant.template.notAvailable")} icon={FileText} /><Metric label={t("participant.kpiAchievement")} value={`${metrics.kpiCompletion || 0}%`} icon={TrendingUp} /></div>
    <ParticipantCommandCalendar events={calendarEvents} addRequest={addRequest} />
    <AppCard><h2 className="text-sm font-bold text-[var(--text-primary)]">{t("participant.yourProgress")}</h2><div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mt-4">{[["program", metrics.programCompletion || 0], ["assignments", metrics.assignmentCompletion || 0], ["attendance", metrics.attendanceRate || 0], ["courses", lessonCompletion]].map(([key, value]) => <div key={key}><div className="flex justify-between text-xs text-[var(--text-secondary)]"><span>{t(`participant.template.progressLabels.${key}`)}</span><span>{value === null ? t("participant.template.notAvailable") : `${value}%`}</span></div><div className="mt-2 h-1.5 rounded-full bg-surface-3 overflow-hidden"><div className="h-full participant-progress-fill" style={{ width: `${Math.min(100, Math.max(0, value || 0))}%` }} /></div></div>)}</div></AppCard>
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">{attention(overdue, t("participant.overdue"), AlertCircle, "var(--chart-danger)")}{attention(dueSoon, t("participant.dueSoon"), Clock, "var(--chart-warning)")}{attention(pending, t("participant.pending"), FileText, "var(--chart-info)", true)}</div>
    <section id="announcements" className="scroll-mt-24"><AppCard><header className="flex items-center justify-between gap-3"><h2 className="text-sm font-bold text-[var(--text-primary)]">{t("participant.announcements")}</h2>{unread > 0 && <span className="text-xs font-bold text-[var(--brand-orange)]">{t("participant.newCount", { count: unread })}</span>}</header><div className="mt-3 divide-y divide-[var(--border-primary)]">{announcements.length ? announcements.map(item => <article key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div className="flex-1 min-w-0"><h3 className="text-sm font-bold text-[var(--text-primary)]">{item.title}</h3><p className="mt-1 text-xs text-[var(--text-secondary)]">{item.message}</p></div><time className="text-xs text-[var(--text-tertiary)]">{formatLocaleDate(item.createdAt, { day: "numeric", month: "short" }, lang)}</time>{!item.isRead && !readIds.includes(item.id) && <AppButton variant="secondary" size="sm" loading={readingId === item.id} onClick={() => markRead(item.id)}>{t("participant.template.markRead")}</AppButton>}</article>) : <p className="py-5 text-center text-xs text-[var(--text-secondary)]">{t("participant.noAnnouncements")}</p>}</div></AppCard></section>
    <section><SectionHeader letter="A" title={t("navigation.learning")} description={t("participant.template.learningHint")} href="/participant/learning" action={t("participant.template.allCourses")} /><div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <AppCard><h3 className="text-sm font-bold text-[var(--text-primary)]">{t("participant.template.courses")}</h3><div className="mt-3 space-y-2">{courses.length ? courses.slice(0, 4).map(course => <Link key={course.id} href={`/participant/learning/${course.id}`} className="flex items-center gap-3 rounded-lg border border-[var(--border-primary)] p-3 hover:bg-surface-2"><GraduationCap className="h-4 w-4 text-[var(--brand-orange)]" /><div><p className="text-sm font-bold text-[var(--text-primary)]">{course.title}</p><p className="mt-1 text-xs text-[var(--text-secondary)]">{t("participant.template.lessonCount", { completed: course.progress?.completedLessons || 0, total: course.progress?.totalLessons || 0 })}</p></div></Link>) : <p className="py-5 text-xs text-[var(--text-secondary)]">{t(courseError ? "errors.networkError" : "participant.template.noCourses")}</p>}</div></AppCard>
      <AppCard><h3 className="text-sm font-bold text-[var(--text-primary)]">{t("participant.template.nextSessions")}</h3><div className="mt-3 divide-y divide-[var(--border-primary)]">{nextSessions.length ? nextSessions.map(session => <Link key={session.id} href={`/participant/${session.programId}?session=${encodeURIComponent(session.id)}#session-${session.id}`} className="block py-3"><p className="text-sm font-bold text-[var(--text-primary)]">{session.title}</p><p className="mt-1 text-xs text-[var(--text-secondary)]">{formatLocaleDate(session.date, { day: "numeric", month: "short" }, lang)}{session.time ? ` · ${session.time.slice(0, 5)}` : ""}</p></Link>) : <p className="py-5 text-xs text-[var(--text-secondary)]">{t("participant.template.noSessions")}</p>}</div></AppCard>
    </div></section>
    <section><SectionHeader letter="B" title={t("participant.template.rituals")} description={t("participant.template.ritualsHint")} href="/participant/rituals" action={t("participant.template.openRituals")} /><div className="grid grid-cols-1 md:grid-cols-3 gap-4">{RITUALS.map(type => <AppCard key={type} padding="sm"><Link href="/participant/rituals" className="flex items-center gap-3"><RefreshCw className="h-5 w-5 text-[var(--brand-orange)]" /><div><h3 className="text-xs font-bold text-[var(--text-secondary)]">{t(`participant.template.ritualTypes.${type}`)}</h3><p className="mt-1 text-lg font-bold text-[var(--text-primary)]">{ritualsLoading ? t("common.loading") : ritualError ? t("participant.template.notAvailable") : t((rituals[type] || []).some(item => Number(item.week_number) === Number(primaryProgram?.currentWeek) && String(item.program_id) === String(primaryProgram?.id)) ? "participant.template.ritualSubmitted" : "participant.template.ritualTodo")}</p></div></Link></AppCard>)}</div></section>
    <section><SectionHeader letter="C" title={t("participant.template.shortcuts")} description={t("participant.template.shortcutsHint")} /><div className="grid grid-cols-2 lg:grid-cols-5 gap-3">{shortcutItems.map(([key, Icon, href]) => <Link key={key} href={href} className="rounded-xl border border-[var(--border-primary)] bg-surface-1 p-4 hover:bg-surface-2"><h3 className="flex items-center gap-2 text-sm font-bold text-[var(--text-primary)]"><Icon className="h-4 w-4 text-[var(--brand-orange)]" />{t(`participant.template.shortcutsItems.${key}.title`)}</h3><p className="mt-2 text-xs text-[var(--text-secondary)]">{t(`participant.template.shortcutsItems.${key}.description`)}</p></Link>)}</div></section>
  </div>;
}
