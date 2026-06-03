# Developer Ticket: Intelligence Module — /admin/intelligence

## File to Modify
`src/app/admin/intelligence/page.js`

## Overview

Build the `/admin/intelligence` page as a **read-only analytics dashboard** that aggregates data from the existing Work OS systems (tasks, blockers, projects, programs, reports) to provide system-wide performance visibility for the Super Admin.

**No new workflows. No data entry. Read-only.**

---

## Data Fetching

Add a `useEffect` that fetches all data in parallel on mount. Use these existing API endpoints:

```js
const fetchIntelligenceData = useCallback(async () => {
  setLoading(true);
  try {
    const [tasksRes, blockersRes, projectsRes, programsRes, reportsRes, staffRes] = await Promise.all([
      fetch("/api/tasks"),
      fetch("/api/blockers"),
      fetch("/api/projects"),
      fetch("/api/programs"),
      fetch("/api/op-reports"),
      fetch("/api/contacts"),
    ]);
    // Parse responses...
  } catch (e) {
    console.error("Intelligence fetch error:", e);
  } finally {
    setLoading(false);
  }
}, []);
```

| Endpoint | Returns | Use |
|---|---|---|
| `GET /api/tasks` | `{ tasks: [{ id, user_id, user_name, project_id, status, category, created_at, start_date, end_date, created_week, created_year, reschedule_count, blockers: [...], subtasks: [...] }] }` | All task metrics, status breakdown, per-user stats |
| `GET /api/blockers` | `{ blockers: [{ id, task_id, title, status, severity, created_at, resolved_at, user_id, user_name }] }` | Blocker counts, resolution rates, aging |
| `GET /api/projects` | `{ projects: [{ id, name, status, program_id }] }` | Project grouping, per-project stats |
| `GET /api/programs` | `{ programs: [{ id, name, assigned_pm_id }] }` | Program-level aggregation |
| `GET /api/op-reports` | `{ reports: [{ user_id, user_name, report_type, week_number, year, has_blockers, had_blockers, created_at }] }` | Weekly compliance, standup/retro rates |
| `GET /api/contacts` | `{ contacts: [{ cid, name, role, status, group_name }] }` | Staff identification and filtering |

---

## UI Layout

### Section 1 — Global System Overview (KPI Cards)

Render 6 stat cards in a grid:

```
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│  Total   │ │ Completed│ │  Active  │ │  Active  │ │ Carry-over│ │  Active  │
│  Tasks   │ │  Tasks   │ │  Tasks   │ │ Blockers │ │   Rate   │ │  Staff   │
│   142    │ │   98     │ │   28     │ │    7     │ │   11%    │ │   24     │
└──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘
```

**Calculations:**

| Metric | Logic |
|---|---|
| Total Tasks | `tasks.length` |
| Completed Tasks | `tasks.filter(t => t.status === "completed").length` |
| Active Tasks | `tasks.filter(t => t.status === "in_progress" || t.status === "blocked").length` |
| Active Blockers | `blockers.filter(b => b.status === "active").length` |
| Carry-over Rate | `(carriedOverTasks / totalTasks * 100).toFixed(0) + "%"` |
| Active Staff Count | `new Set(tasks.filter(t => t.status !== "completed").map(t => t.user_id)).size` |

Use existing card styling from the admin dashboard:
```jsx
<div className="card p-4 space-y-1">
  <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{label}</p>
  <p className="text-3xl font-black text-[var(--text-primary)]">{value}</p>
</div>
```

---

### Section 2 — Staff Performance Grid

Group tasks by `user_id`. For each staff member, compute:

| Metric | Logic |
|---|---|
| Total tasks assigned | Tasks where `task.user_id === staffId` |
| Tasks completed | `tasks.filter(t => t.user_id === staffId && t.status === "completed").length` |
| Carry-over count | `tasks.filter(t => t.user_id === staffId && t.status === "carried_over").length` |
| Active blockers | `blockers.filter(b => b.user_id === staffId && b.status === "active").length` |
| Completion rate | `total > 0 ? (completed / total * 100).toFixed(0) : 0` |

Render each staff member as a card:

