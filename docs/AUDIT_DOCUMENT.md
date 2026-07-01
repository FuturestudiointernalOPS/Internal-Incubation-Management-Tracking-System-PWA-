# Platform Audit Document

---

## 1. DASHBOARD (Super Admin /admin)

**Navigation Path:** `/admin`
**Purpose:** Central super admin command center providing at-a-glance visibility into program operations, internal operations, team accountability, risks, blockers, and historical intelligence.
**Intended Users:** Super Admin
**Data Owned:** Tasks, blockers, notifications, programs, staff activity, reports
**Available Tabs / Sections:**
- Header with [+ New Program] button
- Calendar widget (7-column grid, up to 3 tasks per day, month navigation, Today button, legend for status dots: Pending/Active/Blocked/Done/Carryover)
- Upcoming Summary (today/tomorrow tasks from calendarTasks, max 2 per day)
- Tasks Summary Card (Active/Blocked/Done counts, navigates to `/admin/tasks`)
- Blockers Summary Card (Active/High-Critical counts, navigates to `/admin/blockers`)
- Assigned To Me (Accept/Decline/Complete workflow via `POST /api/tasks/assignment-action`)
- Notifications / Approval Queue (from `/api/notifications?recipient_id=sa`, Approve Access button)
- SECTION A - Program Operations (Stat cards: Active Programs, Total Participants, Operational Staff, Projects; Activity Feed from `/api/superadmin/full-state`; Active Programs List)
- SECTION B - Internal Operations (Stat cards: Monday Standups, Friday Retros, Blockers Reported; Blocker Rate %; Nav Cards: Work Management, Tasks, Blockers, Projects)
- SECTION C - Team Accountability (Consistent/At Risk/Inactive counts; Expandable Staff Table)
- SECTION D - Risks & Blockers (Latest 5 Active Blockers — view-only, no Resolve button; Quick Actions: View All Blockers, Blocker Reports)
- SECTION E - Historical Intelligence (Report Archive, Reports Hub, Report Responses navigation cards)
- Task Detail Drawer modal
**Available Filters:** Calendar month navigation
**Available Actions:**
- [+ New Program] navigation
- Navigate to all section-specific detail pages
- Accept/Decline/Complete tasks via assignment-action endpoint
- Approve Access from Notifications
- View Task Detail Drawer
**Relationships:** Connects to Programs, Tasks, Blockers, Work, Reports, Intelligence sections; data sourced from `/api/tasks`, `/api/notifications`, `/api/superadmin/full-state`, `/api/blockers`
**Known Issues:** Not specified.

---

## 2. PROGRAMS

### 2.1 All Programs (/admin/programs)

**Navigation Path:** `/admin/programs`
**Purpose:** Central listing and management of all programs with CRUD operations.
**Intended Users:** Super Admin, Program Manager
**Data Owned:** Programs, program members, knowledge nodes, KPIs
**Available Tabs:** Active Programs, Pending, Archived, Completed, All Programs
**Available Filters:** Search by name
**Available Actions:**
- Navigate to program detail
- Edit (opens edit modal)
- Archive
- Restore
- Delete (permanent)
- Edit modal fields: name, PM, staff, knowledge note, duration, status, curriculum PDFs, groups, concept note, KPIs
- View status badge, PM, Engagement (members + progress), Admin actions per row
**Relationships:** Data from `/api/pm/programs`, `/api/contacts/full-state`, `/api/families`, `/api/knowledge`
**Known Issues:** Not specified.

### 2.2 Create Program (/admin/programs/new)

**Navigation Path:** `/admin/programs/new`
**Purpose:** Wizard-style form for creating a new program from scratch.
**Intended Users:** Super Admin, Program Manager
**Data Owned:** New program record
**Available Tabs:** N/A (single-page form)
**Available Filters:** N/A
**Available Actions:**
- Basic Identity: name, start/end dates
- Concept Note: rich text / external link / upload document
- Knowledge Base Integration: select or create KB node
- Materials Upload: multi-file
- Contact Group Assignment: select or create group with registration URL
- Assigned Managers: PM + collaborators
- Strategic KPIs configuration
- Submit (POST `/api/pm/programs`)
**Relationships:** Creates a new program linked to Knowledge Base nodes, contact groups, and KPI targets
**Known Issues:** Not specified.

