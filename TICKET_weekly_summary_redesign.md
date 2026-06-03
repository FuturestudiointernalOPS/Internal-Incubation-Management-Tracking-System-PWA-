# Developer Ticket: Weekly Summary Redesign (Internal Reports)

## File to Modify
`src/app/staff/op-report/page.js`

## Overview

Replace the current empty `summary` tab content (`reportType === "summary"`) with a fully automated, read-only operational intelligence view. The tab toggle already exists at line ~709. Add the content block that renders when `reportType === "summary"`.

**Zero manual input.** No forms, no inputs, no submit buttons. Every value is calculated client-side from fetched data.

**No new API routes.** All data comes from existing endpoints.

---

## Data Fetching

Add a `useEffect` that fires when `reportType === "summary"`. Fetch in parallel:

```js
const [tasksRes, blockersRes, projectsRes] = await Promise.all([
  fetch(`/api/tasks?user_id=${user.cid}&week=${weekInfo.week}&year=${weekInfo.year}&sort=oldest`),
  fetch(`/api/blockers?user_id=${user.cid}`),
  fetch(`/api/projects/assignments?user_cid=${user.cid}`),
]);
```

| Endpoint | Returns |
|---|---|
| `GET /api/tasks?user_id=X&week=N&year=Y` | `{ tasks: [{ id, title, status, project_id, category, start_date, end_date, created_at, created_week, created_year, reschedule_count, blockers: [{id, title, status, severity}], subtasks: [{id, title, status}] }] }` |
| `GET /api/blockers?user_id=X` | `{ blockers: [{ id, task_id, title, status, severity, created_at, resolved_at, user_name }] }` |
| `GET /api/projects/assignments?user_cid=X` | `{ projects: [{ id, name, status, program_name, member_role }] }` |

Also use the existing `user` state (contains `user.cid`, `user.name`, `user.role` from session).

---

## Phase 1 — Weekly Overview Card

Render at the top. All values computed from fetched data.

```
┌──────────────────────────────────────────────┐
│  Week 24 — June 8 - June 14                  │
│                                              │
│  Tasks Planned:    12                        │
│  Tasks Completed:   9                        │
│  Tasks Carried Over: 3                       │
│                                              │
│  Blockers Created:   4                        │
│  Blockers Resolved:  3                        │
│  Active Blockers:    1                        │
│                                              │
│  Projects Contributed To: 4                  │
└──────────────────────────────────────────────┘
```

**Date range:** Use the existing `getWeekNumber()` helper. Calculate Monday–Friday of that week.

**Task counts:**
- `planned` = `tasks.length`
- `completed` = `tasks.filter(t => t.status === "completed").length`
- `carriedOver` = `tasks.filter(t => t.status === "carried_over").length`

**Blocker counts:**
- `created` = all blockers in the response
- `resolved` = blockers where `b.status === "resolved"`
- `active` = blockers where `b.status === "active"`

**Projects contributed:** Count unique `project_id` values across all tasks (exclude null).

Use existing card styling: `<div className="card space-y-3 p-5">`

---

## Phase 2 — Tasks Worked On This Week

A table rendering every task that existed during the week.

**Columns:**

| Task Name | Project | Category | Created Date | Due Date | Status | Collaborators |
|---|---|---|---|---|---|---|

**Status mapping** (use existing `STATUS_CONFIG` at the top of the file):
- `completed` → "Completed" (emerald)
- `in_progress` → "Active" (blue)
- `blocked` → "Blocked" (rose)
- `carried_over` → "Carry Over" (indigo)
- `pending` → "Pending" (slate)
- `pending_project_approval` → "Pending Approval" (amber)

**Project name:** Resolve using a `projectMap` built from the assignments response.

**Subtasks:** If `task.subtasks?.length > 0`, render an expandable row beneath the parent using the existing `<ChevronDown />` toggle pattern, indented with `↳`.

**Rule:** No edit buttons, no status change buttons. Display only.

---

## Phase 3 — Project Contributions

Group tasks by project. Show a collapsible card per project.

```
┌──────────────────────────────────────────────┐
│  Future Studio Website         [ ▼ Expand ]  │
│  Tasks Worked On: 5                          │
│  Completed: 4  |  Carry Over: 1  |  Blockers: 0  │
└──────────────────────────────────────────────┘
```

