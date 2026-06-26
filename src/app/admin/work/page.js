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
  Trash2,
  Folder,
  FolderOpen,
} from "lucide-react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { useI18n } from "@/lib/i18n";

/**
 * INTERNAL OPS — HIERARCHICAL KANBAN BOARD
 *
 * Columns: Planning | Pending Approval | In Progress | Blocked | Completed
 *
 * Each column groups tasks by:
 *   Program → Project → Tasks
 *   Or: Project → Tasks (if no program)
 *   Uncategorized tasks at bottom
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
    id: "completed",
    label: "Completed",
    icon: CheckCircle2,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
  },
];

const COLUMN_TO_STATUS = {
  planning: "pending",
  pending_approval: "pending_project_approval",
  in_progress: "in_progress",
  blocked: "blocked",
  completed: "completed",
};

export default function ProjectKanbanBoard() {
  const router = useRouter();
  const { t } = useI18n();

  // ── Data ──
  const [programs, setPrograms] = useState([]);
  const [projects, setProjects] = useState([]);
  const [allTasks, setAllTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [user, setUser] = useState(null);
  const [expandedPrograms, setExpandedPrograms] = useState({});
  const [expandedProjects, setExpandedProjects] = useState({});

  // ── Drag state ──
  const [dragOverCol, setDragOverCol] = useState(null);

  useEffect(() => {
    try {
      const u = JSON.parse(localStorage.getItem("user") || "{}");
      setUser(u);
    } catch (e) {}
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [progRes, projRes, taskRes] = await Promise.all([
        fetch("/api/programs"),
        fetch("/api/admin/projects"),
        fetch("/api/tasks?brief=true&limit=500"),
      ]);

      const progData = await progRes.json();
      const projData = await projRes.json();
      const taskData = await taskRes.json();

      if (progData.success) setPrograms(progData.programs || []);
      if (projData.success) setProjects(projData.projects || []);
      if (taskData.success) setAllTasks(taskData.tasks || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Drag handlers ──
  const handleDragStart = (e, taskId) => {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(taskId));
    requestAnimationFrame(() => {
      e.target.style.opacity = "0.4";
    });
  };

  const handleDragEnd = (e) => {
    e.target.style.opacity = "1";
    setDragOverCol(null);
  };

  const handleDragOver = (e, colId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverCol !== colId) setDragOverCol(colId);
  };

  const handleDragLeave = () => setDragOverCol(null);

  const handleDrop = async (e, targetColId) => {
    e.preventDefault();
    setDragOverCol(null);
    const taskId = parseInt(e.dataTransfer.getData("text/plain"));
    if (!taskId) return;

    const newStatus = COLUMN_TO_STATUS[targetColId];
    if (!newStatus) return;

    setAllTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t)),
    );

    try {
      await fetch("/api/tasks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: taskId, status: newStatus }),
      });
    } catch (e) {
      console.error("Move failed:", e);
      fetchData();
    }
  };

  // ── Delete task ──
  const [deletingTaskId, setDeletingTaskId] = useState(null);

  const handleDeleteTask = useCallback(async (taskId) => {
    if (!confirm("Delete this task? This action cannot be undone.")) return;
    setDeletingTaskId(taskId);
    try {
      const res = await fetch(`/api/tasks?id=${taskId}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        setAllTasks((prev) => prev.filter((t) => t.id !== taskId));
      } else {
        alert(data.error || "Failed to delete task.");
      }
    } catch (e) {
      console.error("Delete error:", e);
      alert("Network error deleting task.");
    } finally {
      setDeletingTaskId(null);
    }
  }, []);

  const isSuperAdmin =
    user?.role === "super_admin" || user?.role === "developer";

  // ── Build hierarchical column data ──
  const columns = useMemo(() => {
    const tasksByStatus = {};
    KANBAN_COLUMNS.forEach((col) => {
      tasksByStatus[col.id] = {
        programTree: {},
        noProgTasks: [],
        noProjectTasks: [],
      };
    });

    const filteredTasks = allTasks.filter((t) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (t.title || "").toLowerCase().includes(q);
    });

    // Build program → project → task tree
    const programMap = {};
    programs.forEach((p) => {
      programMap[p.id] = p;
    });

    for (const task of filteredTasks) {
      const colId =
        task.status === "pending_project_approval"
          ? "pending_approval"
          : COLUMN_TO_STATUS[task.status]
            ? Object.entries(COLUMN_TO_STATUS).find(
                ([, v]) => v === task.status,
              )?.[0]
            : "planning";

      const col = tasksByStatus[colId || "planning"];
      if (!col) continue;

      // Find the task's project
      const project = projects.find(
        (p) => String(p.id) === String(task.project_id),
      );

      if (!project) {
        col.noProjectTasks.push(task);
        continue;
      }

      // Find the project's program
      const prog = programMap[String(project.program_id)];

      if (!prog) {
        col.noProgTasks.push({ project, task });
        continue;
      }

      // Build the tree
      if (!col.programTree[prog.id]) {
        col.programTree[prog.id] = { program: prog, projects: {} };
      }
      if (!col.programTree[prog.id].projects[project.id]) {
        col.programTree[prog.id].projects[project.id] = { project, tasks: [] };
      }
      col.programTree[prog.id].projects[project.id].tasks.push(task);
    }

    return KANBAN_COLUMNS.map((col) => {
      const data = tasksByStatus[col.id];
      return {
        ...col,
        programTree: Object.values(data.programTree),
        noProgTasks: data.noProgTasks,
        noProjectTasks: data.noProjectTasks,
        total:
          Object.values(data.programTree).reduce(
            (sum, p) =>
              sum +
              Object.values(p.projects).reduce(
                (s, pr) => s + pr.tasks.length,
                0,
              ),
            0,
          ) +
          data.noProgTasks.length +
          data.noProjectTasks.length,
      };
    });
  }, [allTasks, programs, projects, search]);

  // ── Toggle expand ──
  const toggleProgram = (id) =>
    setExpandedPrograms((p) => ({ ...p, [id]: !p[id] }));
  const toggleProject = (id) =>
    setExpandedProjects((p) => ({ ...p, [id]: !p[id] }));

  // ── Render a single task card ──
  const renderTaskCard = (task) => (
    <div
      key={task.id}
      draggable
      onDragStart={(e) => handleDragStart(e, task.id)}
      onDragEnd={handleDragEnd}
      className={`p-2 rounded-lg border border-[var(--border-primary)] bg-tertiary/50 cursor-grab active:cursor-grabbing hover:border-[var(--brand-orange)]/30 transition-colors ${
        task.status === "completed" ? "opacity-60" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-1">
        <span
          className={`text-[10px] font-bold flex-1 truncate ${
            task.status === "completed"
              ? "line-through text-slate-500"
              : "text-[var(--text-primary)]"
          }`}
        >
          {task.title}
        </span>
        {isSuperAdmin && (
          <button
            onClick={() => handleDeleteTask(task.id)}
            disabled={deletingTaskId === task.id}
            className="p-0.5 rounded hover:bg-red-500/10 text-slate-500 hover:text-red-400 transition-colors shrink-0"
            title="Delete task"
          >
            {deletingTaskId === task.id ? (
              <div className="w-2.5 h-2.5 border border-red-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <Trash2 className="w-2.5 h-2.5" />
            )}
          </button>
        )}
      </div>
      <div className="flex items-center gap-2 mt-1">
        {task.user_name && (
          <span className="text-[7px] text-slate-500 flex items-center gap-0.5">
            <User className="w-2 h-2" />
            {task.user_name}
          </span>
        )}
      </div>
    </div>
  );

  // ── Loading state ──
  if (loading) {
    return (
      <DashboardLayout role="super_admin">
        <div className="p-8 space-y-6">
          <div className="h-8 w-48 bg-tertiary rounded animate-pulse" />
          <div className="grid grid-cols-5 gap-4">
            {[...Array(5)].map((_, i) => (
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

  // ── Render ──
  return (
    <DashboardLayout role="super_admin">
      <div className="space-y-6 pb-20">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border-primary)] pb-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <LayoutGrid className="w-4 h-4 text-[var(--brand-orange)]" />
              <span className="text-[10px] font-black text-[var(--brand-orange)] uppercase tracking-[0.4em]">
                Internal Ops
              </span>
            </div>
            <h1 className="text-2xl font-black text-[var(--text-primary)] uppercase tracking-tighter">
              Workspace
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-secondary)]" />
              <input
                type="text"
                placeholder="Search tasks..."
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

        {/* Kanban Board */}
        <div className="flex gap-4 overflow-x-auto pb-6 min-h-[70vh]">
          {columns.map((col) => (
            <div
              key={col.id}
              className={`flex-shrink-0 w-80 rounded-xl border flex flex-col transition-colors ${
                dragOverCol === col.id
                  ? "border-[var(--brand-orange)]/40 bg-[var(--brand-orange)]/5"
                  : "border-[var(--border-primary)] bg-tertiary/30"
              }`}
              onDragOver={(e) => handleDragOver(e, col.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, col.id)}
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
                  {col.total}
                </span>
              </div>

              {/* Column Body */}
              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {/* Programs with projects */}
                {col.programTree.map(({ program, projects: projs }) => {
                  const isExpanded = expandedPrograms[program.id] !== false;
                  return (
                    <div key={program.id} className="space-y-1">
                      <button
                        onClick={() => toggleProgram(program.id)}
                        className="flex items-center gap-1.5 w-full text-left text-[9px] font-black text-[var(--text-primary)] uppercase tracking-wider hover:text-[var(--brand-orange)] transition-colors py-1"
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-3 h-3 shrink-0" />
                        ) : (
                          <ChevronRight className="w-3 h-3 shrink-0" />
                        )}
                        <FolderOpen className="w-3 h-3 text-indigo-400" />
                        {program.name ||
                          program.title ||
                          `Program #${program.id}`}
                      </button>

                      {isExpanded && (
                        <div className="ml-3 pl-2 border-l-2 border-indigo-500/20 space-y-2">
                          {Object.values(projs).map(({ project, tasks }) => {
                            const pExpanded =
                              expandedProjects[project.id] !== false;
                            return (
                              <div key={project.id} className="space-y-1">
                                <button
                                  onClick={() => toggleProject(project.id)}
                                  className="flex items-center gap-1 w-full text-left text-[8px] font-bold text-slate-500 uppercase tracking-wider hover:text-slate-300 transition-colors py-0.5"
                                >
                                  {pExpanded ? (
                                    <ChevronDown className="w-2.5 h-2.5 shrink-0" />
                                  ) : (
                                    <ChevronRight className="w-2.5 h-2.5 shrink-0" />
                                  )}
                                  <Briefcase className="w-2.5 h-2.5 text-emerald-400" />
                                  {project.name}{" "}
                                  <span className="text-[7px] text-slate-600 font-normal normal-case ml-1">
                                    ({tasks.length})
                                  </span>
                                </button>
                                {pExpanded && (
                                  <div className="space-y-1.5">
                                    {tasks.map(renderTaskCard)}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Projects without a program */}
                {col.noProgTasks.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5 py-1">
                      <div className="flex-1 h-px bg-slate-600/30" />
                      <span className="text-[7px] font-bold text-slate-500 uppercase tracking-widest">
                        No Program
                      </span>
                      <div className="flex-1 h-px bg-slate-600/30" />
                    </div>
                    {col.noProgTasks.reduce((groups, { project, task }) => {
                      const key = project.id;
                      if (!groups[key]) groups[key] = { project, tasks: [] };
                      groups[key].tasks.push(task);
                      return groups;
                    }, {}) &&
                      Object.values(
                        col.noProgTasks.reduce((groups, { project, task }) => {
                          const key = project.id;
                          if (!groups[key])
                            groups[key] = { project, tasks: [] };
                          groups[key].tasks.push(task);
                          return groups;
                        }, {}),
                      ).map(({ project, tasks }) => (
                        <div key={project.id} className="space-y-1">
                          <button
                            onClick={() => toggleProject(project.id)}
                            className="flex items-center gap-1 text-[8px] font-bold text-slate-500 uppercase tracking-wider hover:text-slate-300 transition-colors py-0.5"
                          >
                            {expandedProjects[project.id] !== false ? (
                              <ChevronDown className="w-2.5 h-2.5 shrink-0" />
                            ) : (
                              <ChevronRight className="w-2.5 h-2.5 shrink-0" />
                            )}
                            <Briefcase className="w-2.5 h-2.5 text-emerald-400" />
                            {project.name} ({tasks.length})
                          </button>
                          {expandedProjects[project.id] !== false && (
                            <div className="ml-2 pl-2 border-l-2 border-slate-500/20 space-y-1.5">
                              {tasks.map(renderTaskCard)}
                            </div>
                          )}
                        </div>
                      ))}
                  </div>
                )}

                {/* Uncategorized tasks (no project) */}
                {col.noProjectTasks.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5 py-1">
                      <div className="flex-1 h-px bg-slate-600/30" />
                      <span className="text-[7px] font-bold text-slate-500 uppercase tracking-widest">
                        Uncategorized
                      </span>
                      <div className="flex-1 h-px bg-slate-600/30" />
                    </div>
                    <div className="space-y-1">
                      {col.noProjectTasks.map(renderTaskCard)}
                    </div>
                  </div>
                )}

                {/* Empty state */}
                {col.total === 0 && (
                  <p className="text-[10px] text-[var(--text-secondary)] italic text-center py-8">
                    No items
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-6 text-[9px] text-[var(--text-secondary)] font-medium">
          <span className="flex items-center gap-1.5">
            <FolderOpen className="w-3 h-3 text-indigo-400" />
            Program
          </span>
          <span className="flex items-center gap-1.5">
            <Briefcase className="w-3 h-3 text-emerald-400" />
            Project
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[var(--brand-orange)]" />
            Drag tasks between columns
          </span>
        </div>
      </div>
    </DashboardLayout>
  );
}
