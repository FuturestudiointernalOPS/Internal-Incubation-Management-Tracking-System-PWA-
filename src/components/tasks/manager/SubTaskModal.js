"use client";

import { X, ListTodo, Trash2, CheckCircle2, Plus } from "lucide-react";
import { PRIORITY_CONFIG, PRIORITY_OPTIONS, cn } from "./constants";

/**
 * The sub-task popup.
 *
 * It opens on a parent task — `subTaskModal` carries the parent's id, project and
 * category, which the sub-task inherits — and lists the sub-tasks that parent
 * already has. It renders nothing when no parent is open.
 */
export default function SubTaskModal({
  subTaskModal,
  onClose,
  tasks,
  subTaskInput,
  setSubTaskInput,
  subTaskDescription,
  setSubTaskDescription,
  subTaskAssignedTo,
  setSubTaskAssignedTo,
  subTaskPriority,
  setSubTaskPriority,
  subTaskStartDate,
  setSubTaskStartDate,
  subTaskEndDate,
  setSubTaskEndDate,
  subTaskLink,
  setSubTaskLink,
  subTaskFile,
  setSubTaskFile,
  subTaskSuccess,
  addSubTaskFromModal,
  projectMembers,
  onTasksChange,
  setConfirmAction,
  notify,
  t,
}) {
  if (!subTaskModal) return null;

  return (
    <div
      className="fixed inset-0 z-[600] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="card w-full max-w-md space-y-4 max-h-[85vh] overflow-y-auto"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ListTodo className="w-5 h-5 text-indigo-400" />
            <h3 className="text-sm font-black uppercase tracking-tight">
              Add Sub-task
            </h3>
          </div>
          <button onClick={onClose}>
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
          <p className="text-[10px] font-bold text-indigo-400">
            Parent task:{" "}
            <span className="text-white">{subTaskModal.title}</span>
          </p>
        </div>

        {/* Existing sub-tasks */}
        {(() => {
          const parentTask = tasks.find(
            (candidate) => String(candidate.id) === String(subTaskModal.id),
          );
          const subtasks = parentTask?.subtasks || [];
          if (subtasks.length === 0) return null;
          return (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">
                Existing sub-tasks ({subtasks.length})
              </p>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {subtasks.map((subtask) => (
                  <div
                    key={subtask.id}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-tertiary border border-[var(--border-primary)]"
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
                    <span className="text-[10px] font-bold text-[var(--text-primary)] truncate">
                      {subtask.title}
                    </span>
                    <span
                      className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                        subtask.status === "completed"
                          ? "bg-emerald-500/10 text-emerald-400"
                          : "bg-slate-500/10 text-slate-400"
                      }`}
                    >
                      {subtask.status === "completed"
                        ? "Done"
                        : subtask.status?.replace(/_/g, " ") || "Pending"}
                    </span>
                    <button
                      onClick={() => {
                        setConfirmAction({
                          message: `Delete subtask "${subtask.title}"?`,
                          onConfirm: async () => {
                            try {
                              const res = await fetch(
                                `/api/tasks?id=${subtask.id}`,
                                {
                                  method: "DELETE",
                                },
                              );
                              const data = await res.json();
                              if (data.success) {
                                if (onTasksChange) onTasksChange();
                              } else {
                                notify('error',
                                  t(data.error ||
                                    "Cannot delete this subtask. It may be older than 12 hours.") ||
                                    data.error ||
                                    "Cannot delete this subtask. It may be older than 12 hours.",
                                );
                              }
                            } catch {
                              notify('error', "Network error while deleting subtask.");
                            }
                          },
                        });
                      }}
                      className="text-slate-500 hover:text-rose-500 transition-all shrink-0"
                      title="Delete subtask"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        <div className="space-y-3 pt-2">
          {/* Success indicator */}
          {subTaskSuccess && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="text-[10px] font-bold text-emerald-400">
                {subTaskSuccess}
              </span>
            </div>
          )}

          <input
            type="text"
            value={subTaskInput}
            onChange={(event) => setSubTaskInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) addSubTaskFromModal();
            }}
            placeholder="Enter sub-task name..."
            className="w-full bg-primary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-sm outline-none focus:border-[var(--brand-orange)] transition-all"
            autoFocus
          />
          <textarea
            value={subTaskDescription}
            onChange={(event) => setSubTaskDescription(event.target.value)}
            placeholder="Description (optional)..."
            rows={2}
            className="w-full bg-primary border border-[var(--border-primary)] rounded-xl px-4 py-2.5 text-[10px] font-bold outline-none focus:border-[var(--brand-orange)] transition-all resize-none"
          />
          <div className="grid grid-cols-2 gap-2">
            {projectMembers.length > 0 && (
              <select
                value={subTaskAssignedTo}
                onChange={(event) => setSubTaskAssignedTo(event.target.value)}
                className="w-full bg-primary border border-[var(--border-primary)] rounded-xl px-3 py-2.5 text-[10px] font-bold text-emerald-400 outline-none appearance-none cursor-pointer"
              >
                <option value="">Assign: Self</option>
                {projectMembers.map((member) => (
                  <option
                    key={member.member_id || member.user_cid}
                    value={member.member_id || member.user_cid}
                  >
                    {member.name || member.member_id}
                  </option>
                ))}
              </select>
            )}
            <select
              value={subTaskPriority}
              onChange={(event) => setSubTaskPriority(event.target.value)}
              className={cn(
                "w-full bg-primary border border-[var(--border-primary)] rounded-xl px-3 py-2.5 text-[10px] font-bold outline-none appearance-none cursor-pointer",
                PRIORITY_CONFIG[subTaskPriority]?.color,
              )}
            >
              {PRIORITY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label} Priority
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="date"
              value={subTaskStartDate}
              onChange={(event) => setSubTaskStartDate(event.target.value)}
              min={new Date().toISOString().split("T")[0]}
              className="w-full bg-primary border border-[var(--border-primary)] rounded-xl px-3 py-2.5 text-[10px] font-bold outline-none focus:border-[var(--brand-orange)] transition-all"
            />
            <input
              type="date"
              value={subTaskEndDate}
              onChange={(event) => setSubTaskEndDate(event.target.value)}
              min={subTaskStartDate || new Date().toISOString().split("T")[0]}
              className="w-full bg-primary border border-[var(--border-primary)] rounded-xl px-3 py-2.5 text-[10px] font-bold outline-none focus:border-[var(--brand-orange)] transition-all"
            />
          </div>
          <input
            type="url"
            value={subTaskLink}
            onChange={(event) => setSubTaskLink(event.target.value)}
            placeholder="Link (optional)..."
            className="w-full bg-primary border border-[var(--border-primary)] rounded-xl px-4 py-2.5 text-[10px] font-bold outline-none focus:border-[var(--brand-orange)] transition-all"
          />
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
              Attachment (optional)
            </label>
            <input
              type="file"
              onChange={(event) => {
                setSubTaskFile(event.target.files?.[0] || null);
                event.target.value = "";
              }}
              className="w-full text-[10px] text-slate-400 file:mr-2 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-tertiary file:text-[10px] file:font-bold file:uppercase file:tracking-wider file:text-[var(--text-primary)] file:cursor-pointer"
            />
            {subTaskFile && (
              <div className="mt-1 flex items-center gap-2">
                <p className="text-[10px] font-medium text-slate-500 truncate">
                  {subTaskFile.name} ({(subTaskFile.size / 1024).toFixed(0)} KB)
                </p>
                <button
                  type="button"
                  onClick={() => setSubTaskFile(null)}
                  className="text-[10px] font-bold uppercase text-rose-400 hover:text-rose-300 shrink-0"
                >
                  {t("common.remove")}
                </button>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={addSubTaskFromModal}
              disabled={!subTaskInput.trim()}
              className="flex-1 py-3 bg-indigo-500 text-black rounded-xl text-sm font-bold uppercase tracking-wide hover:brightness-110 disabled:opacity-40 flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" /> Add
            </button>
            <button
              onClick={onClose}
              className="flex-1 py-3 bg-tertiary border border-[var(--border-primary)] rounded-xl text-sm font-bold uppercase tracking-wide text-slate-500 hover:text-[var(--text-primary)] transition-all"
            >
              Done
            </button>
          </div>
          <p className="text-[10px] font-medium text-slate-500 text-center">
            Press Enter to add another, or click Done when finished.
          </p>
        </div>
      </div>
    </div>
  );
}