```jsx
<div className="card p-4">
  <div className="flex items-center justify-between">
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-full bg-primary border border-[var(--border-primary)] flex items-center justify-center text-sm font-black">
        {name.charAt(0)}
      </div>
      <div>
        <p className="text-xs font-bold text-[var(--text-primary)]">{name}</p>
        <p className="text-[9px] text-slate-500">{role || "Staff"}</p>
      </div>
    </div>
    <div className="flex gap-4 text-[10px]">
      <div className="text-center">
        <p className="font-black">{completed}</p>
        <p className="text-slate-500 text-[8px] uppercase">Done</p>
      </div>
      <div className="text-center">
        <p className="font-black text-indigo-400">{carried}</p>
        <p className="text-slate-500 text-[8px] uppercase">Carry</p>
      </div>
      <div className="text-center">
        <p className="font-black text-rose-400">{activeBlockers}</p>
        <p className="text-slate-500 text-[8px] uppercase">Blocked</p>
      </div>
    </div>
    <div className="text-right">
      <p className="text-lg font-black text-emerald-400">{completionRate}%</p>
      <p className="text-[8px] text-slate-500 uppercase">Rate</p>
    </div>
  </div>
  {/* Expanded drill-down — toggle with onClick */}
  {expanded === staffId && (
    <div className="mt-3 pt-3 border-t border-[var(--border-primary)]/30 space-y-2">
      <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Tasks</p>
      {staffTasks.map(t => (
        <div key={t.id} className="flex justify-between text-[10px]">
          <span className="font-medium">{t.title}</span>
          <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${STATUS_CONFIG[t.status]?.bg} ${STATUS_CONFIG[t.status]?.color}`}>
            {STATUS_CONFIG[t.status]?.label}
          </span>
        </div>
      ))}
    </div>
  )}
</div>
```

**Sort staff** by completion rate ascending — lowest performers first.

---

### Section 3 — Project Performance

Group tasks by `project_id`. For each project, compute:

| Metric | Logic |
|---|---|
| Total tasks | `tasks.filter(t => t.project_id === projectId).length` |
| Completed tasks | `tasks.filter(t => t.project_id === projectId && t.status === "completed").length` |
| Completion rate | `total > 0 ? (completed / total * 100).toFixed(0) : 0` |
| Active blockers | Sum of `(task.blockers || []).filter(b => b.status === "active").length` for all tasks in project |
| Staff distribution | `new Set(tasks.filter(t => t.project_id === projectId).map(t => t.user_name))` |
| Velocity | Tasks completed per week: group completed tasks by `created_week` and calculate average per week |

Render each project as a card:

```jsx
<div className="card p-4">
  <div className="flex items-center justify-between">
    <div>
      <p className="text-xs font-bold text-[var(--text-primary)]">{projectName}</p>
      <p className="text-[9px] text-slate-500">{programName || "—"}</p>
    </div>
    <div className={`text-[8px] font-black uppercase px-2 py-0.5 rounded ${healthColor}`}>
      {healthLabel}
    </div>
  </div>
  <div className="grid grid-cols-4 gap-3 mt-3 text-[10px]">
    <div><span className="font-black">{total}</span> <span className="text-slate-500">total</span></div>
    <div><span className="font-black text-emerald-400">{completed}</span> <span className="text-slate-500">done</span></div>
    <div><span className="font-black">{rate}%</span> <span className="text-slate-500">rate</span></div>
    <div><span className="font-black text-rose-400">{blockers}</span> <span className="text-slate-500">blockers</span></div>
  </div>
  {expanded === projectId && (
    <div className="mt-3 pt-3 border-t border-[var(--border-primary)]/30 space-y-1">
      <p className="text-[8px] text-slate-500">Staff: {Array.from(staffSet).join(", ")}</p>
      <p className="text-[8px] text-slate-500">Velocity: {velocity.toFixed(1)} tasks/week</p>
    </div>
  )}
