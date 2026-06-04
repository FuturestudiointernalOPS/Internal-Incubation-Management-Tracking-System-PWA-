"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  ArrowLeft,
  Briefcase,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ListTodo,
  Shield,
  Users,
  Target,
  Activity,
  ChevronRight,
  Calendar,
  User,
  MessageSquare,
  RefreshCw,
  Edit3,
  Send,
  FileText,
  UserPlus,
  Plus,
  Rocket,
} from "lucide-react";
import { useRouter, useParams } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useI18n } from "@/lib/i18n";

/**
 * PROJECT DETAIL PAGE
 *
 * Single project view with:
 *   - Overview (progress, stats, timeline health)
 *   - Team (auto-derived from task assignments + collaborators)
 *   - Tasks (with status, owner, due date, blockers)
 *   - Blockers (per-project)
 *   - Activity Timeline (chronological feed)
 */

const STATUS_COLORS = {
  Active: "text-emerald-500",
  Completed: "text-purple-500",
  Paused: "text-amber-500",
  Archived: "text-slate-500",
};

const STATUS_BG = {
  Active: "bg-emerald-500/10",
  Completed: "bg-purple-500/10",
  Paused: "bg-amber-500/10",
  Archived: "bg-slate-500/10",
};

const TASK_STATUS_COLORS = {
  completed: "text-emerald-500",
  in_progress: "text-blue-500",
  blocked: "text-rose-500",
  carried_over: "text-amber-500",
  pending: "text-slate-500",
};

const TASK_STATUS_BG = {
  completed: "bg-emerald-500/10",
  in_progress: "bg-blue-500/10",
  blocked: "bg-rose-500/10",
  carried_over: "bg-amber-500/10",
  pending: "bg-slate-500/10",
};

function getWeekNumber(date) {
  const d = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return {
    week: Math.ceil(((d - yearStart) / 86400000 + 1) / 7),
    year: d.getUTCFullYear(),
  };
}

