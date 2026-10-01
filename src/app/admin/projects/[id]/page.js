"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { useApi } from "@/lib/hooks/useApi";
import { useSessionUser } from "@/lib/hooks/useSessionUser";
import { useDialogs } from "@/components/ui/DialogProvider";
import ProjectSkeleton from "@/components/admin/projects/detail/ProjectSkeleton";
import ProjectNotFound from "@/components/admin/projects/detail/ProjectNotFound";
import DetailHeader from "@/components/admin/projects/detail/DetailHeader";
import DetailStats from "@/components/admin/projects/detail/DetailStats";
import DetailTabs from "@/components/admin/projects/detail/DetailTabs";
import OverviewTab from "@/components/admin/projects/detail/OverviewTab";
import DetailTasksTab from "@/components/admin/projects/detail/DetailTasksTab";
import BlockersTab from "@/components/admin/projects/detail/BlockersTab";
import TeamTab from "@/components/admin/projects/detail/TeamTab";
import UpdatesTab from "@/components/admin/projects/detail/UpdatesTab";
import ApprovalsTab from "@/components/admin/projects/detail/ApprovalsTab";
import DiscussionsTab from "@/components/admin/projects/detail/DiscussionsTab";
import TimelineTab from "@/components/admin/projects/detail/TimelineTab";

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
  if (loading) return <ProjectSkeleton />;

  // Error state
  if (error || !project) {
    return (
      <ProjectNotFound
        error={error}
        onBack={() => router.push("/admin/projects")}
      />
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

  // ── The actions the tabs ask for ──
  // Each of these changes something on the server, so they belong to the page:
  // the tabs only say which action was asked for.

  const handleRemoveCollaborator = async (memberId) => {
    try {
      await fetch(
        `/api/projects/members?project_id=${project.id}&user_cid=${memberId}`,
        { method: "DELETE" },
      );
      refreshProject();
    } catch (error) {
      console.error(error);
    }
  };

  const handleAddCollaborator = async () => {
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
  };

  const updateUpdateForm = (field, value) =>
    setUpdateForm((previous) => ({ ...previous, [field]: value }));

  const handleGenerateReport = async () => {
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
  };

  const handleRejectRequest = async (requestId) => {
    const reason = await prompt({
      message: t("adminMisc.projectDetail.rejectionReasonPrompt"),
    });
    if (reason) handleApprovalAction(requestId, "rejected", reason);
  };

  const goToAllProjects = () => {
    const roleMap = {
      super_admin: "/admin/projects",
      staff: "/staff/projects",
      program_manager: "/staff/projects",
    };
    router.push(roleMap[userRole] || "/admin/projects");
  };

  return (
    <>
      <div className="space-y-8 pb-20 text-left">
        {/* ─── TOAST NOTIFICATIONS ─── */}

        {/* ─── HEADER ─── */}
        <DetailHeader
          project={project}
          projectStatusLabels={projectStatusLabels}
          onBack={goToAllProjects}
          onRefresh={refreshProject}
        />

        {/* ─── OVERVIEW STATS CARDS ─── */}
        <DetailStats
          project={project}
          activeBlockersCount={activeBlockersCount}
          members={members}
        />

        {/* ─── TAB NAVIGATION (SCROLLABLE) ─── */}
        <DetailTabs
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          tasks={tasks}
          blockers={blockers}
          members={members}
          discussions={discussions}
          approvalRequests={approvalRequests}
        />

        {/* ─── TAB: OVERVIEW ─── */}
        {activeTab === "overview" && <OverviewTab project={project} />}

        {/* ─── TAB: TASKS ─── */}
        {activeTab === "tasks" && (
          <DetailTasksTab
            project={project}
            members={members}
            onRefresh={refreshProject}
          />
        )}

        {/* ─── TAB: BLOCKERS ─── */}
        {activeTab === "blockers" && (
          <BlockersTab
            blockers={blockers}
            blockerFilter={blockerFilter}
            onFilter={setBlockerFilter}
            filteredBlockers={filteredBlockers}
            blockerStatusLabels={blockerStatusLabels}
          />
        )}

        {/* ─── TAB: TEAM ─── */}
        {activeTab === "team" && (
          <TeamTab
            project={project}
            members={members}
            allStaff={allStaff}
            onRemoveMember={handleRemoveCollaborator}
            onAddCollaborator={handleAddCollaborator}
          />
        )}

        {/* ─── TAB: WEEKLY UPDATE ─── */}
        {activeTab === "updates" && (
          <UpdatesTab
            updateForm={updateForm}
            onFormChange={updateUpdateForm}
            savingUpdate={savingUpdate}
            onSubmitUpdate={handleSubmitUpdate}
            onGenerateReport={handleGenerateReport}
            updates={updates}
            updatesLoading={updatesLoading}
            updateStatusLabels={updateStatusLabels}
          />
        )}

        {/* ─── TAB: APPROVALS ─── */}
        {activeTab === "approvals" && (
          <ApprovalsTab
            approvalRequests={approvalRequests}
            approvalsLoading={approvalsLoading}
            approvalStatusLabels={approvalStatusLabels}
            onApprovalAction={handleApprovalAction}
            onRejectRequest={handleRejectRequest}
          />
        )}

        {/* ─── TAB: DISCUSSIONS ─── */}
        {activeTab === "discussions" && (
          <DiscussionsTab
            newDiscussion={newDiscussion}
            onDiscussionChange={setNewDiscussion}
            onPostDiscussion={handlePostDiscussion}
            postingDiscussion={postingDiscussion}
            discussionsLoading={discussionsLoading}
            discussions={discussions}
          />
        )}

        {/* ─── TAB: TIMELINE ─── */}
        {activeTab === "timeline" && <TimelineTab timeline={timeline} />}
      </div>
    </>
  );
}
