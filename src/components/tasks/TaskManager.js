"use client";

import React, { useState } from "react";
import { ListTodo, Shield } from "lucide-react";

import ConfirmDialog from "@/components/tasks/manager/ConfirmDialog";
import NewTaskForm from "@/components/tasks/manager/NewTaskForm";
import SubTaskModal from "@/components/tasks/manager/SubTaskModal";
import EditTaskModal from "@/components/tasks/manager/EditTaskModal";
import BlockerModal from "@/components/tasks/manager/BlockerModal";
import TaskRow from "@/components/tasks/manager/TaskRow";
import useBoard from "@/components/tasks/manager/hooks/useBoard";
import useTaskForm from "@/components/tasks/manager/hooks/useTaskForm";
import useSubTasks from "@/components/tasks/manager/hooks/useSubTasks";
import useEditTask from "@/components/tasks/manager/hooks/useEditTask";
import useComments from "@/components/tasks/manager/hooks/useComments";
import useResources from "@/components/tasks/manager/hooks/useResources";
import useBlockers from "@/components/tasks/manager/hooks/useBlockers";
import { cn } from "@/components/tasks/manager/constants";
import { useI18n } from "@/lib/i18n";
import { useSessionUser } from "@/lib/hooks/useSessionUser";
import { notify } from "@/lib/notify";