### 2.3 Progress (/admin/progress)

**Navigation Path:** `/admin/progress`
**Purpose:** Visual card layout showing per-program progress with animated bars and completion indices.
**Intended Users:** Super Admin, Program Manager
**Data Owned:** Program progress metrics
**Available Tabs:** N/A (single-page card layout)
**Available Filters:** Search by name
**Available Actions:**
- Click card to navigate to `/admin/programs/{id}`
**Relationships:** Data from `/api/pm/programs`
**Known Issues:** Not specified.

### 2.4 Program Reports (/admin/reports/responses)

**Navigation Path:** `/admin/reports/responses`
**Purpose:** View PM-submitted weekly report responses with detail inspection and PDF export.
**Intended Users:** Super Admin, Program Manager
**Data Owned:** Weekly report responses, teacher feedback
**Available Tabs:** N/A (single-page card list)
**Available Filters:** Search by teacher_name / progress_notes; Filter by program
**Available Actions:**
- View card with week badge, program name, reception score, Eye button
- Open detail modal with 7 sections: Weekly Overview, Assignment Tracking, Participation, Delivery Feedback, Issues, Next Week Planning, Weekly Notes
- Export PDF via `window.print()`
**Relationships:** Data from `/api/teacher/reports`, `/api/pm/programs`
**Known Issues:** Not specified.

---

## 3. PROJECTS

### 3.1 All Projects (/admin/projects)

**Navigation Path:** `/admin/projects`
**Purpose:** Central listing and management of all projects with create, edit, and filtering capabilities.
**Intended Users:** Super Admin, Admin
**Data Owned:** Projects, project members, tasks, blockers, progress
**Available Tabs:** N/A (single-page table)
**Available Filters:** Search by name; Filter by status dropdown (All / Active / Completed / Paused)
**Available Actions:**
- Create modal: name, type, lead, collaborators (`POST /api/projects` + `POST /api/projects/members`)
- Edit modal on double-click: name, type, status, lead, collaborators (`PUT /api/projects`)
- Add / remove collaborators
- View table columns: Project, Status, Tasks, Completed, Blockers, Progress bar
**Relationships:** Data from `/api/admin/projects`, `/api/admin/analytics`, `/api/contacts`
**Known Issues:** Not specified.

### 3.2 My Projects (/staff)

**Navigation Path:** `/staff`
**Purpose:** Staff-facing dashboard showing quick actions, assigned tasks, and a personal projects table with update capabilities.
**Intended Users:** Staff
**Data Owned:** Personal tasks, personal project assignments, personal blockers
**Available Tabs / Sections:**
- Quick Actions: Standup, Retro, Projects navigation
- Assigned To Me with Accept/Decline/Complete
- My Projects table: Project, Role (Owner/Collaborator), Tasks, Blockers, Post Update button
- Project Blockers list with Resolve button
- Weekly Update modal: overall_status, accomplishments, current_focus, blockers, next_steps
- Task Detail Drawer with status update buttons
**Available Filters:** N/A (personal scope)
**Available Actions:**
- Accept/Decline/Complete assigned tasks
- Post Update per project
- Resolve blockers
- View Task Detail Drawer
**Relationships:** Data from `/api/tasks`, `/api/tasks?assigned_to=X`, `/api/admin/projects`, `/api/projects?user_cid=X`, `/api/admin/blockers?status=active`
**Known Issues:** Not specified.

### 3.3 Project Detail (/admin/projects/[id])

