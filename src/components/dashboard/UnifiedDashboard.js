"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import TaskDetailModal from "@/components/ui/TaskDetailModal";
import { cacheGet, cacheSet, useApi } from "@/lib/hooks/useApi";
import {
  getCalendarDays,
  hasMinRole,
  pickDashboard,
} from "./unified-dashboard/constants";
import DashboardHeader from "./unified-dashboard/DashboardHeader";
import CalendarPanel from "./unified-dashboard/CalendarPanel";
import AssignmentsSection from "./unified-dashboard/AssignmentsSection";
import AttentionSection from "./unified-dashboard/AttentionSection";
import WorkspaceGrid from "./unified-dashboard/WorkspaceGrid";
import EmptyState from "./unified-dashboard/EmptyState";
import EventDetailDrawer from "./unified-dashboard/EventDetailDrawer";

// ─── MAIN COMPONENT ────────────────────────────────────────────────────────
// The screen owns the session, the dashboard read, the calendar navigation and
// the writes; every block it renders lives in ./unified-dashboard/.

export default function UnifiedDashboard({ role: propRole }) {
  const router = useRouter();
  const { t, lang } = useI18n();

  // ── Auth / User ──
  const [user, setUser] = useState(null);

  // ── Calendar state ──
  const now = useMemo(() => new Date(), []);
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth());
  const [calView, setCalView] = useState("month");
  const [selectedEvent, setSelectedEvent] = useState(null);

  // ── Detail drawers ──
  const [selectedTask, setSelectedTask] = useState(null);

  // ── Blocker resolve ──
  const [resolvingBlocker, setResolvingBlocker] = useState(null);

  // ── Assignment actions ──
  const [actionLoading, setActionLoading] = useState(null);

  // ── Facilitator programs (program-scoped assignments for any session role) ──
  const [facilitatorPrograms, setFacilitatorPrograms] = useState([]);

  // ── This Week date range (computed once on mount) ──
  const [weekDateRange] = useState(() => {
    const now = new Date();
    const start = new Date(now.toDateString());
    const end = new Date(now);
    end.setDate(end.getDate() + (6 - now.getDay()));
    end.setHours(23, 59, 59, 999);
    return { start, end };
  });

  // ── Auth check ──
  useEffect(() => {
    let active = true;
    async function checkAuth() {
      // Fast path: on client-side navigation the section layout has already
      // resolved a user (dashboardSession/localStorage). Paint immediately and
      // let the server session check below upgrade/redirect if needed.
      let local = null;
      try {
        const stored = JSON.parse(localStorage.getItem("user") || "{}");
        if (stored.cid || stored.id) {
          local = stored;
          setUser(stored);
        }
      } catch (_) {}

      try {
        const res = await fetch("/api/auth/session");
        const session = await res.json();
        if (!active) return;
        if (session.authenticated && session.user) {
          setUser(session.user);
          return;
        }
      } catch (_) {
        // Session API unavailable — rely on the local fallback below
      }

      if (active && !local) router.replace("/login");
    }
    checkAuth();
    return () => {
      active = false;
    };
  }, [router]);

  // Fetch the user's program-scoped facilitator assignments (role-agnostic),
  // so staff who were also assigned as facilitators can see those programs here.
  useEffect(() => {
    if (!user?.cid) return;
    let active = true;
    const url = "/api/pm/programs?my_facilitator=1";
    const apply = (payload) => {
      if (active && payload.success) setFacilitatorPrograms(payload.programs || []);
    };
    const cached = cacheGet(url);
    if (cached !== null && cached.success) apply(cached);
    fetch(url)
      .then((response) => response.json())
      .then((payload) => {
        if (payload.success) {
          cacheSet(url, payload);
          apply(payload);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [user?.cid]);

  // Program completion index by id, taken from the programs endpoint already
  // fetched above. Used as the progress fallback for a program that has no KPI.
  const completionIndexById = useMemo(() => {
    const completionByProgramId = new Map();
    (facilitatorPrograms || []).forEach((program) => {
      if (program?.id === undefined || program?.id === null) return;
      completionByProgramId.set(String(program.id), Number(program.completion_index) || 0);
    });
    return completionByProgramId;
  }, [facilitatorPrograms]);

  // Determine effective role
  const effectiveRole = user?.role || propRole || "staff";

  // ── Read data ──
  // The payload is read through the shared hook, which owns the cache, the
  // cache-first paint and the discarding of a stale answer, so the screen keeps
  // no copy of its own. The address carries the identity, the role and the month
  // under review, so each of those re-reads by itself — the effect that watched
  // them is gone. Until the identity is known there is no address, and the screen
  // keeps its placeholder rather than claiming there is nothing to show.
  const dashboardUserId = user?.cid || user?.id;
  const {
    data,
    loading: readLoading,
    error: readError,
    refresh: refreshDashboard,
  } = useApi(
    dashboardUserId
      ? `/api/dashboard?user_id=${encodeURIComponent(dashboardUserId)}&role=${encodeURIComponent(effectiveRole)}&year=${calYear}&month=${calMonth + 1}`
      : null,
    {
      defaultValue: null,
      transform: pickDashboard,
      deps: [dashboardUserId, effectiveRole, calYear, calMonth],
    },
  );
  const fetching = readLoading;
  const loading = !dashboardUserId || readLoading;
  // The loader reported a request that never got an answer as this message, in
  // the same panel the screen still shows it in.
  const error = readError ? "Failed to load dashboard data" : null;

  // Determine what sections to show based on role & data
  const visibility = useMemo(() => {
    const isMgmt = hasMinRole(effectiveRole, "program_manager");
    const hasPrograms = (data?.summary?.programs || 0) > 0;
    const hasProjects = (data?.summary?.projects || 0) > 0;
    const hasTasks = (data?.summary?.tasks?.open || 0) > 0;
    const hasBlockers = (data?.summary?.blockers?.active || 0) > 0;
    const hasOverdue = (data?.attention?.overdueTasks?.length || 0) > 0;
    const hasCritical = (data?.attention?.criticalBlockers?.length || 0) > 0;
    const hasDueToday = (data?.attention?.dueToday?.length || 0) > 0;
    const hasAssignments = (data?.assignments?.length || 0) > 0;
    const hasActivity = (data?.activity?.length || 0) > 0;

    return {
      // Summary cards
      showProgramsCard: isMgmt && hasPrograms,
      showProjectsCard: hasProjects,
      showTasksCard: hasTasks,
      showBlockersCard: hasBlockers,
      showOverdueCard: hasOverdue,
      showCriticalCard: hasCritical,
      // Attention section
      showAttention: hasOverdue || hasCritical || hasDueToday,
      // Activity
      showActivity: hasActivity,
      // Quick access panels
      showQuickPrograms: isMgmt && hasPrograms,
      showQuickProjects: hasProjects,
      showQuickTasks: hasTasks,
      showQuickBlockers: hasBlockers,
      // Assignments section
      showAssignments: hasAssignments,
    };
  }, [effectiveRole, data]);

  // Ticket 1.6: refetch calendar when tab becomes visible again
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible" && user) {
        refreshDashboard();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [user, refreshDashboard]);

  // Ticket 1.6: expose refresh callback for auto calendar sync
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.__refreshDashboard = refreshDashboard;
    }
    return () => {
      if (typeof window !== "undefined") delete window.__refreshDashboard;
    };
  }, [refreshDashboard]);

  // ── Calendar navigation ──
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
  const handleToday = () => {
    setCalMonth(now.getMonth());
    setCalYear(now.getFullYear());
  };

  // ── Assignment actions ──
  const handleAssignmentAction = async (taskId, action) => {
    setActionLoading(taskId);
    try {
      await fetch("/api/tasks/assignment-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task_id: taskId,
          user_id: user.cid || user.id,
          user_name: user.name,
          action,
        }),
      });
      refreshDashboard();
    } catch (error) {
      console.error(error);
    } finally {
      setActionLoading(null);
    }
  };

  // ── Blocker resolve ──
  const handleResolveBlocker = async (blockerId) => {
    setResolvingBlocker(blockerId);
    try {
      await fetch("/api/blockers", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: blockerId,
          status: "resolved",
          resolved_by: user.cid || user.id,
        }),
      });
      refreshDashboard();
    } catch (error) {
      console.error(error);
    } finally {
      setResolvingBlocker(null);
    }
  };

  // ── Calendar computed ──
  const calendarDays = useMemo(
    () => getCalendarDays(calYear, calMonth),
    [calYear, calMonth],
  );

  // ── The routes the extracted cards ask for ──
  const isSuperAdmin = user?.role === "super_admin";
  const openRoleAwareReport = () =>
    router.push(isSuperAdmin ? "/admin/op-report" : "/staff/op-report");
  const openStaffReport = () => router.push("/staff/op-report");
  const openTasksOrReport = () =>
    router.push(
      effectiveRole === "super_admin" ? "/admin/tasks" : "/staff/op-report",
    );
  const openProjectsOrListing = () =>
    router.push(
      effectiveRole === "super_admin" ? "/admin/projects" : "/staff/projects",
    );
  const openProgram = (program) => router.push(`/pm/programs/${program.id}`);
  const openFacilitatorProgram = (program) =>
    router.push(`/facilitator/program/${program.id}`);
  const openProject = (project) =>
    router.push(`/admin/projects/${project.id}`);
  const openProjectFromEvent = (projectId) => {
    setSelectedEvent(null);
    router.push(`/admin/projects/${projectId}`);
  };
  const openAllPrograms = () => router.push("/pm/programs");
  const openAllActivity = () => router.push("/admin/op-reports");

  // A task on the month grid is read first, so the drawer shows the whole task;
  // anything else opens the event drawer.
  const handleMonthEventClick = (event) => {
    if (event.source === "task" && event.id) {
      const taskId = String(event.id).startsWith("task-")
        ? String(event.id).split("-")[1]
        : event.id;
      fetch(`/api/tasks?id=${taskId}`)
        .then((response) => response.json())
        .then((payload) => {
          if (payload.success && payload.tasks?.[0])
            setSelectedTask(payload.tasks[0]);
        });
    } else {
      setSelectedEvent(event);
    }
  };

  // ── Loading state ──
  if (loading) {
    return (
      <>
        <div className="min-h-[60vh] flex items-center justify-center">
          <div
            className="w-10 h-10 border-4 border-t-[var(--brand-orange)] rounded-full animate-spin"
            style={{
              borderColor: "rgba(255,102,0,0.1)",
              borderTopColor: "var(--brand-orange)",
            }}
          />
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="card text-center space-y-3 p-8">
            <AlertTriangle className="w-10 h-10 text-rose-500 mx-auto" />
            <p className="text-sm font-bold text-rose-400">{error}</p>
            <button
              onClick={refreshDashboard}
              className="px-6 py-2 bg-[var(--brand-orange)] text-black rounded-lg text-[10px] font-bold uppercase tracking-wide"
            >
              {t("common.retry")}
            </button>
          </div>
        </div>
      </>
    );
  }

  // ── Derived data ──
  const summary = data?.summary || {};
  const attention = data?.attention || {};
  const events = data?.calendar?.events || [];
  // "<task id>:<date>" for every day a task appears on, to tell the in-between
  // days of a multi-day task from its first day.
  const taskDays = new Set(
    events
      .filter((event) => event.source === "task")
      .map((event) => `${event.related_id}:${event.date}`),
  );
  const quickAccess = data?.quickAccess || {};
  const assignments = data?.assignments || [];
  const activity = data?.activity || [];

  // ─── RENDER ──────────────────────────────────────────────────────────────

  return (
    <>
      <div className="space-y-8 pb-20 text-left">
        {/* ═══════ HEADER ═══════ */}
        <DashboardHeader t={t} userName={user?.name} role={effectiveRole} />

        {/* ═══════ SECTION 1: UNIFIED CALENDAR ═══════ */}
        <CalendarPanel
          t={t}
          lang={lang}
          now={now}
          calMonth={calMonth}
          calYear={calYear}
          calView={calView}
          onViewChange={setCalView}
          onPrev={handlePrevMonth}
          onNext={handleNextMonth}
          onToday={handleToday}
          calendarDays={calendarDays}
          events={events}
          taskDays={taskDays}
          onSelectEvent={setSelectedEvent}
          onMonthEventClick={handleMonthEventClick}
        />

        {/* ═══════ ASSIGNED TO ME (always shown above sections if has assignments) ═══════ */}
        {visibility.showAssignments && (
          <AssignmentsSection
            t={t}
            lang={lang}
            assignments={assignments}
            actionLoading={actionLoading}
            onAction={handleAssignmentAction}
            onViewAll={openTasksOrReport}
          />
        )}

        {/* ═══════ ATTENTION REQUIRED ═══════ */}
        {visibility.showAttention && (
          <AttentionSection
            t={t}
            lang={lang}
            attention={attention}
            resolvingBlocker={resolvingBlocker}
            onOpenRoleAwareReport={openRoleAwareReport}
            onOpenStaffReport={openStaffReport}
            onResolveBlocker={handleResolveBlocker}
          />
        )}

        {/* ═══════ CONSOLIDATED WORKSPACE ═══════ */}
        <WorkspaceGrid
          t={t}
          lang={lang}
          effectiveRole={effectiveRole}
          userId={user?.cid || user?.id}
          summary={summary}
          data={data}
          quickAccess={quickAccess}
          visibility={visibility}
          completionIndexById={completionIndexById}
          facilitatorPrograms={facilitatorPrograms}
          fetching={fetching}
          weekDateRange={weekDateRange}
          events={events}
          activity={activity}
          resolvingBlocker={resolvingBlocker}
          onOpenRoleAwareReport={openRoleAwareReport}
          onOpenStaffReport={openStaffReport}
          onOpenProgram={openProgram}
          onOpenFacilitatorProgram={openFacilitatorProgram}
          onOpenProject={openProject}
          onResolveBlocker={handleResolveBlocker}
          onSelectEvent={setSelectedEvent}
          onViewAllPrograms={openAllPrograms}
          onViewAllActivity={openAllActivity}
        />
        {/* ═══════ EMPTY STATE (when nothing is visible) ═══════ */}
        {!visibility.showAssignments &&
          !visibility.showAttention &&
          !visibility.showActivity &&
          !visibility.showQuickPrograms &&
          !visibility.showQuickTasks &&
          !visibility.showQuickBlockers &&
          !fetching && (
            <EmptyState
              onCreateTask={openTasksOrReport}
              onViewProjects={openProjectsOrListing}
            />
          )}
      </div>

      {/* ═══════ EVENT DETAIL DRAWER ═══════ */}
      {selectedEvent && (
        <EventDetailDrawer
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onOpenProject={openProjectFromEvent}
        />
      )}

      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
        />
      )}
    </>
  );
}
