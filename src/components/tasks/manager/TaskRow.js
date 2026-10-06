"use client";

import { STATUS_CONFIG } from "./constants";
import TaskRowMain from "./task-row/TaskRowMain";
import TaskRowResources from "./task-row/TaskRowResources";
import TaskRowResourceForm from "./task-row/TaskRowResourceForm";
import TaskRowActions from "./task-row/TaskRowActions";
import TaskRowComments from "./task-row/TaskRowComments";

/**
 * One row of the task board — a task, or one of its sub-tasks.
 *
 * The row is recursive: a parent renders its own sub-tasks through this same
 * component, so every affordance (status, assignment, sub-tasks, comments,
 * resources, blockers) exists once and behaves identically at both levels.
 *
 * All of the state is the manager's, passed down: the row is the presentation of
 * one task and the actions a person can take on it, not a second source of truth.
 * `number` is the row's position on the board — the manager counts, because the
 * count spans both lists (carry-over first, then active).
 *
 * The markup lives in the `task-row/` siblings; this file keeps the composition
 * and the two derived values (`statusConfig`, `isUpdating`) the blocks read.
 */
export default function TaskRow(props) {
  const {
    task,
    isSub = false,
    number = null,
    mode,
    userId,
    projects,
    updatingTasks,
    readOnly,
    effectiveWeekInfo,
    moveTask,
    updateStatus,
    openSubTask,
    openComments,
    commentsByTask,
    loadingComments,
    newComment,
    setNewComment,
    postComment,
    postingComment,
    addResourceTaskId,
    setAddResourceTaskId,
    resourceForm,
    setResourceForm,
    resourceFile,
    setResourceFile,
    resourceAdding,
    handleSaveResource,
    handleDeleteResource,
    setBlockerModal,
    setEditTaskModal,
    setEditForm,
    toggleComments,
    setConfirmAction,
    currentUserId,
    onTasksChange,
    notify,
    t,
    ...rest
  } = props;

  const statusConfig = STATUS_CONFIG[task.status] || STATUS_CONFIG.pending;
  const isUpdating = updatingTasks[task.id];

  return (
    <div>
      <TaskRowMain
        task={task}
        isSub={isSub}
        number={number}
        mode={mode}
        userId={userId}
        currentUserId={currentUserId}
        isUpdating={isUpdating}
        readOnly={readOnly}
        statusConfig={statusConfig}
        updateStatus={updateStatus}
        setBlockerModal={setBlockerModal}
        setEditForm={setEditForm}
        setEditTaskModal={setEditTaskModal}
        setConfirmAction={setConfirmAction}
        onTasksChange={onTasksChange}
        notify={notify}
        t={t}
        effectiveWeekInfo={effectiveWeekInfo}
        moveTask={moveTask}
        projects={projects}
      />

      <TaskRowResources
        task={task}
        isSub={isSub}
        notify={notify}
        readOnly={readOnly}
        handleDeleteResource={handleDeleteResource}
      />

      {addResourceTaskId === task.id && (
        <TaskRowResourceForm
          task={task}
          isSub={isSub}
          resourceForm={resourceForm}
          setResourceForm={setResourceForm}
          resourceFile={resourceFile}
          setResourceFile={setResourceFile}
          resourceAdding={resourceAdding}
          handleSaveResource={handleSaveResource}
          setAddResourceTaskId={setAddResourceTaskId}
        />
      )}

      <TaskRowActions
        task={task}
        isSub={isSub}
        readOnly={readOnly}
        setAddResourceTaskId={setAddResourceTaskId}
        toggleComments={toggleComments}
        openSubTask={openSubTask}
      />

      {openComments === task.id && (
        <TaskRowComments
          task={task}
          isSub={isSub}
          readOnly={readOnly}
          loadingComments={loadingComments}
          commentsByTask={commentsByTask}
          newComment={newComment}
          setNewComment={setNewComment}
          postComment={postComment}
          postingComment={postingComment}
        />
      )}

      {/* Sub-tasks — always visible under parent */}
      {!isSub && task.subtasks?.length > 0 && (
        <div className="mt-1 ml-4 pl-3 border-l-2 border-indigo-500/20 space-y-0.5">
          {task.subtasks.map((subtask) => (
              <TaskRow key={subtask.id} {...rest} task={subtask} isSub />
            ))}
        </div>
      )}
    </div>
  );
}
