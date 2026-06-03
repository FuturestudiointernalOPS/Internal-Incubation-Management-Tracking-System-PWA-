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

## Acceptance Criteria

- [ ] Section 1 — 6 KPI cards render with correct computed values
- [ ] Section 2 — Staff performance grid with drill-down
- [ ] Section 3 — Project performance cards with health and velocity
- [ ] All data is read-only — no edit/create/resolve actions
- [ ] No new API routes — uses only existing endpoints
- [ ] Uses existing `STATUS_CONFIG`, card/table patterns
- [ ] Wrapped in `DashboardLayout role="super_admin"`
- [ ] Build passes with zero errors
- [ ] No database changes
- [ ] No changes to other pages or routes