**Expanded view** shows a task table per project.

**Non-project tasks:** Group by `category` field. If the task has no `project_id` and no `category`, group under "Operations". If `category === "Administration"`, group under "Administrative Tasks".

**Grouping logic:**
```js
const grouped = {};
tasks.forEach(task => {
  const key = task.project_id
    ? `project_${task.project_id}`
    : `category_${task.category || "Operations"}`;
  if (!grouped[key]) grouped[key] = [];
  grouped[key].push(task);
});
```

**Project health indicators** (per project group):
- **On Track** (emerald): completion rate > 70%, zero active blockers
- **At Risk** (amber): completion rate 30–70%, or 1+ active blockers
- **Blocked** (rose): zero completed tasks, or 2+ active blockers, or any task blocked > 1 week

---

## Phase 4 — Assignment History

Show tasks that were assigned to the user (not self-created).

For each assigned task display:

| Field | Source |
|---|---|
| Task Name | `task.title` |
| Assigned By | The `task.user_name` (creator = assigner) when `task.user_id !== user.cid` |
| Assigned Date | `task.created_at` |
| Accepted Date | Display as "Pending" if unavailable (future enhancement) |
| Status | `task.status` → human label from `STATUS_CONFIG` |

**Assignment detection:** A task is "assigned" if the logged-in user (`user.cid`) is different from `task.user_id`.

```jsx
{assignedTasks.length > 0 && (
  <div className="space-y-3">
    <h2 className="text-sm font-black uppercase tracking-tight">Task Assignments Received</h2>
    {assignedTasks.map(task => (
      <div key={task.id} className="card flex justify-between items-center">
        <div>
          <p className="text-xs font-bold">{task.title}</p>
          <p className="text-[9px] text-slate-500">
            Assigned by {task.user_name} on {formatDate(task.created_at)}
          </p>
        </div>
        <span className={`${STATUS_CONFIG[task.status]?.bg || 'bg-slate-500/10'} ${STATUS_CONFIG[task.status]?.color || 'text-slate-400'} px-2 py-0.5 rounded text-[9px] font-bold`}>
          {STATUS_CONFIG[task.status]?.label || task.status}
        </span>
      </div>
    ))}
  </div>
)}
```

---

## Phase 5 — Blockers Summary

Two sub-sections: **Resolved Blockers** and **Active Blockers**.

### Resolved Blockers table:

| Blocker | Linked Task | Project | Created | Resolved |
|---|---|---|---|---|
| `b.title` | `tasks.find(t => t.id === b.task_id)?.title` | Project from that task | `formatDate(b.created_at)` | `formatDate(b.resolved_at)` |

### Active Blockers table:

Same columns + **Weeks Open**:
```js
const weeksOpen = Math.floor((Date.now() - new Date(b.created_at).getTime()) / (7 * 24 * 60 * 60 * 1000));
```

Style active blockers open > 2 weeks with rose-warning colors. Use `<Shield className="w-3 h-3 text-rose-400" />` icon inline.

---

## Phase 6 — Collaboration Overview

Calculate collaborators from all tasks where `task.user_name !== user.name`.

```jsx
<h2 className="text-sm font-black uppercase tracking-tight">Collaboration Overview</h2>
{Object.entries(collaboratorMap).map(([name, sharedTasks]) => (
  <div className="card" key={name}>
    <div className="flex justify-between items-center cursor-pointer"
         onClick={() => setCollapsed(prev => ({...prev, [name]: !prev[name]}))}>
      <h3 className="text-xs font-bold">{name}</h3>
      <span className="text-[9px] text-slate-500">{sharedTasks.length} shared tasks</span>
    </div>
    {collapsed[name] && sharedTasks.map(t => (
      <div key={t.id} className="flex justify-between text-[10px] py-1 border-b border-[var(--border-primary)]/30 last:border-0">
        <span>{t.title}</span>
        <span className="text-slate-500">{projectMap[t.project_id]?.name || t.category || "—"}</span>
      </div>
    ))}
  </div>
))}
```

**Collaborator detection:** Any unique `user_name` in the tasks list that isn't the current user.

---

## Phase 7 — Carry-Over Intelligence

