"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  ArrowLeft,
  Briefcase,
  AlertTriangle,
  Clock,
  ListTodo,
  Shield,
  Users,
  Target,
  Activity,
  Calendar,
  User,
  MessageSquare,
  RefreshCw,
  Edit3,
  Send,
  FileText,
  UserPlus,
  Rocket,
} from "lucide-react";
import { useRouter, useParams } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { useApi } from "@/lib/hooks/useApi";
import { useSessionUser } from "@/lib/hooks/useSessionUser";
import { useDialogs } from "@/components/ui/DialogProvider";
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

// ─── Read shapers (module scope: built once, never per render) ──────────────
// The reading hook mirrors these, so an inline arrow would be a new function on
// every render and would read as a change to the read.

// The project read keeps the server's refusal with it: the screen answers a
// failed read with the server's own message, or the loader's own when the
// payload carried none. The message is translated where it is shown.
const pickProject = (payload) =>
  payload?.success
    ? { project: payload.project, failure: null }
    : {
        project: null,
        failure: payload?.error || "adminMisc.projectDetail.loadProjectFailed",
      };

const pickStaff = (payload) =>
  payload?.success
    ? (payload.contacts || []).filter(
        (contact) => contact.status === "active" && contact.role !== "participant",
      )
    : [];

const pickApprovals = (payload) => (payload?.success ? payload.requests || [] : []);

const pickUpdates = (payload) => (payload?.success ? payload.updates || [] : []);

const pickDiscussions = (payload) => (payload?.success ? payload.messages || [] : []);

const EMPTY_PROJECT = { project: null, failure: null };
const EMPTY_LIST = [];

