"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useI18n } from "@/lib/i18n";
import {
  Layers,
  Users,
  Rocket,
  Briefcase,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  BarChart3,
  ChevronDown,
  Clock,
} from "lucide-react";
import { useRouter } from "next/navigation";
import DashboardHeader from "@/components/admin/dashboard-page/DashboardHeader";
import StatCard from "@/components/admin/dashboard-page/StatCard";
import SectionHeader from "@/components/admin/dashboard-page/SectionHeader";
import CalendarPanel from "@/components/admin/dashboard-page/CalendarPanel";
import UpcomingWidget from "@/components/admin/dashboard-page/UpcomingWidget";
import {
  TasksSummaryWidget,
  BlockersSummaryWidget,
} from "@/components/admin/dashboard-page/SummaryWidgets";
import AssignmentsPanel from "@/components/admin/dashboard-page/AssignmentsPanel";
import {
  ActivityFeed,
  ActiveProgramsCard,
} from "@/components/admin/dashboard-page/ProgramActivity";
import KpiProgressSection from "@/components/admin/dashboard-page/KpiProgressSection";
import {
  BlockerRateCard,
  InternalOpsNavCards,
  ArchiveNavCards,
} from "@/components/admin/dashboard-page/NavCards";
import {
  TeamSummaryStats,
  StaffReportTable,
  CollapseTableButton,
} from "@/components/admin/dashboard-page/TeamAccountability";
import {
  LatestBlockersCard,
  QuickActionsCard,
} from "@/components/admin/dashboard-page/RisksSection";
import TaskDetailDrawer from "@/components/admin/dashboard-page/TaskDetailDrawer";
import GoogleCalendarConnect from "@/components/admin/dashboard-page/GoogleCalendarConnect";
import {
  formatDate,
  formatLabel,
  getCalendarDays,
} from "@/components/admin/dashboard-page/constants";
import { useAdminDashboardData } from "./hooks/useAdminDashboardData";
import { useAdminWidgetData } from "./hooks/useAdminWidgetData";
import { useAdminSections } from "./hooks/useAdminSections";
import { useAdminActions } from "./hooks/useAdminActions";
import { useGoogleCalendar } from "./hooks/useGoogleCalendar";

const ASSIGNMENTS_PER_PAGE = 5;

