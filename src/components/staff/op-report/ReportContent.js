/**
 * The report itself: the stand-up view, the retro view, or the week summary.
 *
 * Cut out of src/app/staff/op-report/page.js as-is: the page keeps every
 * state value and every write, and hands this block what it reads through
 * `ctx`. The names it needs are listed in the signature — nothing else.
 */

"use client";
import RetroHistoryTable from "@/components/staff/op-report/RetroHistoryTable";
import StandupFormHeader from "@/components/staff/op-report/StandupFormHeader";
import StandupHistoryTable from "@/components/staff/op-report/StandupHistoryTable";
import SummaryAssignmentsCard from "@/components/staff/op-report/SummaryAssignmentsCard";
import SummaryBlockersCard from "@/components/staff/op-report/SummaryBlockersCard";
import SummaryCarryoverCard from "@/components/staff/op-report/SummaryCarryoverCard";
import SummaryCollaborationCard from "@/components/staff/op-report/SummaryCollaborationCard";
import SummaryOwnerCard from "@/components/staff/op-report/SummaryOwnerCard";
import SummaryProjectsCard from "@/components/staff/op-report/SummaryProjectsCard";
import SummaryTasksTable from "@/components/staff/op-report/SummaryTasksTable";
import SummaryTimelineCard from "@/components/staff/op-report/SummaryTimelineCard";
import SummaryWeekCard from "@/components/staff/op-report/SummaryWeekCard";

