"use client";

import React, { useState, useCallback, useMemo } from "react";
import {
  LayoutGrid,
  ListTodo,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Target,
  Search,
  Plus,
  Briefcase,
  FolderOpen,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { useApiMulti } from "@/lib/hooks/useApi";
import { useSessionUser } from "@/lib/hooks/useSessionUser";
import KanbanBoard from "@/components/admin/work/KanbanBoard";

// ─── Module-scope readers ────────────────────────────────────────────────────
// The reading hook keys its internal work on the list below, so it is built once
// at module scope: rebuilt each render it would be a new identity and would put
// all three requests back on the wire on every render.

const EMPTY_LIST = [];

const pickList = (field) => (payload) => (payload?.success ? payload[field] || [] : []);

const WORK_BOARD_ENDPOINTS = [
  { key: "programs", url: "/api/programs", transform: pickList("programs") },
  { key: "projects", url: "/api/admin/projects", transform: pickList("projects") },
  {
    key: "tasks",
    url: "/api/tasks?brief=true&limit=500",
    transform: pickList("tasks"),
  },
];

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
  const [search, setSearch] = useState("");

  // The three lists the board is built from, through the shared hook: it owns the
  // cache, the cache-first paint and the discarding of a stale answer, so the page
  // keeps no copy of its own and reads its data during render.
  const { data, loading, refresh, setData } = useApiMulti(WORK_BOARD_ENDPOINTS);
  const programs = data.programs ?? EMPTY_LIST;
  const projects = data.projects ?? EMPTY_LIST;
  const allTasks = data.tasks ?? EMPTY_LIST;

  // Who is signed in, from the shell's session cache: no request of its own, and
  // no dependence on the browser's stored copy.
  const { role } = useSessionUser();

  const [expandedPrograms, setExpandedPrograms] = useState({});
  const [expandedProjects, setExpandedProjects] = useState({});

  // ── Drag state ──
  const [dragOverCol, setDragOverCol] = useState(null);

  // ── Drag handlers ──
  const handleDragStart = (event, taskId) => {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(taskId));
    requestAnimationFrame(() => {
      event.target.style.opacity = "0.4";
    });
  };

  const handleDragEnd = (event) => {
    event.target.style.opacity = "1";
    setDragOverCol(null);
  };

  const handleDragOver = (event, colId) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    if (dragOverCol !== colId) setDragOverCol(colId);
  };

  const handleDragLeave = () => setDragOverCol(null);

  const handleDrop = async (event, targetColId) => {
    event.preventDefault();
    setDragOverCol(null);
    const taskId = parseInt(event.dataTransfer.getData("text/plain"));
    if (!taskId) return;

    const newStatus = COLUMN_TO_STATUS[targetColId];
    if (!newStatus) return;

    // The moved task takes its new column at once; the server is told after. A
    // refused move re-reads, so the board cannot keep a column the server did not
    // accept.
    setData((prev) => ({
      ...prev,
      tasks: (prev.tasks ?? EMPTY_LIST).map((task) =>
        task.id === taskId ? { ...task, status: newStatus } : task,
      ),
    }));

    try {
      await fetch("/api/tasks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: taskId, status: newStatus }),
      });
    } catch (error) {
      console.error("Move failed:", error);
      refresh();
    }
  };

  // ── Delete task ──
  const [deletingTaskId, setDeletingTaskId] = useState(null);

  const handleDeleteTask = useCallback(async (taskId) => {
    setDeletingTaskId(taskId);
    try {
      const response = await fetch(`/api/tasks?id=${taskId}`, { method: "DELETE" });
      const data = await response.json();
      if (data.success) {
        setData((prev) => ({
          ...prev,
          tasks: (prev.tasks ?? EMPTY_LIST).filter((task) => task.id !== taskId),
        }));
      } else {
        window.dispatchEvent(new CustomEvent('impactos:notify', { detail: { type: 'error', message: t((data.error || t("adminMisc.work.deleteTaskFailed")) || "") || (data.error || t("adminMisc.work.deleteTaskFailed")) } }));
      }
    } catch (error) {
      console.error("Delete error:", error);
      window.dispatchEvent(new CustomEvent('impactos:notify', { detail: { type: 'error', message: t("adminMisc.work.deleteTaskNetworkError") } }));
    } finally {
      setDeletingTaskId(null);
    }
  }, [t, setData]);

  const isSuperAdmin = role === "super_admin";

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

    const filteredTasks = allTasks.filter((task) => {
      if (!search) return true;
      const query = search.toLowerCase();
      return (task.title || "").toLowerCase().includes(query);
    });

    // Build program → project → task tree
    const programMap = {};
    programs.forEach((program) => {
      programMap[program.id] = program;
    });

    for (const task of filteredTasks) {
      const colId =
        task.status === "pending_project_approval"
          ? "pending_approval"
          : COLUMN_TO_STATUS[task.status]
            ? Object.entries(COLUMN_TO_STATUS).find(
                ([, status]) => status === task.status,
              )?.[0]
            : "planning";

      const col = tasksByStatus[colId || "planning"];
      if (!col) continue;

      // Find the task's project
      const project = projects.find(
        (projectOption) => String(projectOption.id) === String(task.project_id),
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
            (sum, program) =>
              sum +
              Object.values(program.projects).reduce(
                (total, project) => total + project.tasks.length,
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
    setExpandedPrograms((previous) => ({ ...previous, [id]: !previous[id] }));
  const toggleProject = (id) =>
    setExpandedProjects((previous) => ({ ...previous, [id]: !previous[id] }));

  // ── Loading state ──
  if (loading) {
    return (
      <>
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
      </>
    );
  }

  // ── Render ──
  return (
    <>
      <div className="space-y-6 pb-20">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border-primary)] pb-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <LayoutGrid className="w-4 h-4 text-[var(--brand-orange)]" />
              <span className="text-[10px] font-black text-[var(--brand-orange)] uppercase tracking-[0.4em]">
                {t("adminMisc.work.eyebrow")}
              </span>
            </div>
            <h1 className="text-2xl font-black text-[var(--text-primary)] uppercase tracking-tighter">
              {t("adminMisc.work.title")}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-secondary)]" />
              <input
                type="text"
                placeholder={t("adminMisc.work.searchPlaceholder")}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="w-56 pl-9 pr-4 py-2 rounded-lg bg-tertiary border border-[var(--border-primary)] text-[11px] font-medium text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] outline-none focus:border-[var(--brand-orange)] transition-all"
              />
            </div>
            <button
              onClick={() => router.push("/admin/projects?action=create")}
              className="flex items-center gap-2 px-4 py-2 bg-[var(--brand-orange)] text-black rounded-lg text-sm font-bold uppercase tracking-wide hover:brightness-110 transition-all"
            >
              <Plus className="w-3.5 h-3.5" /> {t("adminMisc.work.newProject")}
            </button>
          </div>
        </div>

        {/* Kanban Board */}
        <KanbanBoard
          columns={columns}
          dragOverCol={dragOverCol}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          expandedPrograms={expandedPrograms}
          expandedProjects={expandedProjects}
          onToggleProgram={toggleProgram}
          onToggleProject={toggleProject}
          isSuperAdmin={isSuperAdmin}
          deletingTaskId={deletingTaskId}
          onDeleteTask={handleDeleteTask}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        />

        {/* Legend */}
        <div className="flex items-center gap-6 text-[9px] text-[var(--text-secondary)] font-medium">
          <span className="flex items-center gap-1.5">
            <FolderOpen className="w-3 h-3 text-indigo-400" />
            {t("adminMisc.work.legendProgram")}
          </span>
          <span className="flex items-center gap-1.5">
            <Briefcase className="w-3 h-3 text-emerald-400" />
            {t("adminMisc.work.legendProject")}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[var(--brand-orange)]" />
            {t("adminMisc.work.dragHint")}
          </span>
        </div>
      </div>
    </>
  );
}
