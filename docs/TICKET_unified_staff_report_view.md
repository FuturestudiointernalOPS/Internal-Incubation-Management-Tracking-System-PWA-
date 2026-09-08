# Developer Ticket: Unified Staff Report View (Super Admin)

## File to Modify
`src/app/admin/op-reports/page.js`

## Overview

The Super Admin Internal Reports view (`/admin/op-reports`) currently displays staff standups and retros in an outdated flat format — plain text lists, JSON-parsed bullet arrays, and form-style summaries. This does not reflect how staff now structure their weekly work through the task system.

The view must be redesigned to display each weekly report as a structured, relational, row-based view that mirrors the actual task data model.

**No new API routes. No database changes. Read-only display refactor.**

---

## Data Sources

All data already available via existing API endpoints:

| Endpoint | Data |
|---|---|
| `GET /api/op-reports` | Reports metadata (user, week, type, status, timestamp) |
| `GET /api/tasks?user_id=X&week=N&year=Y` | Tasks with blockers, subtasks, project_id, status |
| `GET /api/projects` | Project name lookup |
| `GET /api/blockers?user_id=X` | Blocker details |
| `GET /api/projects/assignments?user_cid=X` | Project member info |

---

## What to Change

### Keep the existing structure:
- DashboardLayout wrapper
- Header with navigation back button
- Filter bar (search, user, type, month, week)
- Tab navigation (feed, monthly, tasks, blockers, trends)
- The 3 stat cards in the header

### Replace the Report Detail Modal (`ReportDetailModal` component):
The current modal renders flat form fields (priorities list, deliverables list, blocker description text, etc.). This must be replaced with a **task-table view** that shows the actual task data for that report's week.

---

## New Detail Modal Design

When a Super Admin clicks a report, the modal should show:

### 1. Week Header (Existing — Keep)
```
Staff Name | Week 24 · 2026 | Stand-Up | Submitted June 10
```

### 2. Task Table (Replace current form sections)

Each task from that week displays as a row:

| Task | Project | Category | Status | Start | End | Blockers | Collaborators | Subtasks | Carry-over |
|---|---|---|---|---|---|---|---|---|---|

**Implementation:**

```jsx
{/* Fetch tasks for this report's week + user */}
{(() => {
  const [weekTasks, setWeekTasks] = useState([]);
  useEffect(() => {
    fetch(`/api/tasks?user_id=${report.user_id}&week=${report.week_number}&year=${report.year}`)
      .then(r => r.json())
      .then(d => { if (d.success) setWeekTasks(d.tasks || []); });
  }, [report]);

  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--border-primary)]">
      <table className="w-full">
        <thead>
          <tr className="bg-tertiary">
            <th className="text-left px-3 py-2 text-[8px] font-semibold text-slate-500 uppercase tracking-wider">Task</th>
            <th className="text-left px-3 py-2 text-[8px] font-semibold text-slate-500 uppercase tracking-wider">Project</th>
            <th className="text-left px-3 py-2 text-[8px] font-semibold text-slate-500 uppercase tracking-wider">Category</th>
            <th className="text-left px-3 py-2 text-[8px] font-semibold text-slate-500 uppercase tracking-wider">Status</th>
            <th className="text-left px-3 py-2 text-[8px] font-semibold text-slate-500 uppercase tracking-wider">Start</th>
            <th className="text-left px-3 py-2 text-[8px] font-semibold text-slate-500 uppercase tracking-wider">End</th>
            <th className="text-center px-3 py-2 text-[8px] font-semibold text-slate-500 uppercase tracking-wider">Blockers</th>
            <th className="text-center px-3 py-2 text-[8px] font-semibold text-slate-500 uppercase tracking-wider">Collab</th>
            <th className="text-center px-3 py-2 text-[8px] font-semibold text-slate-500 uppercase tracking-wider">Subtasks</th>
            <th className="text-center px-3 py-2 text-[8px] font-semibold text-slate-500 uppercase tracking-wider">Carry</th>
          </tr>
        </thead>
        <tbody>
          {weekTasks.map(task => (
            <React.Fragment key={task.id}>
              <tr className="border-b border-[var(--border-primary)]/40 hover:bg-tertiary/30">
                <td className="px-3 py-2.5 text-[10px] font-bold text-[var(--text-primary)]">{task.title}</td>
                <td className="px-3 py-2.5 text-[9px] text-slate-500">{projectName || "—"}</td>
                <td className="px-3 py-2.5 text-[9px] text-slate-500">{task.category || "—"}</td>
                <td className="px-3 py-2.5">{renderStatusBadge(task.status)}</td>
                <td className="px-3 py-2.5 text-[9px] text-slate-500">{formatDate(task.start_date)}</td>
                <td className="px-3 py-2.5 text-[9px] text-slate-500">{formatDate(task.end_date)}</td>
                <td className="px-3 py-2.5 text-center">
                  {task.blockers?.length > 0 ? (
                    <span className="text-[9px] font-bold text-rose-400">{task.blockers.length}</span>
                  ) : <span className="text-slate-600">—</span>}
                </td>
                <td className="px-3 py-2.5 text-center text-[9px] text-slate-500">—</td>
                <td className="px-3 py-2.5 text-center">
                  {task.subtasks?.length > 0 ? (
                    <span className="text-[9px] font-bold text-indigo-400">{task.subtasks.length}</span>
                  ) : <span className="text-slate-600">—</span>}
                </td>
                <td className="px-3 py-2.5 text-center">
                  {task.status === "carried_over" && (
                    <span className="text-[8px] font-bold text-indigo-400">✓</span>
                  )}
                </td>
              </tr>
              {/* Subtask rows */}
              {task.subtasks?.length > 0 && (
                <tr className="bg-tertiary/20">
                  <td colSpan={10} className="px-6 py-1.5">
                    <div className="space-y-0.5">
                      {task.subtasks.map(sub => (
                        <div key={sub.id} className="flex items-center gap-2 text-[9px]">
                          <span className="text-slate-500">↳</span>
                          <span className="font-medium">{sub.title}</span>
                          <span className={`text-[7px] font-bold px-1 py-0.5 rounded ${
                            sub.status === "completed" ? "bg-emerald-500/10 text-emerald-400" : "bg-slate-500/10 text-slate-400"
                          }`}>{sub.status}</span>
                        </div>
                      ))}
                    </div>
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
})()}
```