Display every task where `task.status !== "completed"`. This is an operational accountability tool.

**Table columns:**

| Task | Project | Weeks Carried Over | Current Due Date | Linked Blockers |
|---|---|---|---|---|

**Aging indicators:**
- 1–2 weeks: normal styling
- 3–4 weeks: amber background, "⚠ Requires attention" badge
- 5+ weeks: rose background, "🔴 Critical" badge

```jsx
{carryOverTasks.map(task => {
  const weeks = task.reschedule_count || 0;
  return (
    <div key={task.id} className={`card ${
      weeks >= 5 ? 'border-rose-500/30 bg-rose-500/5' :
      weeks >= 3 ? 'border-amber-500/30 bg-amber-500/5' : ''
    }`}>
      <div className="flex justify-between items-center">
        <div>
          <p className="text-xs font-bold">{task.title}</p>
          <p className="text-[9px] text-slate-500">
            Project: {projectMap[task.project_id]?.name || "—"} 
            | Due: {formatDate(task.end_date)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-lg font-black">{weeks}</p>
          <p className="text-[8px] text-slate-500 uppercase tracking-wider">Weeks</p>
        </div>
      </div>
      {weeks >= 3 && (
        <div className={`mt-2 text-[9px] font-bold uppercase tracking-wider ${weeks >= 5 ? 'text-rose-400' : 'text-amber-400'}`}>
          {weeks >= 5 ? '🔴 Critical — Requires immediate attention' : '⚠ Requires attention'}
        </div>
      )}
      {(task.blockers || []).filter(b => b.status === "active").length > 0 && (
        <div className="flex items-center gap-1 mt-2 text-rose-400 text-[9px]">
          <Shield className="w-3 h-3" />
          {(task.blockers || []).filter(b => b.status === "active").length} active blocker(s)
        </div>
      )}
    </div>
  );
})}
```

---

## Phase 8 — Project Owner Summary

**Conditionally render only if user owns projects** (`projects.some(p => p.member_role === "lead")`).

For each owned project, aggregate across ALL tasks (not just the user's own tasks — this is project-wide intelligence, but limited to data available in the current week's task fetch).

```
┌──────────────────────────────────────────────┐
│  Future Studio Website         [ HEALTH: 🟢 ]│
│  Tasks Completed:  12                        │
│  Tasks Active:      4                        │
│  Tasks Carried:     2                        │
│  Blockers Active:   1                        │
│  Collaborators:     3                         │
└──────────────────────────────────────────────┘
```

**Health calculation:**
```js
const computeHealth = (completed, active, carried, blockers) => {
  const total = completed + active + carried;
  const completionRate = total > 0 ? completed / total : 0;
  const hasActiveBlockers = blockers > 0;
  const isCarriedHeavy = total > 0 && (carried / total) > 0.3;

  if ((hasActiveBlockers && isCarriedHeavy) || (completionRate < 0.3 && total > 2)) return "blocked";
  if (hasActiveBlockers || isCarriedHeavy) return "at_risk";
  return "on_track";
};
```

**Health indicator badges:**
- `on_track` → `text-emerald-400 bg-emerald-500/10` ("On Track")
- `at_risk` → `text-amber-400 bg-amber-500/10` ("At Risk")
- `blocked` → `text-rose-400 bg-rose-500/10` ("Blocked")

**Collaborators count:** Unique `task.user_name` values where `task.project_id` matches this project.

---

## Phase 9 — Weekly Activity Timeline

A chronological reconstruction of the week's activity aggregated by day.

```js
const timeline = {};
tasks.forEach(task => {
  const day = task.created_at?.split('T')[0];
  if (!day) return;
  if (!timeline[day]) timeline[day] = { created: 0, completed: 0 };
  timeline[day].created++;
  if (task.status === "completed") timeline[day].completed++;
});

// Also add blocker events
blockers.forEach(b => {
  const day = b.created_at?.split('T')[0];
  if (!day) return;
  if (!timeline[day]) timeline[day] = { created: 0, completed: 0, blockerAdded: 0, blockerResolved: 0 };
  timeline[day].blockerAdded = (timeline[day].blockerAdded || 0) + 1;
  if (b.status === "resolved" && b.resolved_at) {
    const resolvedDay = b.resolved_at?.split('T')[0];
    if (!timeline[resolvedDay]) timeline[resolvedDay] = { created: 0, completed: 0, blockerAdded: 0, blockerResolved: 0 };
    timeline[resolvedDay].blockerResolved = (timeline[resolvedDay].blockerResolved || 0) + 1;
  }
});
```

