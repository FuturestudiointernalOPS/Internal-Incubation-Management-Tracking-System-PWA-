"use client";

import Link from "next/link";
import { AlertCircle, Check, Clock, FileText, TrendingUp } from "lucide-react";
import AppCard from "@/components/ui/AppCard";
import AppStatusBadge from "@/components/ui/AppStatusBadge";
import KpiCard from "@/components/ui/KpiCard";
import SectionHead from "@/components/ui/SectionHead";
import { formatLocaleDate } from "@/lib/constants";

/**
 * The PROGRAM section — shown only when the person holds at least one program
 * seat. The block is absent from the response otherwise, so there is nothing
 * here to hide.
 */
export default function ProgramSection({ block, t, lang }) {
  const { seats = [], primary, progress, actionCenter = {} } = block;
  const overall = progress?.overall || {};
  const totals = progress?.totals || null;

  const bars = [
    {
      key: "program",
      label: t("participant.template.progressLabels.program"),
      value: overall.programCompletion ?? null,
      hint: totals
        ? t("participantMisc.progress.deliverablesCount", {
            completed: totals.completedDeliverables,
            total: totals.deliverables,
          })
        : null,
    },
    {
      key: "assignments",
      label: t("participant.template.progressLabels.assignments"),
      value: overall.assignmentCompletion ?? null,
      hint: totals
        ? t("participantMisc.progress.approvedCount", {
            approved: totals.approved,
            total: totals.submissions,
          })
        : null,
    },
    {
      key: "attendance",
      label: t("participant.template.progressLabels.attendance"),
      value: overall.attendanceRate ?? null,
      hint: totals
        ? t("participantMisc.progress.sessionsCount", {
            attended: totals.attended,
            total: totals.sessions,
          })
        : null,
    },
  ];

  const overdue = actionCenter.overdue || [];
  const dueSoon = actionCenter.dueSoon || [];
  const pending = actionCenter.pendingSubmissions || [];
  const nextSessions = [...(actionCenter.upcomingSessions || [])]
    .sort((first, second) => new Date(first.date) - new Date(second.date))
    .slice(0, 3);

  const attention = (items, title, Icon, tone, review = false) => (
    <AppCard>
      <h3 className="flex items-center gap-2 text-sm font-bold text-[var(--text-primary)]">
        <Icon className="h-4 w-4" style={{ color: tone }} />
        {title} ({items.length})
      </h3>
      <div className="mt-3 divide-y divide-[var(--border-primary)]">
        {items.length ? (
          items.slice(0, 5).map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="text-sm font-bold text-[var(--text-primary)]">
                  {item.title ||
                    t("participantMisc.dashboardHome.deliverableNumber", {
                      id: item.deliverableId,
                    })}
                </p>
                <p className="mt-1 text-xs text-[var(--text-secondary)]">
                  {review
                    ? t("participant.template.awaitingCorrection")
                    : item.dueDate
                      ? formatLocaleDate(item.dueDate, { day: "numeric", month: "short" }, lang)
                      : primary?.name}
                </p>
              </div>
              {review ? (
                <AppStatusBadge
                  status={item.status}
                  label={t("participantMisc.assignments.statusAwaitingReview")}
                />
              ) : (
                <Link
                  href={
                    item.programId
                      ? `/member/participant/${item.programId}`
                      : "/member/participant/assignments"
                  }
                  className="shrink-0 text-xs font-bold text-[var(--brand-orange)]"
                >
                  {t("participant.template.submit")}
                </Link>
              )}
            </div>
          ))
        ) : (
          <p className="py-5 text-center text-xs text-[var(--text-secondary)]">
            {t("participant.template.nothingDue")}
          </p>
        )}
      </div>
    </AppCard>
  );

  return (
    <section>
      <SectionHead
        letter="P"
        tone="o"
        title={t("member.dashboard.section.program.title")}
        subtitle={
          primary
            ? `${primary.name} · ${t("member.dashboard.week", {
                current: primary.currentWeek,
                total: primary.durationWeeks || "?",
              })}`
            : t("member.dashboard.section.program.subtitle")
        }
        action={
          <Link className="stf-link-btn" href="/member/participant/progress">
            {t("participant.template.viewProgress")}
          </Link>
        }
      />

      <div className="stf-grid c4">
        <KpiCard
          label={t("participant.programCompletion")}
          value={`${overall.programCompletion || 0}%`}
          icon={TrendingUp}
        />
        <KpiCard
          label={t("participant.attendance")}
          value={`${overall.attendanceRate || 0}%`}
          icon={Check}
        />
        <KpiCard
          label={t("participant.template.approvedAssignments")}
          value={
            totals
              ? `${totals.approved} / ${totals.submissions}`
              : t("participant.template.notAvailable")
          }
          icon={FileText}
        />
        <KpiCard
          label={t("participant.kpiAchievement")}
          value={`${overall.kpiCompletion || 0}%`}
          icon={TrendingUp}
        />
      </div>

      <div className="stf-grid c2">
        <AppCard>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
            {bars.map((bar) => (
              <div key={bar.key}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-xs font-bold text-[var(--text-secondary)]">{bar.label}</span>
                  <span className="text-sm font-black text-[var(--text-primary)]">
                    {bar.value === null ? t("participant.template.notAvailable") : `${bar.value}%`}
                  </span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-3">
                  <div
                    className="h-full rounded-full bg-[var(--progress-fill)]"
                    style={{ width: `${Math.min(100, Math.max(0, Number(bar.value) || 0))}%` }}
                  />
                </div>
                {bar.hint && <p className="mt-2 text-xs text-[var(--text-secondary)]">{bar.hint}</p>}
              </div>
            ))}
          </div>
        </AppCard>

        <AppCard>
          <h3 className="text-sm font-bold text-[var(--text-primary)]">
            {t("member.dashboard.section.program.seats")}
          </h3>
          <div className="mt-3 divide-y divide-[var(--border-primary)]">
            {seats.map((seat) => (
              <Link
                key={seat.id}
                href={`/member/participant/${seat.id}`}
                className="flex items-center justify-between gap-3 py-3"
              >
                <span className="min-w-0 truncate text-sm font-bold text-[var(--text-primary)]">
                  {seat.name}
                </span>
                <AppStatusBadge
                  status={seat.completed ? "completed" : seat.status}
                  label={seat.readOnly ? t("common.workspaces.completedViewOnly") : undefined}
                />
              </Link>
            ))}
          </div>
          <Link className="stf-link-btn mt-2 inline-block" href="/member/participant/dashboard">
            {t("member.dashboard.seeAll")}
          </Link>
        </AppCard>
      </div>

      <div className="stf-grid g3">
        {attention(overdue, t("participant.overdue"), AlertCircle, "var(--chart-danger)")}
        {attention(dueSoon, t("participant.dueSoon"), Clock, "var(--chart-warning)")}
        {attention(pending, t("participant.pending"), FileText, "var(--chart-info)", true)}
      </div>

      <AppCard>
        <h3 className="text-sm font-bold text-[var(--text-primary)]">
          {t("participant.template.nextSessions")}
        </h3>
        <div className="mt-3 divide-y divide-[var(--border-primary)]">
          {nextSessions.length ? (
            nextSessions.map((session) => (
              <Link
                key={session.id}
                href={`/member/participant/${session.programId}?session=${encodeURIComponent(session.id)}#session-${session.id}`}
                className="block py-3"
              >
                <p className="text-sm font-bold text-[var(--text-primary)]">{session.title}</p>
                <p className="mt-1 text-xs text-[var(--text-secondary)]">
                  {formatLocaleDate(session.date, { day: "numeric", month: "short" }, lang)}
                  {session.time ? ` · ${session.time.slice(0, 5)}` : ""}
                </p>
              </Link>
            ))
          ) : (
            <p className="py-5 text-xs text-[var(--text-secondary)]">
              {t("participant.template.noSessions")}
            </p>
          )}
        </div>
      </AppCard>
    </section>
  );
}