</div>
```

**Health indicators** (same as Phase 3/8 of Weekly Summary):
- `rate > 70 && blockers === 0` → `text-emerald-400 bg-emerald-500/10` ("On Track")
- `rate > 30 && blockers < 2` → `text-amber-400 bg-amber-500/10` ("At Risk")
- Otherwise → `text-rose-400 bg-rose-500/10` ("Blocked")

**Non-project tasks:** Group under "Unassigned" section.

---

## Styling Reference

All patterns from existing admin pages (`src/app/admin/page.js` and `src/app/admin/work/page.js`):

| Element | Classes |
|---|---|
| Page wrapper | `className="space-y-8 pb-20"` |
| Section header | `className="text-sm font-black text-[var(--text-primary)] uppercase tracking-tight"` |
| KPI card | `className="card p-4 space-y-1"` |
| KPI value | `className="text-3xl font-black text-[var(--text-primary)]"` |
| KPI label | `className="text-[9px] font-black text-slate-500 uppercase tracking-widest"` |
| Staff/project card | `className="card p-4"` |
| Status badge | `className={STATUS_CONFIG[status]?.bg + " " + STATUS_CONFIG[status]?.color + " px-1.5 py-0.5 rounded text-[8px] font-bold"}` |
| Loading state | `<TableSkeleton rows={8} />` from `@/components/ui/Skeleton` |
| Empty state | `className="text-[10px] text-slate-600 italic text-center py-12"` |

---

## Icon Imports Needed

Add to the existing lucide-react import:

```js
import {
  ...
  TrendingUp,
  BarChart3,
  Activity,
  Users,
  Shield,
  Clock,
  Target,
  ChevronDown,
  ChevronRight,
  ...rest
} from "lucide-react";
```

---

### Section 4 — Blocker Intelligence

Render a dedicated blocker analytics section with multiple sub-views:

**KPI row:**
```jsx
<div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
  <div className="card p-3">
    <p className="text-2xl font-black text-rose-400">{activeBlockers}</p>
    <p className="text-[8px] text-slate-500 uppercase tracking-wider">Active Blockers</p>
  </div>
  <div className="card p-3">
    <p className="text-2xl font-black">{avgResolutionHours}h</p>
    <p className="text-[8px] text-slate-500 uppercase tracking-wider">Avg Resolution</p>
  </div>
  <div className="card p-3">
    <p className="text-2xl font-black text-amber-400">{longestUnresolved}d</p>
    <p className="text-[8px] text-slate-500 uppercase tracking-wider">Longest Open</p>
  </div>
</div>
```

**Blockers by type chart (text-based table):**
| Type | Count | % |
|---|---|---|
| Dependency | 12 | 40% |
| Resource | 8 | 27% |
| Communication | 5 | 17% |
| Timeline | 3 | 10% |
| Other | 2 | 7% |

**Calculations:**
- `avgResolutionHours` = Average of `(new Date(b.resolved_at) - new Date(b.created_at)) / 3600000` for resolved blockers
- `longestUnresolvedDays` = Max of `(Date.now() - new Date(b.created_at)) / 86400000` for active blockers
- Group blockers by `severity` or inferred type from `title` keywords if no dedicated type column exists; otherwise use `severity` field

**Blocker aging table** (active blockers sorted by oldest first):
```jsx
<Table>
  <thead>
    <tr>
      <th>Blocker</th>
      <th>Task</th>
      <th>Staff</th>
      <th>Age</th>
      <th>Severity</th>
    </tr>
  </thead>
  <tbody>
    {activeBlockers.sort((a,b) => new Date(a.created_at) - new Date(b.created_at)).map(b => (
      <tr className={weeksOpen >= 3 ? 'bg-rose-500/5' : ''}>
        <td>{b.title}</td>
        <td>{taskName}</td>
        <td>{b.user_name}</td>
        <td className="font-bold text-rose-400">{weeksOpen}w</td>
        <td><SeverityBadge severity={b.severity} /></td>
      </tr>
    ))}
  </tbody>