export default function ReportContent({ ctx }) {
  const {
    assignedProjects,
    expandedTasks,
    expandedWeek,
    handleChangeRetroTaskStatus,
    handleOpenBlockerForTask,
    handleOpenHistoricalWeek,
    handleOpenNewStandup,
    handleOpenStandupModal,
    handleOpenTaskCreation,
    handleSetTaskReason,
    handleToggleProject,
    handleToggleRetroSubtask,
    handleToggleRetroSubtasks,
    handleToggleRetroTask,
    handleToggleRetroWeek,
    handleToggleStandupWeek,
    history,
    lang,
    now,
    reportType,
    setTaskDetail,
    summaryBlockers,
    summaryCollapsed,
    summaryLoading,
    summaryProjectExpanded,
    summaryProjects,
    summaryTasks,
    t,
    taskReasons,
    tasks,
    toggleSummaryCollapsed,
    updatingTasks,
    user,
    weekInfo,
  } = ctx;

  return (
    <>
        <div className="w-full">
          {/* REPORT FORM */}
          <div className="space-y-8">
            {reportType === "standup" ? (
              <div className="space-y-6">
                {/* Header */}
                <StandupFormHeader
                  history={history}
                  onOpenNewStandup={handleOpenNewStandup}
                  weekInfo={weekInfo}
                />

                {/* Standups Table */}
                <StandupHistoryTable
                  history={history}
                  assignedProjects={assignedProjects}
                  expandedWeek={expandedWeek}
                  onOpenHistoricalWeek={handleOpenHistoricalWeek}
                  onOpenStandup={handleOpenStandupModal}
                  onOpenTask={setTaskDetail}
                  onOpenTaskCreation={handleOpenTaskCreation}
                  onToggleStandupWeek={handleToggleStandupWeek}
                  tasks={tasks}
                />
              </div>
            ) : reportType === "retro" ? (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-bold text-[var(--text-primary)]">
                    {t("reports.fridayRetro")}
                  </h2>
                  <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                    {t("staff.opReport.reviewCompletedWork")}
                  </p>
                </div>

                {/* Week history table */}
                <RetroHistoryTable
                  history={history}
                  assignedProjects={assignedProjects}
                  expandedTasks={expandedTasks}
                  expandedWeek={expandedWeek}
                  onAddBlocker={handleOpenBlockerForTask}
                  onChangeTaskStatus={handleChangeRetroTaskStatus}
                  onToggleRetroWeek={handleToggleRetroWeek}
                  onToggleSubtask={handleToggleRetroSubtask}
                  onToggleSubtasks={handleToggleRetroSubtasks}
                  onToggleTask={handleToggleRetroTask}
                  tasks={tasks}
                  updatingTasks={updatingTasks}
                />
              </div>
            ) : (
              <div className="space-y-8">
                {summaryLoading ? (
                  <div className="flex items-center justify-center py-20">
                    <div className="w-5 h-5 border-2 border-[var(--brand-orange)] border-t-transparent rounded-full animate-spin" />
                    <span className="ml-3 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                      {t("common.loading")}
                    </span>
                  </div>
                ) : (
                  <>
                    {/* ═══════════════════════════════════ */}
                    {/* PHASE 1 — WEEKLY OVERVIEW CARD     */}
                    {/* ═══════════════════════════════════ */}
                    <SummaryWeekCard
                      lang={lang}
                      summaryBlockers={summaryBlockers}
                      summaryTasks={summaryTasks}
                      weekInfo={weekInfo}
                    />

                    {/* ═══════════════════════════════════ */}
                    {/* PHASE 2 — TASKS WORKED ON THIS WEEK */}
                    {/* ═══════════════════════════════════ */}
                    <SummaryTasksTable
                      summaryProjects={summaryProjects}
                      summaryTasks={summaryTasks}
                    />

                    {/* ═══════════════════════════════════ */}
                    {/* PHASE 3 — PROJECT CONTRIBUTIONS     */}
                    {/* ═══════════════════════════════════ */}
                    <SummaryProjectsCard
                      onToggleProject={handleToggleProject}
                      summaryProjectExpanded={summaryProjectExpanded}
                      summaryProjects={summaryProjects}
                      summaryTasks={summaryTasks}
                    />

                    {/* ═══════════════════════════════════ */}
                    {/* PHASE 4 — ASSIGNMENT HISTORY       */}
                    {/* ═══════════════════════════════════ */}
                    <SummaryAssignmentsCard
                      summaryTasks={summaryTasks}
                      user={user}
                    />

                    {/* ═══════════════════════════════════ */}
                    {/* PHASE 5 — BLOCKERS SUMMARY         */}
                    {/* ═══════════════════════════════════ */}
                    <SummaryBlockersCard
                      now={now}
                      summaryBlockers={summaryBlockers}
                      summaryTasks={summaryTasks}
                    />

                    {/* ═══════════════════════════════════ */}
                    {/* PHASE 6 — COLLABORATION OVERVIEW   */}
                    {/* ═══════════════════════════════════ */}
                    <SummaryCollaborationCard
                      summaryCollapsed={summaryCollapsed}
                      summaryProjects={summaryProjects}
                      summaryTasks={summaryTasks}
                      toggleSummaryCollapsed={toggleSummaryCollapsed}
                      user={user}
                    />

                    {/* ═══════════════════════════════════ */}
                    {/* PHASE 7 — CARRY-OVER INTELLIGENCE  */}
                    {/* ═══════════════════════════════════ */}
                    <SummaryCarryoverCard
                      onSetTaskReason={handleSetTaskReason}
                      summaryProjects={summaryProjects}
                      summaryTasks={summaryTasks}
                      taskReasons={taskReasons}
                    />

                    {/* ═══════════════════════════════════ */}
                    {/* PHASE 8 — PROJECT OWNER SUMMARY    */}
                    {/* ═══════════════════════════════════ */}
                    <SummaryOwnerCard
                      summaryProjects={summaryProjects}
                      summaryTasks={summaryTasks}
                    />

                    {/* ═══════════════════════════════════ */}
                    {/* PHASE 9 — WEEKLY ACTIVITY TIMELINE */}
                    {/* ═══════════════════════════════════ */}
                    <SummaryTimelineCard
                      lang={lang}
                      summaryBlockers={summaryBlockers}
                      summaryTasks={summaryTasks}
                    />
                  </>
                )}
              </div>
            )}
          </div>
        </div>
    </>
  );
}
