"use client";

import { useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { useApi } from "@/lib/hooks/useApi";
import { useDialogs } from "@/components/ui/DialogProvider";
import { useI18n } from "@/lib/i18n";
import { STATUS_ORDER } from "@/components/admin/ventures/tasks/taskConstants";
import VentureTasksHeader from "@/components/admin/ventures/tasks/VentureTasksHeader";
import VentureTasksArchiveBar from "@/components/admin/ventures/tasks/VentureTasksArchiveBar";
import VentureTasksArchived from "@/components/admin/ventures/tasks/VentureTasksArchived";
import VentureTasksKanban from "@/components/admin/ventures/tasks/VentureTasksKanban";
import VentureTasksListView from "@/components/admin/ventures/tasks/VentureTasksListView";
import VentureTaskDrawer from "@/components/admin/ventures/tasks/VentureTaskDrawer";
import VentureTaskModal from "@/components/admin/ventures/tasks/VentureTaskModal";
import VentureTasksLoading from "@/components/admin/ventures/tasks/VentureTasksLoading";

// ─── Module-scope readers ────────────────────────────────────────────────────
// The reading hook keys its internal work on these, so they are made once here
// rather than rebuilt on every render.

const EMPTY_TASKS = { list: [], byStatus: {} };

const pickVenture = (payload) => (payload?.success ? payload.venture || null : null);
const pickTasks = (payload) =>
  payload?.success ? { list: payload.tasks || [], byStatus: payload.by_status || {} } : EMPTY_TASKS;

/** The create/edit form's shape; `blocked_by` holds the ids this task depends on. */
const EMPTY_TASK_FORM = {
  title: "", description: "", priority: "medium", status: "todo", due_date: "",
  estimated_hours: "", assigned_cid: "", assigned_name: "", labels: [], milestone_id: "", blocked_by: [],
};

export default function VentureTasksPage() {
  const { id } = useParams();
  const router = useRouter();
  const { t } = useI18n();
  const { confirm } = useDialogs();
  const [view, setView] = useState("kanban"); // kanban | list
  const [toast, setToast] = useState(null);
  const [dragOver, setDragOver] = useState(null);

  // Task detail drawer
  const [selectedTask, setSelectedTask] = useState(null);
  const [showDrawer, setShowDrawer] = useState(false);

  // Create/edit modal
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editTask, setEditTask] = useState(null);
  const [tForm, setTForm] = useState(() => ({ ...EMPTY_TASK_FORM }));
  const [saving, setSaving] = useState(false);
  const [dupBusy, setDupBusy] = useState(null);
  // Archive (soft delete): archived view + inline result banner.
  const [viewArchived, setViewArchived] = useState(false);
  const [archBusy, setArchBusy] = useState(false);
  const [archMsg, setArchMsg] = useState(null);

  // Comment input
  const [commentText, setCommentText] = useState("");
  const [comments, setComments] = useState([]);
  const [showComments, setShowComments] = useState(false);

  // Search
  const [search, setSearch] = useState("");

  // The venture and its tasks, through the shared hook: it owns the cache, the
  // cache-first paint and the discarding of a stale answer, so the page keeps no
  // copy of its own and reads its data during render. Archived tasks come back in
  // the same answer and are split for display.
  const { data: venture, loading: ventureLoading } = useApi(
    id ? `/api/ventures/${id}` : null,
    { defaultValue: null, transform: pickVenture, deps: [id] },
  );
  const {
    data: tasksPayload,
    loading: tasksLoading,
    refresh: refreshTasks,
  } = useApi(id ? `/api/ventures/${id}/tasks?include_archived=1` : null, {
    defaultValue: EMPTY_TASKS,
    transform: pickTasks,
    deps: [id],
  });
  const tasks = tasksPayload.list;
  const byStatus = tasksPayload.byStatus;

  const loading = ventureLoading || tasksLoading;

  // Every action below re-reads what it changed.
  const reload = useCallback(() => {
    refreshTasks();
  }, [refreshTasks]);

  const notify = (msg, type = "success") => {
    setToast({ msg, type }); setTimeout(() => setToast(null), 4000);
  };

  const openTask = async (task) => {
    setSelectedTask(task);
    setShowDrawer(true);
    setShowComments(false);
    try {
      const response = await fetch(`/api/ventures/${id}/tasks?id=${task.id}&action=get_comments`, { method: "PATCH" });
      const payload = await response.json();
      if (payload.success) setComments(payload.comments || []);
    } catch {}
  };

  const openCreateTask = () => {
    setEditTask(null);
    setTForm({ ...EMPTY_TASK_FORM });
    setShowTaskModal(true);
  };

  // Editing an EXISTING task: the same form, pre-filled — including the tasks it
  // currently depends on, so the editor starts from the truth.
  const openEditTask = (task) => {
    setEditTask(task);
    setTForm({
      title: task.title || "",
      description: task.description || "",
      priority: task.priority || "medium",
      status: task.status || "todo",
      due_date: task.due_date ? String(task.due_date).slice(0, 10) : "",
      estimated_hours: task.estimated_hours ?? "",
      assigned_cid: task.assigned_cid || "",
      assigned_name: task.assigned_name || "",
      labels: task.labels || [],
      milestone_id: task.milestone_id ? String(task.milestone_id) : "",
      blocked_by: (task.blocked_by_ids || []).map(String),
    });
    setShowTaskModal(true);
  };

  const toggleBlockedBy = (taskId) => {
    const id = String(taskId);
    setTForm((previous) => ({
      ...previous,
      blocked_by: previous.blocked_by.includes(id)
        ? previous.blocked_by.filter((existing) => existing !== id)
        : [...previous.blocked_by, id],
    }));
  };

  const updateTaskStatus = async (taskId, newStatus) => {
    try {
      const response = await fetch(`/api/ventures/${id}/tasks?id=${taskId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: newStatus }),
      });
      const payload = await response.json().catch(() => ({}));
      // A dependency-held task refuses to move forward — say WHY, by name.
      if (!payload.success) notify(payload.error || t("vadmin.tasks.dependencyRefused"), "error");
      reload();
    } catch {}
  };

  // Duplicate a task as an independent structure copy (same milestone binding,
  // fresh backlog copy; submissions/reviews/history stay with the source).
  const duplicateTask = async (task) => {
    if (!(await confirm({ message: t("vadmin.tasks.duplicateConfirm", { name: task.title }) }))) return;
    setDupBusy(task.id);
    try {
      const response = await fetch(`/api/ventures/${id}/tasks/duplicate`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task_id: task.id }),
      });
      const data = await response.json();
      if (data.success) { notify(t("vadmin.tasks.duplicateSuccess")); reload(); }
      else notify(data.error || t("venture.manager.duplicateStageFailed"), "error");
    } catch { notify(t("venture.manager.duplicateStageFailed"), "error"); }
    setDupBusy(null);
  };

  const handleDragStart = (event, taskId) => {
    event.dataTransfer.setData("taskId", taskId);
  };

  const handleDrop = (event, status) => {
    event.preventDefault();
    setDragOver(null);
    const taskId = event.dataTransfer.getData("taskId");
    if (taskId) updateTaskStatus(parseInt(taskId), status);
  };

  const handleDragOver = (event, status) => {
    event.preventDefault();
    setDragOver(status);
  };

  const handleDragLeave = () => setDragOver(null);

  const createOrUpdateTask = async () => {
    if (!tForm.title.trim()) { notify(t("vadmin.tasks.titleRequired"), "error"); return; }
    setSaving(true);
    try {
      const response = editTask
        ? await fetch(`/api/ventures/${id}/tasks?id=${editTask.id}`, {
            method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(tForm),
          })
        : await fetch(`/api/ventures/${id}/tasks`, {
            method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...tForm, milestone_id: tForm.milestone_id || null }),
          });
      const payload = await response.json().catch(() => ({}));
      if (!payload.success) {
        // A refused dependency set (a loop) names itself; the modal stays open.
        notify(payload.error || t("vadmin.tasks.saveFailed"), "error");
        setSaving(false);
        return;
      }
      notify(editTask ? t("vadmin.tasks.updated") : t("vadmin.tasks.created"));
      setShowTaskModal(false);
      setEditTask(null);
      setTForm({ ...EMPTY_TASK_FORM });
      reload();
    } catch { notify(t("vadmin.tasks.saveFailed"), "error"); }
    setSaving(false);
  };

  const addComment = async () => {
    if (!commentText.trim() || !selectedTask) return;
    try {
      await fetch(`/api/ventures/${id}/tasks?id=${selectedTask.id}&action=add_comment`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body: commentText.trim() }),
      });
      setCommentText("");
      const response = await fetch(`/api/ventures/${id}/tasks?id=${selectedTask.id}&action=get_comments`, { method: "PATCH" });
      const payload = await response.json();
      if (payload.success) setComments(payload.comments || []);
    } catch { notify("Failed to add comment", "error"); }
  };

  // ── Archive (soft delete) actions ───────────────────────────────────────
  const showArchMsg = (msg, type = "success") => {
    setArchMsg({ msg, type });
    setTimeout(() => setArchMsg(null), 6000);
  };

  const runArchive = async (ids, action) => {
    if (!ids.length) return;
    setArchBusy(true);
    try {
      const response = await fetch(`/api/ventures/${id}/tasks/archive`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, action }),
      });
      const payload = await response.json();
      if (payload.success) {
        const done = action === "restore" ? payload.restored || [] : payload.archived || [];
        const blocked = payload.blocked || [];
        const parts = [];
        if (done.length) parts.push(action === "restore" ? t("vadmin.tasks.restoredOk", { n: done.length }) : t("vadmin.tasks.archivedOk", { n: done.length }));
        if (blocked.length) parts.push(blocked[0]?.reason || t("vadmin.tasks.blockedMsg", { n: blocked.length }));
        showArchMsg(parts.join(" — ") || t("vadmin.tasks.archivedOk", { n: 0 }), blocked.length && !done.length ? "error" : "success");
      } else {
        showArchMsg(payload.error || t("venture.manager.duplicateStageFailed"), "error");
      }
    } catch {
      showArchMsg(t("venture.manager.duplicateStageFailed"), "error");
    }
    setArchBusy(false);
    await reload();
  };

  const archiveOne = async (task) => {
    if (!(await confirm({ message: t("vadmin.tasks.archiveConfirm", { name: task.title }), tone: "danger" }))) return;
    runArchive([String(task.id)], "archive");
  };
  const restoreOne = async (task) => {
    if (!(await confirm({ message: t("vadmin.tasks.restoreConfirm", { name: task.title }) }))) return;
    runArchive([String(task.id)], "restore");
  };

  const activeTasks = tasks.filter((task) => task.is_archived !== true);
  const archivedTasks = tasks.filter((task) => task.is_archived === true);

  const filteredTasks = (viewArchived ? archivedTasks : activeTasks).filter((task) => {
    if (!search) return true;
    const query = search.toLowerCase();
    return task.title?.toLowerCase().includes(query) || task.description?.toLowerCase().includes(query) || task.assigned_name?.toLowerCase().includes(query);
  });

  const filteredByStatus = {};
  if (search) {
    for (const status of STATUS_ORDER) filteredByStatus[status] = filteredTasks.filter((task) => task.status === status);
  }

  const displayByStatus = search ? filteredByStatus : byStatus;

  if (loading) return <VentureTasksLoading />;

  const totalTasks = activeTasks.length;
  const doneTasks = activeTasks.filter((task) => task.status === "done").length;

  return (
    <>
      <div className="space-y-8 pb-20">
        {toast && (
          <div className={`fixed top-6 right-6 z-[60] px-5 py-3 rounded-xl shadow-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-3 ${toast.type === "error" ? "bg-rose-600 text-white" : "bg-emerald-600 text-white"}`}>
            {toast.type === "error" ? <AlertCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}{toast.msg}
          </div>
        )}

        <VentureTasksHeader
          router={router}
          id={id}
          venture={venture}
          totalTasks={totalTasks}
          doneTasks={doneTasks}
          view={view}
          setView={setView}
          search={search}
          setSearch={setSearch}
          openCreateTask={openCreateTask}
        />

        <VentureTasksArchiveBar
          t={t}
          viewArchived={viewArchived}
          setViewArchived={setViewArchived}
          setSearch={setSearch}
          activeTasks={activeTasks}
          archivedTasks={archivedTasks}
          archMsg={archMsg}
          setArchMsg={setArchMsg}
        />

        {/* Archived view: soft-deleted tasks with restore */}
        {viewArchived ? (
          <VentureTasksArchived
            t={t}
            archivedTasks={archivedTasks}
            filteredTasks={filteredTasks}
            archBusy={archBusy}
            restoreOne={restoreOne}
          />
        ) : (
        <>
        {/* Kanban Board */}
        {view === "kanban" && (
          <VentureTasksKanban
            t={t}
            displayByStatus={displayByStatus}
            dragOver={dragOver}
            handleDragOver={handleDragOver}
            handleDragLeave={handleDragLeave}
            handleDrop={handleDrop}
            handleDragStart={handleDragStart}
            openTask={openTask}
            archiveOne={archiveOne}
            duplicateTask={duplicateTask}
            archBusy={archBusy}
            dupBusy={dupBusy}
          />
        )}

        {/* List View */}
        {view === "list" && (
          <VentureTasksListView
            t={t}
            filteredTasks={filteredTasks}
            openTask={openTask}
            archiveOne={archiveOne}
            duplicateTask={duplicateTask}
            archBusy={archBusy}
            dupBusy={dupBusy}
          />
        )}
        </>
        )}
      </div>

      <VentureTaskDrawer
        t={t}
        id={id}
        showDrawer={showDrawer}
        selectedTask={selectedTask}
        setShowDrawer={setShowDrawer}
        openEditTask={openEditTask}
        updateTaskStatus={updateTaskStatus}
        setSelectedTask={setSelectedTask}
        comments={comments}
        showComments={showComments}
        setShowComments={setShowComments}
        commentText={commentText}
        setCommentText={setCommentText}
        addComment={addComment}
      />

      <VentureTaskModal
        t={t}
        showTaskModal={showTaskModal}
        setShowTaskModal={setShowTaskModal}
        editTask={editTask}
        tForm={tForm}
        setTForm={setTForm}
        createOrUpdateTask={createOrUpdateTask}
        saving={saving}
        activeTasks={activeTasks}
        toggleBlockedBy={toggleBlockedBy}
      />
    </>
  );
}
