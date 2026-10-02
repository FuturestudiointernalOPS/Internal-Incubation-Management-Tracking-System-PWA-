"use client";

import { useState } from "react";
import { AlertTriangle, ArrowLeft, RefreshCw } from "lucide-react";
import { useRouter, useParams } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { useApi } from "@/lib/hooks/useApi";
import { useSessionUser } from "@/lib/hooks/useSessionUser";
import TaskManager from "@/components/tasks/TaskManager";
import ProjectHeader from "@/components/staff/project-detail/ProjectHeader";
import ProjectStats from "@/components/staff/project-detail/ProjectStats";
import ProjectTabs from "@/components/staff/project-detail/ProjectTabs";
import OverviewTab from "@/components/staff/project-detail/OverviewTab";
import BlockersTab from "@/components/staff/project-detail/BlockersTab";
import TeamTab from "@/components/staff/project-detail/TeamTab";
import UpdatesTab from "@/components/staff/project-detail/UpdatesTab";
import DiscussionsTab from "@/components/staff/project-detail/DiscussionsTab";
import TimelineTab from "@/components/staff/project-detail/TimelineTab";

// ─── Module-scope readers ────────────────────────────────────────────────────
// The reading hook keys its internal work on these, so they are made once here
// rather than rebuilt on every render.

const EMPTY_LIST = [];

/** The project, whole: the payload carries both the project and its refusal. */
const pickProject = (payload) => (payload?.success ? payload : null);

// The list shapers are built HERE rather than at their call sites, which is the
// habit the file's own note above claims: a factory called inside the component
// returns a new function on every render.
const pickUpdates = (payload) => (payload?.success ? payload.updates || [] : []);
const pickMessages = (payload) => (payload?.success ? payload.messages || [] : []);

export default function StaffProjectDetail() {
  const router = useRouter();
  const params = useParams();
  const { t } = useI18n();
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

  // Who is signed in, from the shell's session cache: no request of its own, and
  // no dependence on the browser's stored copy.
  const { cid: userCid, user } = useSessionUser();

  const projectId = params?.id;

  // The project, its updates and its discussion, through the shared hook: it owns
  // the cache, the cache-first paint and the discarding of a stale answer, so the
  // page keeps no copy of its own and reads its data during render.
  const {
    data: projectPayload,
    loading: projectLoading,
    error: projectError,
    status: projectStatus,
    refresh: refreshProject,
  } = useApi(projectId ? `/api/admin/projects/${projectId}` : null, {
    defaultValue: null,
    transform: pickProject,
    deps: [projectId],
  });
  const project = projectPayload?.project || null;

  const { data: updates, refresh: refreshUpdates } = useApi(
    projectId ? `/api/admin/projects/${projectId}/updates` : null,
    { defaultValue: EMPTY_LIST, transform: pickUpdates, deps: [projectId] },
  );

  const {
    data: discussions,
    loading: discussionsLoading,
    refresh: refreshDiscussions,
  } = useApi(projectId ? `/api/projects/discuss?project_id=${projectId}` : null, {
    defaultValue: EMPTY_LIST,
    transform: pickMessages,
    deps: [projectId],
  });

  // The project's own outcome, derived. A payload that says it failed carries its
  // own message; a request that never got an answer is the network's.
  const error = projectError
    ? t("staffMisc.projectDetail.loadNetworkError")
    : projectStatus !== null && !project
      ? t(projectPayload?.error || "") || t("staffMisc.projectDetail.loadFailed")
      : null;

  const handlePostDiscussion = async () => {
    if (!newDiscussion.trim()) return;
    setPostingDiscussion(true);
    try {
      const response = await fetch("/api/projects/discuss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: String(projectId),
          sender_id: user?.cid || user?.id || "unknown",
          sender_name: user?.name || "Staff",
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
    if (!updateForm.accomplishments && !updateForm.current_focus) return;
    setSavingUpdate(true);
    try {
      const response = await fetch(`/api/admin/projects/${projectId}/updates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...updateForm,
          user_id: userCid || "unknown",
          user_name: user?.name || "Staff",
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
    } catch (_) {}
    setSavingUpdate(false);
  };

  if (projectLoading)
    return (
      <>
        <div className="flex items-center justify-center py-32">
          <RefreshCw className="w-6 h-6 animate-spin text-[var(--brand-orange)]" />
        </div>
      </>
    );

  if (error || !project)
    return (
      <>
        <div className="flex flex-col items-center justify-center py-32">
          <AlertTriangle className="w-16 h-16 text-rose-500 mb-4" />
          <p className="text-base font-black text-rose-500">
            {error || t("staffMisc.projectDetail.notFound")}
          </p>
          <button
            onClick={() => router.push("/staff/projects")}
            className="mt-6 px-4 py-2 bg-[var(--brand-orange)] text-black rounded-lg text-[10px] font-bold uppercase tracking-wide"
          >
            <ArrowLeft className="w-3.5 h-3.5 inline mr-2" />
            {t("staffMisc.projectDetail.backToProjects")}
          </button>
        </div>
      </>
    );

  const tasks = project.tasks || [];
  const blockers = project.blockers || [];
  const members = project.members || [];
  const timeline = project.timeline || [];
  const activeBlockersCount = blockers.filter(
    (blocker) => blocker.status === "active",
  ).length;

  return (
    <>
      <div className="space-y-8 pb-20 text-left">
        {/* Header */}
        <ProjectHeader
          project={project}
          onBack={() => router.push("/staff/projects")}
          onRefresh={() => refreshProject()}
        />

        {/* Stats */}
        <ProjectStats
          project={project}
          activeBlockersCount={activeBlockersCount}
          memberCount={members.length}
        />

        {/* Tabs */}
        <ProjectTabs
          activeTab={activeTab}
          onTabChange={setActiveTab}
          taskCount={tasks.length}
          blockerCount={blockers.length}
          memberCount={members.length}
          discussionCount={discussions.length}
        />

        {/* OVERVIEW */}
        {activeTab === "overview" && (
          <OverviewTab project={project} tasks={tasks} />
        )}

        {/* TASKS */}
        {activeTab === "tasks" && (
          <TaskManager
            mode="project"
            projectId={project.id}
            userId={userCid || ""}
            userName={user?.name || "Staff"}
            projects={[{ id: project.id, name: project.name }]}
            projectMembers={members}
            taskList={project.tasks || []}
            onTasksChange={() => refreshProject()}
            showCarryOver={false}
          />
        )}

        {/* BLOCKERS */}
        {activeTab === "blockers" && (
          <BlockersTab
            blockers={blockers}
            blockerFilter={blockerFilter}
            onFilterChange={setBlockerFilter}
          />
        )}

        {/* TEAM */}
        {activeTab === "team" && <TeamTab members={members} />}

        {/* UPDATES */}
        {activeTab === "updates" && (
          <UpdatesTab
            updateForm={updateForm}
            onUpdateFormChange={setUpdateForm}
            onSubmit={handleSubmitUpdate}
            savingUpdate={savingUpdate}
            updates={updates}
          />
        )}

        {/* DISCUSSIONS */}
        {activeTab === "discussions" && (
          <DiscussionsTab
            discussions={discussions}
            discussionsLoading={discussionsLoading}
            newDiscussion={newDiscussion}
            onDiscussionChange={setNewDiscussion}
            onPost={handlePostDiscussion}
            postingDiscussion={postingDiscussion}
          />
        )}

        {/* TIMELINE */}
        {activeTab === "timeline" && <TimelineTab timeline={timeline} />}
      </div>
    </>
  );
}