export default function ProjectDetail() {
  const router = useRouter();
  const params = useParams();
  const { t } = useI18n();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [taskFilter, setTaskFilter] = useState("all");
  const [blockerFilter, setBlockerFilter] = useState("all");
  const [updates, setUpdates] = useState([]);
  const [updatesLoading, setUpdatesLoading] = useState(false);
  const [updateForm, setUpdateForm] = useState({
    accomplishments: "",
    current_focus: "",
    blockers: "",
    next_steps: "",
    overall_status: "on_track",
    notes: "",
  });
  const [savingUpdate, setSavingUpdate] = useState(false);
  const [allStaff, setAllStaff] = useState([]);
  const [approvalRequests, setApprovalRequests] = useState([]);
  const [approvalsLoading, setApprovalsLoading] = useState(false);
  const [showNewTaskForm, setShowNewTaskForm] = useState(false);
  const [newTaskForm, setNewTaskForm] = useState({
    title: "",
    description: "",
    assigned_to: "",
    end_date: "",
  });
  const [creatingTask, setCreatingTask] = useState(false);

  const projectId = params?.id;

  const fetchProject = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/projects/${projectId}`);
      const data = await res.json();
      if (data.success) {
        setProject(data.project);
      } else {
        setError(data.error || "Failed to load project");
      }
    } catch (e) {
      setError("Network error loading project");
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const fetchStaff = useCallback(async () => {
    try {
      const res = await fetch("/api/contacts");
      const data = await res.json();
      if (data.success) {
        setAllStaff(
          data.contacts?.filter(
            (c) => c.status === "active" && c.role !== "participant",
          ) || [],
        );
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  const fetchApprovals = useCallback(async () => {
    if (!projectId) return;
    setApprovalsLoading(true);
    try {
      const res = await fetch(`/api/admin/projects/${projectId}/approvals`);
      const data = await res.json();
      if (data.success) setApprovalRequests(data.requests || []);
    } catch (e) {
      console.error("Failed to fetch approvals:", e);
    } finally {
      setApprovalsLoading(false);
    }
  }, [projectId]);

  const handleApprovalAction = async (requestId, action, rejectionReason) => {
    try {
      const res = await fetch(`/api/admin/projects/${projectId}/approvals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          request_id: requestId,
          reviewer_id: project.owner_id || "sa",
          reviewer_name: project.owner_name || "Project Owner",
          action,
          rejection_reason: rejectionReason || null,
        }),
      });
      const data = await res.json();
      if (data.success) fetchApprovals();
    } catch (e) {
      console.error("Approval action error:", e);
    }
  };

  const fetchUpdates = useCallback(async () => {
    if (!projectId) return;
    setUpdatesLoading(true);
    try {
      const res = await fetch(`/api/admin/projects/${projectId}/updates`);
      const data = await res.json();
      if (data.success) setUpdates(data.updates || []);
    } catch (e) {
      console.error("Failed to fetch updates:", e);
    } finally {
      setUpdatesLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  useEffect(() => {
    fetchStaff();
  }, [fetchStaff]);

  useEffect(() => {
    fetchApprovals();
  }, [fetchApprovals]);

  useEffect(() => {
    fetchUpdates();
  }, [fetchUpdates]);

  const handleSubmitUpdate = async () => {
    setSavingUpdate(true);
    try {
      const res = await fetch(`/api/admin/projects/${projectId}/updates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...updateForm,
          user_id: project.owner_id || "sa",
          user_name: project.owner_name || "Project Owner",
          status: "submitted",
        }),
      });
      const data = await res.json();
      if (data.success) {
        fetchUpdates();
        setUpdateForm({
          accomplishments: "",
          current_focus: "",
          blockers: "",
          next_steps: "",
          overall_status: "on_track",
          notes: "",
        });
      }
    } catch (e) {
      console.error("Failed to save update:", e);
    } finally {
      setSavingUpdate(false);
    }
  };

  const filteredTasks = React.useMemo(() => {
    if (!project?.tasks) return [];
    if (taskFilter === "all") return project.tasks;
    return project.tasks.filter((t) => t.status === taskFilter);
  }, [project?.tasks, taskFilter]);

  const filteredBlockers = React.useMemo(() => {
    if (!project?.blockers) return [];
    if (blockerFilter === "all") return project.blockers;
    return project.blockers.filter((b) => b.status === blockerFilter);
  }, [project?.blockers, blockerFilter]);

  const activeBlockersCount = React.useMemo(() => {
    return (project?.blockers || []).filter((b) => b.status === "active")
      .length;
  }, [project?.blockers]);

  // Loading state
  if (loading) {
    return (
      <DashboardLayout role="super_admin">
        <div className="space-y-8 pb-20 text-left">
          {/* Skeleton header */}
          <div className="animate-pulse space-y-4">
            <div className="h-4 w-24 bg-[var(--bg-tertiary)] rounded" />
            <div className="h-10 w-64 bg-[var(--bg-tertiary)] rounded" />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-8">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="h-20 bg-[var(--bg-tertiary)] rounded-xl"
                />
              ))}
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // Error state
  if (error || !project) {
    return (
      <DashboardLayout role="super_admin">
        <div className="flex flex-col items-center justify-center py-32">
          <AlertTriangle className="w-16 h-16 text-rose-500 mb-4" />
          <p className="text-base font-black text-rose-500">
            {error || "Project not found"}
          </p>
          <button
            onClick={() => router.push("/admin/projects")}
            className="mt-6 flex items-center gap-2 px-4 py-2 bg-[var(--brand-orange)] text-black rounded-lg text-[9px] font-black uppercase tracking-widest hover:brightness-110 transition-all"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Projects
          </button>
        </div>
      </DashboardLayout>
    );
  }

  const tasks = project.tasks || [];
  const blockers = project.blockers || [];
  const members = project.members || [];
  const timeline = project.timeline || [];

  return (
    <DashboardLayout role="super_admin">
      <div className="space-y-8 pb-20 text-left">
        {/* ─── TOAST NOTIFICATIONS ─── */}

        {/* ─── HEADER ─── */}
        <header className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 border-b border-[var(--border-primary)] pb-8">
          <div className="space-y-3">
            <button
              onClick={() => router.push("/admin/projects")}
              className="group flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--brand-orange)] transition-all font-bold text-[9px] uppercase tracking-widest"
            >
              <ArrowLeft className="w-3 h-3 group-hover:-translate-x-1 transition-transform" />{" "}
              All Projects
            </button>
            <div className="flex items-center gap-3 mt-1">
              <div className="w-10 h-10 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-primary)] flex items-center justify-center">
                <Briefcase className="w-5 h-5 text-[var(--brand-orange)]" />
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-3xl lg:text-4xl font-black text-[var(--text-primary)] uppercase tracking-tighter">
                    {project.name}
                  </h1>
                  <span
                    className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded ${STATUS_BG[project.status] || "bg-slate-500/10"} ${STATUS_COLORS[project.status] || "text-slate-400"}`}
                  >
                    {project.status}
                  </span>
                </div>
                <div className="flex items-center gap-4 mt-1.5">
                  {project.owner_name && (
                    <div className="flex items-center gap-1.5 text-[10px] text-[var(--text-secondary)]">
                      <User className="w-3 h-3" />
                      <span className="font-bold">{project.owner_name}</span>
                    </div>
                  )}
                  {project.program_name && (
                    <div className="flex items-center gap-1.5 text-[10px] text-[var(--text-secondary)]">
                      <Briefcase className="w-3 h-3" />
                      <span className="font-bold">{project.program_name}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 text-[10px] text-[var(--text-secondary)]">
                    <Calendar className="w-3 h-3" />
                    <span className="font-bold">
                      Created{" "}
                      {new Date(project.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <button
            onClick={fetchProject}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-[var(--border-primary)] hover:bg-tertiary transition-all text-[9px] font-black uppercase tracking-widest"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </header>

        {/* ─── OVERVIEW STATS CARDS ─── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="card flex items-center gap-3 p-4">
            <div className="p-2.5 rounded-xl bg-emerald-500/10">
              <Target className="w-4 h-4 text-emerald-500" />
            </div>
            <div>
              <p className="text-[7px] font-bold text-slate-500 uppercase tracking-widest">
                Progress
              </p>
              <p className="text-xl font-black text-emerald-500">
                {project.completionRate || 0}%
              </p>
            </div>
          </div>
          <div className="card flex items-center gap-3 p-4">
            <div className="p-2.5 rounded-xl bg-white/5">
              <ListTodo className="w-4 h-4 text-[var(--text-primary)]" />
            </div>
            <div>
              <p className="text-[7px] font-bold text-slate-500 uppercase tracking-widest">
                Tasks
              </p>
              <p className="text-xl font-black">
                {project.taskStats?.total || 0}
              </p>
            </div>
          </div>
          <div className="card flex items-center gap-3 p-4">
            <div className="p-2.5 rounded-xl bg-rose-500/10">
              <Shield className="w-4 h-4 text-rose-500" />
            </div>
            <div>
              <p className="text-[7px] font-bold text-slate-500 uppercase tracking-widest">
                Active Blockers
              </p>
              <p className="text-xl font-black text-rose-500">
                {activeBlockersCount}
              </p>
            </div>
          </div>
          <div className="card flex items-center gap-3 p-4">
            <div className="p-2.5 rounded-xl bg-blue-500/10">
              <Users className="w-4 h-4 text-blue-500" />
            </div>
            <div>
              <p className="text-[7px] font-bold text-slate-500 uppercase tracking-widest">
                Team
              </p>
              <p className="text-xl font-black text-blue-500">
                {members.length}
              </p>
            </div>
          </div>
        </div>

        {/* ─── TAB NAVIGATION (SCROLLABLE) ─── */}
        <div className="relative">
          {/* Fade edges */}
          <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-[var(--bg-primary)] to-transparent z-10 pointer-events-none" />
          <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-[var(--bg-primary)] to-transparent z-10 pointer-events-none" />
          <div className="overflow-x-auto custom-scrollbar pb-1">
            <div className="flex items-center gap-1 border-b border-[var(--border-primary)] min-w-max px-2">
              {[
                { id: "overview", label: "OVERVIEW", icon: Activity },
                {
                  id: "tasks",
                  label: `TASKS (${tasks.length})`,
                  icon: ListTodo,
                },
                {
                  id: "blockers",
                  label: `BLOCKERS (${blockers.length})`,
                  icon: Shield,
                },
                { id: "team", label: `TEAM (${members.length})`, icon: Users },
                { id: "updates", label: "UPDATE", icon: FileText },
                {
                  id: "approvals",
                  label: `REQUESTS${approvalRequests.filter((r) => r.status === "pending").length > 0 ? ` (${approvalRequests.filter((r) => r.status === "pending").length})` : ""}`,
                  icon: UserPlus,
                },
                { id: "timeline", label: "TIMELINE", icon: Clock },
              ].map((tab) => {
                const isActive = activeTab === tab.id;
                const TabIcon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-1.5 px-3 py-3 text-[9px] font-black uppercase tracking-widest transition-all border-b-2 -mb-[1px] shrink-0 whitespace-nowrap ${
                      isActive
                        ? "border-[var(--brand-orange)] text-[var(--brand-orange)]"
                        : "border-transparent text-slate-500 hover:text-[var(--text-primary)]"
                    }`}
                  >
                    <TabIcon className="w-3 h-3 shrink-0" />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ─── TAB: OVERVIEW ─── */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* Progress bar */}
            <div className="card space-y-3">
              <h3 className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                Overall Progress
              </h3>
              <div className="flex items-center gap-4">
                <div className="flex-1 h-3 bg-[var(--bg-primary)] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                    style={{ width: `${project.completionRate || 0}%` }}
                  />
                </div>
                <span className="text-sm font-black text-emerald-500">
                  {project.completionRate || 0}%
                </span>
              </div>
            </div>

            {/* Task breakdown */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {[
                {
                  label: "Completed",
                  count: project.taskStats?.completed || 0,
                  color: "text-emerald-500",
                  bg: "bg-emerald-500/10",
                },
                {
                  label: "In Progress",
                  count: project.taskStats?.in_progress || 0,
                  color: "text-blue-500",
                  bg: "bg-blue-500/10",
                },
                {
                  label: "Blocked",
                  count: project.taskStats?.blocked || 0,
                  color: "text-rose-500",
                  bg: "bg-rose-500/10",
                },
                {
                  label: "Carried Over",
                  count: project.taskStats?.carried_over || 0,
                  color: "text-amber-500",
                  bg: "bg-amber-500/10",
                },
                {
                  label: "Pending",
                  count: project.taskStats?.pending || 0,
                  color: "text-slate-500",
                  bg: "bg-slate-500/10",
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className={`card p-3 text-center ${item.bg}`}
                >
                  <p className={`text-lg font-black ${item.color}`}>
                    {item.count}
                  </p>
                  <p
                    className={`text-[7px] font-bold uppercase tracking-widest mt-1 ${item.color}`}
                  >
                    {item.label}
                  </p>
                </div>
              ))}
            </div>

            {/* Timeline Health */}
            {project.timelineHealth !== undefined && (
              <div className="card space-y-2">
                <h3 className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                  Timeline Coverage
                </h3>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-2 bg-[var(--bg-primary)] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full"
                      style={{ width: `${project.timelineHealth}%` }}
                    />
                  </div>
                  <span className="text-xs font-bold text-blue-500">
                    {project.timelineHealth}% of tasks have start/end dates
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── TAB: TASKS ─── */}
        {activeTab === "tasks" && (
          <div className="space-y-4">
            {/* Create Task inline */}
            {showNewTaskForm ? (
              <div className="card border border-[var(--brand-orange)]/30 bg-[var(--brand-orange)]/[0.02] space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-[9px] font-black text-[var(--brand-orange)] uppercase tracking-widest">
                    ✦ Create Task
                  </h3>
                  <button
                    onClick={() => setShowNewTaskForm(false)}
                    className="text-[9px] font-black uppercase tracking-widest text-slate-500 hover:text-[var(--text-primary)]"
                  >
                    Cancel
                  </button>
                </div>
                <div>
                  <label className="text-[8px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Task Name
                  </label>
                  <input
                    value={newTaskForm.title}
                    onChange={(e) =>
                      setNewTaskForm((f) => ({
                        ...f,
                        title: e.target.value,
                      }))
                    }
                    placeholder="e.g. Homepage Design"
                    className="w-full bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-2 text-xs font-bold outline-none focus:border-[var(--brand-orange)]"
                  />
                </div>
                <div>
                  <label className="text-[8px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Description
                  </label>
                  <textarea
                    value={newTaskForm.description}
                    onChange={(e) =>
                      setNewTaskForm((f) => ({
                        ...f,
                        description: e.target.value,
                      }))
                    }
                    placeholder="Optional description"
                    rows={2}
                    className="w-full bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-2 text-xs font-bold outline-none focus:border-[var(--brand-orange)] resize-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[8px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                      Assign To
                    </label>
                    <select
                      value={newTaskForm.assigned_to}
                      onChange={(e) =>
                        setNewTaskForm((f) => ({
                          ...f,
                          assigned_to: e.target.value,
                        }))
                      }
                      className="w-full bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-2 text-xs font-bold outline-none text-[var(--text-primary)] appearance-none cursor-pointer"
                    >
                      <option value="">Unassigned</option>
                      {members.map((m) => (
                        <option key={m.member_id} value={m.member_id}>
                          {m.name || m.member_id}
                        </option>
                      ))}
                      {allStaff.map((s) => (
                        <option key={s.cid || s.id} value={s.cid || s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[8px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                      Due Date
                    </label>
                    <input
                      type="date"
                      value={newTaskForm.end_date}
                      onChange={(e) =>
                        setNewTaskForm((f) => ({
                          ...f,
                          end_date: e.target.value,
                        }))
                      }
                      className="w-full bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-2 text-xs font-bold outline-none focus:border-[var(--brand-orange)]"
                    />
                  </div>
                </div>
                <button
                  onClick={async () => {
                    if (!newTaskForm.title.trim()) return;
                    setCreatingTask(true);
                    try {
                      const weekInfo = getWeekNumber(new Date());
                      const res = await fetch("/api/tasks", {
                        method: "POST",
                        headers: {
                          "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                          title: newTaskForm.title.trim(),
                          description: newTaskForm.description || null,
                          user_id: project.owner_id || "sa",
                          user_name: project.owner_name || "Project Owner",
                          assigned_to: newTaskForm.assigned_to || null,
                          project_id: project.id,
                          end_date: newTaskForm.end_date || null,
                          status: "in_progress",
                          created_week: weekInfo.week,
                          created_year: weekInfo.year,
                        }),
                      });
                      const data = await res.json();
                      if (data.success) {
                        setShowNewTaskForm(false);
                        setNewTaskForm({
                          title: "",
                          description: "",
                          assigned_to: "",
                          end_date: "",
                        });
                        fetchProject();
                      }
                    } catch (e) {
                      console.error(e);
                    } finally {
                      setCreatingTask(false);
                    }
                  }}
                  disabled={creatingTask || !newTaskForm.title.trim()}
                  className="w-full py-2.5 bg-[var(--brand-orange)] text-black rounded-lg text-[9px] font-black uppercase tracking-widest hover:brightness-110 transition-all disabled:opacity-50"
                >
                  {creatingTask ? "Creating..." : "Create Task"}
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowNewTaskForm(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-[var(--brand-orange)] text-black rounded-lg text-[9px] font-black uppercase tracking-widest hover:brightness-110 transition-all w-fit"
              >
                <Plus className="w-3.5 h-3.5" /> Create Task
              </button>
            )}

            {/* Task filter */}
            <div className="flex items-center gap-2 flex-wrap">
              {[
                { id: "all", label: `All (${tasks.length})` },
                {
                  id: "completed",
                  label: `Completed (${project.taskStats?.completed || 0})`,
                },
                {
                  id: "in_progress",
                  label: `In Progress (${project.taskStats?.in_progress || 0})`,
                },
                {
                  id: "blocked",
                  label: `Blocked (${project.taskStats?.blocked || 0})`,
                },
                {
                  id: "carried_over",
                  label: `Carried Over (${project.taskStats?.carried_over || 0})`,
                },
                {
                  id: "pending",
                  label: `Pending (${project.taskStats?.pending || 0})`,
                },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setTaskFilter(f.id)}
                  className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
                    taskFilter === f.id
                      ? "bg-[var(--brand-orange)] text-black"
                      : "bg-tertiary text-slate-500 hover:text-[var(--text-primary)]"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Task table */}
            {filteredTasks.length === 0 ? (
              <div className="card py-16 flex flex-col items-center justify-center text-center opacity-50 border-dashed">
                <ListTodo className="w-12 h-12 mb-3" />
                <p className="text-[10px] font-bold uppercase tracking-widest">
                  No tasks found
                </p>
                <p className="text-[9px] text-slate-500 mt-1">
                  Tasks linked to this project will appear here.
                </p>
              </div>
            ) : (
              <div className="card !p-0 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-[var(--border-primary)]">
                        <th className="text-left p-3 text-[8px] font-black text-slate-500 uppercase tracking-widest">
                          Task
                        </th>
                        <th className="text-left p-3 text-[8px] font-black text-slate-500 uppercase tracking-widest">
                          Owner
                        </th>
                        <th className="text-center p-3 text-[8px] font-black text-slate-500 uppercase tracking-widest">
                          Status
                        </th>
                        <th className="text-center p-3 text-[8px] font-black text-slate-500 uppercase tracking-widest">
                          Due
                        </th>
                        <th className="text-center p-3 text-[8px] font-black text-slate-500 uppercase tracking-widest">
                          Blockers
                        </th>
                        <th className="text-center p-3 text-[8px] font-black text-slate-500 uppercase tracking-widest">
                          Subtasks
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTasks.map((task) => {
                        const taskBlockers = task.blockers || [];
                        const activeTaskBlockers = taskBlockers.filter(
                          (b) => b.status === "active",
                        );
                        return (
                          <tr
                            key={task.id}
                            className="border-b border-[var(--border-primary)]/50 hover:bg-white/5 transition-colors"
                          >
                            <td className="p-3">
                              <div>
                                <p className="text-[11px] font-bold text-[var(--text-primary)]">
                                  {task.title || "Untitled"}
                                </p>
                                {task.description && (
                                  <p className="text-[9px] text-slate-500 mt-0.5 line-clamp-1">
                                    {task.description}
                                  </p>
                                )}
                              </div>
                            </td>
                            <td className="p-3">
                              <div className="flex items-center gap-1.5">
                                <div className="w-5 h-5 rounded-full bg-primary border border-[var(--border-primary)] flex items-center justify-center text-[6px] font-black uppercase">
                                  {(
                                    task.assignee_name ||
                                    task.user_name ||
                                    "?"
                                  ).charAt(0)}
                                </div>
                                <span className="text-[10px] font-bold">
                                  {task.assignee_name ||
                                    task.user_name ||
                                    "Unassigned"}
                                </span>
                              </div>
                            </td>
                            <td className="p-3 text-center">
                              <span
                                className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${
                                  TASK_STATUS_BG[task.status] ||
                                  "bg-slate-500/10"
                                } ${
                                  TASK_STATUS_COLORS[task.status] ||
                                  "text-slate-400"
                                }`}
                              >
                                {task.status.replace(/_/g, " ")}
                              </span>
                            </td>
                            <td className="p-3 text-center">
                              {task.end_date ? (
                                <span className="text-[10px] font-bold">
                                  {new Date(task.end_date).toLocaleDateString()}
                                </span>
                              ) : task.start_date ? (
                                <span className="text-[10px] font-bold text-slate-500">
                                  {new Date(
                                    task.start_date,
                                  ).toLocaleDateString()}
                                </span>
                              ) : (
                                <span className="text-[9px] text-slate-600">
                                  —
                                </span>
                              )}
                            </td>
                            <td className="p-3 text-center">
                              {activeTaskBlockers.length > 0 ? (
                                <span className="text-[10px] font-black text-rose-500">
                                  {activeTaskBlockers.length} active
                                </span>
                              ) : taskBlockers.length > 0 ? (
                                <span className="text-[9px] text-slate-600">
                                  {taskBlockers.length} resolved
                                </span>
                              ) : (
                                <span className="text-[9px] text-slate-600">
                                  0
                                </span>
                              )}
                            </td>
                            <td className="p-3 text-center">
                              {task.subtasks && task.subtasks.length > 0 ? (
                                <span className="text-[10px] font-black text-indigo-500">
                                  {task.subtasks.length}
                                </span>
                              ) : (
                                <span className="text-[9px] text-slate-600">
                                  —
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── TAB: BLOCKERS ─── */}
        {activeTab === "blockers" && (
          <div className="space-y-4">
            {/* Blocker filter */}
            <div className="flex items-center gap-2 flex-wrap">
              {[
                { id: "all", label: `All (${blockers.length})` },
                {
                  id: "active",
                  label: `Active (${blockers.filter((b) => b.status === "active").length})`,
                },
                {
                  id: "resolved",
                  label: `Resolved (${blockers.filter((b) => b.status === "resolved").length})`,
                },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setBlockerFilter(f.id)}
                  className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
                    blockerFilter === f.id
                      ? "bg-[var(--brand-orange)] text-black"
                      : "bg-tertiary text-slate-500 hover:text-[var(--text-primary)]"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {filteredBlockers.length === 0 ? (
              <div className="card py-16 flex flex-col items-center justify-center text-center opacity-50 border-dashed">
                <Shield className="w-12 h-12 mb-3" />
                <p className="text-[10px] font-bold uppercase tracking-widest">
                  No blockers found
                </p>
                <p className="text-[9px] text-slate-500 mt-1">
                  All blockers for this project will appear here.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredBlockers.map((blocker) => (
                  <div
                    key={blocker.id}
                    className={`card flex items-start gap-3 p-4 border-l-4 ${
                      blocker.status === "active"
                        ? "border-l-rose-500"
                        : "border-l-emerald-500"
                    }`}
                  >
                    <div
                      className={`p-2 rounded-lg ${
                        blocker.status === "active"
                          ? "bg-rose-500/10"
                          : "bg-emerald-500/10"
                      }`}
                    >
                      <Shield
                        className={`w-4 h-4 ${
                          blocker.status === "active"
                            ? "text-rose-500"
                            : "text-emerald-500"
                        }`}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-[11px] font-bold text-[var(--text-primary)]">
                          {blocker.title}
                        </p>
                        <span
                          className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${
                            blocker.status === "active"
                              ? "bg-rose-500/10 text-rose-500"
                              : "bg-emerald-500/10 text-emerald-500"
                          }`}
                        >
                          {blocker.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1.5 text-[9px] text-slate-500">
                        {blocker.task_title && (
                          <span>
                            Task:{" "}
                            <span className="font-bold text-[var(--text-secondary)]">
                              {blocker.task_title}
                            </span>
                          </span>
                        )}
                        {blocker.user_name && (
                          <span>
                            by{" "}
                            <span className="font-bold">
                              {blocker.user_name}
                            </span>
                          </span>
                        )}
                        <span>
                          {new Date(blocker.created_at).toLocaleDateString()}
                        </span>
                        {blocker.severity && (
                          <span
                            className={`font-bold uppercase ${
                              blocker.severity === "high" ||
                              blocker.severity === "critical"
                                ? "text-rose-500"
                                : "text-slate-500"
                            }`}
                          >
                            {blocker.severity}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ─── TAB: TEAM ─── */}
        {activeTab === "team" && (
          <div className="space-y-6">
            {/* Owner Section */}
            <div className="card border-l-4 border-l-[var(--brand-orange)]">
              <div className="flex items-center gap-2 mb-3">
                <Rocket className="w-4 h-4 text-[var(--brand-orange)]" />
                <span className="text-[9px] font-black uppercase tracking-widest text-[var(--brand-orange)]">
                  Project Owner
                </span>
              </div>
              {project.owner_name ? (
                <div className="flex items-center gap-3 p-3 rounded-xl bg-[var(--brand-orange)]/[0.04] border border-[var(--brand-orange)]/20">
                  <div className="w-10 h-10 rounded-full bg-[var(--brand-orange)]/20 border border-[var(--brand-orange)]/30 flex items-center justify-center text-xs font-black text-[var(--brand-orange)]">
                    {project.owner_name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[var(--text-primary)]">
                      {project.owner_name}
                    </p>
                    <p className="text-[8px] text-slate-500 mt-0.5">
                      Accountable for project delivery
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-[10px] text-slate-500 italic">
                  No owner assigned
                </p>
              )}
            </div>

            {/* Collaborators Section */}
            <div className="card border-l-4 border-l-blue-500">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-500" />
                  <span className="text-[9px] font-black uppercase tracking-widest text-blue-500">
                    Collaborators
                  </span>
                </div>
                <span className="text-[9px] font-bold text-slate-500">
                  {members.length} total
                </span>
              </div>

              {/* Collaborator list */}
              {members.length === 0 ? (
                <p className="text-[10px] text-slate-500 italic text-center py-6">
                  No collaborators yet. Add team members to this project.
                </p>
              ) : (
                <div className="space-y-1.5 mb-4">
                  {members.map((member) => (
                    <div
                      key={member.member_id}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-tertiary/50 hover:bg-tertiary transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary border border-[var(--border-primary)] flex items-center justify-center text-[8px] font-black uppercase">
                          {(member.name || member.member_id || "?").charAt(0)}
                        </div>
                        <div>
                          <p className="text-[11px] font-bold text-[var(--text-primary)]">
                            {member.name || member.member_id || "Unknown"}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {member.member_role && (
                              <span className="text-[8px] font-black uppercase tracking-wider text-[var(--brand-orange)]">
                                {member.member_role}
                              </span>
                            )}
                            {member.role && (
                              <span className="text-[8px] text-slate-500">
                                {member.role}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={async () => {
                          try {
                            await fetch(
                              `/api/projects/members?project_id=${project.id}&user_cid=${member.member_id}`,
                              { method: "DELETE" },
                            );
                            fetchProject();
                          } catch (e) {
                            console.error(e);
                          }
                        }}
                        className="text-[8px] font-black uppercase text-rose-400 hover:text-rose-300 px-2 py-1 rounded-lg hover:bg-rose-500/10 transition-all"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add Collaborator */}
              <div className="pt-3 border-t border-[var(--border-primary)]/30">
                <p className="text-[8px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Add Collaborator
                </p>
                <div className="flex gap-2">
                  <select
                    id="add-collab-team"
                    className="flex-1 bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-2 text-[10px] font-bold outline-none text-[var(--text-primary)] appearance-none cursor-pointer"
                  >
                    <option value="">Select staff...</option>
                    {allStaff
                      .filter(
                        (s) =>
                          s.cid !== (project.owner_id || "") &&
                          !members.find(
                            (m) =>
                              String(m.member_id) === String(s.cid || s.id),
                          ),
                      )
                      .map((s) => (
                        <option key={s.cid || s.id} value={s.cid || s.id}>
                          {s.name} ({s.role})
                        </option>
                      ))}
                  </select>
                  <button
                    onClick={async () => {
                      const sel = document.getElementById("add-collab-team");
                      if (sel?.value) {
                        try {
                          await fetch("/api/projects/members", {
                            method: "POST",
                            headers: {
                              "Content-Type": "application/json",
                            },
                            body: JSON.stringify({
                              project_id: project.id,
                              user_cid: sel.value,
                              role: "member",
                            }),
                          });
                          sel.value = "";
                          fetchProject();
                        } catch (e) {
                          console.error(e);
                        }
                      }
                    }}
                    className="px-4 py-2 bg-[var(--brand-orange)] text-black rounded-lg text-[9px] font-black uppercase tracking-widest hover:brightness-110"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── TAB: WEEKLY UPDATE ─── */}
        {activeTab === "updates" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Current Week Form */}
            <div className="card space-y-4">
              <div className="flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-[var(--brand-orange)]" />
                <h3 className="text-[9px] font-black text-[var(--brand-orange)] uppercase tracking-widest">
                  This Week&apos;s Update
                </h3>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-[8px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Overall Status
                  </label>
                  <select
                    value={updateForm.overall_status}
                    onChange={(e) =>
                      setUpdateForm((f) => ({
                        ...f,
                        overall_status: e.target.value,
                      }))
                    }
                    className="w-full bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-2 text-xs font-bold outline-none text-[var(--text-primary)] appearance-none cursor-pointer"
                  >
                    <option value="on_track">On Track</option>
                    <option value="at_risk">At Risk</option>
                    <option value="behind">Behind</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
                <div>
                  <label className="text-[8px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Accomplishments This Week
                  </label>
                  <textarea
                    value={updateForm.accomplishments}
                    onChange={(e) =>
                      setUpdateForm((f) => ({
                        ...f,
                        accomplishments: e.target.value,
                      }))
                    }
                    placeholder="What got done this week?"
                    rows={3}
                    className="w-full bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-2 text-xs font-bold outline-none focus:border-[var(--brand-orange)] transition-all resize-none"
                  />
                </div>
                <div>
                  <label className="text-[8px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Current Focus
                  </label>
                  <textarea
                    value={updateForm.current_focus}
                    onChange={(e) =>
                      setUpdateForm((f) => ({
                        ...f,
                        current_focus: e.target.value,
                      }))
                    }
                    placeholder="What are you working on now?"
                    rows={2}
                    className="w-full bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-2 text-xs font-bold outline-none focus:border-[var(--brand-orange)] transition-all resize-none"
                  />
                </div>
                <div>
                  <label className="text-[8px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Blockers / Issues
                  </label>
                  <textarea
                    value={updateForm.blockers}
                    onChange={(e) =>
                      setUpdateForm((f) => ({
                        ...f,
                        blockers: e.target.value,
                      }))
                    }
                    placeholder="Any blockers or issues?"
                    rows={2}
                    className="w-full bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-2 text-xs font-bold outline-none focus:border-[var(--brand-orange)] transition-all resize-none"
                  />
                </div>
                <div>
                  <label className="text-[8px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Next Steps
                  </label>
                  <textarea
                    value={updateForm.next_steps}
                    onChange={(e) =>
                      setUpdateForm((f) => ({
                        ...f,
                        next_steps: e.target.value,
                      }))
                    }
                    placeholder="What's next?"
                    rows={2}
                    className="w-full bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-2 text-xs font-bold outline-none focus:border-[var(--brand-orange)] transition-all resize-none"
                  />
                </div>
                <button
                  onClick={handleSubmitUpdate}
                  disabled={
                    savingUpdate ||
                    (!updateForm.accomplishments && !updateForm.current_focus)
                  }
                  className="flex items-center justify-center gap-2 w-full py-3 bg-[var(--brand-orange)] text-black rounded-xl text-[9px] font-black uppercase tracking-widest hover:brightness-110 transition-all disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  {savingUpdate ? "Saving..." : "Submit Weekly Update"}
                </button>
              </div>
            </div>

            {/* Previous Updates */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-500" />
                <h3 className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                  Previous Updates
                </h3>
                <span className="text-[9px] font-bold text-slate-500 ml-auto">
                  {updates.length} total
                </span>
              </div>

              {updates.length === 0 && !updatesLoading ? (
                <div className="card py-12 flex flex-col items-center justify-center text-center opacity-50 border-dashed">
                  <FileText className="w-10 h-10 mb-2" />
                  <p className="text-[9px] font-bold uppercase tracking-widest">
                    No updates yet
                  </p>
                  <p className="text-[8px] text-slate-500 mt-1">
                    Weekly project narratives will appear here.
                  </p>
                </div>
              ) : updatesLoading ? (
                <div className="text-center py-8 text-[10px] text-slate-500 italic">
                  Loading updates...
                </div>
              ) : (
                <div className="space-y-2 max-h-[600px] overflow-y-auto custom-scrollbar pr-1">
                  {updates.map((update) => {
                    const statusColors = {
                      on_track: "text-emerald-500",
                      at_risk: "text-amber-500",
                      behind: "text-rose-500",
                      completed: "text-purple-500",
                    };
                    const statusBg = {
                      on_track: "bg-emerald-500/10",
                      at_risk: "bg-amber-500/10",
                      behind: "bg-rose-500/10",
                      completed: "bg-purple-500/10",
                    };
                    return (
                      <div key={update.id} className="card p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black">
                              Week {update.week_number}, {update.year}
                            </span>
                            <span
                              className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${
                                statusBg[update.overall_status] ||
                                "bg-slate-500/10"
                              } ${
                                statusColors[update.overall_status] ||
                                "text-slate-500"
                              }`}
                            >
                              {update.overall_status.replace(/_/g, " ")}
                            </span>
                          </div>
                          <span className="text-[8px] text-slate-500">
                            {new Date(update.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        {update.accomplishments && (
                          <div>
                            <p className="text-[8px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                              Accomplishments
                            </p>
                            <p className="text-[10px] text-[var(--text-secondary)] whitespace-pre-wrap">
                              {update.accomplishments}
                            </p>
                          </div>
                        )}
                        {update.current_focus && (
                          <div>
                            <p className="text-[8px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                              Current Focus
                            </p>
                            <p className="text-[10px] text-[var(--text-secondary)] whitespace-pre-wrap">
                              {update.current_focus}
                            </p>
                          </div>
                        )}
                        {update.blockers && (
                          <div>
                            <p className="text-[8px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                              Blockers
                            </p>
                            <p className="text-[10px] text-rose-400 whitespace-pre-wrap">
                              {update.blockers}
                            </p>
                          </div>
                        )}
                        {update.next_steps && (
                          <div>
                            <p className="text-[8px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                              Next Steps
                            </p>
                            <p className="text-[10px] text-[var(--text-secondary)] whitespace-pre-wrap">
                              {update.next_steps}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── TAB: APPROVALS ─── */}
        {activeTab === "approvals" && (
          <div className="space-y-4">
            {approvalsLoading ? (
              <div className="text-center py-8 text-[10px] text-slate-500 italic">
                Loading requests...
              </div>
            ) : approvalRequests.filter((r) => r.status === "pending")
                .length === 0 &&
              approvalRequests.filter((r) => r.status !== "pending").length ===
                0 ? (
              <div className="card py-16 flex flex-col items-center justify-center text-center opacity-50 border-dashed">
                <UserPlus className="w-12 h-12 mb-3" />
                <p className="text-[10px] font-bold uppercase tracking-widest">
                  No contribution requests
                </p>
                <p className="text-[9px] text-slate-500 mt-1">
                  When staff link tasks to this project without being
                  collaborators, requests appear here.
                </p>
              </div>
            ) : (
              <>
                {/* Pending Requests */}
                {approvalRequests.filter((r) => r.status === "pending").length >
                  0 && (
                  <div className="space-y-2">
                    <h3 className="text-[9px] font-black text-amber-500 uppercase tracking-widest flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5" />
                      Pending Review (
                      {
                        approvalRequests.filter((r) => r.status === "pending")
                          .length
                      }
                      )
                    </h3>
                    {approvalRequests
                      .filter((r) => r.status === "pending")
                      .map((req) => (
                        <div
                          key={req.id}
                          className="card border-l-4 border-l-amber-500 p-4 space-y-3"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-xs font-bold text-[var(--text-primary)]">
                                {req.task_title || `Task #${req.task_id}`}
                              </p>
                              <p className="text-[9px] text-slate-500 mt-0.5">
                                by{" "}
                                {req.requester_name ||
                                  req.requester_name_lookup ||
                                  req.requester_id}{" "}
                                ·{" "}
                                {new Date(req.created_at).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() =>
                                handleApprovalAction(req.id, "approved")
                              }
                              className="px-4 py-2 bg-emerald-500 text-black rounded-lg text-[9px] font-black uppercase tracking-widest hover:brightness-110 transition-all"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => {
                                const reason = prompt("Reason for rejection:");
                                if (reason)
                                  handleApprovalAction(
                                    req.id,
                                    "rejected",
                                    reason,
                                  );
                              }}
                              className="px-4 py-2 bg-rose-500/10 text-rose-400 rounded-lg text-[9px] font-black uppercase tracking-widest hover:brightness-110 transition-all"
                            >
                              Reject
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                )}

                {/* History */}
                {approvalRequests.filter((r) => r.status !== "pending").length >
                  0 && (
                  <div className="space-y-2">
                    <h3 className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                      History
                    </h3>
                    {approvalRequests
                      .filter((r) => r.status !== "pending")
                      .map((req) => (
                        <div
                          key={req.id}
                          className={`card p-3 border-l-4 ${
                            req.status === "approved"
                              ? "border-l-emerald-500"
                              : "border-l-rose-500"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded ${
                                req.status === "approved"
                                  ? "bg-emerald-500/10 text-emerald-500"
                                  : "bg-rose-500/10 text-rose-500"
                              }`}
                            >
                              {req.status}
                            </span>
                            <span className="text-[10px] font-bold text-[var(--text-primary)]">
                              {req.task_title || `Task #${req.task_id}`}
                            </span>
                          </div>
                          <p className="text-[9px] text-slate-500 mt-1">
                            {req.requester_name || req.requester_id} ·{" "}
                            {new Date(req.created_at).toLocaleDateString()}
                            {req.rejection_reason && (
                              <>
                                {" "}
                                · Reason:{" "}
                                <span className="text-rose-400">
                                  {req.rejection_reason}
                                </span>
                              </>
                            )}
                          </p>
                        </div>
                      ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ─── TAB: TIMELINE ─── */}
        {activeTab === "timeline" && (
          <div className="space-y-4">
            {timeline.length === 0 ? (
              <div className="card py-16 flex flex-col items-center justify-center text-center opacity-50 border-dashed">
                <Clock className="w-12 h-12 mb-3" />
                <p className="text-[10px] font-bold uppercase tracking-widest">
                  No activity yet
                </p>
                <p className="text-[9px] text-slate-500 mt-1">
                  Task assignments, completions, and updates will appear here.
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                {timeline.map((entry, idx) => (
                  <div key={entry.id || idx} className="flex items-start gap-3">
                    {/* Timeline dot + line */}
                    <div className="flex flex-col items-center">
                      <div
                        className={`w-3 h-3 rounded-full border-2 ${
                          entry.action_type?.includes("COMPLETED")
                            ? "border-emerald-500 bg-emerald-500/20"
                            : entry.action_type?.includes("BLOCKED")
                              ? "border-rose-500 bg-rose-500/20"
                              : entry.action_type?.includes("CREATED")
                                ? "border-blue-500 bg-blue-500/20"
                                : entry.action_type?.includes("ASSIGNED")
                                  ? "border-amber-500 bg-amber-500/20"
                                  : "border-slate-500 bg-slate-500/20"
                        }`}
                      />
                      {idx < timeline.length - 1 && (
                        <div className="w-px flex-1 bg-[var(--border-primary)] min-h-[24px]" />
                      )}
                    </div>
                    {/* Content */}
                    <div className="flex-1 pb-4">
                      <div className="card p-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`text-[8px] font-black uppercase tracking-widest ${
                              entry.action_type?.includes("COMPLETED")
                                ? "text-emerald-500"
                                : entry.action_type?.includes("BLOCKED")
                                  ? "text-rose-500"
                                  : entry.action_type?.includes("CREATED")
                                    ? "text-blue-500"
                                    : entry.action_type?.includes("ASSIGNED")
                                      ? "text-amber-500"
                                      : "text-slate-500"
                            }`}
                          >
                            {entry.action_type?.replace(/_/g, " ") ||
                              entry.action ||
                              "Update"}
                          </span>
                          <span className="text-[9px] text-slate-500">
                            {new Date(entry.created_at).toLocaleDateString(
                              "en-US",
                              {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              },
                            )}
                          </span>
                        </div>
                        {(entry.task_title || entry.description) && (
                          <p className="text-[10px] text-[var(--text-secondary)] mt-1">
                            {entry.description || entry.task_title}
                          </p>
                        )}
                        {entry.actor_name && (
                          <p className="text-[9px] text-slate-500 mt-0.5">
                            by{" "}
                            <span className="font-bold">
                              {entry.actor_name}
                            </span>
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