export default function AdminDashboard() {
  const router = useRouter();
  const { t, lang } = useI18n();

  const dashboardData = useAdminDashboardData({ router, t, lang });
  const googleCalendar = useGoogleCalendar({ t });
  const widgetData = useAdminWidgetData({ t, lang, externalItems: googleCalendar.events });
  const sections = useAdminSections();
  const actions = useAdminActions({ 
    tasks: widgetData.tasks, 
    assignments: widgetData.assignments, 
    fetchWidgetData: widgetData.fetchWidgetData, 
    t, 
    lang, 
    router 
  });

  const now = new Date();

  // A Google Calendar entry has no task drawer: it opens in Google instead.
  const selectCalendarItem = (item) => {
    if (item?.source === "google") {
      if (item.html_link) window.open(item.html_link, "_blank", "noopener,noreferrer");
      return;
    }
    widgetData.setSelectedTask(item);
  };

  return (
    <>
      <div className="space-y-10 pb-20 text-left">
        <DashboardHeader onNewProgram={() => router.push("/admin/programs/new")} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <CalendarPanel
              year={widgetData.calYear}
              month={widgetData.calMonth}
              calendarDays={widgetData.calendarDays}
              calendarTasks={widgetData.calendarTasks}
              calendarSpans={widgetData.calendarSpans}
              expandedDays={widgetData.expandedCalendarDays}
              onPrevMonth={widgetData.handlePrevMonth}
              onNextMonth={widgetData.handleNextMonth}
              onToday={() => {
                widgetData.setCalMonth(now.getMonth());
                widgetData.setCalYear(now.getFullYear());
              }}
              onSelectTask={selectCalendarItem}
              onExpandDay={(dateStr, open) =>
                widgetData.setExpandedCalendarDays((prev) => ({ ...prev, [dateStr]: open }))
              }
              headerAction={
                <GoogleCalendarConnect
                  status={googleCalendar.status}
                  syncing={googleCalendar.syncing}
                  onConnect={googleCalendar.connect}
                  onSync={googleCalendar.syncNow}
                  onDisconnect={googleCalendar.disconnect}
                />
              }
              extraLegend={
                googleCalendar.status?.connected
                  ? [{ key: "google", label: t("admin.googleCalendar.legend"), dot: "bg-sky-400" }]
                  : []
              }
            />
          </div>

          <div className="space-y-3">
            <UpcomingWidget
              calendarTasks={widgetData.calendarTasks}
              onSelectTask={selectCalendarItem}
            />

            <TasksSummaryWidget
              tasks={widgetData.tasks}
              onOpen={() => router.push("/admin/tasks")}
            />

            <BlockersSummaryWidget
              blockers={widgetData.activeBlockers}
              onOpen={() => router.push("/admin/blockers")}
            />
          </div>
        </div>

        <AssignmentsPanel
          assignments={widgetData.assignments}
          assignmentsLoading={widgetData.assignmentsLoading}
          processingId={actions.processingId}
          page={1}
          perPage={ASSIGNMENTS_PER_PAGE}
          lang={lang}
          onAction={actions.handleAssignmentAction}
          onPageChange={() => {}}
        />

        <div className="space-y-6">
          <SectionHeader
            number="A"
            title={t("admin.programOperations")}
            subtitle={t("admin.sectionSubtitles.educationalPerformance")}
            icon={Briefcase}
            color="bg-brand-orange/10 text-[var(--brand-orange)]"
            action={
              <button
                onClick={() => router.push("/admin/programs")}
                className="text-[10px] font-bold text-[var(--brand-orange)] uppercase hover:underline"
              >
                {t("admin.viewAllPrograms")}
              </button>
            }
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <StatCard
              title={t("admin.activePrograms")}
              value={dashboardData.stats.programs}
              icon={Layers}
              color="text-[var(--brand-orange)]"
              badge={t("status.live")}
              onClick={() => router.push("/admin/programs")}
              loading={dashboardData.loading}
            />
            <StatCard
              title={t("admin.totalParticipants")}
              value={dashboardData.stats.participants}
              icon={Users}
              color="text-blue-500"
              onClick={() => router.push("/admin/communications/contacts")}
              loading={dashboardData.loading}
            />
            <StatCard
              title={t("admin.operationalStaff")}
              value={dashboardData.stats.totalStaff}
              icon={Rocket}
              color="text-emerald-500"
              subtitle={t("admin.sectionSubtitles.adminsAndStaff")}
              onClick={() => router.push("/admin/communications/contacts")}
              loading={dashboardData.loading}
            />
            <StatCard
              title={t("admin.projects")}
              value={dashboardData.stats.projects ?? dashboardData.stats.totalProjects ?? 0}
              icon={Briefcase}
              color="text-purple-500"
              subtitle={t("admin.sectionSubtitles.activeInternalProjects")}
              onClick={() => router.push("/admin/projects")}
              loading={dashboardData.loading}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <ActivityFeed activity={dashboardData.activity} loading={dashboardData.loading} lang={lang} />

            <ActiveProgramsCard
              programs={dashboardData.activePrograms}
              loading={dashboardData.loading}
              lang={lang}
              onOpen={(program) => router.push(`/admin/programs/${program.id}`)}
              onViewAll={() => router.push("/admin/programs")}
            />
          </div>
        </div>

        <KpiProgressSection
          programs={dashboardData.kpiSummary}
          onOpen={(program) => router.push(`/admin/programs/${program.id}`)}
        />

        <div className="space-y-6 pt-6 border-t border-[var(--border-primary)]">
          <SectionHeader
            number="B"
            title={t("admin.internalOperations")}
            subtitle={t("admin.sectionSubtitles.staffReporting")}
            icon={BarChart3}
            color="bg-indigo-500/10 text-indigo-500"
            action={
              <button
                onClick={() => router.push("/admin/op-reports")}
                className="text-[10px] font-bold text-indigo-400 uppercase hover:underline"
              >
                {t("admin.viewAllReports")}
              </button>
            }
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <StatCard
              title={t("admin.mondayStandups")}
              value={dashboardData.opStats.standups}
              icon={Calendar}
              color="text-[var(--brand-orange)]"
              subtitle={`${dashboardData.opStats.totalUsers} ${t("admin.activeReporters")}`}
              loading={dashboardData.loading}
              onClick={() => router.push("/admin/op-reports")}
            />
            <StatCard
              title={t("admin.fridayRetros")}
              value={dashboardData.opStats.retros}
              icon={CheckCircle2}
              color="text-emerald-500"
              loading={dashboardData.loading}
              onClick={() => router.push("/admin/op-reports")}
            />
            <StatCard
              title={t("admin.blockersReported")}
              value={dashboardData.opStats.blockers}
              icon={AlertTriangle}
              color="text-rose-500"
              badge={dashboardData.opStats.blockers > 0 ? t("status.action") : ""}
              loading={dashboardData.loading}
              onClick={() => router.push("/admin/op-reports")}
            />
          </div>

          <BlockerRateCard
            opStats={dashboardData.opStats}
            onOpen={() => router.push("/admin/op-reports")}
          />
        </div>

        <InternalOpsNavCards onNavigate={(path) => router.push(path)} />

        <div className="space-y-6 pt-6 border-t border-[var(--border-primary)]">
          <SectionHeader
            number="C"
            title={t("admin.teamAccountability")}
            subtitle={t("admin.sectionSubtitles.reportingReliability")}
            icon={Users}
            color="bg-emerald-500/10 text-emerald-500"
            action={
              <button
                onClick={() => sections.toggleSection("teamTable")}
                className="text-[10px] font-bold text-[var(--text-secondary)] uppercase hover:text-[var(--text-primary)] transition-all flex items-center gap-1"
              >
                {sections.expandedSections.teamTable
                  ? t("common.collapse")
                  : t("common.expand")}{" "}
                <ChevronDown
                  className={`w-3 h-3 transition-transform ${sections.expandedSections.teamTable ? "rotate-180" : ""}`}
                />
              </button>
            }
          />

          <TeamSummaryStats
            staffReports={dashboardData.staffReports}
            totalStaff={dashboardData.stats.totalStaff}
          />

          {(sections.expandedSections.teamTable || dashboardData.staffReports.length <= 6) && (
            <StaffReportTable
              staffReports={dashboardData.staffReports}
              loading={dashboardData.loading}
              lang={lang}
            />
          )}
          {sections.expandedSections.teamTable && dashboardData.staffReports.length > 6 && (
            <CollapseTableButton onCollapse={() => sections.toggleSection("teamTable")} />
          )}
        </div>

        <div className="space-y-6 pt-6 border-t border-[var(--border-primary)]">
          <SectionHeader
            number="D"
            title={t("admin.risksAndBlockers")}
            subtitle={t("admin.sectionSubtitles.recurringProblems")}
            icon={AlertTriangle}
            color="bg-rose-500/10 text-rose-500"
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <LatestBlockersCard
              blockers={widgetData.activeBlockers}
              resolvingBlocker={widgetData.resolvingBlocker}
              onResolve={widgetData.handleResolveBlocker}
            />

            <QuickActionsCard onNavigate={(path) => router.push(path)} />
          </div>
        </div>

        <div className="space-y-6 pt-6 border-t border-[var(--border-primary)]">
          <SectionHeader
            number="E"
            title={t("admin.historicalIntelligence")}
            subtitle={t("admin.sectionSubtitles.longTermVisibility")}
            icon={Clock}
            color="bg-blue-500/10 text-blue-500"
            action={
              <button
                onClick={() => router.push("/admin/op-reports")}
                className="text-[10px] font-bold text-blue-400 uppercase hover:underline"
              >
                {t("admin.fullArchive")}
              </button>
            }
          />

          <ArchiveNavCards onNavigate={(path) => router.push(path)} />
        </div>
      </div>

      <TaskDetailDrawer
        task={widgetData.selectedTask}
        lang={lang}
        onClose={() => widgetData.setSelectedTask(null)}
      />
    </>
  );
}