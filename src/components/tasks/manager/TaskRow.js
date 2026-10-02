"use client";

import {
  Send,
  MessageSquare,
  User,
  ChevronUp,
  ChevronDown,
  CheckCircle2,
  Edit3,
  Trash2,
  Archive,
  Link as LinkIcon,
  Copy,
  Paperclip,
  Shield,
  Plus,
} from "lucide-react";
import { STATUS_CONFIG, PRIORITY_CONFIG, STATUS_OPTIONS, cn } from "./constants";

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
      <div
        className={`flex items-center gap-2 py-1.5 ${
          !isSub && task.subtasks?.length > 0
            ? "pl-3 border-l-[3px] border-indigo-400 rounded-sm"
            : isSub
              ? "ml-6 pl-3 border-l-2 border-indigo-500/30"
              : ""
        } ${!isSub && task.subtasks?.length > 0 ? "bg-indigo-500/[0.04]" : ""}`}
      >
        {/* Checkbox — available for both parent and sub-tasks (independent completion, Ticket 1.3). */}
        {(() => {
            const canCheck =
              mode === "project"
                ? String(task.user_id) === String(currentUserId) ||
                  String(task.assigned_to) === String(currentUserId) ||
                  String(userId) === String(currentUserId)
                : true;
            if (mode === "project" && !canCheck) {
              // Show static completed indicator only
              if (task.status === "completed") {
                return (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                );
              }
              return <div className="w-4 h-4 shrink-0" />;
            }
            return (
              <button
                onClick={() =>
                  updateStatus(
                    task.id,
                    task.status === "completed" ? "in_progress" : "completed",
                  )
                }
                disabled={isUpdating || readOnly}
                className={`w-4 h-4 rounded-full border-2 shrink-0 transition-all hover:scale-110 ${task.status === "completed" ? "bg-emerald-500 border-emerald-500" : "border-slate-600 hover:border-emerald-400"} ${isUpdating ? "opacity-50 animate-pulse" : ""} ${readOnly ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                {task.status === "completed" && (
                  <CheckCircle2 className="w-3 h-3 text-white" />
                )}
              </button>
            );
          })()}

        {/* Task number in standup mode */}
        {mode === "standup" && !isSub && number !== null && (
          <span className="w-5 h-5 flex items-center justify-center rounded-md bg-tertiary border border-[var(--border-primary)] text-[10px] font-bold text-slate-500 shrink-0">
            {number}
          </span>
        )}

        {/* Parent indicator icon — always visible when task has sub-tasks */}
        {!isSub && task.subtasks?.length > 0 && (
          <div className="w-5 h-5 flex items-center justify-center rounded-md bg-indigo-500/15 shrink-0">
            <ChevronDown className="w-3.5 h-3.5 text-indigo-400" />
          </div>
        )}

        {/* Task name */}
        {!isSub && task.subtasks?.length > 0 ? (
          <div className="flex items-center gap-1.5 text-left flex-1 min-w-0">
            <span
              className={`text-[11px] font-bold ${task.status === "completed" ? "line-through text-slate-500" : "text-[var(--text-primary)]"}`}
            >
              {task.title}
            </span>
            {(() => {
              const total = task.subtasks.length;
              const done = task.subtasks.filter(
                (subtask) => subtask.status === "completed",
              ).length;
              const allDone = done === total;
              return (
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0 ${allDone ? "text-emerald-400 bg-emerald-500/10" : "text-indigo-400 bg-indigo-500/10"}`}
                  title={`${done} of ${total} sub-tasks completed`}
                >
                  {done}/{total} done
                </span>
              );
            })()}
          </div>
        ) : (
          <span
            className={`flex-1 text-[11px] font-medium min-w-0 truncate ${task.status === "completed" ? "line-through text-slate-500" : "text-[var(--text-primary)]"} ${isSub ? "text-[10px]" : ""}`}
          >
            {isSub && (
              <span className="text-[10px] text-indigo-400 mr-1 uppercase tracking-wider font-bold">
                Sub:
              </span>
            )}
            {task.title}
          </span>
        )}

        {/* Priority badge */}
        {task.priority && task.priority !== "medium" && (
          <span
            className={cn(
              "text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0",
              PRIORITY_CONFIG[task.priority]?.bg,
              PRIORITY_CONFIG[task.priority]?.color,
            )}
          >
            {PRIORITY_CONFIG[task.priority]?.label || task.priority}
          </span>
        )}

        {/* Creator + Assignee + Project / Category tag */}
        {!isSub && (
          <div className="hidden sm:flex items-center gap-2 shrink-0 text-[10px] font-medium">
            {task.user_name && (
              <span
                className="text-slate-500 flex items-center gap-1"
                title="Created by"
              >
                <User className="w-2.5 h-2.5" />
                {task.user_name}
              </span>
            )}
            {task.assignee_name && (
              <span
                className="text-emerald-500 flex items-center gap-1"
                title="Assigned to"
              >
                <Send className="w-2.5 h-2.5" />
                {task.assignee_name}
              </span>
            )}
            <span className="text-slate-500">
              {task.project_id
                ? projects.find(
                    (project) => String(project.id) === String(task.project_id),
                  )?.name
                : task.category || ""}
            </span>
            {task.end_date && (
              <span
                className="text-slate-500 flex items-center gap-1"
                title="Due date"
              >
                <span className="text-[10px]">
                  {new Date(task.end_date).toLocaleDateString("en-GB", {
                    day: "2-digit",
                    month: "2-digit",
                  })}
                </span>
              </span>
            )}
          </div>
        )}

        {/* Status dropdown */}
        {!isSub && (
          <select
            value={task.status || "pending"}
            onChange={(event) => updateStatus(task.id, event.target.value)}
            disabled={readOnly}
            className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border-0 outline-none appearance-none shrink-0 ${readOnly ? "opacity-60 cursor-not-allowed" : "cursor-pointer"} ${statusConfig.bg} ${statusConfig.color}`}
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value} className="bg-primary">
                {option.label}
              </option>
            ))}
          </select>
        )}

        {/* Blockers button */}
        <button
          onClick={() =>
            setBlockerModal({ taskId: task.id, taskTitle: task.title })
          }
          className={`shrink-0 transition-all ${(task.blockers || []).filter((blocker) => blocker.status === "active").length > 0 ? "text-rose-400" : "text-slate-500 hover:text-rose-400"}`}
          title={
            (task.blockers || []).filter((blocker) => blocker.status === "active")
              .length > 0
              ? `${(task.blockers || []).filter((blocker) => blocker.status === "active").length} active blocker(s)`
              : "Add blocker"
          }
        >
          <Shield className="w-3 h-3" />
          {(task.blockers || []).filter((blocker) => blocker.status === "active").length >
            0 && (
            <span className="text-[10px] font-bold ml-0.5">
              {
                (task.blockers || []).filter((blocker) => blocker.status === "active")
                  .length
              }
            </span>
          )}
        </button>

        {/* Edit button — parent AND sub tasks */}
        {!readOnly && (
          <button
            onClick={() => {
              setEditForm({
                name: task.title,
                description: task.description || "",
                project_id: task.project_id || "",
                category: task.category || "",
                start_date: task.start_date || "",
                due_date: task.end_date || "",
                status: task.status || "in_progress",
                assigned_to: task.assigned_to || "",
                priority: task.priority || "medium",
                link: task.link || "",
              });
              setEditTaskModal(task);
            }}
            className="text-slate-500 hover:text-[var(--brand-orange)] transition-all shrink-0"
            title="Edit task"
          >
            <Edit3 className="w-3 h-3" />
          </button>
        )}

        {/* Archive button — always visible */}
        {!readOnly && (
          <button
            onClick={() => {
              setConfirmAction({
                message: `Archive task "${task.title}"? Archived tasks will not carry over to future weeks.`,
                onConfirm: async () => {
                  try {
                    const res = await fetch("/api/tasks", {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ id: task.id, status: "archived" }),
                    });
                    const data = await res.json();
                    if (data.success) {
                      if (onTasksChange) onTasksChange();
                    } else {
                      notify('error', t(data.error || "Failed to archive task.") || data.error || "Failed to archive task.");
                    }
                  } catch {
                    notify('error', "Network error while archiving task.");
                  }
                },
              });
            }}
            className="text-slate-500 hover:text-amber-500 transition-all shrink-0"
            title="Archive task"
          >
            <Archive className="w-3 h-3" />
          </button>
        )}

        {/* Duplicate button — always visible */}
        {!readOnly && (
          <button
            onClick={async () => {
              try {
                const res = await fetch("/api/tasks/duplicate", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ task_id: task.id }),
                });
                const data = await res.json();
                if (data.success) {
                  if (onTasksChange) onTasksChange();
                } else {
                  notify('error', t(data.error || "Failed to duplicate task.") || data.error || "Failed to duplicate task.");
                }
              } catch {
                notify('error', "Network error while duplicating task.");
              }
            }}
            className="text-slate-500 hover:text-[var(--brand-orange)] transition-all shrink-0"
            title="Duplicate task"
          >
            <Copy className="w-3 h-3" />
          </button>
        )}

        {/* Delete / Archive based on week — parent AND sub tasks */}
        {!readOnly &&
          (() => {
            const isPastWeek =
              effectiveWeekInfo &&
              (task.created_week !== effectiveWeekInfo.week ||
                task.created_year !== effectiveWeekInfo.year);
            if (isPastWeek) {
              // Past-week tasks can only be archived, not deleted
              return (
                <button
                  onClick={() => {
                    setConfirmAction({
                      message: `Archive task "${task.title}"? Archived tasks will not carry over to future weeks.`,
                      onConfirm: async () => {
                        try {
                          const res = await fetch("/api/tasks", {
                            method: "PUT",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ id: task.id, status: "archived" }),
                          });
                          const data = await res.json();
                          if (data.success) {
                            if (onTasksChange) onTasksChange();
                          } else {
                            notify('error', t(data.error || "Failed to archive task.") || data.error || "Failed to archive task.");
                          }
                        } catch {
                          notify('error', "Network error while archiving task.");
                        }
                      },
                    });
                  }}
                  className="text-slate-500 hover:text-amber-500 transition-all shrink-0"
                  title="Archive task (past week — cannot delete)"
                >
                  <Archive className="w-3 h-3" />
                </button>
              );
            }
            return (
              <button
                onClick={() => {
                  setConfirmAction({
                    message: `Delete task "${task.title}"?`,
                    onConfirm: async () => {
                      try {
                        const res = await fetch(`/api/tasks?id=${task.id}`, {
                          method: "DELETE",
                        });
                        const data = await res.json();
                        if (data.success) {
                          if (onTasksChange) onTasksChange();
                        } else {
                          notify('error',
                            t(data.error ||
                              "Cannot delete this task. It may be locked (older than 12 hours).") ||
                              data.error ||
                              "Cannot delete this task. It may be locked (older than 12 hours).",
                          );
                        }
                      } catch {
                        notify('error', "Network error while deleting task.");
                      }
                    },
                  });
                }}
                className="text-slate-500 hover:text-rose-500 transition-all shrink-0"
                title="Delete task"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            );
          })()}

        {/* Move up/down buttons */}
        {!readOnly && !isSub && (
          <div className="flex flex-col gap-0.5 shrink-0">
            <button
              onClick={() => moveTask(task.id, "up")}
              className="text-slate-500 hover:text-[var(--text-primary)] transition-all"
              title="Move up"
            >
              <ChevronUp className="w-3 h-3" />
            </button>
            <button
              onClick={() => moveTask(task.id, "down")}
              className="text-slate-500 hover:text-[var(--text-primary)] transition-all"
              title="Move down"
            >
              <ChevronDown className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      {/* Resources Section */}
      {task.resources && task.resources.length > 0 && (
        <div
          className={`mt-1 flex flex-col gap-1 ${isSub ? "ml-10" : "ml-8"}`}
        >
          {task.resources.map((resource) => (
            <div key={resource.id} className="flex items-center gap-2 group">
              <a
                href={resource.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-[var(--brand-orange)] hover:underline flex items-center gap-1 max-w-[200px] truncate"
              >
                {resource.type === "file" ? (
                  <Paperclip className="w-2.5 h-2.5 shrink-0" />
                ) : (
                  <LinkIcon className="w-2.5 h-2.5 shrink-0" />
                )}
                {resource.name || resource.url}
              </a>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(resource.url);
                  notify('info', "URL copied!");
                }}
                className="text-slate-500 opacity-0 group-hover:opacity-100 hover:text-emerald-400 transition-opacity"
                title="Copy URL"
              >
                <Copy className="w-2.5 h-2.5" />
              </button>
              {!readOnly && (
                <button
                  onClick={() => handleDeleteResource(resource.id)}
                  className="text-slate-400 hover:text-rose-400 transition-colors"
                  title="Remove resource"
                >
                  <Trash2 className="w-2.5 h-2.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {addResourceTaskId === task.id && (
        <div
          className={`mt-1 p-2 rounded-lg bg-tertiary border border-[var(--border-primary)] flex flex-col gap-2 ${isSub ? "ml-10" : "ml-8"} w-fit min-w-[250px]`}
        >
          <input
            type="text"
            placeholder="Resource Name (optional)"
            value={resourceForm.name}
            onChange={(event) =>
              setResourceForm((previousForm) => ({ ...previousForm, name: event.target.value }))
            }
            className="w-full bg-primary border border-[var(--border-primary)] rounded px-2 py-1 text-[10px] outline-none"
          />
          <input
            type="url"
            placeholder="https://..."
            value={resourceForm.url}
            onChange={(event) =>
              setResourceForm((previousForm) => ({ ...previousForm, url: event.target.value }))
            }
            className="w-full bg-primary border border-[var(--border-primary)] rounded px-2 py-1 text-[10px] outline-none"
            autoFocus
          />
          <input
            type="file"
            accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
            onChange={(event) => setResourceFile(event.target.files?.[0] || null)}
            className="w-full text-[10px] text-slate-400 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-[10px] file:font-bold file:bg-[var(--brand-orange)] file:text-black"
          />
          <div className="flex gap-1 justify-end">
            <button
              onClick={() => setAddResourceTaskId(null)}
              className="px-2 py-1 text-[10px] font-bold text-slate-500 uppercase"
            >
              Cancel
            </button>
            <button
              onClick={() => handleSaveResource(task.id)}
              disabled={(!resourceFile && !resourceForm.url) || resourceAdding}
              className="px-2 py-1 bg-[var(--brand-orange)] text-black rounded text-[10px] font-bold uppercase"
            >
              {resourceAdding ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      )}

      {/* Action Buttons Row */}
      <div
        className={`mt-1 flex items-center gap-3 ${isSub ? "ml-10" : "ml-8"}`}
      >
        {!readOnly && (
          <button
            onClick={() => setAddResourceTaskId(task.id)}
            className="flex items-center gap-1 text-[10px] font-bold uppercase text-slate-400 hover:text-emerald-400 transition-colors"
          >
            <Plus className="w-2.5 h-2.5" /> Resource
          </button>
        )}
        <button
          onClick={() => toggleComments(task.id)}
          className="flex items-center gap-1 text-[10px] font-bold uppercase text-slate-400 hover:text-blue-400 transition-colors"
        >
          <MessageSquare className="w-2.5 h-2.5" />
          Comments{task.commentCount > 0 ? ` (${task.commentCount})` : ""}
        </button>
        {!readOnly && !isSub && (
          <button
            onClick={() =>
              openSubTask(task.id, task.project_id, task.category, task.title)
            }
            className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-indigo-400 hover:text-indigo-300 transition-all"
          >
            <Plus className="w-2.5 h-2.5" /> Sub-task
          </button>
        )}
      </div>

      {/* Comments thread */}
      {openComments === task.id && (
        <div
          className={`mt-1 p-2 rounded-lg bg-tertiary border border-[var(--border-primary)] flex flex-col gap-2 ${isSub ? "ml-10" : "ml-8"} max-w-md`}
        >
          {loadingComments ? (
            <p className="text-[10px] font-medium text-slate-500">Loading...</p>
          ) : (commentsByTask[task.id] || []).length === 0 ? (
            <p className="text-[10px] font-medium text-slate-500">
              No comments yet.
            </p>
          ) : (
            <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto">
              {(commentsByTask[task.id] || []).map((comment) => (
                <div key={comment.id} className="text-[10px]">
                  <span className="font-black text-[var(--text-primary)]">
                    {comment.sender_name || comment.sender_id}:{" "}
                  </span>
                  <span className="text-[var(--text-secondary)]">
                    {comment.body}
                  </span>
                </div>
              ))}
            </div>
          )}
          {!readOnly && (
            <div className="flex gap-2">
              <input
                type="text"
                value={newComment}
                onChange={(event) => setNewComment(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") postComment(task.id);
                }}
                placeholder="Write a comment..."
                className="flex-1 bg-primary border border-[var(--border-primary)] rounded px-2 py-1 text-[10px] outline-none"
              />
              <button
                onClick={() => postComment(task.id)}
                disabled={!newComment.trim() || postingComment}
                className="px-2 py-1 bg-[var(--brand-orange)] text-black rounded text-[10px] font-bold uppercase disabled:opacity-40"
              >
                Send
              </button>
            </div>
          )}
        </div>
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