### 3. Blockers Section (Below Task Table)

Show blockers grouped by task, not as flat text:

```jsx
{weekTasks.some(t => t.blockers?.length > 0) && (
  <div className="space-y-2">
    <p className="text-[9px] font-black text-rose-400 uppercase tracking-widest">Blockers</p>
    {weekTasks.filter(t => t.blockers?.length > 0).map(task => (
      <div key={task.id} className="space-y-1">
        <p className="text-[10px] font-bold text-[var(--text-primary)]">{task.title}</p>
        {task.blockers.map(b => (
          <div key={b.id} className="flex items-center gap-2 pl-4 text-[9px]">
            <Shield className={`w-2.5 h-2.5 ${b.status === 'active' ? 'text-rose-400' : 'text-emerald-400'}`} />
            <span className="font-medium">{b.title}</span>
            <span className={`text-[7px] font-bold px-1 py-0.5 rounded ${b.status === 'active' ? 'bg-rose-500/10 text-rose-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
              {b.status}
            </span>
          </div>
        ))}
      </div>
    ))}
  </div>
)}
```

### 4. Remove Old Form Sections

Delete the following from `ReportDetailModal`:
- `standupItems` (the old `Section` components with `top_priorities`, `expected_deliverables`, `projects_tasks`, etc.)
- `retroItems` (the old `Section` components with `completed_work`, `unfinished_tasks`, `week_status`, etc.)
- The `Section` helper component (no longer needed)
- The `InfoBlock` helper component (no longer needed)
- The `parseJsonArray` helper (no longer needed)

---

## What to Preserve

| Element | Preserve? |
|---|---|
| Report list (`filteredReports.map`) | ✅ Keep |
| User stats cards | ✅ Keep |
| Filter bar (search, user, type, month) | ✅ Keep |
| Tab navigation (feed, monthly, tasks, blockers, trends) | ✅ Keep |
| User timeline modal | ✅ Keep |
| Monthly breakdown tab | ✅ Keep |
| Tasks tab | ✅ Keep, update to fetch fresh per week |
| Blockers tab | ✅ Keep |
| Trends tab | ✅ Keep |
| Report card (`ReportCard` component) | ✅ Keep |
| Stat card (`StatCard` component) | ✅ Keep |
| PDF export button | ✅ Keep |
| `ReportDetailModal` wrapper | ✅ Keep (replace inner content) |

---

## Styling Reference

Use existing patterns from the same file and from `src/app/staff/op-report/page.js`:

| Element | Classes |
|---|---|
| Table header | `className="text-left px-3 py-2 text-[8px] font-semibold text-slate-500 uppercase tracking-wider"` |
| Table cell | `className="px-3 py-2.5 text-[10px]"` |
| Status badge | Reuse `STATUS_CONFIG` from the file top (already imported) |
| Modal card | `className="card w-full max-w-4xl space-y-6"` (wider to fit task table) |

---

## Acceptance Criteria

- [ ] Clicking a report opens the modal with a task table, not flat form fields
- [ ] Each task row shows: name, project, category, status, dates, blockers count, collaborators, subtasks, carry-over
- [ ] Subtasks expand beneath parent task rows
- [ ] Blockers show inline per task with active/resolved badges
- [ ] All existing tabs (feed, monthly, tasks, blockers, trends) continue working
- [ ] Filters still work
- [ ] PDF export still works
- [ ] Old form sections (priorities, deliverables, etc.) are removed
- [ ] No new API routes — uses existing `GET /api/tasks?user_id=X&week=N&year=Y`
- [ ] Build passes with zero errors
- [ ] No database changes
