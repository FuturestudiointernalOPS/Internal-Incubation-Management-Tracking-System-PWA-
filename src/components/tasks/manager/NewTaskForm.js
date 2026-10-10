"use client";

import { Plus, X } from "lucide-react";
import { CATEGORIES, PRIORITY_CONFIG, PRIORITY_OPTIONS, cn } from "./constants";

/**
 * The manager's new-task panel.
 *
 * It renders the open form and — when the form is closed and the board is not
 * read-only — the button that opens it. The form state belongs to the manager
 * (a parent can ask for the form to open, and a sub-task seeds it), so this
 * receives the values and the setters instead of owning them.
 *
 * The project picker's own search/visibility state is passed as one object
 * (`projectPicker`) because it is a self-contained concern that also needs a
 * ref for its outside-click dismissal.
 */
export default function NewTaskForm({
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
  projectMembers,
  mode,
  readOnly,
  t,
  projectPicker,
}) {
  const {
    projectDropdownRef,
    projectSearch,
    setProjectSearch,
    showProjectDropdown,
    setShowProjectDropdown,
    filteredProjects,
    selectedProject,
  } = projectPicker;

  return showTaskForm ? (
    <div className="p-3 rounded-xl border border-brand-orange/30 bg-brand-orange/[0.02] space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-[10px] font-bold uppercase tracking-widest text-[var(--brand-orange)]">
          {pendingParentTaskId ? "Add Sub-task" : "New Task"}
        </h4>
        {pendingParentTaskId && (
          <span className="text-[10px] text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded uppercase font-bold">
            Sub-task
          </span>
        )}
      </div>

      {/* Task name */}
      <input
        value={form.name}
        onChange={(event) => setForm((previousForm) => ({ ...previousForm, name: event.target.value }))}
        placeholder="What are you working on?"
        className="w-full bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-2 text-[11px] font-bold outline-none focus:border-[var(--brand-orange)] transition-all"
      />

      {/* Description */}
      <textarea
        value={form.description || ""}
        onChange={(event) =>
          setForm((previousForm) => ({ ...previousForm, description: event.target.value }))
        }
        placeholder="Description (optional)"
        rows={2}
        className="w-full bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-2 text-[10px] outline-none focus:border-[var(--brand-orange)] transition-all resize-none"
      />

      {/* Project / Category (hidden for sub-tasks — inherited) */}
      {!pendingParentTaskId && (
        <div className="grid grid-cols-2 gap-2">
          {/* Project picker */}
          <div className="relative" ref={projectDropdownRef}>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
              Project
            </label>
            {form.project_id ? (
              <div className="flex items-center gap-1 w-full bg-primary border border-emerald-500/30 rounded-lg px-2 py-1.5">
                <span className="text-[10px] font-bold text-emerald-500 flex-1 truncate">
                  {selectedProject?.name || form.project_id}
                </span>
                <button
                  onClick={() => setForm((previousForm) => ({ ...previousForm, project_id: "" }))}
                >
                  <X className="w-3 h-3 text-slate-500" />
                </button>
              </div>
            ) : (
              <div>
                <input
                  value={projectSearch}
                  onChange={(event) => {
                    setProjectSearch(event.target.value);
                    setShowProjectDropdown(true);
                  }}
                  onFocus={() => setShowProjectDropdown(true)}
                  placeholder="Search..."
                  className="w-full bg-primary border border-[var(--border-primary)] rounded-lg px-2 py-1.5 text-[10px] font-bold outline-none"
                />
                {showProjectDropdown && (
                  <div className="absolute z-10 mt-1 w-full max-h-32 overflow-y-auto rounded-lg bg-[var(--bg-primary)] border border-[var(--border-primary)] shadow-xl">
                    {filteredProjects.length === 0 ? (
                      <p className="px-3 py-2 text-[10px] font-medium text-slate-500">
                        No projects
                      </p>
                    ) : (
                      filteredProjects.map((project) => (
                        <button
                          key={project.id}
                          onClick={() => {
                            setForm((previousForm) => ({
                              ...previousForm,
                              project_id: project.id,
                              category: "",
                            }));
                            setProjectSearch("");
                            setShowProjectDropdown(false);
                          }}
                          className="w-full text-left px-3 py-1.5 hover:bg-tertiary text-[10px] font-bold"
                        >
                          {project.name}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Category (only when no project) */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
              Category
            </label>
            <select
              value={form.category}
              onChange={(event) =>
                setForm((previousForm) => ({
                  ...previousForm,
                  category: event.target.value,
                  // Only clear project_id when no project is already assigned
                  project_id: (!previousForm.project_id && event.target.value) ? "" : previousForm.project_id,
                }))
              }
              className="w-full bg-primary border border-[var(--border-primary)] rounded-lg px-2 py-1.5 text-[10px] font-bold text-purple-400 outline-none appearance-none cursor-pointer"
            >
              <option value="">—</option>
              {availableCategories.length > 0
                ? availableCategories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))
                : CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
            </select>
          </div>
        </div>
      )}

      {/* Inherited badge for sub-tasks */}
      {pendingParentTaskId && form.project_id && (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
          <span className="text-[10px] font-bold text-indigo-400">
            Inherited from parent
          </span>
          <span className="text-[10px] text-slate-500">
            {selectedProject?.name || form.category || ""}
          </span>
        </div>
      )}

      {/* Assignee + Priority row */}
      <div className="grid grid-cols-2 gap-2">
        {mode === "project" && projectMembers.length > 0 && (
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
              Assign to
            </label>
            <select
              value={form.assigned_to || ""}
              onChange={(event) =>
                setForm((previousForm) => ({ ...previousForm, assigned_to: event.target.value }))
              }
              className="w-full bg-primary border border-[var(--border-primary)] rounded-lg px-2 py-1.5 text-[10px] font-bold text-emerald-400 outline-none appearance-none cursor-pointer"
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
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
            Priority
          </label>
          <select
            value={form.priority || "medium"}
            onChange={(event) =>
              setForm((previousForm) => ({ ...previousForm, priority: event.target.value }))
            }
            className={cn(
              "w-full bg-primary border border-[var(--border-primary)] rounded-lg px-2 py-1.5 text-[10px] font-bold outline-none appearance-none cursor-pointer",
              PRIORITY_CONFIG[form.priority || "medium"]?.color,
            )}
          >
            {PRIORITY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Dates */}
      <div className="grid grid-cols-2 gap-2">
        <input
          type="date"
          value={form.start_date}
          onChange={(event) => {
            const newStart = event.target.value;
            setForm((previousForm) => ({
              ...previousForm,
              start_date: newStart,
              due_date:
                previousForm.due_date && newStart && previousForm.due_date < newStart
                  ? newStart
                  : previousForm.due_date,
            }));
          }}
          min={(() => {
            const today = new Date().toISOString().split("T")[0];
            return today;
          })()}
          className="bg-primary border border-[var(--border-primary)] rounded-lg px-2 py-1.5 text-[10px] font-bold outline-none"
        />
        <input
          type="date"
          value={form.due_date}
          onChange={(event) =>
            setForm((previousForm) => ({ ...previousForm, due_date: event.target.value }))
          }
          min={form.start_date || (() => { const today = new Date().toISOString().split("T")[0]; return today; })()}
          className="bg-primary border border-[var(--border-primary)] rounded-lg px-2 py-1.5 text-[10px] font-bold outline-none"
        />
      </div>

      {/* Resource Link */}
      <div>
        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
          Resource Link (optional)
        </label>
        <input
          type="url"
          value={form.link}
          onChange={(event) => setForm((previousForm) => ({ ...previousForm, link: event.target.value }))}
          placeholder="https://..."
          className="w-full bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-1.5 text-[10px] font-bold outline-none focus:border-[var(--brand-orange)] transition-all"
        />
      </div>

      {/* Attachment (file upload) */}
      <div>
        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
          Attachment (optional)
        </label>
        <input
          type="file"
          onChange={(event) => {
            setTaskFile(event.target.files?.[0] || null);
            event.target.value = "";
          }}
          className="w-full text-[10px] text-slate-400 file:mr-2 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-tertiary file:text-[10px] file:font-bold file:uppercase file:tracking-wider file:text-[var(--text-primary)] file:cursor-pointer"
        />
        {taskFile && (
          <div className="mt-1 flex items-center gap-2">
            <p className="text-[10px] font-medium text-slate-500 truncate">
              {taskFile.name} ({(taskFile.size / 1024).toFixed(0)} KB)
            </p>
            <button
              type="button"
              onClick={() => setTaskFile(null)}
              className="text-[10px] font-bold uppercase text-rose-400 hover:text-rose-300 shrink-0"
            >
              {t("common.remove")}
            </button>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={handleAddTask}
          disabled={
            creating ||
            !form.name.trim() ||
            (!form.project_id && !form.category)
          }
          className="flex-1 px-3 py-2 bg-[var(--brand-orange)] text-black rounded-lg text-[10px] font-bold uppercase tracking-wider disabled:opacity-40 hover:brightness-110 transition-all"
        >
          {creating
            ? "Saving..."
            : pendingParentTaskId
              ? "Add Sub-task"
              : addedCount > 0
                ? "Add Another Task"
                : "Add Task"}
        </button>
        <button
          onClick={handleCloseForm}
          className="px-3 py-2 bg-tertiary border border-[var(--border-primary)] rounded-lg text-[10px] font-bold uppercase tracking-wider text-slate-500 hover:text-[var(--text-primary)] transition-all"
        >
          {addedCount > 0 ? "Done" : "Cancel"}
        </button>
      </div>
    </div>
  ) : (
    !readOnly && (
      <button
        onClick={openTaskForm}
        className="flex items-center gap-2 px-3 py-2 bg-[var(--brand-orange)] text-black rounded-lg text-[10px] font-bold uppercase tracking-wider hover:brightness-110 transition-all w-fit"
      >
        <Plus className="w-3 h-3" /> New Task
      </button>
    )
  );
}
