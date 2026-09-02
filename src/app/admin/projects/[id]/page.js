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
import { useI18n } from "@/lib/i18n";
import { cacheGet, cacheSet } from "@/lib/hooks/useApi";
import TaskManager from "@/components/tasks/TaskManager";

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
    start_date: "",
    start_time: "",
    end_date: "",
    end_time: "",
  });
  const [creatingTask, setCreatingTask] = useState(false);
  const [expandedProjectTasks, setExpandedProjectTasks] = useState({});
  const [parentForSubTask, setParentForSubTask] = useState(null);
  const [userRole, setUserRole] = useState("super_admin");
  const [discussions, setDiscussions] = useState([]);
  const [discussionsLoading, setDiscussionsLoading] = useState(false);
  const [newDiscussion, setNewDiscussion] = useState("");
  const [postingDiscussion, setPostingDiscussion] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("user");
      if (saved) {
        const u = JSON.parse(saved);
        setUserRole(u.role || "super_admin");
      }
    } catch (_) {}
  }, []);

  const handleTaskStatusChange = async (taskId, newStatus) => {
    try {
      await fetch("/api/tasks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: taskId,
          status: newStatus,
          user_id: project.owner_id || "sa",
          user_name: project.owner_name || "Project Owner",
        }),
      });
      fetchProject(true);
    } catch (e) {
      console.error(e);
    }
  };

  const projectId = params?.id;

  const fetchProject = useCallback(async (bypassCache = false) => {
    if (!projectId) return;
    const url = `/api/admin/projects/${projectId}`;
    const apply = (data) => {
      if (data.success) {
        setProject(data.project);
      } else {
        setError(t((data.error || t("adminMisc.projectDetail.loadProjectFailed")) || "") || (data.error || t("adminMisc.projectDetail.loadProjectFailed")));
      }
    };
    let painted = false;
    setLoading(true);
    setError(null);
    try {
      // Cache-first paint: returning to this page renders instantly from a fresh
      // snapshot; mutation flows pass bypassCache=true so the project always
      // reflects the last action.
      if (!bypassCache) {
        const cached = cacheGet(url);
        if (cached !== null && cached.success) {
          apply(cached);
          setLoading(false);
          painted = true;
        }
      }
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) cacheSet(url, data);
      apply(data);
    } catch (e) {
      if (!painted) {
        setError(t("adminMisc.projectDetail.loadProjectNetworkError"));
        console.error(e);
      }
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

  const fetchApprovals = useCallback(async (bypassCache = false) => {
    if (!projectId) return;
    const url = `/api/admin/projects/${projectId}/approvals`;
    const apply = (data) => {
      if (data.success) setApprovalRequests(data.requests || []);
    };
    let painted = false;
    setApprovalsLoading(true);
    try {
      // Cache-first paint: returning to this page renders instantly from a fresh
      // snapshot; approval actions pass bypassCache=true so the list always
      // reflects the last action.
      if (!bypassCache) {
        const cached = cacheGet(url);
        if (cached !== null && cached.success) {
          apply(cached);
          setApprovalsLoading(false);
          painted = true;
        }
      }
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) cacheSet(url, data);
      apply(data);
    } catch (e) {
      if (!painted) console.error("Failed to fetch approvals:", e);
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
      if (data.success) fetchApprovals(true);
    } catch (e) {
      console.error("Approval action error:", e);
    }
  };

  const fetchUpdates = useCallback(async (bypassCache = false) => {
    if (!projectId) return;
    const url = `/api/admin/projects/${projectId}/updates`;
    const apply = (data) => {
      if (data.success) setUpdates(data.updates || []);
    };
    let painted = false;
    setUpdatesLoading(true);
    try {
      // Cache-first paint: returning to this page renders instantly from a fresh
      // snapshot; mutation flows pass bypassCache=true so the list always
      // reflects the last action.
      if (!bypassCache) {
        const cached = cacheGet(url);
        if (cached !== null && cached.success) {
          apply(cached);
          setUpdatesLoading(false);
          painted = true;
        }
      }
      // Auto-generate report if none exists for current week
      try {
        await fetch(`/api/admin/projects/${projectId}/reports/generate`, {
          method: "POST",
        });
      } catch (_) {}
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) cacheSet(url, data);
      apply(data);
    } catch (e) {
      if (!painted) console.error("Failed to fetch updates:", e);
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

  const fetchDiscussions = useCallback(async (bypassCache = false) => {
    if (!projectId) return;
    const url = `/api/projects/discuss?project_id=${projectId}`;
    const apply = (data) => {
      if (data.success) setDiscussions(data.messages || []);
    };
    setDiscussionsLoading(true);
    try {
      // Cache-first paint: returning to this page renders instantly from a fresh
      // snapshot; posting a message passes bypassCache=true so the thread always
      // reflects the last post.
      if (!bypassCache) {
        const cached = cacheGet(url);
        if (cached !== null && cached.success) {
          apply(cached);
          setDiscussionsLoading(false);
        }
      }
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) cacheSet(url, data);
      apply(data);
    } catch (_) {}
    setDiscussionsLoading(false);
  }, [projectId]);

  useEffect(() => {
    fetchDiscussions();
  }, [fetchDiscussions]);

  const handlePostDiscussion = async () => {
    if (!newDiscussion.trim()) return;
    setPostingDiscussion(true);
    try {
      const res = await fetch("/api/projects/discuss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: String(projectId),
          sender_id: userRole || "admin",
          sender_name: "Admin",
          body: newDiscussion.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setNewDiscussion("");
        fetchDiscussions(true);
      }
    } catch (_) {}
    setPostingDiscussion(false);
  };

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
        fetchUpdates(true);
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
      <>
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
      </>
    );
  }

  // Error state
  if (error || !project) {
    return (
      <>
        <div className="flex flex-col items-center justify-center py-32">
          <AlertTriangle className="w-16 h-16 text-rose-500 mb-4" />
          <p className="text-base font-black text-rose-500">
            {error || t("adminMisc.projectDetail.projectNotFound")}
          </p>
          <button
            onClick={() => router.push("/admin/projects")}
            className="mt-6 flex items-center gap-2 px-4 py-2 bg-[var(--brand-orange)] text-black rounded-lg text-[9px] font-black uppercase tracking-widest hover:brightness-110 transition-all"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> {t("adminMisc.projectDetail.backToProjects")}
          </button>
        </div>
      </>
    );
  }

  const tasks = project.tasks || [];
  const blockers = project.blockers || [];
  const members = project.members || [];
  const timeline = project.timeline || [];

  // ── Status display labels ──
  const projectStatusLabels = {
    Active: t("adminMisc.projectDetail.projectStatusActive"),
    Completed: t("adminMisc.projectDetail.projectStatusCompleted"),
    Paused: t("adminMisc.projectDetail.projectStatusPaused"),
    Archived: t("adminMisc.projectDetail.projectStatusArchived"),
  };
  const blockerStatusLabels = {
    active: t("adminMisc.projectDetail.blockerStatusActive"),
    resolved: t("adminMisc.projectDetail.blockerStatusResolved"),
  };
  const updateStatusLabels = {
    on_track: t("adminMisc.projectDetail.statusOnTrack"),
    at_risk: t("adminMisc.projectDetail.statusAtRisk"),
    behind: t("adminMisc.projectDetail.statusBehind"),
    completed: t("adminMisc.projectDetail.statusCompleted"),
  };
  const approvalStatusLabels = {
    approved: t("adminMisc.projectDetail.approvalStatusApproved"),
    rejected: t("adminMisc.projectDetail.approvalStatusRejected"),
  };

  return (
    <>
      <div className="space-y-8 pb-20 text-left">
        {/* ─── TOAST NOTIFICATIONS ─── */}

        {/* ─── HEADER ─── */}
        <header className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 border-b border-[var(--border-primary)] pb-8">
          <div className="space-y-3">
            <button
              onClick={() => {
                const roleMap = {
                  super_admin: "/admin/projects",
                  staff: "/staff/projects",
                  program_manager: "/staff/projects",
                  teacher: "/staff/projects",
                };
                router.push(roleMap[userRole] || "/admin/projects");
              }}
              className="group flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--brand-orange)] transition-all font-bold text-[9px] uppercase tracking-widest"
            >
              <ArrowLeft className="w-3 h-3 group-hover:-translate-x-1 transition-transform" />{" "}
              {t("adminMisc.projectDetail.allProjects")}
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
                    {projectStatusLabels[project.status] || project.status}
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
                      {t("adminMisc.projectDetail.created")}{" "}
                      {new Date(project.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  {project.start_date && (
                    <div className="flex items-center gap-1.5 text-[10px] text-emerald-400">
                      <Calendar className="w-3 h-3" />
                      <span className="font-bold">
                        {t("adminMisc.projectDetail.start")}{" "}
                        {new Date(project.start_date).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                  {project.end_date && (
                    <div className="flex items-center gap-1.5 text-[10px] text-amber-400">
                      <Calendar className="w-3 h-3" />
                      <span className="font-bold">
                        {t("adminMisc.projectDetail.end")}{" "}
                        {new Date(project.end_date).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          <button
            onClick={fetchProject}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-[var(--border-primary)] hover:bg-tertiary transition-all text-[9px] font-black uppercase tracking-widest"
          >
            <RefreshCw className="w-3.5 h-3.5" /> {t("adminMisc.projectDetail.refresh")}
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
                {t("adminMisc.projectDetail.progress")}
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
                {t("adminMisc.projectDetail.tasks")}
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
                {t("adminMisc.projectDetail.activeBlockers")}
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
                {t("adminMisc.projectDetail.team")}
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
                {
                  id: "overview",
                  label: t("adminMisc.projectDetail.tabOverview"),
                  icon: Activity,
                },
                {
                  id: "tasks",
                  label: t("adminMisc.projectDetail.tabTasks", {
                    count: tasks.length,
                  }),
                  icon: ListTodo,
                },
                {
                  id: "blockers",
                  label: t("adminMisc.projectDetail.tabBlockers", {
                    count: blockers.length,
                  }),
                  icon: Shield,
                },
                {
                  id: "team",
                  label: t("adminMisc.projectDetail.tabTeam", {
                    count: members.length,
                  }),
                  icon: Users,
                },
                {
                  id: "updates",
                  label: t("adminMisc.projectDetail.tabUpdates"),
                  icon: FileText,
                },
                {
                  id: "discussions",
                  label: t("adminMisc.projectDetail.tabDiscussions", {
                    count: discussions.length,
                  }),
                  icon: MessageSquare,
                },
                {
                  id: "approvals",
                  label:
                    t("adminMisc.projectDetail.tabApprovals") +
                    (approvalRequests.filter((r) => r.status === "pending")
                      .length > 0
                      ? ` (${approvalRequests.filter((r) => r.status === "pending").length})`
                      : ""),
                  icon: UserPlus,
                },
                {
                  id: "timeline",
                  label: t("adminMisc.projectDetail.tabTimeline"),
                  icon: Clock,
                },
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
                {t("adminMisc.projectDetail.overallProgress")}
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
                  label: t("adminMisc.projectDetail.breakdownCompleted"),
                  count: project.taskStats?.completed || 0,
                  color: "text-emerald-500",
                  bg: "bg-emerald-500/10",
                },
                {
                  label: t("adminMisc.projectDetail.breakdownInProgress"),
                  count: project.taskStats?.in_progress || 0,
                  color: "text-blue-500",
                  bg: "bg-blue-500/10",
                },
                {
                  label: t("adminMisc.projectDetail.breakdownBlocked"),
                  count: project.taskStats?.blocked || 0,
                  color: "text-rose-500",
                  bg: "bg-rose-500/10",
                },
                {
                  label: t("adminMisc.projectDetail.breakdownCarriedOver"),
                  count: project.taskStats?.carried_over || 0,
                  color: "text-amber-500",
                  bg: "bg-amber-500/10",
                },
                {
                  label: t("adminMisc.projectDetail.breakdownPending"),
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
                  {t("adminMisc.projectDetail.timelineCoverage")}
                </h3>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-2 bg-[var(--bg-primary)] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full"
                      style={{ width: `${project.timelineHealth}%` }}
                    />
                  </div>
                  <span className="text-xs font-bold text-blue-500">
                    {t("adminMisc.projectDetail.timelineHealthLabel", {
                      percent: project.timelineHealth,
                    })}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── TAB: TASKS ─── */}
        {activeTab === "tasks" && (
          <div className="space-y-4">
            <TaskManager
              mode="project"
              projectId={project.id}
              userId={project.owner_id || "sa"}
              userName={project.owner_name || "Project Owner"}
              projects={[{ id: project.id, name: project.name }]}
              projectMembers={members}
              taskList={project.tasks || []}
              onTasksChange={fetchProject}
              showCarryOver={false}
            />
          </div>
        )}

        {/* ─── TAB: BLOCKERS ─── */}
        {activeTab === "blockers" && (
          <div className="space-y-4">
            {/* Blocker filter */}
            <div className="flex items-center gap-2 flex-wrap">
              {[
                {
                  id: "all",
                  label: t("adminMisc.projectDetail.blockerFilterAll", {
                    count: blockers.length,
                  }),
                },
                {
                  id: "active",
                  label: t("adminMisc.projectDetail.blockerFilterActive", {
                    count: blockers.filter((b) => b.status === "active")
                      .length,
                  }),
                },
                {
                  id: "resolved",
                  label: t("adminMisc.projectDetail.blockerFilterResolved", {
                    count: blockers.filter((b) => b.status === "resolved")
                      .length,
                  }),
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
                  {t("adminMisc.projectDetail.noBlockers")}
                </p>
                <p className="text-[9px] text-slate-500 mt-1">
                  {t("adminMisc.projectDetail.noBlockersHint")}
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
                          {blockerStatusLabels[blocker.status] ||
                            blocker.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1.5 text-[9px] text-slate-500">
                        {blocker.task_title && (
                          <span>
                            {t("adminMisc.projectDetail.taskLabel")}{" "}
                            <span className="font-bold text-[var(--text-secondary)]">
                              {blocker.task_title}
                            </span>
                          </span>
                        )}
                        {blocker.user_name && (
                          <span>
                            {t("adminMisc.projectDetail.by")}{" "}
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
                  {t("adminMisc.projectDetail.projectOwner")}
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
                      {t("adminMisc.projectDetail.ownerAccountable")}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-[10px] text-slate-500 italic">
                  {t("adminMisc.projectDetail.noOwnerAssigned")}
                </p>
              )}
            </div>

            {/* Collaborators Section */}
            <div className="card border-l-4 border-l-blue-500">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-500" />
                  <span className="text-[9px] font-black uppercase tracking-widest text-blue-500">
                    {t("adminMisc.projectDetail.collaborators")}
                  </span>
                </div>
                <span className="text-[9px] font-bold text-slate-500">
                  {t("adminMisc.projectDetail.totalCount", {
                    count: members.length,
                  })}
                </span>
              </div>

              {/* Collaborator list */}
              {members.length === 0 ? (
                <p className="text-[10px] text-slate-500 italic text-center py-6">
                  {t("adminMisc.projectDetail.noCollaborators")}
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
                            {member.name ||
                              member.member_id ||
                              t("adminMisc.projectDetail.unknown")}
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
                            fetchProject(true);
                          } catch (e) {
                            console.error(e);
                          }
                        }}
                        className="text-[8px] font-black uppercase text-rose-400 hover:text-rose-300 px-2 py-1 rounded-lg hover:bg-rose-500/10 transition-all"
                      >
                        {t("adminMisc.projectDetail.remove")}
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add Collaborator */}
              <div className="pt-3 border-t border-[var(--border-primary)]/30">
                <p className="text-[8px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                  {t("adminMisc.projectDetail.addCollaborator")}
                </p>
                <div className="flex gap-2">
                  <select
                    id="add-collab-team"
                    className="flex-1 bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-2 text-[10px] font-bold outline-none text-[var(--text-primary)] appearance-none cursor-pointer"
                  >
                    <option value="">{t("adminMisc.projectDetail.selectStaff")}</option>
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
                          fetchProject(true);
                        } catch (e) {
                          console.error(e);
                        }
                      }
                    }}
                    className="px-4 py-2 bg-[var(--brand-orange)] text-black rounded-lg text-[9px] font-black uppercase tracking-widest hover:brightness-110"
                  >
                    {t("adminMisc.projectDetail.add")}
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
                  {t("adminMisc.projectDetail.thisWeeksUpdate")}
                </h3>
                <button
                  onClick={async () => {
                    try {
                      const res = await fetch(
                        `/api/admin/projects/${projectId}/reports/generate`,
                        { method: "POST" },
                      );
                      const data = await res.json();
                      if (data.success) {
                        fetchUpdates(true);
                        window.dispatchEvent(new CustomEvent('impactos:notify', { detail: { type: 'success', message: t("adminMisc.projectDetail.reportGenerated", { week: data.week }) } }));
                      } else window.dispatchEvent(new CustomEvent('impactos:notify', { detail: { type: 'error', message: t((data.error || t("adminMisc.projectDetail.generateFailed")) || "") || (data.error || t("adminMisc.projectDetail.generateFailed")) } }));
                    } catch (_) {}
                  }}
                  className="ml-auto px-3 py-1 rounded text-[8px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-white transition-all"
                >
                  {t("adminMisc.projectDetail.generateReport")}
                </button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-[8px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    {t("adminMisc.projectDetail.overallStatus")}
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
                    <option value="on_track">
                      {t("adminMisc.projectDetail.statusOnTrack")}
                    </option>
                    <option value="at_risk">
                      {t("adminMisc.projectDetail.statusAtRisk")}
                    </option>
                    <option value="behind">
                      {t("adminMisc.projectDetail.statusBehind")}
                    </option>
                    <option value="completed">
                      {t("adminMisc.projectDetail.statusCompleted")}
                    </option>
                  </select>
                </div>
                <div>
                  <label className="text-[8px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    {t("adminMisc.projectDetail.accomplishmentsThisWeek")}
                  </label>
                  <textarea
                    value={updateForm.accomplishments}
                    onChange={(e) =>
                      setUpdateForm((f) => ({
                        ...f,
                        accomplishments: e.target.value,
                      }))
                    }
                    placeholder={t("adminMisc.projectDetail.accomplishmentsPlaceholder")}
                    rows={3}
                    className="w-full bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-2 text-xs font-bold outline-none focus:border-[var(--brand-orange)] transition-all resize-none"
                  />
                </div>
                <div>
                  <label className="text-[8px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    {t("adminMisc.projectDetail.currentFocus")}
                  </label>
                  <textarea
                    value={updateForm.current_focus}
                    onChange={(e) =>
                      setUpdateForm((f) => ({
                        ...f,
                        current_focus: e.target.value,
                      }))
                    }
                    placeholder={t("adminMisc.projectDetail.currentFocusPlaceholder")}
                    rows={2}
                    className="w-full bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-2 text-xs font-bold outline-none focus:border-[var(--brand-orange)] transition-all resize-none"
                  />
                </div>
                <div>
                  <label className="text-[8px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    {t("adminMisc.projectDetail.blockersIssues")}
                  </label>
                  <textarea
                    value={updateForm.blockers}
                    onChange={(e) =>
                      setUpdateForm((f) => ({
                        ...f,
                        blockers: e.target.value,
                      }))
                    }
                    placeholder={t("adminMisc.projectDetail.blockersPlaceholder")}
                    rows={2}
                    className="w-full bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-2 text-xs font-bold outline-none focus:border-[var(--brand-orange)] transition-all resize-none"
                  />
                </div>
                <div>
                  <label className="text-[8px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    {t("adminMisc.projectDetail.nextSteps")}
                  </label>
                  <textarea
                    value={updateForm.next_steps}
                    onChange={(e) =>
                      setUpdateForm((f) => ({
                        ...f,
                        next_steps: e.target.value,
                      }))
                    }
                    placeholder={t("adminMisc.projectDetail.nextStepsPlaceholder")}
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
                  {savingUpdate
                    ? t("adminMisc.projectDetail.saving")
                    : t("adminMisc.projectDetail.submitWeeklyUpdate")}
                </button>
              </div>
            </div>

            {/* Previous Updates */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-500" />
                <h3 className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                  {t("adminMisc.projectDetail.previousUpdates")}
                </h3>
                <span className="text-[9px] font-bold text-slate-500 ml-auto">
                  {t("adminMisc.projectDetail.totalCount", {
                    count: updates.length,
                  })}
                </span>
              </div>

              {updates.length === 0 && !updatesLoading ? (
                <div className="card py-12 flex flex-col items-center justify-center text-center opacity-50 border-dashed">
                  <FileText className="w-10 h-10 mb-2" />
                  <p className="text-[9px] font-bold uppercase tracking-widest">
                    {t("adminMisc.projectDetail.noUpdates")}
                  </p>
                  <p className="text-[8px] text-slate-500 mt-1">
                    {t("adminMisc.projectDetail.noUpdatesHint")}
                  </p>
                </div>
              ) : updatesLoading ? (
                <div className="text-center py-8 text-[10px] text-slate-500 italic">
                  {t("adminMisc.projectDetail.loadingUpdates")}
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
                              {t("adminMisc.projectDetail.weekLabel", {
                                week: update.week_number,
                                year: update.year,
                              })}
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
                              {updateStatusLabels[update.overall_status] ||
                                update.overall_status.replace(/_/g, " ")}
                            </span>
                          </div>
                          <span className="text-[8px] text-slate-500">
                            {new Date(update.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        {update.accomplishments && (
                          <div>
                            <p className="text-[8px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                              {t("adminMisc.projectDetail.accomplishments")}
                            </p>
                            <p className="text-[10px] text-[var(--text-secondary)] whitespace-pre-wrap">
                              {update.accomplishments}
                            </p>
                          </div>
                        )}
                        {update.current_focus && (
                          <div>
                            <p className="text-[8px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                              {t("adminMisc.projectDetail.currentFocus")}
                            </p>
                            <p className="text-[10px] text-[var(--text-secondary)] whitespace-pre-wrap">
                              {update.current_focus}
                            </p>
                          </div>
                        )}
                        {update.blockers && (
                          <div>
                            <p className="text-[8px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                              {t("adminMisc.projectDetail.blockers")}
                            </p>
                            <p className="text-[10px] text-rose-400 whitespace-pre-wrap">
                              {update.blockers}
                            </p>
                          </div>
                        )}
                        {update.next_steps && (
                          <div>
                            <p className="text-[8px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                              {t("adminMisc.projectDetail.nextSteps")}
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
                {t("adminMisc.projectDetail.loadingRequests")}
              </div>
            ) : approvalRequests.filter((r) => r.status === "pending")
                .length === 0 &&
              approvalRequests.filter((r) => r.status !== "pending").length ===
                0 ? (
              <div className="card py-16 flex flex-col items-center justify-center text-center opacity-50 border-dashed">
                <UserPlus className="w-12 h-12 mb-3" />
                <p className="text-[10px] font-bold uppercase tracking-widest">
                  {t("adminMisc.projectDetail.noContributionRequests")}
                </p>
                <p className="text-[9px] text-slate-500 mt-1">
                  {t("adminMisc.projectDetail.noContributionRequestsHint")}
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
                      {t("adminMisc.projectDetail.pendingReview", {
                        count: approvalRequests.filter(
                          (r) => r.status === "pending",
                        ).length,
                      })}
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
                                {req.task_title ||
                                  t("adminMisc.projectDetail.taskFallback", {
                                    id: req.task_id,
                                  })}
                              </p>
                              <p className="text-[9px] text-slate-500 mt-0.5">
                                {t("adminMisc.projectDetail.by")}{" "}
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
                              {t("adminMisc.projectDetail.approve")}
                            </button>
                            <button
                              onClick={() => {
                                const reason = prompt(
                                  t("adminMisc.projectDetail.rejectionReasonPrompt"),
                                );
                                if (reason)
                                  handleApprovalAction(
                                    req.id,
                                    "rejected",
                                    reason,
                                  );
                              }}
                              className="px-4 py-2 bg-rose-500/10 text-rose-400 rounded-lg text-[9px] font-black uppercase tracking-widest hover:brightness-110 transition-all"
                            >
                              {t("adminMisc.projectDetail.reject")}
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
                      {t("adminMisc.projectDetail.history")}
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
                              {approvalStatusLabels[req.status] || req.status}
                            </span>
                            <span className="text-[10px] font-bold text-[var(--text-primary)]">
                              {req.task_title ||
                                t("adminMisc.projectDetail.taskFallback", {
                                  id: req.task_id,
                                })}
                            </span>
                          </div>
                          <p className="text-[9px] text-slate-500 mt-1">
                            {req.requester_name || req.requester_id} ·{" "}
                            {new Date(req.created_at).toLocaleDateString()}
                            {req.rejection_reason && (
                              <>
                                {" "}
                                · {t("adminMisc.projectDetail.reasonLabel")}{" "}
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

        {/* ─── TAB: DISCUSSIONS ─── */}
        {activeTab === "discussions" && (
          <div className="space-y-6">
            {/* Post new message */}
            <div className="card space-y-3">
              <h3 className="text-[10px] font-black text-[var(--text-primary)] uppercase tracking-widest">
                {t("adminMisc.projectDetail.projectDiscussions")}
              </h3>
              <div className="flex gap-2">
                <textarea
                  value={newDiscussion}
                  onChange={(e) => setNewDiscussion(e.target.value)}
                  placeholder={t("messaging.typeDiscussion")}
                  rows={2}
                  className="flex-1 px-3 py-2 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[11px] font-bold text-[var(--text-primary)] outline-none resize-none"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handlePostDiscussion();
                    }
                  }}
                />
                <button
                  onClick={handlePostDiscussion}
                  disabled={postingDiscussion || !newDiscussion.trim()}
                  className="px-4 py-2 bg-[var(--brand-orange)] text-black rounded-xl text-[10px] font-black uppercase tracking-wider disabled:opacity-30 flex items-center gap-2 self-end"
                >
                  <Send className="w-3.5 h-3.5" />
                  {postingDiscussion ? "..." : t("messaging.postDiscussion")}
                </button>
              </div>
            </div>

            {/* Messages list */}
            {discussionsLoading ? (
              <div className="card py-16 flex flex-col items-center justify-center text-center opacity-50">
                <RefreshCw className="w-8 h-8 animate-spin mb-3" />
                <p className="text-[10px] font-bold uppercase tracking-widest">
                  {t("messaging.loadingDiscussions")}
                </p>
              </div>
            ) : discussions.length === 0 ? (
              <div className="card py-16 flex flex-col items-center justify-center text-center opacity-50">
                <MessageSquare className="w-12 h-12 mb-3" />
                <p className="text-[10px] font-bold uppercase tracking-widest">
                  {t("messaging.noDiscussions")}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {discussions.map((msg) => (
                  <div key={msg.id} className="card p-4 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-[var(--bg-tertiary)] border border-[var(--border-primary)] flex items-center justify-center text-[8px] font-black text-[var(--text-primary)]">
                        {(msg.sender_name || "?").charAt(0).toUpperCase()}
                      </div>
                      <span className="text-[10px] font-bold text-[var(--text-primary)]">
                        {msg.sender_name || t("adminMisc.projectDetail.unknown")}
                      </span>
                      <span className="text-[8px] text-slate-500 ml-auto">
                        {new Date(msg.created_at).toLocaleDateString(
                          undefined,
                          {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          },
                        )}
                      </span>
                    </div>
                    <p className="text-[11px] text-[var(--text-secondary)] whitespace-pre-wrap">
                      {msg.body}
                    </p>
                  </div>
                ))}
              </div>
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
                  {t("adminMisc.projectDetail.noActivity")}
                </p>
                <p className="text-[9px] text-slate-500 mt-1">
                  {t("adminMisc.projectDetail.noActivityHint")}
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
                              t("adminMisc.projectDetail.update")}
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
                            {t("adminMisc.projectDetail.by")}{" "}
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
    </>
  );
}
