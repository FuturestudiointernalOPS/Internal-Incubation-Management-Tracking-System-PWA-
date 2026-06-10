"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  LayoutGrid,
  ListTodo,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Target,
  Search,
  Briefcase,
  User,
  Plus,
  X,
  ChevronDown,
  ChevronRight,
  Shield,
} from "lucide-react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { useI18n } from "@/lib/i18n";

/**
 * INTERNAL OPS — PROJECT KANBAN BOARD
 *
 * Columns are project-level statuses. Each card is a PROJECT, not a task.
 * Uncategorized column shows non-project tasks (internal office tasks).
 *
 * Columns: Planning | Pending Approval | In Progress | Blocked | Carried Over | Completed
 */

const KANBAN_COLUMNS = [
  {
    id: "planning",
    label: "Planning",
    icon: Target,
    color: "text-slate-400",
    bg: "bg-slate-500/10",
  },
  {
    id: "pending_approval",
    label: "Pending Approval",
    icon: Clock,
    color: "text-amber-400",
    bg: "bg-amber-500/10",
  },
  {
    id: "in_progress",
    label: "In Progress",
    icon: ListTodo,
    color: "text-blue-400",
    bg: "bg-blue-500/10",
  },
  {
    id: "blocked",
    label: "Blocked",
    icon: AlertTriangle,
    color: "text-rose-400",
    bg: "bg-rose-500/10",
  },
  {
    id: "carried_over",
    label: "Carried Over",
    icon: ChevronRight,
    color: "text-purple-400",
    bg: "bg-purple-500/10",
  },
  {
    id: "completed",
    label: "Completed",
    icon: CheckCircle2,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
  },
];

function deriveKanbanStatus(project) {
  const stats = project.taskStats || {
    total: 0,
    completed: 0,
    in_progress: 0,
    blocked: 0,
    carried_over: 0,
    pending: 0,
  };
  const blockerStats = project.blockerStats || { active: 0 };

  if (stats.total === 0) return "planning";
  if (blockerStats.active > 0) return "blocked";
  if (stats.carried_over > 0) return "carried_over";
  if (stats.completed === stats.total && stats.total > 0) return "completed";
  if (stats.in_progress > 0 || stats.pending > 0) return "in_progress";
  return "planning";
}

