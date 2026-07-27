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
  Archive,
  Link as LinkIcon,
  Copy,
  Paperclip,
  AlertTriangle,
} from "lucide-react";

import { uploadFile } from "@/lib/storage";
import { useI18n } from "@/lib/i18n";

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

const PRIORITY_CONFIG = {
  critical: { label: "Critical", color: "text-red-400", bg: "bg-red-500/10" },
  high: { label: "High", color: "text-amber-400", bg: "bg-amber-500/10" },
  medium: { label: "Medium", color: "text-blue-400", bg: "bg-blue-500/10" },
  low: { label: "Low", color: "text-slate-400", bg: "bg-slate-500/10" },
};

const PRIORITY_OPTIONS = [
  { value: "critical", label: "Critical" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

const CATEGORIES = [
  "Operations",
  "Administration",
  "Marketing",
  "Finance",
  "Logistics",
  "HR",
  "Technology",
  "Research",
  "Other",
];

// ─── Main Component ──────────────────────────────────────────────────────

export default function TaskManager({
  mode = "standup", // "standup" | "project" | "my-tasks"
  projectId = null, // scoped to a project
  userId = null,
  userName = "",
  projects = [], // available projects for picker
  projectMembers = [], // available members for assignment
  taskList = [], // existing tasks from API (with subtasks nested)
  onTasksChange = null, // callback(newTaskRows) when pending tasks change
  compact = false,
  weekInfo = null, // { week, year } for standup mode
  showCarryOver = true, // show carry-over tasks section
  readOnly = false, // past-week read-only mode
}) {
  const { t } = useI18n();
  const uid = userId;

  // ── Toast notification helper ──
  const notify = (type, message) => {
    window.dispatchEvent(new CustomEvent('impactos:notify', { detail: { type, message } }));
  };

  // ── Confirmation dialog state ──
  const [confirmAction, setConfirmAction] = useState(null); // { message, onConfirm } or null
  // Get current logged-in user for permission checks
  const [currentUserId, setCurrentUserId] = useState(null);
  useEffect(() => {
    try {
      const saved = localStorage.getItem("user");
      if (saved)
        setCurrentUserId(JSON.parse(saved).cid || JSON.parse(saved).id || null);
    } catch (_) {}
  }, []);

  // Compute effective week info — fallback to current ISO week if not provided
  const effectiveWeekInfo = useMemo(() => {
    if (weekInfo?.week && weekInfo?.year) return weekInfo;
    const now = new Date();
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
    const week1 = new Date(d.getFullYear(), 0, 4);
    const week =
      1 +
      Math.round(
        ((d.getTime() - week1.getTime()) / 86400000 -
          3 +
          ((week1.getDay() + 6) % 7)) /
          7,
      );
    return { week, year: now.getFullYear() };
  }, [weekInfo]);

  const [tasks, setTasks] = useState([]);
  const [expandedTasks, setExpandedTasks] = useState({});
  const [updatingTasks, setUpdatingTasks] = useState({});
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [pendingParentTaskId, setPendingParentTaskId] = useState(null);
  const [subTaskModal, setSubTaskModal] = useState(null); // { id, project_id, category, title } or null
  const [subTaskInput, setSubTaskInput] = useState("");
  const [subTaskDescription, setSubTaskDescription] = useState("");
  const [subTaskPriority, setSubTaskPriority] = useState("medium");
  const [subTaskAssignedTo, setSubTaskAssignedTo] = useState("");
  const [subTaskStartDate, setSubTaskStartDate] = useState("");
  const [subTaskEndDate, setSubTaskEndDate] = useState("");
  const [subTaskLink, setSubTaskLink] = useState("");
  const [subTaskSuccess, setSubTaskSuccess] = useState("");
  const [availableCategories, setAvailableCategories] = useState([]);
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [editTaskModal, setEditTaskModal] = useState(null); // task object or null
  const [editForm, setEditForm] = useState({
    name: "",
    description: "",
    project_id: "",
    category: "",
    start_date: "",
    due_date: "",
    status: "",
    assigned_to: "",
    priority: "medium",
  });

  // ── Comments (Ticket 1.3 / 1.9) ──
  const [openComments, setOpenComments] = useState(null); // task id or null
  const [commentsByTask, setCommentsByTask] = useState({});
  const [loadingComments, setLoadingComments] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [postingComment, setPostingComment] = useState(false);

  const [addResourceTaskId, setAddResourceTaskId] = useState(null);
  const [resourceForm, setResourceForm] = useState({ name: "", url: "" });
  const [resourceAdding, setResourceAdding] = useState(false);
  const [resourceFile, setResourceFile] = useState(null);
  const [blockerModal, setBlockerModal] = useState(null); // { taskId, taskTitle } or null
  const [blockerTitle, setBlockerTitle] = useState("");
  const [blockerDescription, setBlockerDescription] = useState("");
  const [blockerPriority, setBlockerPriority] = useState("medium");
  const [blockerRefUrl, setBlockerRefUrl] = useState("");
  const [blockerNotes, setBlockerNotes] = useState("");
  const [blockerAdding, setBlockerAdding] = useState(false);
  // ── Blocker Discussions (Ticket 1.9) ──
  const [openBlockerDiscuss, setOpenBlockerDiscuss] = useState(null); // blocker id or null
  const [blockerMessages, setBlockerMessages] = useState({});
  const [newBlockerMsg, setNewBlockerMsg] = useState("");
  const [postingBlockerMsg, setPostingBlockerMsg] = useState(false);
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
    assigned_to: "",
    priority: "medium",
    start_date: "",
    due_date: "",
    start_time: "",
    due_time: "",
    link: "",
  });

  // Auto-populate project_id from prop when in project mode
  useEffect(() => {
    if (mode === "project" && projectId && showTaskForm) {
      setForm((p) => ({ ...p, project_id: String(projectId) }));
    }
  }, [mode, projectId, showTaskForm]);

  // Sync taskList into local state when it changes
  useEffect(() => {
    setTasks(taskList || []);
  }, [taskList]);

  // Fetch available categories from API
  useEffect(() => {
    fetch("/api/categories")
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setAvailableCategories(d.categories.map((c) => c.name));
      })
      .catch(() => {});
  }, []);

  const handleAddResource = async (taskId) => {
    if (!resourceForm.url.trim()) return;
    setResourceAdding(true);
    try {
      const res = await fetch("/api/tasks/resources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task_id: taskId,
          name: resourceForm.name,
          url: resourceForm.url,
        }),
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

  const handleUploadResourceFile = async (taskId) => {
    if (!resourceFile) return;
    setResourceAdding(true);
    try {
      const path = `${taskId}/${Date.now()}_${resourceFile.name}`;
      const upload = await uploadFile("task-attachments", path, resourceFile);
      if (!upload.success) {
        notify('error', upload.error || "Upload failed");
        return;
      }
      const res = await fetch("/api/tasks/resources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task_id: taskId,
          name: resourceFile.name,
          url: upload.url,
          type: "file",
          file_name: resourceFile.name,
          file_size: resourceFile.size,
        }),
      });
      if (res.ok) {
        if (onTasksChange) onTasksChange();
        setAddResourceTaskId(null);
        setResourceFile(null);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setResourceAdding(false);
    }
  };

  const handleDeleteResource = async (resourceId) => {
    setConfirmAction({
      message: "Delete this resource link?",
      onConfirm: () => performDeleteResource(resourceId),
    });
  };
  const performDeleteResource = async (resourceId) => {
    try {
      const res = await fetch(`/api/tasks/resources?id=${resourceId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        if (onTasksChange) onTasksChange();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // ── Comments (Ticket 1.3 / 1.9) ──
  const toggleComments = useCallback(
    async (taskId) => {
      if (openComments === taskId) {
        setOpenComments(null);
        return;
      }
      setOpenComments(taskId);
      if (!commentsByTask[taskId]) {
        setLoadingComments(true);
        try {
          const res = await fetch(`/api/tasks/comments?task_id=${taskId}`);
          const data = await res.json();
          if (data.success) {
            setCommentsByTask((prev) => ({
              ...prev,
              [taskId]: data.comments || [],
            }));
          }
        } catch (e) {
          console.error(e);
        } finally {
          setLoadingComments(false);
        }
      }
    },
    [openComments, commentsByTask],
  );

  const postComment = useCallback(
    async (taskId) => {
      const text = newComment.trim();
      if (!text) return;
      setPostingComment(true);
      try {
        const res = await fetch("/api/tasks/comments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            task_id: taskId,
            sender_id: uid,
            sender_name: userName || "User",
            body: text,
          }),
        });
        const data = await res.json();
        if (data.success) {
          setCommentsByTask((prev) => ({
            ...prev,
            [taskId]: [
              ...(prev[taskId] || []),
              {
                id: data.id,
                task_id: taskId,
                sender_id: uid,
                sender_name: userName || "User",
                body: text,
                created_at: data.created_at || new Date().toISOString(),
              },
            ],
          }));
          setNewComment("");
          if (onTasksChange) onTasksChange();
        }
      } catch (e) {
        console.error(e);
      } finally {
        setPostingComment(false);
      }
    },
    [newComment, uid, userName, onTasksChange],
  );

  // ── API: Add blocker to task ──
  const handleAddBlocker = async () => {
    if (!blockerModal || !blockerTitle.trim()) return;
    setBlockerAdding(true);
    try {
      const res = await fetch("/api/blockers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task_id: blockerModal.taskId,
          user_id: uid,
          user_name: userName || "User",
          title: blockerTitle.trim(),
          description: blockerDescription.trim() || null,
          severity: blockerPriority,
          reference_url: blockerRefUrl.trim() || null,
          notes: blockerNotes.trim() || null,
        }),
      });
      if (res.ok) {
        setBlockerModal(null);
        setBlockerTitle("");
        setBlockerDescription("");
        setBlockerPriority("medium");
        setBlockerRefUrl("");
        setBlockerNotes("");
        if (onTasksChange) onTasksChange();
      }
    } catch (e) {
      console.error(e);
    }
    setBlockerAdding(false);
  };

  // ── API: Resolve blocker ──
  const handleResolveBlocker = async (blockerId) => {
    try {
      await fetch("/api/blockers", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: blockerId,
          user_id: uid,
          status: "resolved",
          resolved_by: uid,
        }),
      });
      if (onTasksChange) onTasksChange();
    } catch (e) {
      console.error(e);
    }
  };

  // ── Blocker Discussions (Ticket 1.9) ──
  const toggleBlockerDiscuss = useCallback(
    async (blockerId) => {
      if (openBlockerDiscuss === blockerId) {
        setOpenBlockerDiscuss(null);
        return;
      }
      setOpenBlockerDiscuss(blockerId);
      setNewBlockerMsg("");
      if (!blockerMessages[blockerId]) {
        try {
          const res = await fetch(
            `/api/blockers/discuss?blocker_id=${blockerId}`,
          );
          const data = await res.json();
          if (data.success) {
            setBlockerMessages((prev) => ({
              ...prev,
              [blockerId]: data.messages || [],
            }));
          }
        } catch (_) {}
      }
    },
    [openBlockerDiscuss, blockerMessages],
  );

  const postBlockerMessage = useCallback(
    async (blockerId) => {
      const text = newBlockerMsg.trim();
      if (!text) return;
      setPostingBlockerMsg(true);
      try {
        const res = await fetch("/api/blockers/discuss", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            blocker_id: blockerId,
            sender_id: uid,
            sender_name: userName || "User",
            body: text,
          }),
        });
        const data = await res.json();
        if (data.success) {
          setBlockerMessages((prev) => ({
            ...prev,
            [blockerId]: [
              ...(prev[blockerId] || []),
              {
                id: data.id,
                sender_id: uid,
                sender_name: userName || "User",
                body: text,
                blocker_id: blockerId,
                created_at: new Date().toISOString(),
              },
            ],
          }));
          setNewBlockerMsg("");
        }
      } catch (_) {}
      setPostingBlockerMsg(false);
    },
    [newBlockerMsg, uid, userName],
  );

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
        if (typeof window !== "undefined") {
          window.__refreshDashboard?.();
          window.__refreshAdminDashboard?.();
        }
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
      const week = effectiveWeekInfo || { week: 0, year: 0 };
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: taskData.title,
          description: taskData.description || null,
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
          assigned_to: taskData.assigned_to || null,
          link: taskData.link || null,
          priority: taskData.priority || "medium",
        }),
      });
      return await res.json();
    },
    [uid, userName, effectiveWeekInfo],
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
      assigned_to: form.assigned_to || null,
      start_date: form.start_date || null,
      due_date: form.due_date || null,
      link: form.link || null,
      priority: form.priority || "medium",
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
      if (typeof window !== "undefined") {
        window.__refreshDashboard?.();
        window.__refreshAdminDashboard?.();
      }
    } else {
      alert(data.error || "Failed to create task.");
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
      assigned_to: "",
      priority: "medium",
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
      description: subTaskDescription || null,
      project_id: subTaskModal.project_id || null,
      category: subTaskModal.category || null,
      parent_task_id: subTaskModal.id,
      assigned_to: subTaskAssignedTo || null,
      priority: subTaskPriority || "medium",
      start_date: subTaskStartDate || null,
      due_date: subTaskEndDate || null,
      link: subTaskLink || null,
    });

    if (data.success) {
      setSubTaskInput("");
      setSubTaskDescription("");
      setSubTaskAssignedTo("");
      setSubTaskPriority("medium");
      setSubTaskStartDate("");
      setSubTaskEndDate("");
      setSubTaskLink("");
      setSubTaskSuccess("Sub-task added!");
      setTimeout(() => setSubTaskSuccess(""), 2000);
      if (onTasksChange) onTasksChange();
      if (typeof window !== "undefined") {
        window.__refreshDashboard?.();
        window.__refreshAdminDashboard?.();
      }
    }
  }, [
    subTaskInput,
    subTaskDescription,
    subTaskAssignedTo,
    subTaskPriority,
    subTaskModal,
    subTaskStartDate,
    subTaskEndDate,
    subTaskLink,
    createTask,
    onTasksChange,
  ]);

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
    if (mode === "standup" && effectiveWeekInfo) {
      return tasks.filter(
        (t) =>
          t.created_week === effectiveWeekInfo.week &&
          t.created_year === effectiveWeekInfo.year,
      );
    }
    return tasks;
  }, [tasks, mode, effectiveWeekInfo]);

  const carryOverTasks = useMemo(
    () =>
      tasks.filter(
        (t) =>
          !["completed", "archived"].includes(t.status) &&
          t.created_week !== effectiveWeekInfo?.week &&
          !t.parent_task_id,
      ),
    [tasks, effectiveWeekInfo],
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
          {/* Checkbox — always available for sub-tasks (independent completion, Ticket 1.3).
              For parent tasks, hidden in standup mode since the status dropdown covers it. */}
          {(mode !== "standup" || isSub) &&
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
                  disabled={isUpdating || readOnly}
                  className={`w-4 h-4 rounded-full border-2 shrink-0 transition-all hover:scale-110 ${task.status === "completed" ? "bg-emerald-500 border-emerald-500" : "border-slate-600 hover:border-emerald-400"} ${isUpdating ? "opacity-50 animate-pulse" : ""} ${readOnly ? "opacity-50 cursor-not-allowed" : ""}`}
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
              {(() => {
                const total = task.subtasks.length;
                const done = task.subtasks.filter(
                  (s) => s.status === "completed",
                ).length;
                const allDone = done === total;
                return (
                  <span
                    className={`text-[7px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0 ${allDone ? "text-emerald-400 bg-emerald-500/10" : "text-indigo-400 bg-indigo-500/10"}`}
                    title={`${done} of ${total} sub-tasks completed`}
                  >
                    {done}/{total} done
                  </span>
                );
              })()}
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

          {/* Priority badge */}
          {task.priority && task.priority !== "medium" && (
            <span
              className={cn(
                "text-[7px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0",
                PRIORITY_CONFIG[task.priority]?.bg,
                PRIORITY_CONFIG[task.priority]?.color,
              )}
            >
              {PRIORITY_CONFIG[task.priority]?.label || task.priority}
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
              {task.end_date && (
                <span
                  className="text-slate-500 flex items-center gap-1"
                  title="Due date"
                >
                  <span className="text-[8px]">
                    {new Date(task.end_date).toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "2-digit",
                    })}
                  </span>
                </span>
              )}
            </div>
          )}

          {/* Status dropdown */}
          {!isSub && (
            <select
              value={task.status || "pending"}
              onChange={(e) => updateStatus(task.id, e.target.value)}
              disabled={readOnly}
              className={`text-[8px] font-semibold px-1.5 py-0.5 rounded-full border-0 outline-none appearance-none shrink-0 ${readOnly ? "opacity-60 cursor-not-allowed" : "cursor-pointer"} ${cfg.bg} ${cfg.color}`}
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value} className="bg-primary">
                  {o.label}
                </option>
              ))}
            </select>
          )}

          {/* Blockers button */}
          <button
            onClick={() =>
              setBlockerModal({ taskId: task.id, taskTitle: task.title })
            }
            className={`shrink-0 transition-all ${(task.blockers || []).filter((b) => b.status === "active").length > 0 ? "text-rose-400" : "text-slate-500 hover:text-rose-400"}`}
            title={
              (task.blockers || []).filter((b) => b.status === "active")
                .length > 0
                ? `${(task.blockers || []).filter((b) => b.status === "active").length} active blocker(s)`
                : "Add blocker"
            }
          >
            <Shield className="w-3 h-3" />
            {(task.blockers || []).filter((b) => b.status === "active").length >
              0 && (
              <span className="text-[7px] font-black ml-0.5">
                {
                  (task.blockers || []).filter((b) => b.status === "active")
                    .length
                }
              </span>
            )}
          </button>

          {/* Edit button — parent AND sub tasks */}
          {!readOnly && (
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
                  assigned_to: task.assigned_to || "",
                  priority: task.priority || "medium",
                });
                setEditTaskModal(task);
              }}
              className="text-slate-500 hover:text-[var(--brand-orange)] transition-all shrink-0"
              title="Edit task"
            >
              <Edit3 className="w-3 h-3" />
            </button>
          )}

          {/* Archive button — always visible */}
          {!readOnly && (
            <button
              onClick={() => {
                setConfirmAction({
                  message: `Archive task "${task.title}"? Archived tasks will not carry over to future weeks.`,
                  onConfirm: async () => {
                    try {
                      const res = await fetch("/api/tasks", {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ id: task.id, status: "archived" }),
                      });
                      const data = await res.json();
                      if (data.success) {
                        if (onTasksChange) onTasksChange();
                      } else {
                        notify('error', data.error || "Failed to archive task.");
                      }
                    } catch (e) {
                      notify('error', "Network error while archiving task.");
                    }
                  },
                });
              }}
              className="text-slate-500 hover:text-amber-500 transition-all shrink-0"
              title="Archive task"
            >
              <Archive className="w-3 h-3" />
            </button>
          )}

          {/* Duplicate button — always visible */}
          {!readOnly && (
            <button
              onClick={async () => {
                try {
                  const res = await fetch("/api/tasks/duplicate", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ task_id: task.id }),
                  });
                  const data = await res.json();
                  if (data.success) {
                    if (onTasksChange) onTasksChange();
                  } else {
                    notify('error', data.error || "Failed to duplicate task.");
                  }
                } catch (e) {
                  notify('error', "Network error while duplicating task.");
                }
              }}
              className="text-slate-500 hover:text-[var(--brand-orange)] transition-all shrink-0"
              title="Duplicate task"
            >
              <Copy className="w-3 h-3" />
            </button>
          )}

          {/* Delete / Archive based on week — parent AND sub tasks */}
          {!readOnly &&
            (() => {
              const isPastWeek =
                effectiveWeekInfo &&
                (task.created_week !== effectiveWeekInfo.week ||
                  task.created_year !== effectiveWeekInfo.year);
              if (isPastWeek) {
                // Past-week tasks can only be archived, not deleted
                return (
                  <button
                    onClick={() => {
                      setConfirmAction({
                        message: `Archive task "${task.title}"? Archived tasks will not carry over to future weeks.`,
                        onConfirm: async () => {
                          try {
                            const res = await fetch("/api/tasks", {
                              method: "PUT",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ id: task.id, status: "archived" }),
                            });
                            const data = await res.json();
                            if (data.success) {
                              if (onTasksChange) onTasksChange();
                            } else {
                              notify('error', data.error || "Failed to archive task.");
                            }
                          } catch (e) {
                            notify('error', "Network error while archiving task.");
                          }
                        },
                      });
                    }}
                    className="text-slate-500 hover:text-amber-500 transition-all shrink-0"
                    title="Archive task (past week — cannot delete)"
                  >
                    <Archive className="w-3 h-3" />
                  </button>
                );
              }
              return (
                <button
                  onClick={() => {
                    setConfirmAction({
                      message: `Delete task "${task.title}"?`,
                      onConfirm: async () => {
                        try {
                          const res = await fetch(`/api/tasks?id=${task.id}`, {
                            method: "DELETE",
                          });
                          const data = await res.json();
                          if (data.success) {
                            if (onTasksChange) onTasksChange();
                          } else {
                            notify('error',
                              data.error ||
                                "Cannot delete this task. It may be locked (older than 12 hours).",
                            );
                          }
                        } catch (e) {
                          notify('error', "Network error while deleting task.");
                        }
                      },
                    });
                  }}
                  className="text-slate-500 hover:text-rose-500 transition-all shrink-0"
                  title="Delete task"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              );
            })()}

          {/* Move up/down buttons */}
          {!readOnly && !isSub && (
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
          <div
            className={`mt-1 flex flex-col gap-1 ${isSub ? "ml-10" : "ml-8"}`}
          >
            {task.resources.map((r) => (
              <div key={r.id} className="flex items-center gap-2 group">
                <a
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] text-[var(--brand-orange)] hover:underline flex items-center gap-1 max-w-[200px] truncate"
                >
                  {r.type === "file" ? (
                    <Paperclip className="w-2.5 h-2.5 shrink-0" />
                  ) : (
                    <LinkIcon className="w-2.5 h-2.5 shrink-0" />
                  )}
                  {r.name || r.url}
                </a>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(r.url);
                    notify('info', "URL copied!");
                  }}
                  className="text-slate-500 opacity-0 group-hover:opacity-100 hover:text-emerald-400 transition-opacity"
                  title="Copy URL"
                >
                  <Copy className="w-2.5 h-2.5" />
                </button>
                {!readOnly && (
                  <button
                    onClick={() => handleDeleteResource(r.id)}
                    className="text-slate-500 opacity-0 group-hover:opacity-100 hover:text-rose-400 transition-opacity"
                    title="Remove URL"
                  >
                    <Trash2 className="w-2.5 h-2.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {addResourceTaskId === task.id && (
          <div
            className={`mt-1 p-2 rounded-lg bg-tertiary border border-[var(--border-primary)] flex flex-col gap-2 ${isSub ? "ml-10" : "ml-8"} w-fit min-w-[250px]`}
          >
            <input
              type="text"
              placeholder="Resource Name (optional)"
              value={resourceForm.name}
              onChange={(e) =>
                setResourceForm((p) => ({ ...p, name: e.target.value }))
              }
              className="w-full bg-primary border border-[var(--border-primary)] rounded px-2 py-1 text-[9px] outline-none"
            />
            <input
              type="url"
              placeholder="https://..."
              value={resourceForm.url}
              onChange={(e) =>
                setResourceForm((p) => ({ ...p, url: e.target.value }))
              }
              className="w-full bg-primary border border-[var(--border-primary)] rounded px-2 py-1 text-[9px] outline-none"
              autoFocus
            />
            <input
              type="file"
              onChange={(e) => setResourceFile(e.target.files?.[0] || null)}
              className="w-full text-[9px] text-slate-400 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-[8px] file:font-bold file:bg-[var(--brand-orange)] file:text-black"
            />
            <div className="flex gap-1 justify-end">
              <button
                onClick={() => setAddResourceTaskId(null)}
                className="px-2 py-1 text-[8px] font-bold text-slate-500 uppercase"
              >
                Cancel
              </button>
              <button
                onClick={() => handleUploadResourceFile(task.id)}
                disabled={!resourceFile || resourceAdding}
                className="px-2 py-1 bg-[var(--brand-orange)] text-black rounded text-[8px] font-bold uppercase"
              >
                Upload
              </button>
              <button
                onClick={() => handleAddResource(task.id)}
                disabled={!resourceForm.url || resourceAdding}
                className="px-2 py-1 bg-[var(--brand-orange)] text-black rounded text-[8px] font-bold uppercase"
              >
                {resourceAdding ? "Saving" : "Save"}
              </button>
            </div>
          </div>
        )}

        {/* Action Buttons Row */}
        <div
          className={`mt-1 flex items-center gap-3 ${isSub ? "ml-10" : "ml-8"}`}
        >
          {!readOnly && (
            <button
              onClick={() => setAddResourceTaskId(task.id)}
              className="flex items-center gap-1 text-[8px] font-bold uppercase text-slate-400 hover:text-emerald-400 transition-colors"
            >
              <Plus className="w-2.5 h-2.5" /> Resource
            </button>
          )}
          <button
            onClick={() => toggleComments(task.id)}
            className="flex items-center gap-1 text-[8px] font-bold uppercase text-slate-400 hover:text-blue-400 transition-colors"
          >
            <MessageSquare className="w-2.5 h-2.5" />
            Comments{task.commentCount > 0 ? ` (${task.commentCount})` : ""}
          </button>
          {!readOnly && !isSub && (
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

        {/* Comments thread */}
        {openComments === task.id && (
          <div
            className={`mt-1 p-2 rounded-lg bg-tertiary border border-[var(--border-primary)] flex flex-col gap-2 ${isSub ? "ml-10" : "ml-8"} max-w-md`}
          >
            {loadingComments ? (
              <p className="text-[9px] text-slate-500 italic">Loading...</p>
            ) : (commentsByTask[task.id] || []).length === 0 ? (
              <p className="text-[9px] text-slate-500 italic">
                No comments yet.
              </p>
            ) : (
              <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto">
                {(commentsByTask[task.id] || []).map((c) => (
                  <div key={c.id} className="text-[9px]">
                    <span className="font-black text-[var(--text-primary)]">
                      {c.sender_name || c.sender_id}:{" "}
                    </span>
                    <span className="text-[var(--text-secondary)]">
                      {c.body}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {!readOnly && (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") postComment(task.id);
                  }}
                  placeholder="Write a comment..."
                  className="flex-1 bg-primary border border-[var(--border-primary)] rounded px-2 py-1 text-[9px] outline-none"
                />
                <button
                  onClick={() => postComment(task.id)}
                  disabled={!newComment.trim() || postingComment}
                  className="px-2 py-1 bg-[var(--brand-orange)] text-black rounded text-[8px] font-bold uppercase disabled:opacity-40"
                >
                  Send
                </button>
              </div>
            )}
          </div>
        )}

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
            <Shield className="w-3 h-3" /> Carryover Tasks (
            {carryOverTasks.length})
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
                      // Only clear project_id when no project is already assigned
                      project_id: (!p.project_id && e.target.value) ? "" : p.project_id,
                    }))
                  }
                  className="w-full bg-primary border border-[var(--border-primary)] rounded-lg px-2 py-1.5 text-[10px] font-bold text-purple-400 outline-none appearance-none cursor-pointer"
                >
                  <option value="">—</option>
                  {availableCategories.length > 0
                    ? availableCategories.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))
                    : CATEGORIES.map((c) => (
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

          {/* Assignee + Priority row */}
          <div className="grid grid-cols-2 gap-2">
            {mode === "project" && projectMembers.length > 0 && (
              <div>
                <label className="text-[7px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Assign to
                </label>
                <select
                  value={form.assigned_to || ""}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, assigned_to: e.target.value }))
                  }
                  className="w-full bg-primary border border-[var(--border-primary)] rounded-lg px-2 py-1.5 text-[10px] font-bold text-emerald-400 outline-none appearance-none cursor-pointer"
                >
                  <option value="">Self</option>
                  {projectMembers.map((m) => (
                    <option
                      key={m.member_id || m.user_cid}
                      value={m.member_id || m.user_cid}
                    >
                      {m.name || m.member_id}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="text-[7px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                Priority
              </label>
              <select
                value={form.priority || "medium"}
                onChange={(e) =>
                  setForm((p) => ({ ...p, priority: e.target.value }))
                }
                className={cn(
                  "w-full bg-primary border border-[var(--border-primary)] rounded-lg px-2 py-1.5 text-[10px] font-bold outline-none appearance-none cursor-pointer",
                  PRIORITY_CONFIG[form.priority || "medium"]?.color,
                )}
              >
                {PRIORITY_OPTIONS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

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
        !readOnly && (
          <button
            onClick={() => setShowTaskForm(true)}
            className="flex items-center gap-2 px-3 py-2 bg-[var(--brand-orange)] text-black rounded-lg text-[8px] font-black uppercase tracking-wider hover:brightness-110 transition-all w-fit"
          >
            <Plus className="w-3 h-3" /> New Task
          </button>
        )
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
                          className={`text-[7px] font-semibold px-1.5 py-0.5 rounded-full ${
                            st.status === "completed"
                              ? "bg-emerald-500/10 text-emerald-400"
                              : "bg-slate-500/10 text-slate-400"
                          }`}
                        >
                          {st.status === "completed"
                            ? "Done"
                            : st.status?.replace(/_/g, " ") || "Pending"}
                        </span>
                        <button
                          onClick={() => {
                            setConfirmAction({
                              message: `Delete subtask "${st.title}"?`,
                              onConfirm: async () => {
                                try {
                                  const res = await fetch(
                                    `/api/tasks?id=${st.id}`,
                                    {
                                      method: "DELETE",
                                    },
                                  );
                                  const data = await res.json();
                                  if (data.success) {
                                    if (onTasksChange) onTasksChange();
                                  } else {
                                    notify('error',
                                      data.error ||
                                        "Cannot delete this subtask. It may be older than 12 hours.",
                                    );
                                  }
                                } catch (e) {
                                  notify('error', "Network error while deleting subtask.");
                                }
                              },
                            });
                          }}
                          className="text-slate-500 hover:text-rose-500 transition-all shrink-0"
                          title="Delete subtask"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
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
                  if (e.key === "Enter" && !e.shiftKey) addSubTaskFromModal();
                }}
                placeholder="Enter sub-task name..."
                className="w-full bg-primary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-sm outline-none focus:border-[var(--brand-orange)] transition-all"
                autoFocus
              />
              <textarea
                value={subTaskDescription}
                onChange={(e) => setSubTaskDescription(e.target.value)}
                placeholder="Description (optional)..."
                rows={2}
                className="w-full bg-primary border border-[var(--border-primary)] rounded-xl px-4 py-2.5 text-[10px] font-bold outline-none focus:border-[var(--brand-orange)] transition-all resize-none"
              />
              <div className="grid grid-cols-2 gap-2">
                {projectMembers.length > 0 && (
                  <select
                    value={subTaskAssignedTo}
                    onChange={(e) => setSubTaskAssignedTo(e.target.value)}
                    className="w-full bg-primary border border-[var(--border-primary)] rounded-xl px-3 py-2.5 text-[10px] font-bold text-emerald-400 outline-none appearance-none cursor-pointer"
                  >
                    <option value="">Assign: Self</option>
                    {projectMembers.map((m) => (
                      <option
                        key={m.member_id || m.user_cid}
                        value={m.member_id || m.user_cid}
                      >
                        {m.name || m.member_id}
                      </option>
                    ))}
                  </select>
                )}
                <select
                  value={subTaskPriority}
                  onChange={(e) => setSubTaskPriority(e.target.value)}
                  className={cn(
                    "w-full bg-primary border border-[var(--border-primary)] rounded-xl px-3 py-2.5 text-[10px] font-bold outline-none appearance-none cursor-pointer",
                    PRIORITY_CONFIG[subTaskPriority]?.color,
                  )}
                >
                  {PRIORITY_OPTIONS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label} Priority
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  value={subTaskStartDate}
                  onChange={(e) => setSubTaskStartDate(e.target.value)}
                  className="w-full bg-primary border border-[var(--border-primary)] rounded-xl px-3 py-2.5 text-[10px] font-bold outline-none focus:border-[var(--brand-orange)] transition-all"
                />
                <input
                  type="date"
                  value={subTaskEndDate}
                  onChange={(e) => setSubTaskEndDate(e.target.value)}
                  className="w-full bg-primary border border-[var(--border-primary)] rounded-xl px-3 py-2.5 text-[10px] font-bold outline-none focus:border-[var(--brand-orange)] transition-all"
                />
              </div>
              <input
                type="url"
                value={subTaskLink}
                onChange={(e) => setSubTaskLink(e.target.value)}
                placeholder="Link (optional)..."
                className="w-full bg-primary border border-[var(--border-primary)] rounded-xl px-4 py-2.5 text-[10px] font-bold outline-none focus:border-[var(--brand-orange)] transition-all"
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

              <div>
                <label className="text-[8px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Priority
                </label>
                <select
                  value={editForm.priority || "medium"}
                  onChange={(e) =>
                    setEditForm((p) => ({ ...p, priority: e.target.value }))
                  }
                  className={cn(
                    "w-full bg-primary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-sm outline-none focus:border-[var(--brand-orange)] transition-all font-bold appearance-none cursor-pointer",
                    PRIORITY_CONFIG[editForm.priority || "medium"]?.color,
                  )}
                >
                  {PRIORITY_OPTIONS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Assignee dropdown (project mode only) */}
              {mode === "project" && projectMembers.length > 0 && (
                <div>
                  <label className="text-[8px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Assign to
                  </label>
                  <select
                    value={editForm.assigned_to || ""}
                    onChange={(e) =>
                      setEditForm((p) => ({
                        ...p,
                        assigned_to: e.target.value,
                      }))
                    }
                    className="w-full bg-primary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-sm outline-none focus:border-[var(--brand-orange)] transition-all font-bold text-emerald-400"
                  >
                    <option value="">Self</option>
                    {projectMembers.map((m) => (
                      <option
                        key={m.member_id || m.user_cid}
                        value={m.member_id || m.user_cid}
                      >
                        {m.name || m.member_id}
                      </option>
                    ))}
                  </select>
                </div>
              )}

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
                        assigned_to: editForm.assigned_to || null,
                        priority: editForm.priority || "medium",
                        user_id: uid,
                      }),
                    });
                    const data = await res.json();
                    if (data.success) {
                      setEditTaskModal(null);
                      if (onTasksChange) onTasksChange();
                    } else {
                      notify('error', data.error || "Failed to save task.");
                    }
                  } catch (e) {
                    notify('error', "Network error saving task.");
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

      {/* ─── Blocker Modal ─── */}
      {blockerModal && (
        <div
          className="fixed inset-0 z-[600] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm"
          onClick={() => {
            setBlockerModal(null);
            setBlockerTitle("");
          }}
        >
          <div
            className="w-full max-w-sm bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-rose-400" />
                <span className="text-xs font-black uppercase tracking-wider text-rose-400">
                  Blockers
                </span>
              </div>
              <button
                onClick={() => {
                  setBlockerModal(null);
                  setBlockerTitle("");
                }}
              >
                <X className="w-5 h-5 text-[var(--text-secondary)]" />
              </button>
            </div>

            <p className="text-[10px] font-bold text-[var(--text-primary)]">
              {blockerModal.taskTitle}
            </p>

            {/* Existing blockers */}
            {(() => {
              const taskBlockers =
                tasks.find((t) => t.id === blockerModal.taskId)?.blockers || [];
              const activeBlockers = taskBlockers.filter(
                (b) => b.status === "active",
              );
              const resolvedBlockers = taskBlockers.filter(
                (b) => b.status !== "active",
              );
              return (
                <>
                  {activeBlockers.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-[8px] font-black text-rose-400 uppercase tracking-widest">
                        Active ({activeBlockers.length})
                      </p>
                      {activeBlockers.map((b) => (
                        <div
                          key={b.id}
                          className="flex flex-col p-2 rounded-lg bg-rose-500/10 border border-rose-500/20"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-rose-400 font-bold">
                                {b.title}
                              </span>
                              <span className="text-[7px] font-black uppercase text-rose-500/60">
                                {b.severity || "medium"}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => toggleBlockerDiscuss(b.id)}
                                className="px-2 py-0.5 text-[7px] font-black uppercase bg-blue-500/20 text-blue-400 rounded hover:bg-blue-500 hover:text-white transition-all"
                              >
                                Discuss
                              </button>
                              {!readOnly && (
                                <button
                                  onClick={() => handleResolveBlocker(b.id)}
                                  className="px-2 py-0.5 text-[7px] font-black uppercase bg-rose-500/20 text-rose-400 rounded hover:bg-rose-500 hover:text-white transition-all"
                                >
                                  Resolve
                                </button>
                              )}
                            </div>
                          </div>
                          {(b.description || b.reference_url || b.notes) && (
                            <div className="mt-1.5 pt-1.5 border-t border-rose-500/10 space-y-1">
                              {b.description && (
                                <p className="text-[9px] text-slate-400">
                                  {b.description}
                                </p>
                              )}
                              {b.reference_url && (
                                <a
                                  href={b.reference_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[8px] text-blue-400 underline break-all"
                                >
                                  {b.reference_url}
                                </a>
                              )}
                              {b.notes && (
                                <p className="text-[8px] text-slate-500 italic">
                                  {b.notes}
                                </p>
                              )}
                            </div>
                          )}
                          {/* Discussion thread */}
                          {openBlockerDiscuss === b.id && (
                            <div className="mt-2 pt-2 border-t border-rose-500/10 space-y-1.5">
                              {(blockerMessages[b.id] || []).map((msg) => (
                                <div key={msg.id} className="text-[9px]">
                                  <span className="font-black text-[var(--text-primary)]">
                                    {msg.sender_name || msg.sender_id}:{" "}
                                  </span>
                                  <span className="text-[var(--text-secondary)]">
                                    {msg.body}
                                  </span>
                                </div>
                              ))}
                              {!readOnly && (
                                <div className="flex items-center gap-1 pt-1">
                                  <input
                                    type="text"
                                    value={newBlockerMsg}
                                    onChange={(e) =>
                                      setNewBlockerMsg(e.target.value)
                                    }
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter")
                                        postBlockerMessage(b.id);
                                    }}
                                    placeholder="Reply..."
                                    className="flex-1 bg-primary border border-[var(--border-primary)] rounded px-2 py-1 text-[9px] outline-none"
                                  />
                                  <button
                                    onClick={() => postBlockerMessage(b.id)}
                                    disabled={
                                      !newBlockerMsg.trim() || postingBlockerMsg
                                    }
                                    className="px-2 py-1 bg-blue-500 text-white rounded text-[8px] font-bold uppercase disabled:opacity-40"
                                  >
                                    Send
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {resolvedBlockers.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">
                        Resolved ({resolvedBlockers.length})
                      </p>
                      {resolvedBlockers.map((b) => (
                        <div
                          key={b.id}
                          className="flex items-center p-2 rounded-lg bg-slate-500/10"
                        >
                          <span className="text-[10px] text-slate-400 font-bold line-through">
                            {b.title}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              );
            })()}

            {/* New blocker input */}
            {!readOnly && (
              <div className="space-y-2">
                <input
                  type="text"
                  value={blockerTitle}
                  onChange={(e) => setBlockerTitle(e.target.value)}
                  placeholder={t("staff.opReport.blockerTitlePlaceholder")}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[11px] font-bold outline-none focus:border-rose-500/50"
                  autoFocus
                />
                <textarea
                  value={blockerDescription}
                  onChange={(e) => setBlockerDescription(e.target.value)}
                  placeholder={t(
                    "staff.opReport.blockerDescriptionPlaceholder",
                  )}
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[10px] outline-none focus:border-rose-500/50 resize-none"
                />
                <div className="flex gap-2">
                  <select
                    value={blockerPriority}
                    onChange={(e) => setBlockerPriority(e.target.value)}
                    className="flex-1 px-2 py-1.5 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[10px] font-bold outline-none"
                  >
                    <option value="low">
                      {t("staff.opReport.priorityLow")}
                    </option>
                    <option value="medium">
                      {t("staff.opReport.priorityMedium")}
                    </option>
                    <option value="high">
                      {t("staff.opReport.priorityHigh")}
                    </option>
                    <option value="critical">
                      {t("staff.opReport.priorityCritical")}
                    </option>
                  </select>
                  <input
                    type="url"
                    value={blockerRefUrl}
                    onChange={(e) => setBlockerRefUrl(e.target.value)}
                    placeholder={t(
                      "staff.opReport.blockerReferenceUrlPlaceholder",
                    )}
                    className="flex-[2] px-2 py-1.5 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[10px] outline-none focus:border-rose-500/50"
                  />
                </div>
                <textarea
                  value={blockerNotes}
                  onChange={(e) => setBlockerNotes(e.target.value)}
                  placeholder={t("staff.opReport.blockerNotesPlaceholder")}
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[10px] outline-none focus:border-rose-500/50 resize-none"
                />
                <button
                  onClick={handleAddBlocker}
                  disabled={!blockerTitle.trim() || blockerAdding}
                  className="w-full px-4 py-2 bg-rose-500 text-white rounded-lg text-[9px] font-black uppercase tracking-wider disabled:opacity-30 hover:bg-rose-600 transition-all"
                >
                  {blockerAdding
                    ? t("staff.opReport.addingBlocker")
                    : t("staff.opReport.addBlockerButton")}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── CONFIRM DIALOG MODAL ─── */}
      {confirmAction && (
        <div
          className="fixed inset-0 z-[700] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm"
          onClick={() => setConfirmAction(null)}
        >
          <div
            className="card w-full max-w-sm space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0" />
              <div>
                <h3 className="text-sm font-black uppercase tracking-tight">
                  Confirm Action
                </h3>
                <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                  {confirmAction.message}
                </p>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => {
                  const cb = confirmAction.onConfirm;
                  setConfirmAction(null);
                  cb();
                }}
                className="flex-1 px-4 py-2.5 bg-rose-500 text-white rounded-xl text-[9px] font-black uppercase tracking-wider hover:bg-rose-600 transition-all"
              >
                Confirm
              </button>
              <button
                onClick={() => setConfirmAction(null)}
                className="flex-1 px-4 py-2.5 bg-tertiary border border-[var(--border-primary)] rounded-xl text-[9px] font-black uppercase tracking-wider text-slate-400 hover:text-[var(--text-primary)] transition-all"
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
