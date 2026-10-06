"use client";

import AppTabs from "@/components/ui/AppTabs";
import AppButton from "@/components/ui/AppButton";
import GlobalToast from "@/components/ui/GlobalToast";
import { Calendar, FileText, FolderKanban, BookOpen, ListTodo, Loader2 } from "lucide-react";
import TeamHeader from "./TeamHeader";
import StatsRow from "./StatsRow";
import TeamInfoCard from "./TeamInfoCard";
import MembersCard from "./MembersCard";
import OverviewDeadlines from "./OverviewDeadlines";
import DeliverablesTab from "./DeliverablesTab";
import TasksTab from "./TasksTab";
import FilesTab from "./FilesTab";
import CalendarTab from "./CalendarTab";
import SubmitModal from "./SubmitModal";
import ReviewModal from "./ReviewModal";
import TaskModal from "./TaskModal";

export default function TeamWorkspaceView({
  t,
  loading,
  team,
  program,
  onGoHome,
  goBack,
  toast,
  onCloseToast,
  activeTab,
  setActiveTab,
  progressPct,
  completedCount,
  pendingCount,
  members,
  deliverables,
  upcomingDeadlines,
  submissions,
  getSubmissionStatus,
  canReview,
  tasks,
  tasksLoading,
  onToggleVentureReady,
  onReview,
  onSubmit,
  onCreateTask,
  onUpdateStatus,
  onDeleteTask,
  showSubmitModal,
  selectedDeliverable,
  submitFileUrl,
  submitLink,
  uploading,
  submitting,
  onCloseSubmit,
  onFileUpload,
  onLinkChange,
  onSubmitDeliverable,
  showReviewModal,
  reviewSubData,
  reviewFeedback,
  onFeedbackChange,
  showFollowUpModal,
  followUpDate,
  onFollowUpDateChange,
  onScheduleFollowUp,
  reviewing,
  onCloseReview,
  onReviewAction,
  showTaskModal,
  taskForm,
  editingTask,
  savingTask,
  onCloseTask,
  onTaskChange,
  onTaskSave,
}) {
  // — Tab definitions —
  const tabs = [
    { id: "overview", label: t("rootMisc.team.tabOverview"), icon: FolderKanban },
    { id: "deliverables", label: t("rootMisc.team.tabDeliverables"), icon: FileText },
    { id: "tasks", label: t("rootMisc.team.tabTasks"), icon: ListTodo },
    { id: "files", label: t("rootMisc.team.tabFiles"), icon: BookOpen },
    { id: "calendar", label: t("rootMisc.team.tabCalendar"), icon: Calendar },
  ];

  // — Loading state —
  if (loading) {
    return (
      <>
        <div className="max-w-6xl mx-auto p-6 flex items-center justify-center min-h-[60vh]">
          <div className="flex items-center gap-3 text-[var(--text-secondary)]">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm font-bold uppercase tracking-wider">
              {t("rootMisc.team.loading")}
            </span>
          </div>
        </div>
      </>
    );
  }

  // — Not found —
  if (!team) {
    return (
      <>
        <div className="max-w-6xl mx-auto p-6">
          <div className="text-center py-20">
            <h2 className="text-lg font-black text-[var(--text-primary)] uppercase mb-2">
              {t("rootMisc.team.notFound")}
            </h2>
            <p className="text-sm text-[var(--text-secondary)] mb-6">
              {t("rootMisc.team.notFoundDesc")}
            </p>
            <AppButton variant="secondary" onClick={onGoHome}>
              {t("rootMisc.team.goHome")}
            </AppButton>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
        <GlobalToast toast={toast} onClose={onCloseToast} />

        {/* — Header — */}
        <TeamHeader team={team} program={program} onBack={goBack} />

        {/* — Tabs — */}
        <AppTabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

        {/* ============================================
            TAB: OVERVIEW
            ============================================ */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            <StatsRow
              progressPct={progressPct}
              completedCount={completedCount}
              deliverableCount={deliverables.length}
              pendingCount={pendingCount}
              memberCount={members.length}
            />

            {/* Team Info + Members */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <TeamInfoCard
                team={team}
                program={program}
                canMarkVentureReady={canReview}
                onToggleVentureReady={onToggleVentureReady}
              />
              <MembersCard members={members} />
            </div>

            {/* Quick links */}
            <OverviewDeadlines upcomingDeadlines={upcomingDeadlines} />
          </div>
        )}

        {/* ============================================
            TAB: DELIVERABLES
            ============================================ */}
        {activeTab === "deliverables" && (
          <DeliverablesTab
            deliverables={deliverables}
            submissions={submissions}
            getSubmissionStatus={getSubmissionStatus}
            canReview={canReview}
            onReview={onReview}
            onSubmit={onSubmit}
          />
        )}

        {/* ============================================
            TAB: TASKS (Team Workspace)
            ============================================ */}
        {activeTab === "tasks" && (
          <TasksTab
            tasks={tasks}
            tasksLoading={tasksLoading}
            onCreate={onCreateTask}
            onUpdateStatus={onUpdateStatus}
            onDelete={onDeleteTask}
          />
        )}

        {/* ============================================
            TAB: FILES
            ============================================ */}
        {activeTab === "files" && (
          <FilesTab
            program={program}
            submissions={submissions}
            deliverables={deliverables}
          />
        )}

        {/* ============================================
            TAB: CALENDAR
            ============================================ */}
        {activeTab === "calendar" && (
          <CalendarTab
            upcomingDeadlines={upcomingDeadlines}
            submissions={submissions}
            deliverables={deliverables}
            getSubmissionStatus={getSubmissionStatus}
          />
        )}

        {/* ============================================
            SUBMIT MODAL
            ============================================ */}
        {showSubmitModal && selectedDeliverable && (
          <SubmitModal
            deliverable={selectedDeliverable}
            fileUrl={submitFileUrl}
            link={submitLink}
            uploading={uploading}
            submitting={submitting}
            onClose={onCloseSubmit}
            onFileUpload={onFileUpload}
            onLinkChange={onLinkChange}
            onSubmit={onSubmitDeliverable}
          />
        )}

        {/* ============================================
            COACHING REVIEW MODAL
            ============================================ */}
        {showReviewModal && reviewSubData && (
          <ReviewModal
            submission={reviewSubData}
            feedback={reviewFeedback}
            onFeedbackChange={onFeedbackChange}
            showFollowUp={showFollowUpModal}
            followUpDate={followUpDate}
            onFollowUpDateChange={onFollowUpDateChange}
            onScheduleFollowUp={onScheduleFollowUp}
            reviewing={reviewing}
            onClose={onCloseReview}
            onAction={onReviewAction}
          />
        )}

        {/* ============================================
            TASK CREATION MODAL
            ============================================ */}
        {showTaskModal && (
          <TaskModal
            form={taskForm}
            editing={editingTask}
            saving={savingTask}
            members={members}
            onClose={onCloseTask}
            onChange={onTaskChange}
            onSave={onTaskSave}
          />
        )}
      </div>
    </>
  );
}