**Navigation Path:** `/admin/projects/[id]`
**Purpose:** Comprehensive single-project view with 7 tabs for full project management.
**Intended Users:** Super Admin, Admin, Staff
**Data Owned:** Single project record, tasks, blockers, team, updates, approvals, timeline
**Available Tabs:**
1. **OVERVIEW** — Progress bar, Task breakdown grid (Completed / In Progress / Blocked / Carried Over / Pending), Timeline Coverage
2. **TASKS (N)** — Create Task form (name, description, assignee, start/due/time); 6 filter pills (All / completed / in_progress / blocked / carried_over / pending); Task table with inline status select, due date, blockers count, subtasks count
3. **BLOCKERS (N)** — 3 filter pills (All / active / resolved); Blocker cards with severity and status
4. **TEAM (N)** — Project Owner section, Collaborators list with Remove, Add Collaborator select
5. **UPDATE** — Weekly update form (status / accomplishments / focus / blockers / next steps); Previous updates list
6. **APPROVALS / REQUESTS (N)** — Pending requests with Approve/Reject; History section
7. **TIMELINE** — Chronological feed with colored dots (COMPLETED / BLOCKED / CREATED / ASSIGNED)
**Available Filters:** Per-tab filter pills (status-based)
**Available Actions:**
- Create task, inline status changes
- Add / remove collaborators
- Submit weekly updates
- Approve / reject requests
- View timeline
**Relationships:** Data from `/api/admin/projects/[id]`, `/api/tasks`, `/api/contacts`, `/api/admin/projects/[id]/updates`, `/api/admin/projects/[id]/approvals`, `/api/projects/members`
**Known Issues:** Not specified.

---

## 4. WORK

### 4.1 Work Hub (/admin/work)

**Navigation Path:** `/admin/work`
**Purpose:** Central work management with table and Kanban board views for all tasks across the platform.
**Intended Users:** Super Admin
**Data Owned:** All tasks, projects, categories
**Available Views:**
- Table view
- Kanban Board view
**Available Filters:**
- Search
- Status
- Project
- Category
- User
- Date (All Time / This Week / Last Week / This Month)
**Available Actions:**
- View stats row: Total, Active, Completed, Carried, Blockers, Pending, Blocked
- Table columns: Task, Project/Category, Owner, Status, Blockers, Week
- Board columns: Pending, Pending Approval, In Progress, Blocked, Carried Over, Completed
- Approve / Reject for `pending_project_approval` tasks in task detail modal
**Relationships:** Data from `/api/tasks`, `/api/projects?include_archived=true`, `/api/categories`
**Known Issues:** Not specified.

### 4.2 Tasks (/admin/tasks)

**Navigation Path:** `/admin/tasks`
**Purpose:** Dedicated task management page with sorting, filtering, and inline actions.
**Intended Users:** Super Admin
**Data Owned:** All tasks across the platform
**Available Tabs:** N/A (single-page table)
**Available Filters:**
- Search
- User
- Status
- Project
- Sort: Newest, Oldest, Most Carried Over, Recently Updated
**Available Actions:**
- Inline per row: Mark In Progress, Mark Blocked, Mark Completed, View Details
- Stats row: Total, Pending, In Progress, Blocked, Completed, Carried Over
- Table columns: Task, Owner, Project, Status, Created (week/year), Updated, Carry-Over Count, Blockers, Actions
- Task Detail modal with status change, carry-over info, linked blockers
**Relationships:** Data from `/api/tasks?sort=X`, `/api/projects`
**Known Issues:** Not specified.

### 4.3 Blockers (/admin/blockers)

