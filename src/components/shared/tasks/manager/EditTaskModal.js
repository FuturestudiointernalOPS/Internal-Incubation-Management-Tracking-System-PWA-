"use client";

import { X, Edit3 } from "lucide-react";
import { PRIORITY_CONFIG, PRIORITY_OPTIONS, cn } from "./constants";

/**
 * The edit-task modal.
 *
 * It opens on a task (`editTaskModal`) and edits a copy of it (`editForm`), so
 * closing without saving leaves the task untouched. It renders nothing when no
 * task is open.
 */
export default function EditTaskModal({
  editTaskModal,
  editForm,
  setEditForm,
  onClose,
  projectMembers,
  mode,
  uid,
  validateTaskDates,
  onTasksChange,
  notify,
  t,
}) {
  if (!editTaskModal) return null;

  return (
    <div
      className="fixed inset-0 z-[600] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="card w-full max-w-lg space-y-4 max-h-[85vh] overflow-y-auto"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Edit3 className="w-5 h-5 text-[var(--brand-orange)]" />
            <h3 className="text-sm font-black uppercase tracking-tight">
              Edit Task
            </h3>
          </div>
          <button onClick={onClose}>
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="space-y-3">
          <input
            type="text"
            value={editForm.name}
            onChange={(event) =>
              setEditForm((previousForm) => ({ ...previousForm, name: event.target.value }))
            }
            placeholder="Task name"
            className="w-full bg-primary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-sm outline-none focus:border-[var(--brand-orange)] transition-all font-bold"
          />
          <textarea
            value={editForm.description}
            onChange={(event) =>
              setEditForm((previousForm) => ({ ...previousForm, description: event.target.value }))
            }
            placeholder="Description (optional)"
            rows={2}
            className="w-full bg-primary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-sm outline-none focus:border-[var(--brand-orange)] transition-all resize-none"
          />

          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
              Resource Link (optional)
            </label>
            <input
              type="url"
              value={editForm.link || ""}
              onChange={(event) =>
                setEditForm((previousForm) => ({ ...previousForm, link: event.target.value }))
              }
              placeholder="https://..."
              className="w-full bg-primary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-sm outline-none focus:border-[var(--brand-orange)] transition-all"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
              Priority
            </label>
            <select
              value={editForm.priority || "medium"}
              onChange={(event) =>
                setEditForm((previousForm) => ({ ...previousForm, priority: event.target.value }))
              }
              className={cn(
                "w-full bg-primary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-sm outline-none focus:border-[var(--brand-orange)] transition-all font-bold appearance-none cursor-pointer",
                PRIORITY_CONFIG[editForm.priority || "medium"]?.color,
              )}
            >
              {PRIORITY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Assignee dropdown (project mode only) */}
          {mode === "project" && projectMembers.length > 0 && (
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                Assign to
              </label>
              <select
                value={editForm.assigned_to || ""}
                onChange={(event) =>
                  setEditForm((previousForm) => ({
                    ...previousForm,
                    assigned_to: event.target.value,
                  }))
                }
                className="w-full bg-primary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-sm outline-none focus:border-[var(--brand-orange)] transition-all font-bold text-emerald-400"
              >
                <option value="">Self</option>
                {projectMembers.map((member) => (
                  <option
                    key={member.member_id || member.user_cid}
                    value={member.member_id || member.user_cid}
                  >
                    {member.name || member.member_id}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={editForm.start_date}
                onChange={(event) =>
                  setEditForm((previousForm) => ({ ...previousForm, start_date: event.target.value }))
                }
                min={(() => {
                  if (
                    !editTaskModal.created_week ||
                    !editTaskModal.created_year
                  )
                    return "";
                  const jan1 = new Date(editTaskModal.created_year, 0, 1);
                  const days = (editTaskModal.created_week - 1) * 7;
                  const monday = new Date(jan1);
                  monday.setDate(
                    jan1.getDate() + days + (1 - jan1.getDay()),
                  );
                  return monday.toISOString().split("T")[0];
                })()}
                max={(() => {
                  if (
                    !editTaskModal.created_week ||
                    !editTaskModal.created_year
                  )
                    return "";
                  const jan1 = new Date(editTaskModal.created_year, 0, 1);
                  const days = (editTaskModal.created_week - 1) * 7;
                  const monday = new Date(jan1);
                  monday.setDate(
                    jan1.getDate() + days + (1 - jan1.getDay()),
                  );
                  const sunday = new Date(monday);
                  sunday.setDate(monday.getDate() + 6);
                  return sunday.toISOString().split("T")[0];
                })()}
                className="w-full bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-2 text-[11px] font-bold outline-none"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                End Date
              </label>
              <input
                type="date"
                value={editForm.due_date}
                onChange={(event) =>
                  setEditForm((previousForm) => ({ ...previousForm, due_date: event.target.value }))
                }
                min={editForm.start_date || ""}
                className="w-full bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-2 text-[11px] font-bold outline-none"
              />
            </div>
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            onClick={async () => {
              if (!editForm.name.trim()) return;
              const dateError = validateTaskDates(
                editForm.start_date,
                editForm.due_date,
              );
              if (dateError) {
                notify("error", dateError);
                return;
              }
              try {
                const res = await fetch("/api/tasks", {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    id: editTaskModal.id,
                    title: editForm.name.trim(),
                    description: editForm.description || null,
                    start_date: editForm.start_date || null,
                    end_date: editForm.due_date || null,
                    assigned_to: editForm.assigned_to || null,
                    priority: editForm.priority || "medium",
                    link: editForm.link || null,
                    user_id: uid,
                  }),
                });
                const data = await res.json();
                if (data.success) {
                  onClose();
                  if (onTasksChange) onTasksChange();
                } else {
                  notify('error', t(data.error || "Failed to save task.") || data.error || "Failed to save task.");
                }
              } catch (error) {
                notify('error', "Network error saving task.");
                console.error(error);
              }
            }}
            disabled={!editForm.name.trim()}
            className="flex-1 py-3 bg-[var(--brand-orange)] text-black rounded-xl text-sm font-bold uppercase tracking-wide hover:brightness-110 disabled:opacity-40"
          >
            Save
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-3 bg-tertiary border border-[var(--border-primary)] rounded-xl text-sm font-bold uppercase tracking-wide text-slate-500 hover:text-[var(--text-primary)] transition-all"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
