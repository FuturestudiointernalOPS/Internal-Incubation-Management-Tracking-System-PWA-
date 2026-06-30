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
  ChevronUp,
  ChevronDown,
  Plus,
  CheckCircle2,
  Edit3,
  Trash2,
  Link as LinkIcon,
  Copy,
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
  // Get current logged-in user for permission checks
  const [currentUserId, setCurrentUserId] = useState(null);
  useEffect(() => {
    try {
      const saved = localStorage.getItem("user");
      if (saved)
        setCurrentUserId(JSON.parse(saved).cid || JSON.parse(saved).id || null);
    } catch (_) {}
  }, []);
  const [tasks, setTasks] = useState([]);
  const [expandedTasks, setExpandedTasks] = useState({});
  const [updatingTasks, setUpdatingTasks] = useState({});
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [pendingParentTaskId, setPendingParentTaskId] = useState(null);
  const [subTaskModal, setSubTaskModal] = useState(null); // { id, project_id, category, title } or null
  const [subTaskInput, setSubTaskInput] = useState("");
  const [subTaskSuccess, setSubTaskSuccess] = useState("");
  const [editTaskModal, setEditTaskModal] = useState(null); // task object or null
  const [editForm, setEditForm] = useState({
    name: "",
    description: "",
    project_id: "",
    category: "",
    start_date: "",
    due_date: "",
    status: "",
  });

  const [addResourceTaskId, setAddResourceTaskId] = useState(null);
  const [resourceForm, setResourceForm] = useState({ name: "", url: "" });
  const [resourceAdding, setResourceAdding] = useState(false);
  const [projectSearch, setProjectSearch] = useState("");
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);
  const projectDropdownRef = useRef(null);

  // Close project dropdown on outside click
  useEffect(() => {
    if (!showProjectDropdown) return;
    const handler = (e) => {
      if (
        projectDropdownRef.current &&
        !projectDropdownRef.current.contains(e.target)
      ) {
        setShowProjectDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showProjectDropdown]);

  // Form state
  const [form, setForm] = useState({
    name: "",
    project_id: "",
    category: "",
    start_date: "",
    due_date: "",
    start_time: "",
    due_time: "",
    link: "",
  });

  // Sync taskList into local state when it changes
  useEffect(() => {
    setTasks(taskList || []);
  }, [taskList]);

  const handleAddResource = async (taskId) => {
    if (!resourceForm.url.trim()) return;
    setResourceAdding(true);
    try {
      const res = await fetch("/api/tasks/resources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task_id: taskId, name: resourceForm.name, url: resourceForm.url })
      });
      if (res.ok) {
        if (onTasksChange) onTasksChange();
        setAddResourceTaskId(null);
        setResourceForm({ name: "", url: "" });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setResourceAdding(false);
    }
  };

  const handleDeleteResource = async (resourceId) => {
    if (!window.confirm("Delete this resource link?")) return;
    try {
      const res = await fetch(`/api/tasks/resources?id=${resourceId}`, { method: "DELETE" });
      if (res.ok) {
        if (onTasksChange) onTasksChange();
      }
    } catch (e) {
      console.error(e);
    }
  };

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
          link: taskData.link || null,
        }),
      });
      return await res.json();
    },
    [uid, userName, weekInfo],
  );

  // ── Submit new task from form ──
  const [creating, setCreating] = useState(false);
  const [addedCount, setAddedCount] = useState(0);

  const handleAddTask = useCallback(async () => {
    if (creating) return;
    if (!form.name.trim()) return;
    if (!form.project_id && !form.category) return;

    setCreating(true);
    const data = await createTask({
      title: form.name.trim(),
      project_id: form.project_id || null,
      category: form.category || null,
      parent_task_id: pendingParentTaskId || null,
      start_date: form.start_date || null,
      due_date: form.due_date || null,
    link: form.link || null,
    });

    if (data.success) {
      setForm((p) => ({
        ...p,
        name: "",
        start_date: "",
        due_date: "",
        start_time: "",
        due_time: "",
      }));
      setPendingParentTaskId(null);
      setAddedCount((c) => c + 1);
      if (onTasksChange) onTasksChange();
    }
    setCreating(false);
  }, [form, pendingParentTaskId, createTask, onTasksChange, creating]);

  const handleCloseForm = useCallback(() => {
    setShowTaskForm(false);
    setPendingParentTaskId(null);
    setAddedCount(0);
    setForm({
      name: "",
      project_id: "",
      category: "",
      start_date: "",
      due_date: "",
      start_time: "",
      due_time: "",
      link: "",
    });
  }, []);

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
      start_date: subTaskStartDate || null,
      due_date: subTaskEndDate || null,
      link: subTaskLink || null,
    });
    if (data.success) {
      setSubTaskInput("");
      setSubTaskStartDate("");
      setSubTaskEndDate("");
      setSubTaskLink("");
      setSubTaskSuccess("Sub-task added!");
      setTimeout(() => setSubTaskSuccess(""), 2000);
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
  const filteredTasks = useMemo(() => {
    if (mode === "standup" && weekInfo) {
      return tasks.filter(
        (t) =>
          t.created_week === weekInfo.week && t.created_year === weekInfo.year,
      );
    }
    return tasks;
  }, [tasks, mode, weekInfo]);

  const carryOverTasks = useMemo(
    () =>
      filteredTasks.filter(
        (t) =>
          (t.carried_over_from_task_id !== null || t.status === "carried_over") &&
          !t.parent_task_id,
      ),
    [filteredTasks],
  );

  const activeTasks = useMemo(
    () =>
      filteredTasks
        .filter(
          (t) =>
            t.carried_over_from_task_id === null &&
            t.status !== "carried_over" &&
            t.status !== "archived" &&
            !t.parent_task_id,
        )
        .sort(
          (a, b) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
        ),
    [filteredTasks],
  );

  // Move task up or down in the active list
  const moveTask = useCallback((taskId, direction) => {
    setTasks((prev) => {
      const idx = prev.findIndex((t) => t.id === taskId);
      if (idx === -1) return prev;
      const targetIdx = direction === "up" ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= prev.length) return prev;
      const updated = [...prev];
      [updated[idx], updated[targetIdx]] = [updated[targetIdx], updated[idx]];
      return updated;
    });
  }, []);

  // ── Render task row (with optional sub-tasks) ──
  // Track task index for numbering in standup mode
  let taskIndex = 0;
  const renderTaskRow = (task, isSub = false) => {
    const isExpanded = expandedTasks[task.id];
    const cfg = STATUS_CONFIG[task.status] || STATUS_CONFIG.pending;
    const isUpdating = updatingTasks[task.id];

    return (
      <div key={task.id}>
        <div
          className={`flex items-center gap-2 py-1.5 ${
            !isSub && task.subtasks?.length > 0
              ? "pl-3 border-l-[3px] border-indigo-400 rounded-sm"
              : isSub
                ? "ml-6 pl-3 border-l-2 border-indigo-500/30"
                : ""
          } ${!isSub && task.subtasks?.length > 0 ? "bg-indigo-500/[0.04]" : ""}`}
        >
          {/* Checkbox — only in project mode for task owner/assignee, never in standup */}
          {mode !== "standup" &&
            (() => {
              const canCheck =
                mode === "project"
                  ? String(task.user_id) === String(currentUserId) ||
                    String(task.assigned_to) === String(currentUserId) ||
                    String(userId) === String(currentUserId)
                  : true;
              if (mode === "project" && !canCheck) {
                // Show static completed indicator only
                if (task.status === "completed") {
                  return (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  );
                }
                return <div className="w-4 h-4 shrink-0" />;
              }
              return (
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
              );
            })()}

          {/* Task number in standup mode */}
          {mode === "standup" && !isSub && (
            <span className="w-5 h-5 flex items-center justify-center rounded-md bg-tertiary border border-[var(--border-primary)] text-[9px] font-black text-slate-500 shrink-0">
              {++taskIndex}
            </span>
          )}

          {/* Parent indicator icon — always visible when task has sub-tasks */}
          {!isSub && task.subtasks?.length > 0 && (
            <div className="w-5 h-5 flex items-center justify-center rounded-md bg-indigo-500/15 shrink-0">
              <ChevronDown className="w-3.5 h-3.5 text-indigo-400" />
            </div>
          )}

          {/* Task name */}
          {!isSub && task.subtasks?.length > 0 ? (
            <div className="flex items-center gap-1.5 text-left flex-1 min-w-0">
              <span
                className={`text-[11px] font-bold ${task.status === "completed" ? "line-through text-slate-500" : "text-[var(--text-primary)]"}`}
              >
                {task.title}
              </span>
              <span className="text-[7px] font-black text-indigo-400 uppercase tracking-wider bg-indigo-500/10 px-1.5 py-0.5 rounded shrink-0">
                {task.subtasks.length} sub
              </span>
            </div>
          ) : (
            <span
              className={`flex-1 text-[11px] font-medium min-w-0 truncate ${task.status === "completed" ? "line-through text-slate-500" : "text-[var(--text-primary)]"} ${isSub ? "text-[10px]" : ""}`}
            >
              {isSub && (
                <span className="text-[7px] text-indigo-400 mr-1 uppercase tracking-wider font-bold">
                  Sub:
                </span>
              )}
              {task.title}
            </span>
          )}

          {/* Creator + Assignee + Project / Category tag */}
          {!isSub && (
            <div className="hidden sm:flex items-center gap-2 shrink-0 text-[8px]">
              {task.user_name && (
                <span
                  className="text-slate-500 flex items-center gap-1"
                  title="Created by"
                >
                  <User className="w-2.5 h-2.5" />
                  {task.user_name}
                </span>
              )}
              {task.assignee_name && (
                <span
                  className="text-emerald-500 flex items-center gap-1"
                  title="Assigned to"
                >
                  <Send className="w-2.5 h-2.5" />
                  {task.assignee_name}
                </span>
              )}
              <span className="text-slate-500">
                {task.project_id
                  ? projects.find(
                      (p) => String(p.id) === String(task.project_id),
                    )?.name
                  : task.category || ""}
              </span>
            </div>
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

          {/* Edit button — parent AND sub tasks */}
          {
            <button
              onClick={() => {
                setEditForm({
                  name: task.title,
                  description: task.description || "",
                  project_id: task.project_id || "",
                  category: task.category || "",
                  start_date: task.start_date || "",
                  due_date: task.end_date || "",
                  status: task.status || "in_progress",
                });
                setEditTaskModal(task);
              }}
              className="text-slate-500 hover:text-[var(--brand-orange)] transition-all shrink-0"
              title="Edit task"
            >
              <Edit3 className="w-3 h-3" />
            </button>
          }

          {/* Delete button — parent AND sub tasks */}
          {
            <button
              onClick={async () => {
                if (!window.confirm(`Delete task "${task.title}"?`)) return;
                await fetch(`/api/tasks?id=${task.id}`, { method: "DELETE" });
                if (onTasksChange) onTasksChange();
              }}
              className="text-slate-500 hover:text-rose-500 transition-all shrink-0"
              title="Delete task"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          }

          {/* Move up/down buttons */}
          {!isSub && (
            <div className="flex flex-col gap-0.5 shrink-0">
              <button
                onClick={() => moveTask(task.id, "up")}
                className="text-slate-500 hover:text-[var(--text-primary)] transition-all"
                title="Move up"
              >
                <ChevronUp className="w-3 h-3" />
              </button>
              <button
                onClick={() => moveTask(task.id, "down")}
                className="text-slate-500 hover:text-[var(--text-primary)] transition-all"
                title="Move down"
              >
                <ChevronDown className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>

        {/* Resources Section */}
        {task.resources && task.resources.length > 0 && (
          <div className={`mt-1 flex flex-col gap-1 ${isSub ? "ml-10" : "ml-8"}`}>
            {task.resources.map(r => (
              <div key={r.id} className="flex items-center gap-2 group">
                <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-[var(--brand-orange)] hover:underline flex items-center gap-1 max-w-[200px] truncate">
                  <LinkIcon className="w-2.5 h-2.5 shrink-0" />
                  {r.name || r.url}
                </a>
                <button onClick={() => { navigator.clipboard.writeText(r.url); alert("URL copied!"); }} className="text-slate-500 opacity-0 group-hover:opacity-100 hover:text-emerald-400 transition-opacity" title="Copy URL">
                  <Copy className="w-2.5 h-2.5" />
                </button>
                <button onClick={() => handleDeleteResource(r.id)} className="text-slate-500 opacity-0 group-hover:opacity-100 hover:text-rose-400 transition-opacity" title="Remove URL">
                  <Trash2 className="w-2.5 h-2.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {addResourceTaskId === task.id && (
          <div className={`mt-1 p-2 rounded-lg bg-tertiary border border-[var(--border-primary)] flex flex-col gap-2 ${isSub ? "ml-10" : "ml-8"} w-fit min-w-[250px]`}>
            <input type="text" placeholder="Resource Name (optional)" value={resourceForm.name} onChange={e => setResourceForm(p => ({...p, name: e.target.value}))} className="w-full bg-primary border border-[var(--border-primary)] rounded px-2 py-1 text-[9px] outline-none" />
            <input type="url" placeholder="https://..." value={resourceForm.url} onChange={e => setResourceForm(p => ({...p, url: e.target.value}))} className="w-full bg-primary border border-[var(--border-primary)] rounded px-2 py-1 text-[9px] outline-none" autoFocus />
            <div className="flex gap-1 justify-end">
              <button onClick={() => setAddResourceTaskId(null)} className="px-2 py-1 text-[8px] font-bold text-slate-500 uppercase">Cancel</button>
              <button onClick={() => handleAddResource(task.id)} disabled={!resourceForm.url || resourceAdding} className="px-2 py-1 bg-[var(--brand-orange)] text-black rounded text-[8px] font-bold uppercase">{resourceAdding ? "Saving" : "Save"}</button>
            </div>
          </div>
        )}

        {/* Action Buttons Row */}
        <div className={`mt-1 flex items-center gap-3 ${isSub ? "ml-10" : "ml-8"}`}>
          <button onClick={() => setAddResourceTaskId(task.id)} className="flex items-center gap-1 text-[8px] font-bold uppercase text-slate-400 hover:text-emerald-400 transition-colors">
            <Plus className="w-2.5 h-2.5" /> Resource
          </button>
          {!isSub && (
            <button
              onClick={() =>
                openSubTask(task.id, task.project_id, task.category, task.title)
              }
              className="flex items-center gap-1 text-[8px] font-black uppercase tracking-wider text-indigo-400 hover:text-indigo-300 transition-all"
            >
              <Plus className="w-2.5 h-2.5" /> Sub-task
            </button>
          )}
        </div>

        {/* Sub-tasks — always visible under parent */}
        {!isSub && task.subtasks?.length > 0 && (
          <div className="mt-1 ml-4 pl-3 border-l-2 border-indigo-500/20 space-y-0.5">
            {task.subtasks.map((st) => renderTaskRow(st, true))}
          </div>
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
            <Shield className="w-3 h-3" /> Carryover Tasks ({carryOverTasks.length})
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
              <div className="relative" ref={projectDropdownRef}>
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

          {/* Resource Link */}
          <div>
            <label className="text-[7px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
              Resource Link (optional)
            </label>
            <input
              type="url"
              value={form.link}
              onChange={(e) => setForm((p) => ({ ...p, link: e.target.value }))}
              placeholder="https://..."
              className="w-full bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-1.5 text-[10px] font-bold outline-none focus:border-[var(--brand-orange)] transition-all"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={handleAddTask}
              disabled={
                creating ||
                !form.name.trim() ||
                (!form.project_id && !form.category)
              }
              className="flex-1 px-3 py-2 bg-[var(--brand-orange)] text-black rounded-lg text-[8px] font-black uppercase tracking-wider disabled:opacity-40 hover:brightness-110 transition-all"
            >
              {creating
                ? "Saving..."
                : pendingParentTaskId
                  ? "Add Sub-task"
                  : addedCount > 0
                    ? "Add Another Task"
                    : "Add Task"}
            </button>
            <button
              onClick={handleCloseForm}
              className="px-3 py-2 bg-tertiary border border-[var(--border-primary)] rounded-lg text-[8px] font-black uppercase tracking-wider text-slate-500 hover:text-[var(--text-primary)] transition-all"
            >
              {addedCount > 0 ? "Done" : "Cancel"}
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
                Parent task:{" "}
                <span className="text-white">{subTaskModal.title}</span>
              </p>
            </div>

            {/* Existing sub-tasks */}
            {(() => {
              const parentTask = tasks.find(
                (t) => String(t.id) === String(subTaskModal.id),
              );
              const subs = parentTask?.subtasks || [];
              if (subs.length === 0) return null;
              return (
                <div>
                  <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mb-2">
                    Existing sub-tasks ({subs.length})
                  </p>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {subs.map((st) => (
                      <div
                        key={st.id}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-tertiary border border-[var(--border-primary)]"
                      >
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
                        <span className="text-[10px] font-bold text-[var(--text-primary)] truncate">
                          {st.title}
                        </span>
                        <span
                          className={`ml-auto text-[7px] font-semibold px-1.5 py-0.5 rounded-full ${
                            st.status === "completed"
                              ? "bg-emerald-500/10 text-emerald-400"
                              : "bg-slate-500/10 text-slate-400"
                          }`}
                        >
                          {st.status === "completed"
                            ? "Done"
                            : st.status?.replace(/_/g, " ") || "Pending"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            <div className="space-y-3 pt-2">
              {/* Success indicator */}
              {subTaskSuccess && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="text-[9px] font-bold text-emerald-400">
                    {subTaskSuccess}
                  </span>
                </div>
              )}

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
              <div className="grid grid-cols-2 gap-2">
                <input type="date" value={subTaskStartDate} onChange={(e) => setSubTaskStartDate(e.target.value)}
                  className="w-full bg-primary border border-[var(--border-primary)] rounded-xl px-3 py-2.5 text-[10px] font-bold outline-none focus:border-[var(--brand-orange)] transition-all" />
                <input type="date" value={subTaskEndDate} onChange={(e) => setSubTaskEndDate(e.target.value)}
                  className="w-full bg-primary border border-[var(--border-primary)] rounded-xl px-3 py-2.5 text-[10px] font-bold outline-none focus:border-[var(--brand-orange)] transition-all" />
              </div>
              <input type="url" value={subTaskLink} onChange={(e) => setSubTaskLink(e.target.value)}
                placeholder="Link (optional)..."
                className="w-full bg-primary border border-[var(--border-primary)] rounded-xl px-4 py-2.5 text-[10px] font-bold outline-none focus:border-[var(--brand-orange)] transition-all" />
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

      {/* ─── EDIT TASK MODAL ─── */}
      {editTaskModal && (
        <div
          className="fixed inset-0 z-[600] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm"
          onClick={() => setEditTaskModal(null)}
        >
          <div
            className="card w-full max-w-lg space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-[var(--brand-orange)]" />
                <h3 className="text-sm font-black uppercase tracking-tight">
                  Edit Task
                </h3>
              </div>
              <button onClick={() => setEditTaskModal(null)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="space-y-3">
              <input
                type="text"
                value={editForm.name}
                onChange={(e) =>
                  setEditForm((p) => ({ ...p, name: e.target.value }))
                }
                placeholder="Task name"
                className="w-full bg-primary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-sm outline-none focus:border-[var(--brand-orange)] transition-all font-bold"
              />
              <textarea
                value={editForm.description}
                onChange={(e) =>
                  setEditForm((p) => ({ ...p, description: e.target.value }))
                }
                placeholder="Description (optional)"
                rows={2}
                className="w-full bg-primary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-sm outline-none focus:border-[var(--brand-orange)] transition-all resize-none"
              />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[8px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={editForm.start_date}
                    onChange={(e) =>
                      setEditForm((p) => ({ ...p, start_date: e.target.value }))
                    }
                    min={(() => {
                      if (
                        !editTaskModal.created_week ||
                        !editTaskModal.created_year
                      )
                        return "";
                      const jan1 = new Date(editTaskModal.created_year, 0, 1);
                      const days = (editTaskModal.created_week - 1) * 7;
                      const monday = new Date(jan1);
                      monday.setDate(
                        jan1.getDate() + days + (1 - jan1.getDay()),
                      );
                      return monday.toISOString().split("T")[0];
                    })()}
                    max={(() => {
                      if (
                        !editTaskModal.created_week ||
                        !editTaskModal.created_year
                      )
                        return "";
                      const jan1 = new Date(editTaskModal.created_year, 0, 1);
                      const days = (editTaskModal.created_week - 1) * 7;
                      const monday = new Date(jan1);
                      monday.setDate(
                        jan1.getDate() + days + (1 - jan1.getDay()),
                      );
                      const sunday = new Date(monday);
                      sunday.setDate(monday.getDate() + 6);
                      return sunday.toISOString().split("T")[0];
                    })()}
                    className="w-full bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-2 text-[11px] font-bold outline-none"
                  />
                </div>
                <div>
                  <label className="text-[8px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={editForm.due_date}
                    onChange={(e) =>
                      setEditForm((p) => ({ ...p, due_date: e.target.value }))
                    }
                    min={editForm.start_date || ""}
                    className="w-full bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-2 text-[11px] font-bold outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={async () => {
                  if (!editForm.name.trim()) return;
                  try {
                    const res = await fetch("/api/tasks", {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        id: editTaskModal.id,
                        title: editForm.name.trim(),
                        description: editForm.description || null,
                        start_date: editForm.start_date || null,
                        end_date: editForm.due_date || null,
                        user_id: uid,
                      }),
                    });
                    const data = await res.json();
                    if (data.success) {
                      setEditTaskModal(null);
                      if (onTasksChange) onTasksChange();
                    } else {
                      alert(data.error || "Failed to save task.");
                    }
                  } catch (e) {
                    alert("Network error saving task.");
                    console.error(e);
                  }
                }}
                disabled={!editForm.name.trim()}
                className="flex-1 py-3 bg-[var(--brand-orange)] text-black rounded-xl text-[9px] font-black uppercase tracking-widest hover:brightness-110 disabled:opacity-40"
              >
                Save
              </button>
              <button
                onClick={() => setEditTaskModal(null)}
                className="flex-1 py-3 bg-tertiary border border-[var(--border-primary)] rounded-xl text-[9px] font-black uppercase tracking-widest text-slate-500 hover:text-[var(--text-primary)] transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
