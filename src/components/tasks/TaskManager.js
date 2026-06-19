"use client";

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import {
  Send,
  MessageSquare,
  Search,
  Users,
  Briefcase,
  User,
  X,
  Check,
  ListTodo,
  Shield,
  ChevronDown,
  Plus,
  CheckCircle2,
} from "lucide-react";

// ─── Helpers ─────────────────────────────────────────────────────────────

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

const STATUS_CONFIG = {
  pending: { color: "text-slate-400", bg: "bg-slate-500/10" },
  in_progress: { color: "text-blue-400", bg: "bg-blue-500/10" },
  blocked: { color: "text-rose-400", bg: "bg-rose-500/10" },
  completed: { color: "text-emerald-400", bg: "bg-emerald-500/10" },
  carried_over: { color: "text-amber-400", bg: "bg-amber-500/10" },
};

const STATUS_OPTIONS = [
  { value: "pending", label: "Not Started" },
  { value: "in_progress", label: "In Progress" },
  { value: "blocked", label: "Blocked" },
  { value: "carried_over", label: "Carried Over" },
  { value: "completed", label: "Completed" },
];

const CATEGORIES = [
  "Operations",
  "Administration",
  "Marketing",
  "Finance",
  "Logistics",
  "HR",
  "Technology",
  "Other",
];

// ─── Main Component ──────────────────────────────────────────────────────