export default function ProjectKanbanBoard() {
  const router = useRouter();
  const { t } = useI18n();
  const [projects, setProjects] = useState([]);
  const [uncategorizedTasks, setUncategorizedTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expandedProject, setExpandedProject] = useState(null);
  const [projectTasks, setProjectTasks] = useState({});
  const [user, setUser] = useState(null);

  useEffect(() => {
    try {
      const u = JSON.parse(localStorage.getItem("user") || "{}");
      setUser(u);
    } catch (e) {}
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [projRes, taskRes] = await Promise.all([
        fetch("/api/admin/projects"),
        fetch("/api/tasks?brief=true&limit=500"),
      ]);

      const projData = await projRes.json();
      const taskData = await taskRes.json();

      if (projData.success) setProjects(projData.projects || []);
      if (taskData.success) {
        const noProject = (taskData.tasks || []).filter(
          (t) => !t.project_id || t.project_id === null || t.project_id === "",
        );
        setUncategorizedTasks(noProject);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Map task statuses to kanban column IDs
  function taskStatusToColumn(taskStatus) {
    const map = {
      pending: "pending_approval",
      pending_project_approval: "pending_approval",
      in_progress: "in_progress",
      blocked: "blocked",
      carried_over: "carried_over",
      completed: "completed",
    };
    return map[taskStatus] || "planning";
  }

  // Group projects + uncategorized tasks by kanban status
  const columns = useMemo(() => {
    const grouped = {};
    KANBAN_COLUMNS.forEach(
      (col) => (grouped[col.id] = { projects: [], uncategorized: [] }),
    );

    const filtered = projects.filter((p) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        (p.name || "").toLowerCase().includes(q) ||
        (p.type || "").toLowerCase().includes(q)
      );
    });

    filtered.forEach((p) => {
      const status = deriveKanbanStatus(p);
      if (grouped[status]) grouped[status].projects.push(p);
    });

    // Distribute uncategorized tasks into their matching columns by task status
    uncategorizedTasks.forEach((task) => {
      const colId = taskStatusToColumn(task.status);
      if (grouped[colId]) grouped[colId].uncategorized.push(task);
    });

    return KANBAN_COLUMNS.map((col) => ({
      ...col,
      projects: grouped[col.id]?.projects || [],
      uncategorized: grouped[col.id]?.uncategorized || [],
    }));
  }, [projects, uncategorizedTasks, search]);

  const fetchProjectTasks = useCallback(
    async (projectId) => {
      if (projectTasks[projectId]) return;
      try {
        const res = await fetch(`/api/tasks?project_id=${projectId}&limit=200`);
        const data = await res.json();
        if (data.success) {
          setProjectTasks((prev) => ({
            ...prev,
            [projectId]: data.tasks || [],
          }));
        }
      } catch (e) {
        console.error(e);
      }
    },
    [projectTasks],
  );

  const handleProjectClick = (projectId) => {
    if (expandedProject === projectId) {
      setExpandedProject(null);
    } else {
      setExpandedProject(projectId);
      fetchProjectTasks(projectId);
    }
  };

  if (loading) {
    return (
      <DashboardLayout role="super_admin">
        <div className="p-6 space-y-6">
          <div className="h-8 w-48 bg-tertiary rounded animate-pulse" />
          <div className="grid grid-cols-6 gap-4">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="h-96 bg-tertiary rounded-xl animate-pulse"
              />
            ))}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="super_admin">
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-lg font-black uppercase tracking-tight text-[var(--text-primary)]">
              Internal Ops
            </h1>
            <p className="text-[10px] text-[var(--text-secondary)] mt-1">
              Project-level operations board — {projects.length} projects,{" "}
              {uncategorizedTasks.length} internal tasks
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-secondary)]" />
              <input
                type="text"
                placeholder="Search projects..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-56 pl-9 pr-4 py-2 rounded-lg bg-tertiary border border-[var(--border-primary)] text-[11px] font-medium text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] outline-none focus:border-[var(--brand-orange)] transition-all"
              />
            </div>
            <button
              onClick={() => router.push("/admin/projects?action=create")}
              className="flex items-center gap-2 px-4 py-2 bg-[var(--brand-orange)] text-black rounded-lg text-[9px] font-black uppercase tracking-widest hover:brightness-110 transition-all"
            >
              <Plus className="w-3.5 h-3.5" /> New Project
            </button>
          </div>
        </div>

        {/* Kanban Columns */}
        <div className="flex gap-4 overflow-x-auto pb-6 min-h-[70vh]">
          {columns.map((col) => (
            <div
              key={col.id}
              className="flex-shrink-0 w-72 rounded-xl bg-tertiary/30 border border-[var(--border-primary)] flex flex-col"
            >
              {/* Column Header */}
              <div
                className={`flex items-center justify-between px-4 py-3 border-b border-[var(--border-primary)] ${col.bg} rounded-t-xl`}
              >
                <div className="flex items-center gap-2">
                  <col.icon className={`w-4 h-4 ${col.color}`} />
                  <span
                    className={`text-[10px] font-black uppercase tracking-wider ${col.color}`}
                  >
                    {col.label}
                  </span>
                </div>
                <span className={`text-[10px] font-black ${col.color}`}>
                  {col.projects.length + col.uncategorized.length}
                </span>
              </div>

              {/* Column Body */}
              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {col.projects.length === 0 && col.uncategorized.length === 0 ? (
                  <p className="text-[10px] text-[var(--text-secondary)] italic text-center py-8">
                    No items
                  </p>
                ) : (
                  <>
                    {/* Project cards */}
                    {col.projects.map((project) => (
                      <div key={project.id}>
                        <button
                          onClick={() => handleProjectClick(project.id)}
                          className={`w-full text-left p-3 rounded-lg border transition-all hover:border-[var(--brand-orange)]/50 ${
                            expandedProject === project.id
                              ? "border-[var(--brand-orange)] bg-[var(--brand-orange)]/5"
                              : "border-[var(--border-primary)] bg-tertiary"
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="min-w-0 flex-1">
                              <p className="text-[11px] font-bold text-[var(--text-primary)] truncate">
                                {project.name}
                              </p>
                              <p className="text-[9px] text-[var(--text-secondary)] mt-0.5 truncate">
                                {project.type || "Project"}
                              </p>
                            </div>
                          </div>

                          {/* Mini task stats */}
                          <div className="flex items-center gap-3 mt-2">
                            <span className="text-[8px] font-bold text-blue-400">
                              {(project.taskStats?.in_progress || 0) +
                                (project.taskStats?.pending || 0)}{" "}
                              open
                            </span>
                            {project.blockerStats?.active > 0 && (
                              <span className="text-[8px] font-bold text-rose-400">
                                {project.blockerStats.active} blocked
                              </span>
                            )}
                            <span className="text-[8px] font-bold text-emerald-400">
                              {project.completionRate || 0}% done
                            </span>
                          </div>

                          {/* Progress bar */}
                          <div className="mt-2 h-1 rounded-full bg-tertiary overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                project.completionRate === 100
                                  ? "bg-emerald-500"
                                  : project.blockerStats?.active > 0
                                    ? "bg-rose-500"
                                    : "bg-[var(--brand-orange)]"
                              }`}
                              style={{
                                width: `${project.completionRate || 0}%`,
                              }}
                            />
                          </div>
                        </button>

                        {/* Expanded project tasks */}
                        {expandedProject === project.id && (
                          <div className="mt-2 ml-2 space-y-1.5 border-l-2 border-[var(--brand-orange)]/30 pl-3">
                            {(projectTasks[project.id] || []).length === 0 ? (
                              <p className="text-[9px] text-[var(--text-secondary)] italic py-2">
                                Loading tasks...
                              </p>
                            ) : (
                              (projectTasks[project.id] || []).map((task) => (
                                <div
                                  key={task.id}
                                  className="p-2 rounded-md bg-tertiary/50 border border-[var(--border-primary)] flex items-center justify-between"
                                >
                                  <div className="min-w-0 flex-1">
                                    <p className="text-[10px] font-semibold text-[var(--text-primary)] truncate">
                                      {task.title}
                                    </p>
                                    <p className="text-[8px] text-[var(--text-secondary)]">
                                      {task.user_name || "Unassigned"}
                                    </p>
                                  </div>
                                  <span
                                    className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${
                                      task.status === "completed"
                                        ? "text-emerald-400 bg-emerald-500/10"
                                        : task.status === "blocked"
                                          ? "text-rose-400 bg-rose-500/10"
                                          : task.status === "carried_over"
                                            ? "text-purple-400 bg-purple-500/10"
                                            : task.status === "in_progress"
                                              ? "text-blue-400 bg-blue-500/10"
                                              : "text-slate-400 bg-slate-500/10"
                                    }`}
                                  >
                                    {task.status?.replace(/_/g, " ")}
                                  </span>
                                </div>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    ))}

                    {/* Separator between projects and uncategorized tasks */}
                    {col.projects.length > 0 &&
                      col.uncategorized.length > 0 && (
                        <div className="flex items-center gap-2 py-1">
                          <div className="flex-1 h-px bg-[var(--border-primary)]" />
                          <span className="text-[7px] font-bold text-slate-500 uppercase tracking-widest">
                            Internal Tasks
                          </span>
                          <div className="flex-1 h-px bg-[var(--border-primary)]" />
                        </div>
                      )}

                    {/* Uncategorized task cards (internal office tasks) */}
                    {col.uncategorized.map((task) => (
                      <div
                        key={task.id}
                        className="p-2.5 rounded-lg border border-dashed border-[var(--border-primary)] bg-tertiary/50"
                      >
                        <div className="flex items-start justify-between">
                          <div className="min-w-0 flex-1">
                            <p className="text-[10px] font-bold text-[var(--text-primary)]">
                              {task.title}
                            </p>
                            <p className="text-[8px] text-[var(--text-secondary)] mt-0.5">
                              {task.user_name || "Unassigned"}
                            </p>
                          </div>
                          <span className="text-[7px] font-bold text-slate-500 uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-500/10 ml-2 whitespace-nowrap">
                            Internal
                          </span>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="mt-4 flex items-center gap-6 text-[9px] text-[var(--text-secondary)] font-medium">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[var(--brand-orange)]" />
            Click a project to expand its tasks
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            Only task creators can change status
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-slate-500" />
            Only blocker creators can resolve blockers
          </span>
        </div>
      </div>
    </DashboardLayout>
  );
}
