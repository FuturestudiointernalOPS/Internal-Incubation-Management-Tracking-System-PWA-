# DeepSeek work order — Ticket 1.2 gap — Add "Assign to" field to Edit Task modal

Reply language: **English**. Codebase: Next.js. Do **not** redesign UI beyond what's asked. Reuse existing patterns exactly.

## Context

`src/components/tasks/TaskManager.js` has TWO separate task forms:
1. **Create form** (~L1094-1118) — has a working "Assign to" `<select>` dropdown, `mode === "project"` gated, populated from `projectMembers` prop.
2. **Edit modal** (~L1356-1500, `editTaskModal` state) — only has name, description, start_date, end_date. **No assignee field at all**, even though Ticket 1.2 (Personal Task Management) requires edit to cover "Assigned Users". This blocks reassigning an already-created task via UI.

Fix: add the same "Assign to" dropdown to the Edit modal, wired to save.

## Task

**1. Add `assigned_to` to edit form state init** (~L658-667, inside the Edit button's `onClick`):
```js
setEditForm({
  name: task.title,
  description: task.description || "",
  project_id: task.project_id || "",
  category: task.category || "",
  start_date: task.start_date || "",
  due_date: task.end_date || "",
  status: task.status || "in_progress",
  assigned_to: task.assigned_to || "",   // ADD THIS
});
```

**2. Add `assigned_to` to the `editForm` useState default** (~L122-130):
```js
const [editForm, setEditForm] = useState({
  name: "",
  description: "",
  project_id: "",
  category: "",
  start_date: "",
  due_date: "",
  status: "",
  assigned_to: "",   // ADD THIS
});
```

**3. Add the dropdown to the Edit modal JSX** (~L1396, right after the description `<textarea>`, before the date grid). Mirror the create form's dropdown exactly (~L1094-1118), same `mode === "project" && projectMembers.length > 0` gate, same options pattern (`Self` = clear, then `projectMembers.map(...)`):
```jsx
{mode === "project" && projectMembers.length > 0 && (
  <div>
    <label className="text-[8px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
      Assign to
    </label>
    <select
      value={editForm.assigned_to || ""}
      onChange={(e) =>
        setEditForm((p) => ({ ...p, assigned_to: e.target.value }))
      }
      className="w-full bg-primary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-sm outline-none focus:border-[var(--brand-orange)] transition-all font-bold text-emerald-400"
    >
      <option value="">Self</option>
      {projectMembers.map((m) => (
        <option key={m.member_id || m.user_cid} value={m.member_id || m.user_cid}>
          {m.name || m.member_id}
        </option>
      ))}
    </select>
  </div>
)}
```

**4. Include `assigned_to` in the Save PUT body** (~L1463-1474):
```js
const res = await fetch("/api/tasks", {
  method: "PUT",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    id: editTaskModal.id,
    title: editForm.name.trim(),
    description: editForm.description || null,
    start_date: editForm.start_date || null,
    end_date: editForm.due_date || null,
    assigned_to: editForm.assigned_to || null,   // ADD THIS
    user_id: uid,
  }),
});
```

Do NOT touch `project_id` or `category` in the PUT body — those fields exist in `editForm` state but were never sent before this task either; that's a separate pre-existing gap, out of scope here. Only wire `assigned_to`.

## Why this matters (context, not instructions)

The backend (`src/app/api/tasks/route.js` PATCH handler, `assigned_to` block ~L698) already correctly routes edit-time reassignment through the pending accept/decline workflow (`task_assignments` table) instead of setting `tasks.assigned_to` directly — that logic is already fixed and tested. This ticket only adds the missing UI trigger so a real user can reach that code path.

## Acceptance

- ☐ Edit modal shows "Assign to" dropdown when `mode === "project"` and project has members.
- ☐ Dropdown defaults to current `task.assigned_to` (or "Self" if unassigned/self).
- ☐ Saving with a different assignee sends `assigned_to` in the PUT body.
- ☐ No regression: editing title/description/dates without touching assignee still works exactly as before.

## Out of scope

- Do not add `project_id` or `category` fields to the edit modal (separate pre-existing gap, not needed for this fix).
- Do not touch the Create form, the PATCH backend logic, or any other file.
- `--no-auto-commits`. Check `git status` after — should only touch `src/components/tasks/TaskManager.js`.
</content>
