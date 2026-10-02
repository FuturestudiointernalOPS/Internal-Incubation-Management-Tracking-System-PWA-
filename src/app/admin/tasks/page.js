"use client";

import React, { useMemo } from "react";
import { useRouter } from "next/navigation";

import AdminTasksHeader from "@/components/tasks/admin-tasks/AdminTasksHeader";
import TaskStatsRow from "@/components/tasks/admin-tasks/TaskStatsRow";
import TaskFilters from "@/components/tasks/admin-tasks/TaskFilters";
import TasksTable from "@/components/tasks/admin-tasks/TasksTable";
import TaskDetailModal from "@/components/tasks/admin-tasks/TaskDetailModal";
import useAdminTaskFilters from "@/components/tasks/admin-tasks/hooks/useAdminTaskFilters";
import useAdminTasksData from "@/components/tasks/admin-tasks/hooks/useAdminTasksData";
import useAdminTaskDetail from "@/components/tasks/admin-tasks/hooks/useAdminTaskDetail";
import useAdminTaskWrites from "@/components/tasks/admin-tasks/hooks/useAdminTaskWrites";
import {
  taskOwners,
  projectNameMap,
  filterTasks,
  taskStats,
} from "@/components/tasks/admin-tasks/derive";
import { useI18n } from "@/lib/i18n";

/**
 * SUPER ADMIN TASKS DASHBOARD
 *
 * Full visibility into all tasks across the organization.
 * View, filter, sort, and manage tasks.
 *
 * Columns: Task, Owner, Project, Status, Created, Updated, Carry-Over Count, Blockers
 * Filters: User, Status
 * Sorting: Newest, Oldest, Most Carried Over, Most Recently Updated
 *
 * Statuses: pending, in_progress, blocked, completed, carried_over
 *
 * The page is the wiring only: what is narrowed by, what is read, what is open,
 * and which part each of those renders. The parts are in
 * `src/components/tasks/admin-tasks/`.
 */
export default function AdminTasks() {
  const router = useRouter();
  const { t } = useI18n();

  const filters = useAdminTaskFilters(t);
  const detail = useAdminTaskDetail();
  const {
    tasks,
    projects,
    allUsers,
    comments,
    loading,
    refreshTasks,
    refreshProjects,
    refreshComments,
  } = useAdminTasksData(filters.sortBy, detail.viewingTaskId);
  const writes = useAdminTaskWrites({
    t,
    refreshTasks,
    refreshProjects,
    refreshComments,
  });

  const users = useMemo(() => taskOwners(tasks), [tasks]);
  const projectMap = useMemo(() => projectNameMap(projects), [projects]);
  const filteredTasks = useMemo(
    () =>
      filterTasks({
        tasks,
        search: filters.search,
        filterUser: filters.filterUser,
        filterStatus: filters.filterStatus,
        filterProject: filters.filterProject,
      }),
    [
      tasks,
      filters.search,
      filters.filterUser,
      filters.filterStatus,
      filters.filterProject,
    ],
  );
  const stats = useMemo(() => taskStats(tasks), [tasks]);

  return (
    <>
      <div className="space-y-8 pb-20 text-left">
        <AdminTasksHeader
          taskCount={tasks.length}
          onBack={() => router.push("/admin")}
          onRefresh={() => {
            refreshTasks();
            refreshProjects();
          }}
          t={t}
        />

        <TaskStatsRow stats={stats} t={t} />

        <TaskFilters
          search={filters.search}
          setSearch={filters.setSearch}
          users={users}
          filterUser={filters.filterUser}
          setFilterUser={filters.setFilterUser}
          filterStatus={filters.filterStatus}
          setFilterStatus={filters.setFilterStatus}
          filterProject={filters.filterProject}
          setFilterProject={filters.setFilterProject}
          projects={projects}
          sortBy={filters.sortBy}
          setSortBy={filters.setSortBy}
          sortOptions={filters.sortOptions}
          t={t}
        />

        <TasksTable
          loading={loading}
          tasks={filteredTasks}
          projectMap={projectMap}
          statusUpdating={writes.statusUpdating}
          onStatusUpdate={writes.updateStatus}
          onOpenTask={detail.openTask}
          t={t}
        />

        {detail.viewingTask && (
          <TaskDetailModal
            task={detail.viewingTask}
            projectMap={projectMap}
            allUsers={allUsers}
            comments={comments}
            assignValue={detail.viewingTask?.assigned_to || ""}
            assigningUser={writes.assigningUser}
            statusUpdating={writes.statusUpdating}
            commentInput={writes.commentInput}
            setCommentInput={writes.setCommentInput}
            onAssign={(taskId, assignedTo) =>
              writes.assignTask(taskId, assignedTo, (assignedToValue) =>
                detail.setViewingTask((previousTask) => ({
                  ...previousTask,
                  assigned_to: assignedToValue,
                })),
              )
            }
            onStatusUpdate={writes.updateStatus}
            onAddComment={writes.addComment}
            onClose={detail.closeTask}
            t={t}
          />
        )}
      </div>
    </>
  );
}