**Navigation Path:** `/admin/blockers`
**Purpose:** Central blocker tracking with severity, status, and resolution management.
**Intended Users:** Super Admin (view-only for resolution)
**Data Owned:** All blockers
**Available Tabs:** N/A (single-page table)
**Available Filters:**
- Search
- User
- Status (All / active / resolved)
**Available Actions:**
- Stats row: Active, Resolved, Total
- Table columns: Blocker, Owner, Linked Task, Severity (Low / Medium / High / Critical), Status, Created, Updated/Resolved
- Sorting: active first, then newest
- Detail modal: title, description, owner, linked task, severity, status, created date, resolved at
- Super Admin CANNOT resolve blockers (view-only notice in modal)
**Relationships:** Data from `/api/blockers`, `/api/tasks`
**Known Issues:** Super Admin has view-only access on the detail modal — no Resolve button is available.

---

## 5. REPORTS

### 5.1 Reports Placeholder (/admin/reports)

**Navigation Path:** `/admin/reports`
**Purpose:** Placeholder page for a module that is not yet built.
**Intended Users:** All roles with access to this menu item
**Data Owned:** N/A
**Available Tabs:** N/A
**Available Filters:** N/A
**Available Actions:** N/A — Shows "Module Deployment Pending" message with pulsing icon
**Relationships:** N/A
**Known Issues:** Module is not built / not deployed.

### 5.2 Internal Reports — Operational Reports (/admin/op-reports)

**Navigation Path:** `/admin/op-reports`
**Purpose:** Operational reporting hub covering standups, retros, tasks, blockers, and trends over time.
**Intended Users:** Super Admin, Admin
**Data Owned:** Operational reports, tasks data, blockers data
**Available Tabs:**
1. Report Feed
2. Monthly Breakdown
3. Tasks
4. Blockers
5. Trends
**Available Filters:**
- Primary: Search, User, Type (standup / retro), Month, Project
- Secondary (per-tab): Status, Blocker, Carry-Over
- Blockers tab: Week / Status selectors, effort analysis by user, blocker lifecycle table
- Trends tab: Monthly volume chart, blockers over time, recently active staff
**Available Actions:**
- Report detail modal with Export PDF (html2canvas + jsPDF)
**Relationships:** Data from `/api/op-reports`, `/api/projects`, `/api/blockers`, `/api/tasks`
**Known Issues:** Not specified.

---

## 6. INTELLIGENCE

**Navigation Path:** `/admin/intelligence`
**Purpose:** High-level analytics and intelligence dashboard with 7 insight sections covering staff, projects, blockers, carry-overs, system health, and programs.
**Intended Users:** Super Admin
**Data Owned:** Aggregated analytics across all system modules
**Available Tabs / Sections:**
1. Global Overview (6 KPI cards)
2. Staff Performance
3. Project Performance
4. Blocker Intelligence
5. Carry-Over Analytics
6. Weekly System Health
7. Program Performance
**Available Filters:**
- Week
- Staff
- Project
- Program
- Blocker Type
- Refresh button
**Available Actions:** View KPI cards; filter and refresh data
**Relationships:** Data from `/api/tasks`, `/api/blockers`, `/api/projects`, `/api/programs`, `/api/op-reports`, `/api/contacts`
**Known Issues:** Not specified.

---

## 7. COMMUNICATIONS

### 7.1 Campaigns (/admin/communications/campaigns)

**Navigation Path:** `/admin/communications/campaigns`
**Purpose:** Create and manage multi-step email campaigns with form binding and target group selection.
**Intended Users:** Super Admin
**Data Owned:** Campaigns, email sequences, campaign targets
**Available Tabs:** All, Running, Upcoming, Completed
**Available Filters:** By tab (implicit filter by campaign status)
**Available Actions:**
- Create modal: name, form binding, sequence pipeline (multi-step emails with delays), target selection (families or individuals)
- Edit modal: name, master switch, steps, targets
- DESTROY (requires PIN 147369)
**Relationships:** Data from `/api/campaigns`, `/api/contacts`, `/api/forms`, `/api/families`
**Known Issues:** Not specified.

### 7.2 Forms (/admin/communications/forms)

