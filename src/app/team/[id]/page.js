"use client";

import { useState, use, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { useSafeBack } from "@/lib/useSafeBack";
import { useApi } from "@/lib/hooks/useApi";
import { useSessionUser } from "@/lib/hooks/useSessionUser";
import TeamWorkspaceView from "@/components/team/team-workspace/TeamWorkspaceView";
import {
  EMPTY_MAP,
  NO_DELIVERABLES,
  pickDeliverables,
  pickFirstProgram,
  pickSubmissionsByDeliverable,
  pickTasks,
  pickTeams,
} from "@/components/team/team-workspace/constants";

const EMPTY_TASK_FORM = {
  title: "",
  description: "",
  priority: "medium",
  assigned_to: "",
};

/** The roles allowed to coach a submission and to mark a venture ready. */
const REVIEW_ROLES = ["staff", "super_admin", "program_manager"];

export default function TeamDashboardPage({ params }) {
  const unwrappedParams = use(params);
  const { id: teamId } = unwrappedParams;
  const router = useRouter();
  const goBack = useSafeBack("/");
  const { t } = useI18n();

  // — State —
  const [activeTab, setActiveTab] = useState("overview");
  const [submitting, setSubmitting] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [selectedDeliverable, setSelectedDeliverable] = useState(null);
  const [submitFileUrl, setSubmitFileUrl] = useState("");
  const [submitLink, setSubmitLink] = useState("");
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState(null);

  // Task 4.5 — Team Workspace state
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [taskForm, setTaskForm] = useState(EMPTY_TASK_FORM);
  const [savingTask, setSavingTask] = useState(false);

  // Task 4.4 — Coaching state
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewSubData, setReviewSubData] = useState(null);
  const [reviewFeedback, setReviewFeedback] = useState("");
  const [showFollowUpModal, setShowFollowUpModal] = useState(false);
  const [followUpDate, setFollowUpDate] = useState("");
  const [reviewing, setReviewing] = useState(false);

  // Who is signed in, from the shell's session cache. This screen used to ask the
  // session endpoint for itself, which the shell has already done.
  const { role: userRole } = useSessionUser();

  // — Read everything —
  //
  // A chain rather than a set: the team names the programme, and the programme
  // names the three reads below it. Each one is addressed from the value the one
  // above it returned, so a value that is not known yet is simply an address that
  // is not known yet - there is nothing to keep in step.
  const {
    data: teams,
    loading: teamsLoading,
    refresh: refreshTeams,
  } = useApi(`/api/teams?program_id=all&team_id=${teamId}`, {
    defaultValue: [],
    transform: pickTeams,
    deps: [teamId],
  });

  const team =
    teams.find((candidate) => candidate.id === teamId || String(candidate.id) === String(teamId)) ||
    null;
  const members = team?.members || [];
  const programId = team?.program_id || null;

  const {
    data: program,
    loading: programLoading,
    error: programError,
    status: programStatus,
    refresh: refreshProgram,
  } = useApi(programId ? `/api/programs?id=${programId}` : null, {
    defaultValue: null,
    transform: pickFirstProgram,
    deps: [programId],
  });

  const {
    data: deliverablesPayload,
    loading: deliverablesLoading,
    refresh: refreshDeliverables,
  } = useApi(programId ? `/api/deliverables?program_id=${programId}` : null, {
    defaultValue: NO_DELIVERABLES,
    transform: pickDeliverables,
    deps: [programId],
  });
  const deliverables = deliverablesPayload.list;
  const upcomingDeadlines = deliverablesPayload.upcoming;

  const {
    data: submissions,
    loading: submissionsLoading,
    refresh: refreshSubmissions,
  } = useApi(
    programId ? `/api/submissions?team_id=${teamId}&program_id=${programId}` : null,
    { defaultValue: EMPTY_MAP, transform: pickSubmissionsByDeliverable, deps: [teamId, programId] },
  );

  // The tasks are read only while their tab is open, which is what the effect
  // this replaced expressed by deciding whether to call its loader.
  const {
    data: tasks,
    loading: tasksLoading,
    refresh: refreshTasks,
  } = useApi(
    teamId && activeTab === "tasks" ? `/api/team-tasks?team_id=${teamId}` : null,
    { defaultValue: [], transform: pickTasks, deps: [teamId, activeTab] },
  );

  // One render passes with the programme known and its three reads not yet asked
  // for: the hook's flags rise in the effect, which is after that render. Counting
  // it as loading keeps the shell from showing empty panels for that frame.
  const programReadPending =
    Boolean(programId) && programStatus === null && !programError;
  const loading =
    teamsLoading ||
    programReadPending ||
    programLoading ||
    deliverablesLoading ||
    submissionsLoading;

  // Every action below re-reads the chain it changed.
  const reloadTeam = useCallback(() => {
    refreshTeams();
    refreshProgram();
    refreshDeliverables();
    refreshSubmissions();
  }, [refreshTeams, refreshProgram, refreshDeliverables, refreshSubmissions]);

  // — File upload handler —
  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      if (data.url) {
        setSubmitFileUrl(data.url);
      } else if (data.blob?.url) {
        setSubmitFileUrl(data.blob.url);
      } else {
        setToast({
          type: "error",
          message: t("rootMisc.team.uploadFailed"),
        });
      }
    } catch (_) {
      setToast({ type: "error", message: t("rootMisc.team.uploadError") });
    } finally {
      setUploading(false);
    }
  };

  // — Submit deliverable —
  const handleSubmitDeliverable = async () => {
    if (!selectedDeliverable) return;
    const fileUrl = submitFileUrl || submitLink;
    if (!fileUrl) {
      setToast({ type: "error", message: t("rootMisc.team.provideFileOrLink") });
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          program_id: team.program_id,
          deliverable_id: selectedDeliverable.id,
          team_id: teamId,
          file_url: fileUrl,
          status: "pending",
        }),
      });
      const data = await response.json();
      if (data.success) {
        setToast({ type: "success", message: t("rootMisc.team.submissionSuccess") });
        setShowSubmitModal(false);
        setSelectedDeliverable(null);
        setSubmitFileUrl("");
        setSubmitLink("");
        reloadTeam();
      } else {
        setToast({
          type: "error",
          message: t((data.error || t("rootMisc.team.submissionFailed")) || "") || (data.error || t("rootMisc.team.submissionFailed")),
        });
      }
    } catch (_) {
      setToast({ type: "error", message: t("rootMisc.team.networkError") });
    } finally {
      setSubmitting(false);
    }
  };

  // — Open submit modal —
  const openSubmitModal = (deliverable) => {
    setSelectedDeliverable(deliverable);
    setSubmitFileUrl("");
    setSubmitLink("");
    setShowSubmitModal(true);
  };

  // — Coaching review handler —
  const openReviewModal = (deliverable) => {
    const submission = getSubmissionStatus(deliverable.id);
    if (!submission) return;
    setReviewSubData({ ...submission, _deliverable: deliverable });
    setReviewFeedback(submission.feedback || "");
    setShowReviewModal(true);
  };

  const closeReviewModal = () => {
    setShowReviewModal(false);
    setShowFollowUpModal(false);
  };

  const handleReviewAction = async (status, followUp) => {
    if (!reviewSubData?.id) return;
    setReviewing(true);
    try {
      const body = { id: reviewSubData.id, status, feedback: reviewFeedback };
      if (followUp && followUpDate) {
        body.follow_up = {
          scheduled_at: followUpDate,
          comment: reviewFeedback,
        };
      }
      const response = await fetch("/api/submissions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (data.success) {
        setToast({
          type: "success",
          message: `${t("rootMisc.team.submissionToast")} ${status.replace(/_/g, " ")}`,
        });
        setShowReviewModal(false);
        setReviewSubData(null);
        setReviewFeedback("");
        setFollowUpDate("");
        reloadTeam();
      } else {
        setToast({ type: "error", message: t((data.error || t("rootMisc.team.reviewFailed")) || "") || (data.error || t("rootMisc.team.reviewFailed")) });
      }
    } catch (error) {
      setToast({ type: "error", message: t(error.message || "") || error.message });
    }
    setReviewing(false);
  };

  // — Task CRUD handlers —
  const openTaskModal = () => {
    setEditingTask(null);
    setTaskForm(EMPTY_TASK_FORM);
    setShowTaskModal(true);
  };

  const handleCreateTask = async () => {
    if (!taskForm.title.trim()) return;
    setSavingTask(true);
    try {
      const response = await fetch("/api/team-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...taskForm, team_id: teamId }),
      });
      const data = await response.json();
      if (data.success) {
        setToast({ type: "success", message: t("rootMisc.team.taskCreated") });
        setShowTaskModal(false);
        setTaskForm(EMPTY_TASK_FORM);
        refreshTasks();
      }
    } catch (error) {
      setToast({ type: "error", message: t(error.message || "") || error.message });
    }
    setSavingTask(false);
  };

  const handleUpdateTaskStatus = async (taskId, status) => {
    try {
      const response = await fetch("/api/team-tasks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: taskId, status }),
      });
      const data = await response.json();
      if (data.success) refreshTasks();
    } catch (_) {}
  };

  const handleDeleteTask = async (taskId) => {
    try {
      const response = await fetch("/api/team-tasks", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: taskId }),
      });
      const data = await response.json();
      if (data.success) {
        setToast({ type: "success", message: t("rootMisc.team.taskDeleted") });
        refreshTasks();
      }
    } catch (error) {
      setToast({ type: "error", message: t(error.message || "") || error.message });
    }
  };

  const getSubmissionStatus = (deliverableId) => {
    const submissionList = submissions[deliverableId];
    if (!submissionList || submissionList.length === 0) return null;
    const latest = submissionList[0];
    return latest;
  };

  // — Compute progress % —
  const progressPct = (() => {
    if (deliverables.length === 0) return 0;
    let completed = 0;
    for (const deliverable of deliverables) {
      const submission = getSubmissionStatus(deliverable.id);
      if (submission && (submission.status === "approved" || submission.status === "completed")) {
        completed++;
      }
    }
    return Math.round((completed / deliverables.length) * 100);
  })();

  const toggleVentureReady = async () => {
    try {
      const response = await fetch("/api/teams", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: teamId,
          name: team.name,
          is_venture_ready: !team.is_venture_ready,
        }),
      });
      if ((await response.json()).success) reloadTeam();
    } catch (_) {}
  };

  const completedCount = deliverables.filter((deliverable) => {
    const submission = getSubmissionStatus(deliverable.id);
    return submission && ["approved", "completed"].includes(submission.status);
  }).length;

  const pendingCount = deliverables.filter((deliverable) => {
    const submission = getSubmissionStatus(deliverable.id);
    return !submission || submission.status === "pending";
  }).length;

  const canReview = REVIEW_ROLES.includes(userRole);

  return (
    <TeamWorkspaceView
      t={t}
      loading={loading}
      team={team}
      program={program}
      onGoHome={() => router.push("/")}
      goBack={goBack}
      toast={toast}
      onCloseToast={() => setToast(null)}
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      progressPct={progressPct}
      completedCount={completedCount}
      pendingCount={pendingCount}
      members={members}
      deliverables={deliverables}
      upcomingDeadlines={upcomingDeadlines}
      submissions={submissions}
      getSubmissionStatus={getSubmissionStatus}
      canReview={canReview}
      tasks={tasks}
      tasksLoading={tasksLoading}
      onToggleVentureReady={toggleVentureReady}
      onReview={openReviewModal}
      onSubmit={openSubmitModal}
      onCreateTask={openTaskModal}
      onUpdateStatus={handleUpdateTaskStatus}
      onDeleteTask={handleDeleteTask}
      showSubmitModal={showSubmitModal}
      selectedDeliverable={selectedDeliverable}
      submitFileUrl={submitFileUrl}
      submitLink={submitLink}
      uploading={uploading}
      submitting={submitting}
      onCloseSubmit={() => setShowSubmitModal(false)}
      onFileUpload={handleFileUpload}
      onLinkChange={(event) => setSubmitLink(event.target.value)}
      onSubmitDeliverable={handleSubmitDeliverable}
      showReviewModal={showReviewModal}
      reviewSubData={reviewSubData}
      reviewFeedback={reviewFeedback}
      onFeedbackChange={(event) => setReviewFeedback(event.target.value)}
      showFollowUpModal={showFollowUpModal}
      followUpDate={followUpDate}
      onFollowUpDateChange={(event) => setFollowUpDate(event.target.value)}
      onScheduleFollowUp={() => setShowFollowUpModal(true)}
      reviewing={reviewing}
      onCloseReview={closeReviewModal}
      onReviewAction={handleReviewAction}
      showTaskModal={showTaskModal}
      taskForm={taskForm}
      editingTask={editingTask}
      savingTask={savingTask}
      onCloseTask={() => setShowTaskModal(false)}
      onTaskChange={(field, value) => setTaskForm({ ...taskForm, [field]: value })}
      onTaskSave={handleCreateTask}
    />
  );
}
