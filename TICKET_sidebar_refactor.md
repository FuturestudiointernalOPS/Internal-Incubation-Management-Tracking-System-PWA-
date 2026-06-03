# Developer Ticket: Super Admin Sidebar Refactor

## File to Modify
`src/components/layout/DashboardLayout.js` — the `NAVIGATION_MATRIX.super_admin` array only.

## Objective

Reorganize the Super Admin navigation into 4 clear systems:

- **Programs** — external learning system
- **Projects** — internal execution units
- **Work** — task + blocker engine
- **Reports** — weekly human reporting

Without breaking existing routes or database logic.

---

## Scope

### DO NOT CHANGE
- Database schema
- Existing API endpoints
- Existing task/project/report logic
- Role permissions system

### ONLY CHANGE
- Sidebar structure (the `NAVIGATION_MATRIX.super_admin` array)
- Navigation grouping and labels

---

## Current Structure

```
DASHBOARD        /admin
PROGRAMS         /admin/programs, /admin/programs/new
PROGRESS         /admin/progress                         ← standalone top-level
COMMUNICATION    /admin/communications/campaigns, forms, contacts
                 /admin/pending-users, /admin/bulk-upload
KNOWLEDGE BASE   /admin/knowledge
REPORTS          /admin/reports/responses
                 /admin/op-reports
                 /admin/work                              ← buried in Reports
                 /admin/tasks                             ← buried in Reports
                 /admin/blockers                          ← buried in Reports
PROJECTS         /admin/projects
INTELLIGENCE     /admin/intelligence
```

---

## Target Structure

```
DASHBOARD        /admin
PROGRAMS         /admin/programs, /admin/programs/new
                 /admin/progress                          ← moved under Programs
PROJECTS         /admin/projects
WORK             /admin/work                              ← promoted to top-level
                 /admin/tasks                             ← moved from Reports
                 /admin/blockers                          ← moved from Reports
REPORTS          /admin/reports/responses
                 /admin/op-reports                        ← standups/retros/summary only
COMMUNICATION    /admin/communications/campaigns, forms, contacts
                 /admin/pending-users, /admin/bulk-upload
KNOWLEDGE BASE   /admin/knowledge
INTELLIGENCE     /admin/intelligence
```

---

## Phase 1 — Replace Navigation Matrix

Replace the `super_admin` entry in `NAVIGATION_MATRIX` (starts at line ~220 in `DashboardLayout.js`):

```js
super_admin: [
  { id: "dashboard", name: "DASHBOARD", icon: LayoutDashboard, href: "/admin" },

  {
    id: "programs",
    name: "PROGRAMS",
    icon: Briefcase,
    subItems: [
      { id: "all_programs", name: "ALL PROGRAMS", href: "/admin/programs" },
      { id: "create_program", name: "CREATE PROGRAM", href: "/admin/programs/new" },
      { id: "progress", name: "PROGRESS", href: "/admin/progress" },
      { id: "program_reports", name: "PROGRAM REPORTS", href: "/admin/reports/responses" },
    ],
  },

  { id: "projects", name: "PROJECTS", icon: Briefcase, href: "/admin/projects" },

  {
    id: "work",
    name: "WORK",
    icon: ListTodo,
    subItems: [
      { id: "work_hub", name: "WORK HUB", href: "/admin/work" },
      { id: "tasks", name: "TASKS", href: "/admin/tasks" },
      { id: "blockers", name: "BLOCKERS", href: "/admin/blockers" },
    ],
  },

  {
    id: "reports",
    name: "REPORTS",
    icon: BarChart3,
    subItems: [
      { id: "internal_reports", name: "INTERNAL REPORTS", href: "/admin/op-reports" },
    ],
  },

  {
    id: "communication",
    name: "COMMUNICATIONS",
    icon: Send,
    subItems: [
      { id: "campaigns", name: "CAMPAIGNS", href: "/admin/communications/campaigns" },
      { id: "forms", name: "FORMS", href: "/admin/communications/forms" },
      { id: "all_contacts", name: "CONTACTS", href: "/admin/communications/contacts" },
      { id: "pending_users", name: "PENDING USERS", href: "/admin/pending-users" },
      { id: "bulk_upload", name: "BULK UPLOAD", href: "/admin/bulk-upload" },
    ],
  },

  { id: "knowledge", name: "KNOWLEDGE BASE", icon: Library, href: "/admin/knowledge" },

  { id: "intelligence", name: "INTELLIGENCE", icon: TrendingUp, href: "/admin/intelligence" },
],
```

---

## Phase 2 — Add Icon Import

Add `ListTodo` to the lucide-react import at the top of `DashboardLayout.js`:

```js
import {
  ...
  ListTodo,
  ...
} from "lucide-react";
```

---

## What Each Change Does

| Change | Rationale |
|---|---|
| PROGRESS moved under PROGRAMS | Progress is a sub-function of programs, not a top-level concept |
| PROGRAM REPORTS added under PROGRAMS | Report responses are program-level form submissions |
| WORK promoted to top-level | Tasks/blockers are core execution, not a sub-section of reports |
| TASKS moved under WORK | Tasks belong in the execution engine |
| BLOCKERS moved under WORK | Blockers belong with tasks |
| WORK HUB is primary Work entry point | `/admin/work` is the command center |
| Internal Reports under REPORTS only | Standups/retros/summary — no task/blocker CRUD |
| REPORT RESPONSES removed from REPORTS | Moved under PROGRAMS (they're program form submissions) |

---

## Safety Checklist

- [ ] `/admin` — unchanged
- [ ] `/admin/programs` — unchanged
- [ ] `/admin/programs/new` — unchanged
- [ ] `/admin/progress` — unchanged
- [ ] `/admin/projects` — unchanged
- [ ] `/admin/work` — unchanged
- [ ] `/admin/tasks` — unchanged
- [ ] `/admin/blockers` — unchanged
- [ ] `/admin/op-reports` — unchanged
- [ ] `/admin/reports/responses` — unchanged
- [ ] `/admin/communications/campaigns` — unchanged
- [ ] `/admin/communications/forms` — unchanged
- [ ] `/admin/communications/contacts` — unchanged
- [ ] `/admin/pending-users` — unchanged
- [ ] `/admin/bulk-upload` — unchanged
- [ ] `/admin/knowledge` — unchanged
- [ ] `/admin/intelligence` — unchanged
- [ ] All 18 routes still exist and work
- [ ] No database changes
- [ ] No API changes
- [ ] Other role sidebars (staff, pm, teacher) unchanged
- [ ] Build passes with zero errors

---

## Acceptance Criteria

- 8 top-level modules: Dashboard, Programs, Projects, Work, Reports, Communications, Knowledge Base, Intelligence
- Each concept has exactly one primary location
- No duplicate entry points for the same data
- All existing routes still accessible
- Build passes with no errors
- Feature parity is 100% preserved