**Navigation Path:** `/admin/communications/forms`
**Purpose:** Build form-based surveys and view collected responses.
**Intended Users:** Super Admin
**Data Owned:** Forms, questions, responses
**Available Views:** List, Builder, Responses
**Available Filters:** N/A (view-switching)
**Available Actions:**
- Form builder: name, target group, text and yes/no questions
- Responses view: respondent name, group, date, details modal
**Relationships:** Data from `/api/forms`, `/api/families`, `/api/responses`
**Known Issues:** Not specified.

### 7.3 Contacts (/admin/communications/contacts)

**Navigation Path:** `/admin/communications/contacts`
**Purpose:** Central contact management with segments, bulk operations, and member lifecycle management.
**Intended Users:** Super Admin
**Data Owned:** Contacts, segments, sub-teams
**Available Tabs / Sections:**
- Segments sidebar
- Status pills (All / Active / Inactive / Pending)
- Sub-Team tabs
**Available Filters:**
- Search
- Segments sidebar (New Segment, Edit Segment)
- Access Keys
- Copy Join Link
**Available Actions:**
- Bulk CSV upload
- Add Member modal
- Per-row: Toggle Status, Edit, Pivot to Entity, Reset Password
- Bulk: Approve Selected, Approve All
- Sidebar: New Segment, Edit Segment, Access Keys, Copy Join Link
**Relationships:** Data from `/api/contacts/full-state`, `/api/pm/programs`
**Known Issues:** Not specified.

### 7.4 Pending Users (/admin/pending-users)

**Navigation Path:** `/admin/pending-users`
**Purpose:** Review and process user registration requests.
**Intended Users:** Super Admin
**Data Owned:** Pending user registrations
**Available Tabs:** N/A (single-page)
**Available Filters:** Search by name / email
**Available Actions:**
- 3 summary cards: Total Pending, Groups, Awaiting Review
- Grouped user tables (expandable)
- Per-user: Approve (`POST /api/admin/approve-user`), Reject (`POST /api/admin/reject-user`)
- Bulk Upload button (navigates to `/admin/bulk-upload`)
**Relationships:** Connected to /admin/bulk-upload page
**Known Issues:** Not specified.

### 7.5 Bulk Upload (/admin/bulk-upload)

**Navigation Path:** `/admin/bulk-upload`
**Purpose:** Page for bulk user upload operations (referenced from Pending Users page).
**Intended Users:** Super Admin
**Data Owned:** N/A
**Available Tabs:** N/A
**Available Filters:** N/A
**Available Actions:** N/A
**Relationships:** Referenced from `/admin/pending-users` via Bulk Upload button
**Known Issues:** Minimal detail available — further inspection of the page is needed.

---

## 8. KNOWLEDGE BASE

**Navigation Path:** `/admin/knowledge`
**Purpose:** Central repository for knowledge articles and documents with PDF viewing and search capabilities.
**Intended Users:** Super Admin
**Data Owned:** Knowledge nodes, PDF documents
**Available Tabs:** Active Records, Archive
**Available Filters:** 2-panel layout: PDF viewer (left) + search / notes list (right)
**Available Actions:**
- Create Node (title, description, PDFs)
- Edit
- Archive / Restore
- Delete
**Relationships:** Data from `/api/knowledge`, Supabase storage
**Known Issues:** Not specified.

---

## APPENDIX: Role Navigation Summary

| Role | Menu Count | Menus |
|---|---|---|
| super_admin | 8 | DASHBOARD, PROGRAMS, PROJECTS, WORK, REPORTS, COMMUNICATIONS, KNOWLEDGE BASE, INTELLIGENCE |
| admin | 5 | DASHBOARD, TEAM SETTINGS, PROJECTS, ACTIVITY LOGS, REPORTS |
| program_manager | 5 | DASHBOARD, PROGRAMS, COMMUNICATION, PROGRESS HUB, REPORTS |
| staff | 2 | DASHBOARD, REPORTS |
| teacher | 5 | DASHBOARD, PROGRAMS, SESSIONS, SUBMISSIONS, REPORTS |
| participant | 1 | PROJECTS |