</Table>
```

---

### Section 5 — Carry-Over Analytics

Render a section focused on multi-week carry-over tasks — the operational accountability layer.

**Summary row:**
| Metric | Logic |
|---|---|
| Tasks carried this week | `tasks.filter(t => t.status === "carried_over").length` |
| Multi-week carry-overs (3+) | `tasks.filter(t => (t.reschedule_count || 0) >= 3).length` |
| Staff with highest carry-over | Group by `user_id`, sort by carry-over count descending, take top 5 |
| Projects with chronic delays | Group by `project_id`, filter to projects where >30% of tasks are carried_over |

**Carry-over leaderboard (table):**
| Staff | Carried Tasks | Multi-Week | Rate |
|---|---|---|---|
| Sarah J. | 7 | 3 | 58% |
| Mark T. | 4 | 1 | 33% |
| Alex K. | 3 | 2 | 25% |

**Weeks-carried distribution:**
```jsx
{/* Bar-style visualization */}
[1 week]  ████████████  12 tasks
[2 weeks] ████████       8 tasks
[3 weeks] ████           4 tasks  ← amber warning
[4 weeks] ██             2 tasks  ← amber warning
[5+ weeks]█              1 task   ← red critical
```

Render as divs with width proportional to count:
```jsx
{distribution.map(d => (
  <div className="flex items-center gap-2">
    <span className="text-[9px] text-slate-500 w-16">{d.label}</span>
    <div className="flex-1 h-4 rounded bg-tertiary overflow-hidden">
      <div className={`h-full rounded ${d.color}`} style={{width: `${d.percent}%`}} />
    </div>
    <span className="text-[9px] font-bold w-8 text-right">{d.count}</span>
  </div>
))}
```

---

### Section 6 — Weekly System Health

Render system-wide compliance and health metrics.

**Compliance cards:**
| Metric | Logic |
|---|---|
| Standup completion rate | Reports where `report_type === "standup"` / total staff count for the current week |
| Retro completion rate | Reports where `report_type === "retro"` / total staff count for the current week |
| Task creation vs completion | Tasks created this week vs tasks completed this week (ratio) |
| Weekly workload distribution | Tasks per staff for current week, displayed as distribution |

```jsx
<div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
  <div className="card p-3">
    <p className="text-2xl font-black text-emerald-400">{standupRate}%</p>
    <p className="text-[8px] text-slate-500 uppercase tracking-wider">Standup Completion</p>
    <p className="text-[8px] text-slate-600 mt-1">{standupSubmitted}/{totalStaff} submitted</p>
  </div>
  <div className="card p-3">
    <p className="text-2xl font-black text-blue-400">{retroRate}%</p>
    <p className="text-[8px] text-slate-500 uppercase tracking-wider">Retro Completion</p>
    <p className="text-[8px] text-slate-600 mt-1">{retroSubmitted}/{totalStaff} submitted</p>
  </div>
  <div className="card p-3">
    <p className="text-2xl font-black">{createdThisWeek}</p>
    <p className="text-[8px] text-slate-500 uppercase tracking-wider">Tasks Created</p>
  </div>
  <div className="card p-3">
    <p className="text-2xl font-black text-emerald-400">{completedThisWeek}</p>
    <p className="text-[8px] text-slate-500 uppercase tracking-wider">Tasks Completed</p>
  </div>
</div>
```

**Weekly trend** — Show last 8 weeks as a mini-table:
```jsx
<Table>
  <thead>
    <tr>
      <th>Week</th>
      <th>Created</th>
      <th>Completed</th>
      <th>Carried</th>
      <th>Standups</th>
      <th>Retros</th>
    </tr>
  </thead>
  <tbody>
    {last8Weeks.map(w => (
      <tr>
        <td>W{w.week}</td>
        <td>{w.created}</td>
        <td className="text-emerald-400">{w.completed}</td>
        <td className="text-indigo-400">{w.carried}</td>
        <td>{w.standups}/{totalStaff}</td>
        <td>{w.retros}/{totalStaff}</td>
      </tr>
    ))}
  </tbody>
