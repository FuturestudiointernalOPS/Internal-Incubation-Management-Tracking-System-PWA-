/**
 * The four modals the screen can open.
 *
 * Cut out of src/app/staff/op-report/page.js as-is: the page keeps every
 * state value and every write, and hands this block what it reads through
 * `ctx`. The names it needs are listed in the signature — nothing else.
 */

"use client";
import BlockerModal from "@/components/staff/op-report/BlockerModal";
import ConfirmDialog from "@/components/staff/op-report/ConfirmDialog";
import StandupDraftModal from "@/components/staff/op-report/StandupDraftModal";
import TaskCreationModal from "@/components/staff/op-report/TaskCreationModal";
import TaskDetailModal from "@/components/ui/TaskDetailModal";

export default function OpReportModals({ ctx }) {
  const {
    assignedProjects,
    blockerModal,
    confirmTarget,
    creatingTask,
    discardDraft,
    draftAvailable,
    handleAddBlockerFromModal,
    handleCloseStandupModal,
    handleConfirmAction,
    handleCreateNewTask,
    handleNewTaskFieldChange,
    handleResolveBlocker,
    handleSaveStandupFromModal,
    isHistorical,
    newBlockerDescription,
    newBlockerNotes,
    newBlockerPriority,
    newBlockerRefUrl,
    newBlockerTitle,
    newTaskForm,
    newTaskRequest,
    readOnly,
    refreshTasks,
    restoreDraft,
    saving,
    setBlockerModal,
    setConfirmTarget,
    setNewBlockerDescription,
    setNewBlockerNotes,
    setNewBlockerPriority,
    setNewBlockerRefUrl,
    setNewBlockerTitle,
    setTaskCreationOpen,
    setTaskDetail,
    showStandupModal,
    taskCreationOpen,
    taskDetail,
    taskRows,
    tasks,
    user,
    weekInfo,
  } = ctx;

  return (
    <>
      {taskCreationOpen && (
        <TaskCreationModal
          assignedProjects={assignedProjects}
          creatingTask={creatingTask}
          newTaskForm={newTaskForm}
          onClose={() => setTaskCreationOpen(false)}
          onCreate={handleCreateNewTask}
          onFieldChange={handleNewTaskFieldChange}
        />
      )}
      {showStandupModal && (
        <StandupDraftModal
          assignedProjects={assignedProjects}
          draftAvailable={draftAvailable}
          isHistorical={isHistorical}
          newTaskRequest={newTaskRequest}
          onClose={handleCloseStandupModal}
          onDiscardDraft={discardDraft}
          onRestoreDraft={restoreDraft}
          onSubmit={handleSaveStandupFromModal}
          readOnly={readOnly}
          refreshTasks={refreshTasks}
          saving={saving}
          tasks={tasks}
          user={user}
          weekInfo={weekInfo}
        />
      )}
      {/* ─── BLOCKER MODAL ─── */}
      {blockerModal !== null && (
        <BlockerModal
          blockerModal={blockerModal}
          newBlockerDescription={newBlockerDescription}
          newBlockerNotes={newBlockerNotes}
          newBlockerPriority={newBlockerPriority}
          newBlockerRefUrl={newBlockerRefUrl}
          newBlockerTitle={newBlockerTitle}
          onAddBlocker={handleAddBlockerFromModal}
          onClose={() => setBlockerModal(null)}
          onDescriptionChange={setNewBlockerDescription}
          onNotesChange={setNewBlockerNotes}
          onPriorityChange={setNewBlockerPriority}
          onRefUrlChange={setNewBlockerRefUrl}
          onResolveBlocker={handleResolveBlocker}
          onTitleChange={setNewBlockerTitle}
          taskRows={taskRows}
          tasks={tasks}
        />
      )}

      <TaskDetailModal task={taskDetail} onClose={() => setTaskDetail(null)} />

      {/* Confirm Dialog */}
      {confirmTarget && (
        <ConfirmDialog
          confirmTarget={confirmTarget}
          onClose={() => setConfirmTarget(null)}
          onConfirm={handleConfirmAction}
        />
      )}
    </>
  );
}