**Render:**
```
Monday, June 9
  ● Created 6 tasks
  ● Completed 2 tasks

Tuesday, June 10
  ● Created 3 tasks
  ● Added 1 blocker

Thursday, June 12
  ● Completed 3 tasks

Friday, June 13
  ● Resolved 1 blocker
  ● Completed 2 tasks
```

**Day labels:** Convert `YYYY-MM-DD` to `new Date(day).toLocaleDateString('en', { weekday: 'long', month: 'long', day: 'numeric' })`.

**Event types (ordered):**
1. "Created N tasks" — if `dayData.created > 0`
2. "Completed N tasks" — if `dayData.completed > 0`
3. "Added N blockers" — if `dayData.blockerAdded > 0`
4. "Accepted N assignments" — placeholder for future
5. "Resolved N blockers" — if `dayData.blockerResolved > 0`

Use the timeline styling pattern (flex with colored dots):
```jsx
<div className="flex gap-3">
  <div className="w-2 h-2 rounded-full bg-[var(--brand-orange)] mt-1.5 shrink-0" />
  <div>
    <p className="text-[10px] text-slate-500">{dayLabel}</p>
    <p className="text-xs font-bold">{eventText}</p>
  </div>
</div>
```

---

## Phase 10 — Architecture Constraints

**Do NOT introduce:**
- New database tables
- New API routes
- New report entities
- New form fields or submit endpoints
- Any write operations in the summary tab

**The Weekly Summary must use only:**
- `tasks` table (via `GET /api/tasks`)
- `blockers` table (via `GET /api/blockers`)
- `v2_projects` / `project_members` (via `GET /api/projects/assignments`)
- Existing audit log data (via `GET /api/tasks/logs`)
- Session data (`user` state from the existing auth `useEffect`)

**Preserve existing functionality:** The Stand-Up (`reportType === "standup"`) and Retro (`reportType === "retro"`) tabs must continue to work exactly as they do now. The summary tab is additive only.

---

## Styling Reference

All from existing patterns in `src/app/staff/op-report/page.js`:

| Element | Classes |
|---|---|
| Card container | `className="card space-y-3 p-5"` |
| Section header | `className="text-sm font-black text-[var(--text-primary)] uppercase tracking-tight"` |
| Sub-header | `className="text-[10px] font-black text-slate-500 uppercase tracking-widest"` |
| Stat value | `className="text-2xl font-black text-[var(--text-primary)]"` |
| Stat label | `className="text-[9px] text-slate-500 uppercase tracking-wider"` |
| Table header | `className="text-left px-3 py-2 text-[9px] font-semibold text-slate-500 uppercase tracking-wider"` |
| Table cell | `className="px-3 py-2.5 text-[11px] text-[var(--text-primary)]"` |
| Status badge | `className={STATUS_CONFIG[status]?.bg + " " + STATUS_CONFIG[status]?.color + " px-2 py-0.5 rounded text-[9px] font-bold"}` |
| Empty state | `className="text-[10px] text-slate-600 italic text-center py-8"` |
| Collapsible toggle | `<ChevronDown className="w-3 h-3 transition-transform" />` |
| Inline icon+text | `<Shield className="w-3 h-3 text-rose-400" />` |

---

## Success Criteria

When a staff member opens Weekly Summary, they should instantly understand:

- **What I planned** — Phase 1 overview card
- **What I worked on** — Phase 2 task table
- **What I completed vs what is still pending** — Phase 2 status badges + Phase 7 carry-overs
- **Which projects I contributed to** — Phase 3 project grouping + Phase 8 (if owner)
- **What blockers I faced** — Phase 5 blocker summary
- **Who I collaborated with** — Phase 6 collaboration overview
- **How my week unfolded** — Phase 9 activity timeline
- **What carries into next week** — Phase 7 carry-over intelligence

**Without filling a single form field.**