</Table>
```

**Week calculation:** Use the existing `getWeekNumber()` helper pattern. Group tasks and reports by `created_week` / `created_year`.

---

### Section 7 — Program Performance

Aggregate data at the program level (external learning system).

| Metric | Logic |
|---|---|
| Program completion rate | Tasks for projects under this program where `status === "completed"` / total tasks for the program |
| Participant engagement | Count of unique `user_id` values on tasks linked to program projects |
| Report submission rate | Reports from users assigned to this program's projects |
| Drop-off trend | Tasks created vs completed per week for this program, showing widening gap if completion lags creation |

**Grouping:** Programs are linked to projects via `v2_projects.program_id`. Tasks are linked to projects via `task.project_id`. Chain: task → project → program.

```jsx
{programs.map(program => {
  const progProjects = projects.filter(p => p.program_id === program.id);
  const progTasks = tasks.filter(t => progProjects.some(p => p.id === t.project_id));
  // Compute metrics...
  return (
    <div className="card p-4">
      <div className="flex justify-between items-center">
        <p className="text-xs font-bold">{program.name}</p>
        <HealthBadge health={health} />
      </div>
      <div className="grid grid-cols-4 gap-3 mt-3 text-[10px]">
        <div><span className="font-black">{rate}%</span> completion</div>
        <div><span className="font-black">{participants}</span> participants</div>
        <div><span className="font-black">{submitRate}%</span> reports</div>
      </div>
    </div>
  );
})}
```

---

## Global Filters (Mandatory)

Render a filter bar at the top of the page, below the header:

```jsx
<div className="flex flex-wrap gap-2 p-3 card">
  {/* Date Range */}
  <select value={filterWeek} onChange={...} className="...">
    <option value="">All Weeks</option>
    <option value="current">This Week</option>
    <option value="last">Last Week</option>
    <option value="month">This Month</option>
  </select>

  {/* Staff */}
  <select value={filterStaff} onChange={...}>
    <option value="">All Staff</option>
    {staffList.map(s => <option key={s.cid} value={s.cid}>{s.name}</option>)}
  </select>

  {/* Project */}
  <select value={filterProject} onChange={...}>
    <option value="">All Projects</option>
    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
  </select>

  {/* Program */}
  <select value={filterProgram} onChange={...}>
    <option value="">All Programs</option>
    {programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
  </select>

  {/* Blocker Type — only relevant for Section 4 */}
  <select value={filterBlockerType} onChange={...}>
    <option value="">All Blocker Types</option>
    <option value="dependency">Dependency</option>
    <option value="resource">Resource</option>
    <option value="communication">Communication</option>
    <option value="timeline">Timeline</option>
  </select>
</div>
```

**Filtering applies to all 7 sections.** Each section recomputes its metrics based on the active filters.

Use the same select styling as the admin work page:
```jsx
className="bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-2 text-[10px] font-bold outline-none text-[var(--text-primary)] appearance-none cursor-pointer"
```

---

## Role Restriction

Only Super Admin has access. The page already uses `DashboardLayout role="super_admin"` from the existing page template. No additional role logic needed — the layout handles redirect for unauthorized roles.

---

## Performance Requirements

- **Precompute** staff performance summaries in a single pass over tasks rather than per-user loops
- **Cache** weekly metrics by computing once into a lookup object: `weeklyMap[week_year] = { created, completed, carried, standups, retros }`
- **Precompute** blocker counts per project: `blockerCountByProject[projectId] = blockers.filter(b => tasksForProject.includes(b.task_id)).length`
- **Memoize** computed values using `useMemo` with filter dependencies
- Avoid re-filtering all tasks for every section — filter once, then pass filtered data to each section

**Recommended structure:**
```js
const filteredTasks = useMemo(() => {
  return tasks.filter(t => {
    if (filterStaff && t.user_id !== filterStaff) return false;
    if (filterProject && t.project_id !== parseInt(filterProject)) return false;
    // ... week filter, program filter
    return true;
  });
}, [tasks, filterStaff, filterProject, filterWeek, filterProgram]);

const filteredBlockers = useMemo(() => {
  return blockers.filter(b => {
    if (filterBlockerType && b.severity !== filterBlockerType) return false;
    // ... other filters
    return true;
  });
}, [blockers, filterBlockerType]);
```

---

## Data Aggregation Rules Summary

| Metric | Formula |
|---|---|
| Completion Rate | `completed_tasks / total_tasks` |
| Carry-over Rate | `carried_over_tasks / total_tasks` |
| Avg Resolution Time | `avg(resolved_at - created_at)` for resolved blockers |
| Velocity | `completed_tasks_this_week / count_of_weeks` per project |
| Blocker Density | `active_blockers / total_tasks` per project |
| Standup Compliance | `standups_submitted_this_week / active_staff_count` |
| Retro Compliance | `retros_submitted_this_week / active_staff_count` |
| Program Completion | `completed_tasks_for_program / total_tasks_for_program` |

---

## Acceptance Criteria

- [ ] Section 1 — 6 KPI cards render with correct computed values
- [ ] Section 2 — Staff performance grid with drill-down, sorted by completion rate ascending
- [ ] Section 3 — Project performance cards with health and velocity
- [ ] Section 4 — Blocker analytics with type breakdown, aging table, resolution time
- [ ] Section 5 — Carry-over analytics with distribution bar chart and leaderboard
- [ ] Section 6 — Weekly system health with compliance rates and 8-week trend table
- [ ] Section 7 — Program performance with completion rates and participant engagement
- [ ] Filters — Date range, Staff, Project, Program, Blocker type — all sections update when filters change
- [ ] All data is read-only — no edit/create/resolve actions
- [ ] No new API routes — uses only existing endpoints
- [ ] Uses existing `STATUS_CONFIG`, card/table patterns
- [ ] Precomputed metrics using `useMemo` — no per-user loops
- [ ] Wrapped in `DashboardLayout role="super_admin"`
- [ ] Build passes with zero errors
- [ ] No database changes
- [ ] No changes to other pages or routes