export default function TaskManager({
  mode = "standup", // "standup" | "project" | "my-tasks"
  projectId = null, // scoped to a project
  userId = null,
  userName = "",
  projects = [], // available projects for picker
  taskList = [], // existing tasks from API (with subtasks nested)
  onTasksChange = null, // callback(newTaskRows) when pending tasks change
  compact = false,
  weekInfo = null, // { week, year } for standup mode
  showCarryOver = true, // show carry-over tasks section
}) {
  const uid = userId;
  const [tasks, setTasks] = useState([]);
  const [expandedTasks, setExpandedTasks] = useState({});
  const [updatingTasks, setUpdatingTasks] = useState({});
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [pendingParentTaskId, setPendingParentTaskId] = useState(null);
  const [subTaskModal, setSubTaskModal] = useState(null); // { id, project_id, category, title } or null
  const [subTaskInput, setSubTaskInput] = useState("");
  const [projectSearch, setProjectSearch] = useState("");
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);

  // Form state
  const [form, setForm] = useState({
    name: "",
    project_id: "",
    category: "",
    start_date: "",
    due_date: "",
    start_time: "",
    due_time: "",
  });

  // Sync taskList into local state when it changes
  useEffect(() => {
    setTasks(taskList || []);
  }, [taskList]);

  // ── API: Update task status ──
  const updateStatus = useCallback(
    async (taskId, newStatus) => {
      if (updatingTasks[taskId]) return;
      setUpdatingTasks((p) => ({ ...p, [taskId]: true }));
      try {
        // If completing parent, cascade to sub-tasks
        if (newStatus === "completed") {
          const task = tasks.find((t) => t.id === taskId);
          if (task?.subtasks?.length > 0) {
            await Promise.all(
              task.subtasks.map((st) =>
                fetch("/api/tasks", {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ id: st.id, status: "completed" }),
                }),
              ),
            );
          }
        }
        await fetch("/api/tasks", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: taskId, status: newStatus }),
        });
        // Re-fetch via callback
        if (onTasksChange) onTasksChange();
      } catch (e) {
        console.error(e);
      } finally {
        setUpdatingTasks((p) => ({ ...p, [taskId]: false }));
      }
    },
    [tasks, updatingTasks, onTasksChange],
  );

  // ── API: Create task ──
  const createTask = useCallback(
    async (taskData) => {
      const week = weekInfo || { week: 0, year: 0 };
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: taskData.title,
          project_id: taskData.project_id || null,
          category: taskData.category || null,
          user_id: uid,
          user_name: userName || "User",
          status: "in_progress",
          parent_task_id: taskData.parent_task_id || null,
          created_week: week.week || 0,
          created_year: week.year || 0,
          start_date: taskData.start_date || null,
          end_date: taskData.due_date || null,
        }),
      });
      return await res.json();
    },
    [uid, userName, weekInfo],
  );

  // ── Submit new task from form ──
  const handleAddTask = useCallback(async () => {
    if (!form.name.trim()) return;
    if (!form.project_id && !form.category) return;

    const data = await createTask({
      title: form.name.trim(),
      project_id: form.project_id || null,
      category: form.category || null,
      parent_task_id: pendingParentTaskId || null,
      start_date: form.start_date || null,
      due_date: form.due_date || null,
    });

    if (data.success) {
      setForm({
        name: "",
        project_id: "",
        category: "",
        start_date: "",
        due_date: "",
        start_time: "",
        due_time: "",
      });
      setPendingParentTaskId(null);
      setShowTaskForm(false);
      if (onTasksChange) onTasksChange();
    }
  }, [form, pendingParentTaskId, createTask, onTasksChange]);

  // ── Open sub-task popup modal ──
  const openSubTask = useCallback(
    (parentId, parentProjectId, parentCategory, parentTitle) => {
      setSubTaskModal({
        id: parentId,
        project_id: parentProjectId,
        category: parentCategory,
        title: parentTitle,
      });
      setSubTaskInput("");
    },
    [],
  );

  const addSubTaskFromModal = useCallback(async () => {
    const name = subTaskInput.trim();
    if (!name || !subTaskModal) return;
    const data = await createTask({
      title: name,
      project_id: subTaskModal.project_id || null,
      category: subTaskModal.category || null,
      parent_task_id: subTaskModal.id,
    });
    if (data.success) {
      setSubTaskInput("");
      if (onTasksChange) onTasksChange();
    }
  }, [subTaskInput, subTaskModal, createTask, onTasksChange]);

  // ── Available projects / categories ──
  const selectedProject = projects.find(
    (p) => String(p.id) === String(form.project_id),
  );
  const filteredProjects = projects.filter((p) => {
    if (!projectSearch) return true;
    return p.name?.toLowerCase().includes(projectSearch.toLowerCase());
  });

  // ── Tasks grouped by relevance ──
  const carryOverTasks = useMemo(
    () => tasks.filter((t) => t.status === "carried_over" && !t.parent_task_id),
    [tasks],
  );

  const activeTasks = useMemo(
    () =>
      tasks.filter(
        (t) =>
          !["completed", "archived", "carried_over"].includes(t.status) &&
          !t.parent_task_id,
      ),
    [tasks],
  );

  // ── Render task row (with optional sub-tasks) ──
  const renderTaskRow = (task, isSub = false) => {
    const isExpanded = expandedTasks[task.id];
    const cfg = STATUS_CONFIG[task.status] || STATUS_CONFIG.pending;
    const isUpdating = updatingTasks[task.id];

    return (
      <div key={task.id}>
        <div
          className={`flex items-center gap-2 py-1.5 ${isSub ? "ml-6 pl-3 border-l-2 border-indigo-500/30" : ""}`}
        >
          {/* Checkbox */}
          <button
            onClick={() =>
              updateStatus(
                task.id,
                task.status === "completed" ? "in_progress" : "completed",
              )
            }
            disabled={isUpdating}
            className={`w-4 h-4 rounded-full border-2 shrink-0 transition-all hover:scale-110 ${task.status === "completed" ? "bg-emerald-500 border-emerald-500" : "border-slate-600 hover:border-emerald-400"} ${isUpdating ? "opacity-50 animate-pulse" : ""}`}
          >
            {task.status === "completed" && (
              <CheckCircle2 className="w-3 h-3 text-white" />
            )}
          </button>

          {/* Task name with expand toggle */}
          {!isSub && task.subtasks?.length > 0 ? (
            <button
              onClick={() =>
                setExpandedTasks((p) => ({ ...p, [task.id]: !p[task.id] }))
              }
              className="flex items-center gap-1 text-left flex-1 min-w-0"
            >
              <span
                className={`text-[11px] font-medium ${task.status === "completed" ? "line-through text-slate-500" : "text-[var(--text-primary)]"} ${isSub ? "text-[10px]" : ""}`}
              >
                {task.title}
              </span>
              <ChevronDown
                className={`w-3 h-3 shrink-0 text-slate-500 transition-transform ${isExpanded ? "rotate-180" : ""}`}
              />
            </button>
          ) : (
            <span
              className={`flex-1 text-[11px] font-medium min-w-0 truncate ${task.status === "completed" ? "line-through text-slate-500" : "text-[var(--text-primary)]"} ${isSub ? "text-[10px]" : ""}`}
            >
              {task.title}
            </span>
          )}

          {/* Project / Category tag */}
          {!isSub && (
            <span className="text-[8px] text-slate-500 hidden sm:inline shrink-0">
              {task.project_id
                ? projects.find((p) => String(p.id) === String(task.project_id))
                    ?.name
                : task.category || ""}
            </span>
          )}

          {/* Status dropdown */}
          {!isSub && (
            <select
              value={task.status || "pending"}
              onChange={(e) => updateStatus(task.id, e.target.value)}
              className={`text-[8px] font-semibold px-1.5 py-0.5 rounded-full border-0 outline-none cursor-pointer appearance-none shrink-0 ${cfg.bg} ${cfg.color}`}
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value} className="bg-primary">
                  {o.label}
                </option>
              ))}
            </select>
          )}

          {/* Sub-task count */}
          {!isSub && task.subtasks?.length > 0 && (
            <span className="text-[8px] text-indigo-400 font-bold shrink-0">
              {task.subtasks.length} sub
            </span>
          )}
        </div>

        {/* Expanded sub-tasks */}
        {!isSub && isExpanded && task.subtasks?.length > 0 && (
          <div className="mt-1">
            {task.subtasks.map((st) => renderTaskRow(st, true))}
          </div>
        )}

        {/* Add sub-task button (parent tasks only) */}
        {!isSub && (
          <button
            onClick={() =>
              openSubTask(task.id, task.project_id, task.category, task.title)
            }
            className="ml-8 mt-0.5 flex items-center gap-1 px-2 py-0.5 text-[7px] font-black uppercase tracking-wider text-indigo-400 hover:text-indigo-300 transition-all"
          >
            <Plus className="w-2.5 h-2.5" /> Sub-task
          </button>
        )}
      </div>
    );
  };

  // ── Render ──
  return (
    <div className={cn("space-y-4", compact ? "text-sm" : "")}>
      {/* ─── Carry Over Tasks (standup mode) ─── */}
      {showCarryOver && carryOverTasks.length > 0 && (
        <div>
          <h4 className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Shield className="w-3 h-3" /> Carry Over ({carryOverTasks.length})
          </h4>
          <div className="space-y-0.5">
            {carryOverTasks.map((t) => renderTaskRow(t))}
          </div>
        </div>
      )}

      {/* ─── Active Tasks ─── */}
      {activeTasks.length > 0 && (
        <div>
          <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
            Tasks ({activeTasks.length})
          </h4>
          <div className="space-y-0.5">
            {activeTasks.map((t) => renderTaskRow(t))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {activeTasks.length === 0 &&
        carryOverTasks.length === 0 &&
        !showTaskForm && (
          <div className="text-center py-6">
            <ListTodo className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="text-[10px] text-slate-500">No tasks yet</p>
          </div>
        )}

      {/* ─── Task Form ─── */}
      {showTaskForm ? (
        <div className="p-3 rounded-xl border border-[var(--brand-orange)]/30 bg-[var(--brand-orange)]/[0.02] space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-[9px] font-black text-[var(--brand-orange)] uppercase tracking-widest">
              {pendingParentTaskId ? "Add Sub-task" : "New Task"}
            </h4>
            {pendingParentTaskId && (
              <span className="text-[7px] text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded uppercase font-black">
                Sub-task
              </span>
            )}
          </div>

          {/* Task name */}
          <input
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            placeholder="What are you working on?"
            className="w-full bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-2 text-[11px] font-bold outline-none focus:border-[var(--brand-orange)] transition-all"
          />

          {/* Project / Category (hidden for sub-tasks — inherited) */}
          {!pendingParentTaskId && (
            <div className="grid grid-cols-2 gap-2">
              {/* Project picker */}
              <div className="relative">
                <label className="text-[7px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Project
                </label>
                {form.project_id ? (
                  <div className="flex items-center gap-1 w-full bg-primary border border-emerald-500/30 rounded-lg px-2 py-1.5">
                    <span className="text-[10px] font-bold text-emerald-500 flex-1 truncate">
                      {selectedProject?.name || form.project_id}
                    </span>
                    <button
                      onClick={() => setForm((p) => ({ ...p, project_id: "" }))}
                    >
                      <X className="w-3 h-3 text-slate-500" />
                    </button>
                  </div>
                ) : (
                  <div>
                    <input
                      value={projectSearch}
                      onChange={(e) => {
                        setProjectSearch(e.target.value);
                        setShowProjectDropdown(true);
                      }}
                      onFocus={() => setShowProjectDropdown(true)}
                      placeholder="Search..."
                      className="w-full bg-primary border border-[var(--border-primary)] rounded-lg px-2 py-1.5 text-[10px] font-bold outline-none"
                    />
                    {showProjectDropdown && (
                      <div className="absolute z-10 mt-1 w-full max-h-32 overflow-y-auto rounded-lg bg-[var(--bg-primary)] border border-[var(--border-primary)] shadow-xl">
                        {filteredProjects.length === 0 ? (
                          <p className="px-3 py-2 text-[9px] text-slate-500 italic">
                            No projects
                          </p>
                        ) : (
                          filteredProjects.map((p) => (
                            <button
                              key={p.id}
                              onClick={() => {
                                setForm((f) => ({
                                  ...f,
                                  project_id: p.id,
                                  category: "",
                                }));
                                setProjectSearch("");
                                setShowProjectDropdown(false);
                              }}
                              className="w-full text-left px-3 py-1.5 hover:bg-tertiary text-[10px] font-bold"
                            >
                              {p.name}
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Category (only when no project) */}
              <div>
                <label className="text-[7px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Category
                </label>
                <select
                  value={form.category}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      category: e.target.value,
                      project_id: e.target.value ? "" : p.project_id,
                    }))
                  }
                  className="w-full bg-primary border border-[var(--border-primary)] rounded-lg px-2 py-1.5 text-[10px] font-bold text-purple-400 outline-none appearance-none cursor-pointer"
                >
                  <option value="">—</option>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Inherited badge for sub-tasks */}
          {pendingParentTaskId && form.project_id && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
              <span className="text-[8px] font-bold text-indigo-400">
                Inherited from parent
              </span>
              <span className="text-[8px] text-slate-500">
                {selectedProject?.name || form.category || ""}
              </span>
            </div>
          )}

          {/* Dates */}
          <div className="grid grid-cols-2 gap-2">
            <input
              type="date"
              value={form.start_date}
              onChange={(e) =>
                setForm((p) => ({ ...p, start_date: e.target.value }))
              }
              className="bg-primary border border-[var(--border-primary)] rounded-lg px-2 py-1.5 text-[9px] font-bold outline-none"
            />
            <input
              type="date"
              value={form.due_date}
              onChange={(e) =>
                setForm((p) => ({ ...p, due_date: e.target.value }))
              }
              className="bg-primary border border-[var(--border-primary)] rounded-lg px-2 py-1.5 text-[9px] font-bold outline-none"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={handleAddTask}
              disabled={
                !form.name.trim() || (!form.project_id && !form.category)
              }
              className="flex-1 px-3 py-2 bg-[var(--brand-orange)] text-black rounded-lg text-[8px] font-black uppercase tracking-wider disabled:opacity-40 hover:brightness-110 transition-all"
            >
              {pendingParentTaskId ? "Add Sub-task" : "Add Task"}
            </button>
            <button
              onClick={() => {
                setShowTaskForm(false);
                setPendingParentTaskId(null);
              }}
              className="px-3 py-2 bg-tertiary border border-[var(--border-primary)] rounded-lg text-[8px] font-black uppercase tracking-wider text-slate-500 hover:text-[var(--text-primary)] transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowTaskForm(true)}
          className="flex items-center gap-2 px-3 py-2 bg-[var(--brand-orange)] text-black rounded-lg text-[8px] font-black uppercase tracking-wider hover:brightness-110 transition-all w-fit"
        >
          <Plus className="w-3 h-3" /> New Task
        </button>
      )}

      {/* ─── SUB-TASK POPUP MODAL ─── */}
      {subTaskModal && (
        <div
          className="fixed inset-0 z-[600] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm"
          onClick={() => setSubTaskModal(null)}
        >
          <div
            className="card w-full max-w-md space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ListTodo className="w-5 h-5 text-indigo-400" />
                <h3 className="text-sm font-black uppercase tracking-tight">
                  Add Sub-task
                </h3>
              </div>
              <button onClick={() => setSubTaskModal(null)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
              <p className="text-[9px] font-bold text-indigo-400">
                Parent task: {""}
                <span className="text-white">{subTaskModal.title}</span>
              </p>
            </div>

            <div className="space-y-3 pt-2">
              <input
                type="text"
                value={subTaskInput}
                onChange={(e) => setSubTaskInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") addSubTaskFromModal();
                }}
                placeholder="Enter sub-task name..."
                className="w-full bg-primary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-sm outline-none focus:border-[var(--brand-orange)] transition-all"
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  onClick={addSubTaskFromModal}
                  disabled={!subTaskInput.trim()}
                  className="flex-1 py-3 bg-indigo-500 text-black rounded-xl text-[9px] font-black uppercase tracking-widest hover:brightness-110 disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" /> Add
                </button>
                <button
                  onClick={() => setSubTaskModal(null)}
                  className="flex-1 py-3 bg-tertiary border border-[var(--border-primary)] rounded-xl text-[9px] font-black uppercase tracking-widest text-slate-500 hover:text-[var(--text-primary)] transition-all"
                >
                  Done
                </button>
              </div>
              <p className="text-[8px] text-slate-500 text-center">
                Press Enter to add another, or click Done when finished.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