/**
 * The board of tasks, and nothing else.
 *
 * Every piece of state the board owns lives in one of the hooks under
 * `manager/hooks` — the week and the rows, the new-task form, sub-tasks, the edit
 * modal, comments, resources and blockers. What is left here is the wiring
 * between them and the markup: which row is rendered where, and which handler a
 * row is handed.
 */
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
  requestNewTask = 0, // increments to auto-open the new-task form
}) {
  const { t } = useI18n();
  const uid = userId;

  // ── Confirmation dialog state ──
  const [confirmAction, setConfirmAction] = useState(null); // { message, onConfirm } or null

  // Get current logged-in user for permission checks. The shell has already
  // fetched and published the session, so this observes it instead of keeping a
  // second copy of the identity read out of the browser's stored user.
  const { cid, user } = useSessionUser();
  const currentUserId = cid ?? user?.id ?? null;

  const {
    effectiveWeekInfo,
    tasks,
    carryOverTasks,
    activeTasks,
    moveTask,
    updateStatus,
    updatingTasks,
  } = useBoard({ mode, taskList, weekInfo, onTasksChange });

  const {
    form,
    setForm,
    showTaskForm,
    openTaskForm,
    handleCloseForm,
    handleAddTask,
    creating,
    addedCount,
    pendingParentTaskId,
    taskFile,
    setTaskFile,
    availableCategories,
    validateTaskDates,
    createTask,
    attachFileToTask,
    projectPicker,
  } = useTaskForm({
    mode,
    projectId,
    projects,
    userId,
    userName,
    effectiveWeekInfo,
    requestNewTask,
    onTasksChange,
    t,
  });

  // A sub-task is created through the form's own create call, so it lands with
  // the same fields and the same week as a task.
  const {
    subTaskModal,
    setSubTaskModal,
    subTaskInput,
    setSubTaskInput,
    subTaskDescription,
    setSubTaskDescription,
    subTaskPriority,
    setSubTaskPriority,
    subTaskAssignedTo,
    setSubTaskAssignedTo,
    subTaskStartDate,
    setSubTaskStartDate,
    subTaskEndDate,
    setSubTaskEndDate,
    subTaskLink,
    setSubTaskLink,
    subTaskSuccess,
    subTaskFile,
    setSubTaskFile,
    openSubTask,
    addSubTaskFromModal,
  } = useSubTasks({
    onTasksChange,
    t,
    createTask,
    attachFileToTask,
    validateTaskDates,
  });

  const { editTaskModal, setEditTaskModal, editForm, setEditForm } = useEditTask();

  const {
    openComments,
    commentsByTask,
    loadingComments,
    newComment,
    setNewComment,
    postingComment,
    toggleComments,
    postComment,
  } = useComments({ userId, userName, onTasksChange });

  const {
    addResourceTaskId,
    setAddResourceTaskId,
    resourceForm,
    setResourceForm,
    resourceAdding,
    resourceFile,
    setResourceFile,
    handleSaveResource,
    handleDeleteResource,
  } = useResources({ onTasksChange, setConfirmAction, t });

  const {
    blockerModal,
    setBlockerModal,
    blockerTitle,
    setBlockerTitle,
    blockerDescription,
    setBlockerDescription,
    blockerPriority,
    setBlockerPriority,
    blockerRefUrl,
    setBlockerRefUrl,
    blockerNotes,
    setBlockerNotes,
    blockerAdding,
    handleAddBlocker,
    handleResolveBlocker,
    openBlockerDiscuss,
    blockerMessages,
    newBlockerMsg,
    setNewBlockerMsg,
    postingBlockerMsg,
    toggleBlockerDiscuss,
    postBlockerMessage,
  } = useBlockers({ userId, userName, onTasksChange });

  // ── Render task row (with optional sub-tasks) ──
  // The board number counts every TOP-LEVEL row in the order it is rendered —
  // carry-over first, then active — and only in standup mode. The count lives
  // here rather than inside the row so the two lists share one sequence.
  let taskIndex = 0;
  const renderTaskRow = (task, isSub = false) => (
    <TaskRow
      key={task.id}
      task={task}
      isSub={isSub}
      number={mode === "standup" && !isSub ? ++taskIndex : null}
      mode={mode}
      userId={userId}
      readOnly={readOnly}
      effectiveWeekInfo={effectiveWeekInfo}
      projects={projects}
      updatingTasks={updatingTasks}
      moveTask={moveTask}
      updateStatus={updateStatus}
      openSubTask={openSubTask}
      openComments={openComments}
      commentsByTask={commentsByTask}
      loadingComments={loadingComments}
      newComment={newComment}
      setNewComment={setNewComment}
      postComment={postComment}
      postingComment={postingComment}
      toggleComments={toggleComments}
      addResourceTaskId={addResourceTaskId}
      setAddResourceTaskId={setAddResourceTaskId}
      resourceForm={resourceForm}
      setResourceForm={setResourceForm}
      resourceFile={resourceFile}
      setResourceFile={setResourceFile}
      resourceAdding={resourceAdding}
      handleSaveResource={handleSaveResource}
      handleDeleteResource={handleDeleteResource}
      setBlockerModal={setBlockerModal}
      setEditTaskModal={setEditTaskModal}
      setEditForm={setEditForm}
      setConfirmAction={setConfirmAction}
      currentUserId={currentUserId}
      onTasksChange={onTasksChange}
      notify={notify}
      t={t}
    />
  );

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
            {carryOverTasks.map((task) => renderTaskRow(task))}
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
            {activeTasks.map((task) => renderTaskRow(task))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {activeTasks.length === 0 &&
        carryOverTasks.length === 0 &&
        !showTaskForm && (
          <div className="text-center py-6">
            <ListTodo className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="text-[10px] text-slate-500">{t("staffMisc.standupRetro.noTasksYet")}</p>
          </div>
        )}

      {/* ─── Task Form ─── */}
      <NewTaskForm
        form={form}
        setForm={setForm}
        showTaskForm={showTaskForm}
        openTaskForm={openTaskForm}
        handleCloseForm={handleCloseForm}
        handleAddTask={handleAddTask}
        creating={creating}
        addedCount={addedCount}
        pendingParentTaskId={pendingParentTaskId}
        taskFile={taskFile}
        setTaskFile={setTaskFile}
        availableCategories={availableCategories}
        projectMembers={projectMembers}
        mode={mode}
        readOnly={readOnly}
        t={t}
        projectPicker={projectPicker}
      />

      {/* ─── SUB-TASK POPUP MODAL ─── */}
      <SubTaskModal
        subTaskModal={subTaskModal}
        onClose={() => setSubTaskModal(null)}
        tasks={tasks}
        subTaskInput={subTaskInput}
        setSubTaskInput={setSubTaskInput}
        subTaskDescription={subTaskDescription}
        setSubTaskDescription={setSubTaskDescription}
        subTaskAssignedTo={subTaskAssignedTo}
        setSubTaskAssignedTo={setSubTaskAssignedTo}
        subTaskPriority={subTaskPriority}
        setSubTaskPriority={setSubTaskPriority}
        subTaskStartDate={subTaskStartDate}
        setSubTaskStartDate={setSubTaskStartDate}
        subTaskEndDate={subTaskEndDate}
        setSubTaskEndDate={setSubTaskEndDate}
        subTaskLink={subTaskLink}
        setSubTaskLink={setSubTaskLink}
        subTaskFile={subTaskFile}
        setSubTaskFile={setSubTaskFile}
        subTaskSuccess={subTaskSuccess}
        addSubTaskFromModal={addSubTaskFromModal}
        projectMembers={projectMembers}
        onTasksChange={onTasksChange}
        setConfirmAction={setConfirmAction}
        notify={notify}
        t={t}
      />

      {/* ─── EDIT TASK MODAL ─── */}
      <EditTaskModal
        editTaskModal={editTaskModal}
        editForm={editForm}
        setEditForm={setEditForm}
        onClose={() => setEditTaskModal(null)}
        projectMembers={projectMembers}
        mode={mode}
        uid={uid}
        validateTaskDates={validateTaskDates}
        onTasksChange={onTasksChange}
        notify={notify}
        t={t}
      />

      {/* ─── Blocker Modal ─── */}
      <BlockerModal
        blockerModal={blockerModal}
        onClose={() => setBlockerModal(null)}
        tasks={tasks}
        blockerTitle={blockerTitle}
        setBlockerTitle={setBlockerTitle}
        blockerDescription={blockerDescription}
        setBlockerDescription={setBlockerDescription}
        blockerPriority={blockerPriority}
        setBlockerPriority={setBlockerPriority}
        blockerRefUrl={blockerRefUrl}
        setBlockerRefUrl={setBlockerRefUrl}
        blockerNotes={blockerNotes}
        setBlockerNotes={setBlockerNotes}
        blockerAdding={blockerAdding}
        handleAddBlocker={handleAddBlocker}
        handleResolveBlocker={handleResolveBlocker}
        readOnly={readOnly}
        toggleBlockerDiscuss={toggleBlockerDiscuss}
        openBlockerDiscuss={openBlockerDiscuss}
        blockerMessages={blockerMessages}
        newBlockerMsg={newBlockerMsg}
        setNewBlockerMsg={setNewBlockerMsg}
        postBlockerMessage={postBlockerMessage}
        postingBlockerMsg={postingBlockerMsg}
        t={t}
      />

      {/* ─── CONFIRM DIALOG MODAL ─── */}
      <ConfirmDialog
        confirmAction={confirmAction}
        onDismiss={() => setConfirmAction(null)}
      />
    </div>
  );
}