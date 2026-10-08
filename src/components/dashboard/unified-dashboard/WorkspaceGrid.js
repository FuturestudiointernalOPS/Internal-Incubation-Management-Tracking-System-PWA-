"use client";

import OperationsSection from "./OperationsSection";
import StrategicKpisCard from "./StrategicKpisCard";
import MyProgramsCard from "./MyProgramsCard";
import FacilitatorProgramsCard from "./FacilitatorProgramsCard";
import MyTasksCard from "./MyTasksCard";
import RecentActivityCard from "./RecentActivityCard";
import QuickStatsCard from "./QuickStatsCard";
import MyProjectsCard from "./MyProjectsCard";
import ActiveBlockersCard from "./ActiveBlockersCard";
import UpcomingEventsCard from "./UpcomingEventsCard";

// ─── CONSOLIDATED WORKSPACE ────────────────────────────────────────────────
// The left operations column and the right sidebar widgets. The screen owns
// the data and the routes; this block renders only what it is handed.

export default function WorkspaceGrid({
  t,
  lang,
  effectiveRole,
  userId,
  summary,
  data,
  quickAccess,
  visibility,
  completionIndexById,
  facilitatorPrograms,
  fetching,
  weekDateRange,
  events,
  activity,
  resolvingBlocker,
  onOpenRoleAwareReport,
  onOpenStaffReport,
  onOpenProgram,
  onOpenFacilitatorProgram,
  onOpenProject,
  onResolveBlocker,
  onSelectEvent,
  onViewAllPrograms,
  onViewAllActivity,
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* ===== LEFT COLUMN (2/3) ===== */}
      <div className="lg:col-span-2 space-y-6">
        {/* ═══════ OPERATIONS (staff / super_admin) ═══════ */}
        {(effectiveRole === "staff" ||
          effectiveRole === "super_admin") && (
          <OperationsSection
            userId={userId}
            summary={summary}
          />
        )}

        {/* STRATEGIC KPIs */}
        {visibility.showQuickPrograms &&
          (data?.kpis || []).length > 0 && (
            <StrategicKpisCard
              kpis={data.kpis}
              programs={quickAccess.programs}
            />
          )}

        {/* My Programs — Rich Cards */}
        {visibility.showQuickPrograms && (
          <MyProgramsCard
            t={t}
            programs={quickAccess.programs}
            kpis={data?.kpis}
            completionIndexById={completionIndexById}
            fetching={fetching}
            onViewAll={onViewAllPrograms}
            onOpenProgram={onOpenProgram}
          />
        )}

        {/* My Facilitator Programs — program-scoped assignments for any role */}
        {facilitatorPrograms.length > 0 && (
          <FacilitatorProgramsCard
            t={t}
            programs={facilitatorPrograms}
            onOpenProgram={onOpenFacilitatorProgram}
          />
        )}

        {/* My Tasks — Compact List */}
        {visibility.showQuickTasks && (
          <MyTasksCard
            t={t}
            lang={lang}
            tasks={quickAccess.tasks}
            fetching={fetching}
            onOpenReport={onOpenRoleAwareReport}
            onViewAll={onOpenStaffReport}
          />
        )}

        {/* Recent Activity */}
        {visibility.showActivity && (
          <RecentActivityCard
            t={t}
            lang={lang}
            activity={activity}
            onViewAll={onViewAllActivity}
          />
        )}
      </div>

      {/* ===== RIGHT COLUMN (1/3) — SIDEBAR ===== */}
      <div className="space-y-6">
        {/* Quick Stats — Compact Inline Badges */}
        <QuickStatsCard t={t} summary={summary} />

        {/* My Projects — With Role Status */}
        {visibility.showQuickProjects && (
          <MyProjectsCard
            t={t}
            projects={quickAccess.projects}
            onOpenProject={onOpenProject}
          />
        )}

        {/* Active Blockers — With Inline Resolve */}
        {visibility.showQuickBlockers && (
          <ActiveBlockersCard
            t={t}
            blockers={quickAccess.blockers}
            fetching={fetching}
            resolvingBlocker={resolvingBlocker}
            onResolveBlocker={onResolveBlocker}
          />
        )}

        {/* Upcoming Events — From Calendar */}
        {events.length > 0 && (
          <UpcomingEventsCard
            t={t}
            lang={lang}
            events={events}
            weekDateRange={weekDateRange}
            onSelectEvent={onSelectEvent}
          />
        )}
      </div>
    </div>
  );
}
