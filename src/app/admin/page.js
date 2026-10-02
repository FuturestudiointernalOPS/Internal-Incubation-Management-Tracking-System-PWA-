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
import { cacheGet, cacheSet } from "@/lib/hooks/useApi";
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
import {
  formatDate,
  formatLabel,
  getCalendarDays,
} from "@/components/admin/dashboard-page/constants";

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    programs: 0,
    participants: 0,
    totalStaff: 0,
  });
  const [activity, setActivity] = useState([]);
  const [activePrograms, setActivePrograms] = useState([]);
  const [opStats, setOpStats] = useState({
    standups: 0,
    retros: 0,
    blockers: 0,
    support: 0,
    totalUsers: 0,
  });
  const [staffReports, setStaffReports] = useState([]);
  const [processingId, setProcessingId] = useState(null);
  const [expandedSections, setExpandedSections] = useState({});
  const router = useRouter();
  const { t, lang } = useI18n();

  // Dashboard widgets state
  const now = new Date();
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth());
  const [tasks, setTasks] = useState([]);
  const [selectedTask, setSelectedTask] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [assignmentsLoading] = useState(false);
  const [activeBlockers, setActiveBlockers] = useState([]);
  const [resolvingBlocker, setResolvingBlocker] = useState(null);
  const [kpiSummary, setKpiSummary] = useState([]);

  // Pagination and UI state
  const [assignmentsPage, setAssignmentsPage] = useState(1);
  const ASSIGNMENTS_PER_PAGE = 5;
  const [expandedCalendarDays, setExpandedCalendarDays] = useState({});

  const toggleSection = (id) => {
    setExpandedSections((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const fetchDashboardData = useCallback(async () => {
    // Aggregate endpoints rendered by this dashboard. Kept in a single place so
    // the cache-first paint below can reuse them to fetch from the network.
    const urls = [
      "/api/superadmin/full-state",
      "/api/op-reports",
      "/api/blockers?status=active",
      "/api/dashboard?summary=true",
    ];

    // Pure apply: computes every widget state from the four payloads.
    const apply = (stateData, opData, blockerData, kpiData) => {
      if (stateData.success) {
        setStats(stateData.stats || {});
        setActivity(stateData.activity || []);
        setActivePrograms(stateData.activePrograms || []);
      }
      if (opData.success) {
        const reports = opData.reports || [];

        // Calculate op stats
        const standups = reports.filter(
          (report) => report.report_type === "standup",
        );
        const retros = reports.filter(
          (report) => report.report_type === "retro",
        );
        const blockers = reports.filter((report) => report.has_blockers);
        const support = reports.filter((report) => report.needs_support);

        // Count active blockers from dedicated blockers table
        const activeBlockersCount = blockerData.success
          ? (blockerData.blockers || []).length
          : 0;

        setOpStats({
          standups: standups.length,
          retros: retros.length,
          blockers: blockers.length + activeBlockersCount,
          support: support.length,
          totalUsers: new Set(reports.map((report) => report.user_id)).size,
        });

        // Per-staff reporting stats
        const userMap = {};
        reports.forEach((report) => {
          if (!userMap[report.user_id]) {
            userMap[report.user_id] = {
              id: report.user_id,
              name: report.user_name,
              role: report.user_role,
              standups: 0,
              retros: 0,
              blockers: 0,
              latest: null,
              weeks: new Set(),
            };
          }
          if (report.report_type === "standup") userMap[report.user_id].standups++;
          else userMap[report.user_id].retros++;
          if (report.has_blockers) userMap[report.user_id].blockers++;
          if (
            !userMap[report.user_id].latest ||
            new Date(report.created_at) > new Date(userMap[report.user_id].latest)
          ) {
            userMap[report.user_id].latest = report.created_at;
          }
          userMap[report.user_id].weeks.add(
            `${report.year}-W${String(report.week_number).padStart(2, "0")}`,
          );
        });
        setStaffReports(Object.values(userMap));

        // Blocker type aggregation
        const blockerAgg = {};
        standups
          .filter((report) => report.has_blockers && report.blocker_description)
          .forEach((report) => {
            const desc = report.blocker_description || "Other";
            blockerAgg[desc] = (blockerAgg[desc] || 0) + 1;
          });
        retros
          .filter((report) => report.had_blockers && report.blocker_type)
          .forEach((report) => {
            const type = report.blocker_type || "Other";
            blockerAgg[formatLabel(type)] =
              (blockerAgg[formatLabel(type)] || 0) + 1;
          });
      }
      if (kpiData.success) {
        setKpiSummary(kpiData.programs || []);
      }
    };

    try {
      // Cache-first paint: if a fresh (≤30s) snapshot of all four endpoints is
      // available (e.g. returning to /admin), render it immediately instead of
      // showing skeletons, then let the network refresh below converge.
      const cached = urls.map((url) => cacheGet(url));
      if (cached.every((cachedItem) => cachedItem !== null)) {
        apply(cached[0], cached[1], cached[2], cached[3]);
        setLoading(false);
      }

      const responses = await Promise.all(urls.map((url) => fetch(url)));
      const payloads = await Promise.all(
        responses.map((response) => response.json()),
      );
      urls.forEach((url, index) => cacheSet(url, payloads[index]));
      apply(payloads[0], payloads[1], payloads[2], payloads[3]);
    } catch (err) {
      console.error("Dashboard sync failure:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch tasks for calendar (super_admin sees all, others see own)
  const fetchWidgetData = useCallback(async () => {
    try {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      const userId = user.cid || user.id;
      const isSA = user.role === "super_admin";

      const urls = [
        isSA
          ? "/api/tasks?brief=true"
          : `/api/tasks?user_id=${userId}&brief=true`,
        isSA
          ? "/api/blockers?status=active"
          : `/api/blockers?user_id=${userId}&status=active`,
      ];
      // Fetch assigned tasks if user has a user ID
      if (userId) urls.push(`/api/tasks?assigned_to=${userId}&brief=true`);

      const apply = (taskData, blockerData, assignData) => {
        if (taskData && taskData.success) setTasks(taskData.tasks || []);
        if (blockerData && blockerData.success)
          setActiveBlockers(blockerData.blockers || []);
        if (assignData && assignData.success)
          setAssignments(assignData.tasks || []);
      };

      // Cache-first paint (same 30s SWR window as fetchDashboardData): render
      // the widgets instantly from a fresh snapshot when returning to /admin,
      // then the network refresh below converges to current values.
      const cached = urls.map((url) => cacheGet(url));
      if (cached.every((cachedItem) => cachedItem !== null)) {
        apply(cached[0], cached[1], cached[2]);
      }

      const responses = await Promise.all(urls.map((url) => fetch(url)));
      const payloads = await Promise.all(
        responses.map((response) => response.json()),
      );
      urls.forEach((url, index) => cacheSet(url, payloads[index]));
      apply(payloads[0], payloads[1], payloads[2]);
    } catch (error) {
      console.error("Widget data fetch error:", error);
    }
  }, []);

  // Ticket 1.6: expose refresh callback for auto calendar sync
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.__refreshAdminDashboard = fetchWidgetData;
    }
    return () => {
      if (typeof window !== "undefined") delete window.__refreshAdminDashboard;
    };
  }, [fetchWidgetData]);

  const handlePrevMonth = () => {
    if (calMonth === 0) {
      setCalMonth(11);
      setCalYear(calYear - 1);
    } else setCalMonth(calMonth - 1);
  };
  const handleNextMonth = () => {
    if (calMonth === 11) {
      setCalMonth(0);
      setCalYear(calYear + 1);
    } else setCalMonth(calMonth + 1);
  };

  const handleResolveBlocker = async (blockerId) => {
    setResolvingBlocker(blockerId);
    try {
      await fetch("/api/blockers", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: blockerId,
          status: "resolved",
          resolved_by: "sa",
        }),
      });
      fetchWidgetData();
    } catch (error) {
      console.error(error);
    } finally {
      setResolvingBlocker(null);
    }
  };

  const handleAssignmentAction = async (task, action) => {
    setProcessingId(task.id);
    try {
      await fetch("/api/tasks/assignment-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task_id: task.id,
          user_id:
            JSON.parse(
              localStorage.getItem("user") || "{}",
            ).cid || "sa",
          action,
        }),
      });
      fetchWidgetData();
    } finally {
      setProcessingId(null);
    }
  };

  // Calendar computed
  const calendarDays = getCalendarDays(calYear, calMonth);

  // A task spanning several days is listed on each of them. `calendarSpans`
  // records where each day sits in that span ("middle" = neither first nor
  // last), so the grid can draw the in-between days as a quiet bar instead of
  // repeating the full title every day.
  const calendarSpans = React.useMemo(() => {
    const spans = {};
    const allTasks = [...(tasks || []), ...(assignments || [])];
    allTasks.forEach((task) => {
      if (!task.start_date || !task.end_date) return;
      const start = new Date(task.start_date);
      const end = new Date(task.end_date);
      const current = new Date(start);
      current.setDate(current.getDate() + 1);
      while (current < end) {
        const key = formatDate(
          current.getFullYear(),
          current.getMonth(),
          current.getDate(),
        );
        spans[`${key}:${task.id}`] = "middle";
        current.setDate(current.getDate() + 1);
      }
    });
    return spans;
  }, [tasks, assignments]);

  const calendarTasks = React.useMemo(() => {
    const cal = {};
    const allTasks = [...(tasks || []), ...(assignments || [])];
    // Deduplicate by task id
    const seen = new Set();
    const unique = allTasks.filter((task) => {
      if (seen.has(task.id)) return false;
      seen.add(task.id);
      return true;
    });
    unique.forEach((task) => {
      if (task.start_date || task.end_date) {
        const start = task.start_date ? new Date(task.start_date) : null;
        const end = task.end_date ? new Date(task.end_date) : null;
        if (start && end) {
          const current = new Date(start);
          while (current <= end) {
            const key = formatDate(
              current.getFullYear(),
              current.getMonth(),
              current.getDate(),
            );
            if (!cal[key]) cal[key] = [];
            cal[key].push(task);
            current.setDate(current.getDate() + 1);
          }
        } else if (start) {
          const key = formatDate(
            start.getFullYear(),
            start.getMonth(),
            start.getDate(),
          );
          if (!cal[key]) cal[key] = [];
          cal[key].push(task);
        } else if (end) {
          const key = formatDate(
            end.getFullYear(),
            end.getMonth(),
            end.getDate(),
          );
          if (!cal[key]) cal[key] = [];
          cal[key].push(task);
        }
      }
    });
    return cal;
  }, [tasks, assignments]);

  useEffect(() => {
    fetchWidgetData();
  }, [fetchWidgetData]);

  // Ticket 1.6: refetch calendar when tab becomes visible again
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") fetchWidgetData();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [fetchWidgetData]);

  useEffect(() => {
    let active = true;
    let started = false;
    const startData = () => {
      if (!started) {
        started = true;
        fetchDashboardData();
      }
    };

    async function checkAuth() {
      // Fast path: on client-side navigation the section layout has already
      // authenticated an admin session (localStorage/cache). Start loading the
      // dashboard data immediately instead of waiting for a duplicate
      // /api/auth/session round-trip; the revalidation below still redirects if
      // the session is no longer valid.
      try {
        const storedUser = localStorage.getItem("user");
        if (storedUser && JSON.parse(storedUser).role === "super_admin") startData();
      } catch (_) {}

      try {
        const response = await fetch("/api/auth/session");
        const payload = await response.json();
        if (!active) return;
        if (
          !payload.authenticated ||
          !payload.user ||
          payload.user.role !== "super_admin"
        ) {
          router.replace("/login");
          return;
        }
        startData();
      } catch {
        if (active) router.replace("/login");
      }
    }
    checkAuth();
    return () => {
      active = false;
    };
  }, [router, fetchDashboardData]);

  return (
    <>
      <div className="space-y-10 pb-20 text-left">
        {/* ──────── GLOBAL HEADER ──────── */}
        <DashboardHeader onNewProgram={() => router.push("/admin/programs/new")} />

        {/* ═══════ DASHBOARD WIDGETS ═══════ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ─── LEFT: CALENDAR ─── */}
          <div className="lg:col-span-2">
            <CalendarPanel
              year={calYear}
              month={calMonth}
              calendarDays={calendarDays}
              calendarTasks={calendarTasks}
              calendarSpans={calendarSpans}
              expandedDays={expandedCalendarDays}
              onPrevMonth={handlePrevMonth}
              onNextMonth={handleNextMonth}
              onToday={() => {
                setCalMonth(now.getMonth());
                setCalYear(now.getFullYear());
              }}
              onSelectTask={setSelectedTask}
              onExpandDay={(dateStr, open) =>
                setExpandedCalendarDays((prev) => ({ ...prev, [dateStr]: open }))
              }
            />
          </div>

          {/* ─── RIGHT: SUMMARY WIDGETS ─── */}
          <div className="space-y-3">
            <UpcomingWidget
              calendarTasks={calendarTasks}
              onSelectTask={setSelectedTask}
            />

            <TasksSummaryWidget
              tasks={tasks}
              onOpen={() => router.push("/admin/tasks")}
            />

            <BlockersSummaryWidget
              blockers={activeBlockers}
              onOpen={() => router.push("/admin/blockers")}
            />
          </div>
        </div>

        {/* ═══════ ASSIGNED TO ME ═══════ */}
        <AssignmentsPanel
          assignments={assignments}
          assignmentsLoading={assignmentsLoading}
          processingId={processingId}
          page={assignmentsPage}
          perPage={ASSIGNMENTS_PER_PAGE}
          lang={lang}
          onAction={handleAssignmentAction}
          onPageChange={setAssignmentsPage}
        />

        {/* ═══════════════════════════════════════════════ */}
        {/* SECTION A — PROGRAM OPERATIONS                 */}
        {/* ═══════════════════════════════════════════════ */}
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
              value={stats.programs}
              icon={Layers}
              color="text-[var(--brand-orange)]"
              badge={t("status.live")}
              onClick={() => router.push("/admin/programs")}
              loading={loading}
            />
            <StatCard
              title={t("admin.totalParticipants")}
              value={stats.participants}
              icon={Users}
              color="text-blue-500"
              onClick={() => router.push("/admin/communications/contacts")}
              loading={loading}
            />
            <StatCard
              title={t("admin.operationalStaff")}
              value={stats.totalStaff}
              icon={Rocket}
              color="text-emerald-500"
              subtitle={t("admin.sectionSubtitles.adminsAndStaff")}
              onClick={() => router.push("/admin/communications/contacts")}
              loading={loading}
            />
            <StatCard
              title={t("admin.projects")}
              value={stats.projects ?? stats.totalProjects ?? 0}
              icon={Briefcase}
              color="text-purple-500"
              subtitle={t("admin.sectionSubtitles.activeInternalProjects")}
              onClick={() => router.push("/admin/projects")}
              loading={loading}
            />
          </div>

          {/* Activity Feed + Active Programs (existing content) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <ActivityFeed activity={activity} loading={loading} lang={lang} />

            <ActiveProgramsCard
              programs={activePrograms}
              loading={loading}
              lang={lang}
              onOpen={(program) => router.push(`/admin/programs/${program.id}`)}
              onViewAll={() => router.push("/admin/programs")}
            />
          </div>
        </div>

        {/* ═══════════════════════════════════════════════ */}
        {/* KPI PROGRESS OVERVIEW                               */}
        {/* ═══════════════════════════════════════════════ */}
        <KpiProgressSection
          programs={kpiSummary}
          onOpen={(program) => router.push(`/admin/programs/${program.id}`)}
        />

        {/* ═══════════════════════════════════════════════ */}
        {/* SECTION B — INTERNAL OPERATIONS                */}
        {/* ═══════════════════════════════════════════════ */}
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
              value={opStats.standups}
              icon={Calendar}
              color="text-[var(--brand-orange)]"
              subtitle={`${opStats.totalUsers} ${t("admin.activeReporters")}`}
              loading={loading}
              onClick={() => router.push("/admin/op-reports")}
            />
            <StatCard
              title={t("admin.fridayRetros")}
              value={opStats.retros}
              icon={CheckCircle2}
              color="text-emerald-500"
              loading={loading}
              onClick={() => router.push("/admin/op-reports")}
            />
            <StatCard
              title={t("admin.blockersReported")}
              value={opStats.blockers}
              icon={AlertTriangle}
              color="text-rose-500"
              badge={opStats.blockers > 0 ? t("status.action") : ""}
              loading={loading}
              onClick={() => router.push("/admin/op-reports")}
            />
          </div>

          {/* Quick insights row */}
          <BlockerRateCard
            opStats={opStats}
            onOpen={() => router.push("/admin/op-reports")}
          />
        </div>

        {/* ── Section B — Internal Operations nav cards ── */}
        <InternalOpsNavCards onNavigate={(path) => router.push(path)} />

        {/* ═══════════════════════════════════════════════ */}
        {/* SECTION C — TEAM ACCOUNTABILITY                */}
        {/* ═══════════════════════════════════════════════ */}
        <div className="space-y-6 pt-6 border-t border-[var(--border-primary)]">
          <SectionHeader
            number="C"
            title={t("admin.teamAccountability")}
            subtitle={t("admin.sectionSubtitles.reportingReliability")}
            icon={Users}
            color="bg-emerald-500/10 text-emerald-500"
            action={
              <button
                onClick={() => toggleSection("teamTable")}
                className="text-[10px] font-bold text-[var(--text-secondary)] uppercase hover:text-[var(--text-primary)] transition-all flex items-center gap-1"
              >
                {expandedSections.teamTable
                  ? t("common.collapse")
                  : t("common.expand")}{" "}
                <ChevronDown
                  className={`w-3 h-3 transition-transform ${expandedSections.teamTable ? "rotate-180" : ""}`}
                />
              </button>
            }
          />

          {/* Summary stats */}
          <TeamSummaryStats
            staffReports={staffReports}
            totalStaff={stats.totalStaff}
          />

          {/* Staff table (expandable) */}
          {(expandedSections.teamTable || staffReports.length <= 6) && (
            <StaffReportTable
              staffReports={staffReports}
              loading={loading}
              lang={lang}
            />
          )}
          {expandedSections.teamTable && staffReports.length > 6 && (
            <CollapseTableButton onCollapse={() => toggleSection("teamTable")} />
          )}
        </div>

        {/* ═══════════════════════════════════════════════ */}
        {/* SECTION D — RISKS & BLOCKERS                   */}
        {/* ═══════════════════════════════════════════════ */}
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
              blockers={activeBlockers}
              resolvingBlocker={resolvingBlocker}
              onResolve={handleResolveBlocker}
            />

            <QuickActionsCard onNavigate={(path) => router.push(path)} />
          </div>
        </div>

        {/* ═══════════════════════════════════════════════ */}
        {/* SECTION E — HISTORICAL INTELLIGENCE            */}
        {/* ═══════════════════════════════════════════════ */}
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

      {/* ═══════ TASK DETAIL DRAWER ═══════ */}
      <TaskDetailDrawer
        task={selectedTask}
        lang={lang}
        onClose={() => setSelectedTask(null)}
      />
    </>
  );
}