export default function ProjectDetail() {
  const router = useRouter();
  const params = useParams();
  const { t } = useI18n();
  const { prompt } = useDialogs();
  // The signed-in role, observed from the session the shell already publishes
  // rather than re-read from the browser's stored copy. "super_admin" is the
  // same fallback the stored copy's absence used to produce.
  const { role } = useSessionUser();
  const userRole = role || "super_admin";
  const [activeTab, setActiveTab] = useState("overview");

  const [blockerFilter, setBlockerFilter] = useState("all");
  const [updateForm, setUpdateForm] = useState({
    accomplishments: "",
    current_focus: "",
    blockers: "",
    next_steps: "",
    overall_status: "on_track",
    notes: "",
  });
  const [savingUpdate, setSavingUpdate] = useState(false);
  const [newDiscussion, setNewDiscussion] = useState("");
  const [postingDiscussion, setPostingDiscussion] = useState(false);

  const projectId = params?.id;

  // ── The reads ──
  // Each loader — the cache-first paint, the discarding of a stale answer, the
  // background refresh — belongs to the hook, so the screen keeps no copy of any
  // of them and reads them during render.

  const {
    data: projectData,
    loading: projectLoading,
    error: projectReadError,
    refresh: refreshProject,
  } = useApi(projectId ? `/api/admin/projects/${projectId}` : null, {
    defaultValue: EMPTY_PROJECT,
    transform: pickProject,
    deps: [projectId],
  });
  const project = projectData.project;

  // The refusal the loader used to paint into its own error state: the server's
  // own message when the payload carried one, the network's otherwise.
  const error = projectData.failure
    ? t(projectData.failure)
    : projectReadError
      ? t("adminMisc.projectDetail.loadProjectNetworkError")
      : null;

  // The skeleton is for not knowing the project yet, which is the only moment
  // the loader left it up. A re-read — the task console asks for one after every
  // edit — must not blank a page that is already on screen.
  const loading = !projectId || (projectLoading && !project);

  const { data: allStaff } = useApi("/api/contacts", {
    defaultValue: EMPTY_LIST,
    transform: pickStaff,
  });

  const {
    data: approvalRequests,
    loading: approvalsLoading,
    refresh: refreshApprovals,
  } = useApi(projectId ? `/api/admin/projects/${projectId}/approvals` : null, {
    defaultValue: EMPTY_LIST,
    transform: pickApprovals,
    deps: [projectId],
  });

  const handleApprovalAction = async (requestId, action, rejectionReason) => {
    try {
      const response = await fetch(`/api/admin/projects/${projectId}/approvals`, {
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
      const data = await response.json();
      if (data.success) refreshApprovals();
    } catch (error) {
      console.error("Approval action error:", error);
    }
  };

  const {
    data: updates,
    loading: updatesLoading,
    refresh: refreshUpdates,
  } = useApi(projectId ? `/api/admin/projects/${projectId}/updates` : null, {
    defaultValue: EMPTY_LIST,
    transform: pickUpdates,
    deps: [projectId],
  });

  // Asking the server to write this week's report when it is missing used to
  // precede the updates read, and it still does: that request keeps nothing, so
  // it stays an effect whose only job is the request, and the read is re-asked
  // once it has settled. The read is mirrored into a ref because it is a new
  // function on every render and the effect must not re-run for that.
  const refreshUpdatesRef = useRef(refreshUpdates);
  useEffect(() => {
    refreshUpdatesRef.current = refreshUpdates;
  });
  useEffect(() => {
    if (!projectId) return;
    let active = true;
    fetch(`/api/admin/projects/${projectId}/reports/generate`, {
      method: "POST",
    })
      .catch(() => {})
      .then(() => {
        if (active) refreshUpdatesRef.current();
      });
    return () => {
      active = false;
    };
  }, [projectId]);

  const {
    data: discussions,
    loading: discussionsLoading,
    refresh: refreshDiscussions,
  } = useApi(projectId ? `/api/projects/discuss?project_id=${projectId}` : null, {
    defaultValue: EMPTY_LIST,
    transform: pickDiscussions,
    deps: [projectId],
  });

  const handlePostDiscussion = async () => {
    if (!newDiscussion.trim()) return;
    setPostingDiscussion(true);
    try {
      const response = await fetch("/api/projects/discuss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: String(projectId),
          sender_id: userRole || "admin",
          sender_name: "Admin",
          body: newDiscussion.trim(),
        }),
      });
      const data = await response.json();
      if (data.success) {
        setNewDiscussion("");
        refreshDiscussions();
      }
    } catch (_) {}
    setPostingDiscussion(false);
  };

  const handleSubmitUpdate = async () => {
    setSavingUpdate(true);
    try {
      const response = await fetch(`/api/admin/projects/${projectId}/updates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...updateForm,
          user_id: project.owner_id || "sa",
          user_name: project.owner_name || "Project Owner",
          status: "submitted",
        }),
      });
      const data = await response.json();
      if (data.success) {
        refreshUpdates();
        setUpdateForm({
          accomplishments: "",
          current_focus: "",
          blockers: "",
          next_steps: "",
          overall_status: "on_track",
          notes: "",
        });
      }
    } catch (error) {
      console.error("Failed to save update:", error);
    } finally {
      setSavingUpdate(false);
    }
  };

  const projectBlockers = project?.blockers;
  const filteredBlockers = React.useMemo(() => {
    if (!projectBlockers) return [];
    if (blockerFilter === "all") return projectBlockers;
    return projectBlockers.filter((blocker) => blocker.status === blockerFilter);
  }, [projectBlockers, blockerFilter]);

  const activeBlockersCount = React.useMemo(() => {
    return (project?.blockers || []).filter((blocker) => blocker.status === "active")
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
              {[1, 2, 3, 4].map((skeletonIndex) => (
                <div
                  key={skeletonIndex}
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
            className="mt-6 flex items-center gap-2 px-4 py-2 bg-[var(--brand-orange)] text-black rounded-lg text-sm font-bold uppercase tracking-wide hover:brightness-110 transition-all"
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
                };
                router.push(roleMap[userRole] || "/admin/projects");
              }}
              className="group flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--brand-orange)] transition-all font-bold text-[10px] uppercase tracking-wide"
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
                    className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded ${STATUS_BG[project.status] || "bg-slate-500/10"} ${STATUS_COLORS[project.status] || "text-slate-400"}`}
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
            onClick={refreshProject}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-[var(--border-primary)] hover:bg-tertiary transition-all text-[10px] font-bold uppercase tracking-wide"
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
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
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
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
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
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
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
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
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
                    (approvalRequests.filter((request) => request.status === "pending")
                      .length > 0
                      ? ` (${approvalRequests.filter((request) => request.status === "pending").length})`
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
                    className={`flex items-center gap-1.5 px-3 py-3 text-[10px] font-bold uppercase tracking-widest transition-all border-b-2 -mb-[1px] shrink-0 whitespace-nowrap ${
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
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
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
              ].map((breakdownItem) => (
                <div
                  key={breakdownItem.label}
                  className={`card p-3 text-center ${breakdownItem.bg}`}
                >
                  <p className={`text-lg font-black ${breakdownItem.color}`}>
                    {breakdownItem.count}
                  </p>
                  <p
                    className={`text-[10px] font-bold uppercase tracking-widest mt-1 ${breakdownItem.color}`}
                  >
                    {breakdownItem.label}
                  </p>
                </div>
              ))}
            </div>

            {/* Timeline Health */}
            {project.timelineHealth !== undefined && (
              <div className="card space-y-2">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
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
              onTasksChange={refreshProject}
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
                    count: blockers.filter((blocker) => blocker.status === "active")
                      .length,
                  }),
                },
                {
                  id: "resolved",
                  label: t("adminMisc.projectDetail.blockerFilterResolved", {
                    count: blockers.filter((blocker) => blocker.status === "resolved")
                      .length,
                  }),
                },
              ].map((filterOption) => (
                <button
                  key={filterOption.id}
                  onClick={() => setBlockerFilter(filterOption.id)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${
                    blockerFilter === filterOption.id
                      ? "bg-[var(--brand-orange)] text-black"
                      : "bg-tertiary text-slate-500 hover:text-[var(--text-primary)]"
                  }`}
                >
                  {filterOption.label}
                </button>
              ))}
            </div>

            {filteredBlockers.length === 0 ? (
              <div className="card py-16 flex flex-col items-center justify-center text-center opacity-50 border-dashed">
                <Shield className="w-12 h-12 mb-3" />
                <p className="text-sm text-[var(--text-secondary)]">
                  {t("adminMisc.projectDetail.noBlockers")}
                </p>
                <p className="text-sm text-[var(--text-secondary)] mt-1">
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
                          className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                            blocker.status === "active"
                              ? "bg-rose-500/10 text-rose-500"
                              : "bg-emerald-500/10 text-emerald-500"
                          }`}
                        >
                          {blockerStatusLabels[blocker.status] ||
                            blocker.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1.5 text-[10px] font-medium text-[var(--text-secondary)]">
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
                <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--brand-orange)]">
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
                    <p className="text-[10px] font-medium text-[var(--text-secondary)] mt-0.5">
                      {t("adminMisc.projectDetail.ownerAccountable")}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-[10px] font-medium text-[var(--text-secondary)]">
                  {t("adminMisc.projectDetail.noOwnerAssigned")}
                </p>
              )}
            </div>

            {/* Collaborators Section */}
            <div className="card border-l-4 border-l-blue-500">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-500" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-blue-500">
                    {t("adminMisc.projectDetail.collaborators")}
                  </span>
                </div>
                <span className="text-[10px] font-medium text-[var(--text-secondary)]">
                  {t("adminMisc.projectDetail.totalCount", {
                    count: members.length,
                  })}
                </span>
              </div>

              {/* Collaborator list */}
              {members.length === 0 ? (
                <p className="text-sm text-[var(--text-secondary)] text-center py-6">
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
                        <div className="w-8 h-8 rounded-full bg-primary border border-[var(--border-primary)] flex items-center justify-center text-[10px] font-bold uppercase">
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
                              <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--brand-orange)]">
                                {member.member_role}
                              </span>
                            )}
                            {member.role && (
                              <span className="text-[10px] font-medium text-[var(--text-secondary)]">
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
                            refreshProject();
                          } catch (error) {
                            console.error(error);
                          }
                        }}
                        className="text-[10px] font-bold uppercase text-rose-400 hover:text-rose-300 px-2 py-1 rounded-lg hover:bg-rose-500/10 transition-all"
                      >
                        {t("adminMisc.projectDetail.remove")}
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add Collaborator */}
              <div className="pt-3 border-t border-[var(--border-primary)]/30">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-2">
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
                        (staffMember) =>
                          staffMember.cid !== (project.owner_id || "") &&
                          !members.find(
                            (member) =>
                              String(member.member_id) === String(staffMember.cid || staffMember.id),
                          ),
                      )
                      .map((staffMember) => (
                        <option key={staffMember.cid || staffMember.id} value={staffMember.cid || staffMember.id}>
                          {staffMember.name} ({staffMember.role})
                        </option>
                      ))}
                  </select>
                  <button
                    onClick={async () => {
                      const selectElement = document.getElementById("add-collab-team");
                      if (selectElement?.value) {
                        try {
                          await fetch("/api/projects/members", {
                            method: "POST",
                            headers: {
                              "Content-Type": "application/json",
                            },
                            body: JSON.stringify({
                              project_id: project.id,
                              user_cid: selectElement.value,
                              role: "member",
                            }),
                          });
                          selectElement.value = "";
                          refreshProject();
                        } catch (error) {
                          console.error(error);
                        }
                      }
                    }}
                    className="px-4 py-2 bg-[var(--brand-orange)] text-black rounded-lg text-sm font-bold uppercase tracking-wide hover:brightness-110"
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
                <h3 className="text-[10px] font-bold text-[var(--brand-orange)] uppercase tracking-widest">
                  {t("adminMisc.projectDetail.thisWeeksUpdate")}
                </h3>
                <button
                  onClick={async () => {
                    try {
                      const response = await fetch(
                        `/api/admin/projects/${projectId}/reports/generate`,
                        { method: "POST" },
                      );
                      const data = await response.json();
                      if (data.success) {
                        refreshUpdates();
                        window.dispatchEvent(new CustomEvent('impactos:notify', { detail: { type: 'success', message: t("adminMisc.projectDetail.reportGenerated", { week: data.week }) } }));
                      } else window.dispatchEvent(new CustomEvent('impactos:notify', { detail: { type: 'error', message: t((data.error || t("adminMisc.projectDetail.generateFailed")) || "") || (data.error || t("adminMisc.projectDetail.generateFailed")) } }));
                    } catch (_) {}
                  }}
                  className="ml-auto px-3 py-1 rounded text-[10px] font-bold uppercase tracking-widest bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-white transition-all"
                >
                  {t("adminMisc.projectDetail.generateReport")}
                </button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] block mb-1">
                    {t("adminMisc.projectDetail.overallStatus")}
                  </label>
                  <select
                    value={updateForm.overall_status}
                    onChange={(event) =>
                      setUpdateForm((previous) => ({
                        ...previous,
                        overall_status: event.target.value,
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
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] block mb-1">
                    {t("adminMisc.projectDetail.accomplishmentsThisWeek")}
                  </label>
                  <textarea
                    value={updateForm.accomplishments}
                    onChange={(event) =>
                      setUpdateForm((previous) => ({
                        ...previous,
                        accomplishments: event.target.value,
                      }))
                    }
                    placeholder={t("adminMisc.projectDetail.accomplishmentsPlaceholder")}
                    rows={3}
                    className="w-full bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-2 text-xs font-bold outline-none focus:border-[var(--brand-orange)] transition-all resize-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] block mb-1">
                    {t("adminMisc.projectDetail.currentFocus")}
                  </label>
                  <textarea
                    value={updateForm.current_focus}
                    onChange={(event) =>
                      setUpdateForm((previous) => ({
                        ...previous,
                        current_focus: event.target.value,
                      }))
                    }
                    placeholder={t("adminMisc.projectDetail.currentFocusPlaceholder")}
                    rows={2}
                    className="w-full bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-2 text-xs font-bold outline-none focus:border-[var(--brand-orange)] transition-all resize-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] block mb-1">
                    {t("adminMisc.projectDetail.blockersIssues")}
                  </label>
                  <textarea
                    value={updateForm.blockers}
                    onChange={(event) =>
                      setUpdateForm((previous) => ({
                        ...previous,
                        blockers: event.target.value,
                      }))
                    }
                    placeholder={t("adminMisc.projectDetail.blockersPlaceholder")}
                    rows={2}
                    className="w-full bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-2 text-xs font-bold outline-none focus:border-[var(--brand-orange)] transition-all resize-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] block mb-1">
                    {t("adminMisc.projectDetail.nextSteps")}
                  </label>
                  <textarea
                    value={updateForm.next_steps}
                    onChange={(event) =>
                      setUpdateForm((previous) => ({
                        ...previous,
                        next_steps: event.target.value,
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
                  className="flex items-center justify-center gap-2 w-full py-3 bg-[var(--brand-orange)] text-black rounded-xl text-sm font-bold uppercase tracking-wide hover:brightness-110 transition-all disabled:opacity-50"
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
                <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                  {t("adminMisc.projectDetail.previousUpdates")}
                </h3>
                <span className="text-[10px] font-medium text-[var(--text-secondary)] ml-auto">
                  {t("adminMisc.projectDetail.totalCount", {
                    count: updates.length,
                  })}
                </span>
              </div>

              {updates.length === 0 && !updatesLoading ? (
                <div className="card py-12 flex flex-col items-center justify-center text-center opacity-50 border-dashed">
                  <FileText className="w-10 h-10 mb-2" />
                  <p className="text-sm text-[var(--text-secondary)]">
                    {t("adminMisc.projectDetail.noUpdates")}
                  </p>
                  <p className="text-sm text-[var(--text-secondary)] mt-1">
                    {t("adminMisc.projectDetail.noUpdatesHint")}
                  </p>
                </div>
              ) : updatesLoading ? (
                <div className="text-center py-8 text-[10px] font-medium text-[var(--text-secondary)]">
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
                              className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded ${
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
                          <span className="text-[10px] font-medium text-[var(--text-secondary)]">
                            {new Date(update.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        {update.accomplishments && (
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-1">
                              {t("adminMisc.projectDetail.accomplishments")}
                            </p>
                            <p className="text-[10px] text-[var(--text-secondary)] whitespace-pre-wrap">
                              {update.accomplishments}
                            </p>
                          </div>
                        )}
                        {update.current_focus && (
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-1">
                              {t("adminMisc.projectDetail.currentFocus")}
                            </p>
                            <p className="text-[10px] text-[var(--text-secondary)] whitespace-pre-wrap">
                              {update.current_focus}
                            </p>
                          </div>
                        )}
                        {update.blockers && (
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-1">
                              {t("adminMisc.projectDetail.blockers")}
                            </p>
                            <p className="text-[10px] text-rose-400 whitespace-pre-wrap">
                              {update.blockers}
                            </p>
                          </div>
                        )}
                        {update.next_steps && (
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-1">
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
              <div className="text-center py-8 text-[10px] font-medium text-[var(--text-secondary)]">
                {t("adminMisc.projectDetail.loadingRequests")}
              </div>
            ) : approvalRequests.filter((request) => request.status === "pending")
                .length === 0 &&
              approvalRequests.filter((request) => request.status !== "pending")
                .length === 0 ? (
              <div className="card py-16 flex flex-col items-center justify-center text-center opacity-50 border-dashed">
                <UserPlus className="w-12 h-12 mb-3" />
                <p className="text-sm text-[var(--text-secondary)]">
                  {t("adminMisc.projectDetail.noContributionRequests")}
                </p>
                <p className="text-sm text-[var(--text-secondary)] mt-1">
                  {t("adminMisc.projectDetail.noContributionRequestsHint")}
                </p>
              </div>
            ) : (
              <>
                {/* Pending Requests */}
                {approvalRequests.filter((request) => request.status === "pending")
                  .length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-[10px] font-bold text-amber-500 uppercase tracking-widest flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5" />
                      {t("adminMisc.projectDetail.pendingReview", {
                        count: approvalRequests.filter(
                          (request) => request.status === "pending",
                        ).length,
                      })}
                    </h3>
                    {approvalRequests
                      .filter((request) => request.status === "pending")
                      .map((pendingRequest) => (
                        <div
                          key={pendingRequest.id}
                          className="card border-l-4 border-l-amber-500 p-4 space-y-3"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-xs font-bold text-[var(--text-primary)]">
                                {pendingRequest.task_title ||
                                  t("adminMisc.projectDetail.taskFallback", {
                                    id: pendingRequest.task_id,
                                  })}
                              </p>
                              <p className="text-[10px] font-medium text-[var(--text-secondary)] mt-0.5">
                                {t("adminMisc.projectDetail.by")}{" "}
                                {pendingRequest.requester_name ||
                                  pendingRequest.requester_name_lookup ||
                                  pendingRequest.requester_id}{" "}
                                ·{" "}
                                {new Date(pendingRequest.created_at).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() =>
                                handleApprovalAction(pendingRequest.id, "approved")
                              }
                              className="px-4 py-2 bg-emerald-500 text-black rounded-lg text-sm font-bold uppercase tracking-wide hover:brightness-110 transition-all"
                            >
                              {t("adminMisc.projectDetail.approve")}
                            </button>
                            <button
                              onClick={async () => {
                                const reason = await prompt({
                                  message: t("adminMisc.projectDetail.rejectionReasonPrompt"),
                                });
                                if (reason)
                                  handleApprovalAction(
                                    pendingRequest.id,
                                    "rejected",
                                    reason,
                                  );
                              }}
                              className="px-4 py-2 bg-rose-500/10 text-rose-400 rounded-lg text-[10px] font-bold uppercase tracking-wide hover:brightness-110 transition-all"
                            >
                              {t("adminMisc.projectDetail.reject")}
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                )}

                {/* History */}
                {approvalRequests.filter((request) => request.status !== "pending")
                  .length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                      {t("adminMisc.projectDetail.history")}
                    </h3>
                    {approvalRequests
                      .filter((request) => request.status !== "pending")
                      .map((decidedRequest) => (
                        <div
                          key={decidedRequest.id}
                          className={`card p-3 border-l-4 ${
                            decidedRequest.status === "approved"
                              ? "border-l-emerald-500"
                              : "border-l-rose-500"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded ${
                                decidedRequest.status === "approved"
                                  ? "bg-emerald-500/10 text-emerald-500"
                                  : "bg-rose-500/10 text-rose-500"
                              }`}
                            >
                              {approvalStatusLabels[decidedRequest.status] || decidedRequest.status}
                            </span>
                            <span className="text-[10px] font-bold text-[var(--text-primary)]">
                              {decidedRequest.task_title ||
                                t("adminMisc.projectDetail.taskFallback", {
                                  id: decidedRequest.task_id,
                                })}
                            </span>
                          </div>
                          <p className="text-[10px] font-medium text-[var(--text-secondary)] mt-1">
                            {decidedRequest.requester_name || decidedRequest.requester_id} ·{" "}
                            {new Date(decidedRequest.created_at).toLocaleDateString()}
                            {decidedRequest.rejection_reason && (
                              <>
                                {" "}
                                · {t("adminMisc.projectDetail.reasonLabel")}{" "}
                                <span className="text-rose-400">
                                  {decidedRequest.rejection_reason}
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
                  onChange={(event) => setNewDiscussion(event.target.value)}
                  placeholder={t("messaging.typeDiscussion")}
                  rows={2}
                  className="flex-1 px-3 py-2 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[11px] font-bold text-[var(--text-primary)] outline-none resize-none"
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
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
                {discussions.map((message) => (
                  <div key={message.id} className="card p-4 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-[var(--bg-tertiary)] border border-[var(--border-primary)] flex items-center justify-center text-[10px] font-bold text-[var(--text-primary)]">
                        {(message.sender_name || "?").charAt(0).toUpperCase()}
                      </div>
                      <span className="text-[10px] font-bold text-[var(--text-primary)]">
                        {message.sender_name || t("adminMisc.projectDetail.unknown")}
                      </span>
                      <span className="text-[10px] font-medium text-[var(--text-secondary)] ml-auto">
                        {new Date(message.created_at).toLocaleDateString(
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
                      {message.body}
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
                <p className="text-sm text-[var(--text-secondary)]">
                  {t("adminMisc.projectDetail.noActivity")}
                </p>
                <p className="text-sm text-[var(--text-secondary)] mt-1">
                  {t("adminMisc.projectDetail.noActivityHint")}
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                {timeline.map((entry, index) => (
                  <div key={entry.id || index} className="flex items-start gap-3">
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
                      {index < timeline.length - 1 && (
                        <div className="w-px flex-1 bg-[var(--border-primary)] min-h-[24px]" />
                      )}
                    </div>
                    {/* Content */}
                    <div className="flex-1 pb-4">
                      <div className="card p-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`text-[10px] font-bold uppercase tracking-widest ${
                              entry.action_type?.includes("COMPLETED")
                                ? "text-emerald-500"
                                : entry.action_type?.includes("BLOCKED")
                                  ? "text-rose-500"
                                  : entry.action_type?.includes("CREATED")
                                    ? "text-blue-500"
                                    : entry.action_type?.includes("ASSIGNED")
                                      ? "text-amber-500"
                                      : "text-[var(--text-secondary)]"
                            }`}
                          >
                            {entry.action_type?.replace(/_/g, " ") ||
                              entry.action ||
                              t("adminMisc.projectDetail.update")}
                          </span>
                          <span className="text-[10px] font-medium text-[var(--text-secondary)]">
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
                          <p className="text-[10px] font-medium text-[var(--text-secondary)] mt-0.5">
                            {t("adminMisc.projectDetail.by")}{" "}
                            <span className="font-bold text-[var(--text-primary)]">
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
