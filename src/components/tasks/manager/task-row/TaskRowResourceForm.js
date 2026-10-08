"use client";

/**
 * The inline "add a resource" editor for one task.
 *
 * `TaskRow` decides when it is mounted (`addResourceTaskId === task.id`); this
 * renders the form itself.
 */
export default function TaskRowResourceForm({
  task,
  isSub,
  resourceForm,
  setResourceForm,
  resourceFile,
  setResourceFile,
  resourceAdding,
  handleSaveResource,
  setAddResourceTaskId,
}) {
  return (
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
  );
}
