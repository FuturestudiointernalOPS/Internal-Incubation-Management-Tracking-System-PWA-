# Graph Report - src  (2026-07-01)

## Corpus Check
- Large corpus: 329 files · ~238,991 words. Semantic extraction will be expensive (many Claude tokens). Consider running on a subfolder, or use --no-semantic to run AST-only.

## Summary
- 949 nodes · 1312 edges · 183 communities (128 shown, 55 thin omitted)
- Extraction: 62% EXTRACTED · 38% INFERRED · 0% AMBIGUOUS · INFERRED: 501 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 45|Community 45]]
- [[_COMMUNITY_Community 46|Community 46]]
- [[_COMMUNITY_Community 47|Community 47]]
- [[_COMMUNITY_Community 48|Community 48]]
- [[_COMMUNITY_Community 49|Community 49]]
- [[_COMMUNITY_Community 50|Community 50]]
- [[_COMMUNITY_Community 51|Community 51]]
- [[_COMMUNITY_Community 52|Community 52]]
- [[_COMMUNITY_Community 53|Community 53]]
- [[_COMMUNITY_Community 54|Community 54]]
- [[_COMMUNITY_Community 55|Community 55]]
- [[_COMMUNITY_Community 56|Community 56]]
- [[_COMMUNITY_Community 57|Community 57]]
- [[_COMMUNITY_Community 58|Community 58]]
- [[_COMMUNITY_Community 60|Community 60]]
- [[_COMMUNITY_Community 61|Community 61]]
- [[_COMMUNITY_Community 63|Community 63]]
- [[_COMMUNITY_Community 64|Community 64]]
- [[_COMMUNITY_Community 66|Community 66]]
- [[_COMMUNITY_Community 67|Community 67]]
- [[_COMMUNITY_Community 69|Community 69]]
- [[_COMMUNITY_Community 70|Community 70]]
- [[_COMMUNITY_Community 71|Community 71]]
- [[_COMMUNITY_Community 72|Community 72]]
- [[_COMMUNITY_Community 73|Community 73]]
- [[_COMMUNITY_Community 74|Community 74]]
- [[_COMMUNITY_Community 75|Community 75]]
- [[_COMMUNITY_Community 76|Community 76]]
- [[_COMMUNITY_Community 77|Community 77]]
- [[_COMMUNITY_Community 78|Community 78]]
- [[_COMMUNITY_Community 79|Community 79]]
- [[_COMMUNITY_Community 80|Community 80]]
- [[_COMMUNITY_Community 87|Community 87]]
- [[_COMMUNITY_Community 88|Community 88]]
- [[_COMMUNITY_Community 89|Community 89]]
- [[_COMMUNITY_Community 91|Community 91]]
- [[_COMMUNITY_Community 92|Community 92]]
- [[_COMMUNITY_Community 93|Community 93]]
- [[_COMMUNITY_Community 118|Community 118]]
- [[_COMMUNITY_Community 119|Community 119]]
- [[_COMMUNITY_Community 120|Community 120]]
- [[_COMMUNITY_Community 121|Community 121]]
- [[_COMMUNITY_Community 122|Community 122]]
- [[_COMMUNITY_Community 123|Community 123]]
- [[_COMMUNITY_Community 132|Community 132]]
- [[_COMMUNITY_Community 133|Community 133]]
- [[_COMMUNITY_Community 134|Community 134]]
- [[_COMMUNITY_Community 135|Community 135]]
- [[_COMMUNITY_Community 136|Community 136]]
- [[_COMMUNITY_Community 137|Community 137]]
- [[_COMMUNITY_Community 138|Community 138]]
- [[_COMMUNITY_Community 139|Community 139]]
- [[_COMMUNITY_Community 140|Community 140]]
- [[_COMMUNITY_Community 176|Community 176]]
- [[_COMMUNITY_Community 181|Community 181]]

## God Nodes (most connected - your core abstractions)
1. `initDb()` - 206 edges
2. `requireAuth()` - 171 edges
3. `getSession()` - 33 edges
4. `useI18n()` - 31 edges
5. `logAuditEvent()` - 10 edges
6. `GET()` - 9 edges
7. `GET()` - 9 edges
8. `recalculateKpiProgress()` - 9 edges
9. `MicrosoftCalendarProvider` - 9 edges
10. `PUT()` - 8 edges

## Surprising Connections (you probably didn't know these)
- `SubmissionsHub()` --calls--> `useI18n()`  [INFERRED]
  app/teacher/reviews/page.js → lib/i18n.js
- `TeacherCalendar()` --calls--> `useI18n()`  [INFERRED]
  app/teacher/sessions/page.js → lib/i18n.js
- `AdminProjects()` --calls--> `useI18n()`  [INFERRED]
  app/admin/projects/page.js → lib/i18n.js
- `ProjectDetail()` --calls--> `useI18n()`  [INFERRED]
  app/admin/projects/[id]/page.js → lib/i18n.js
- `ProjectKanbanBoard()` --calls--> `useI18n()`  [INFERRED]
  app/admin/work/page.js → lib/i18n.js

## Communities (183 total, 55 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.05
Nodes (31): GET(), POST(), POST(), GET(), POST(), POST(), POST(), GET() (+23 more)

### Community 1 - "Community 1"
Cohesion: 0.06
Nodes (37): GET(), POST(), GET(), PUT(), ACCESS_LEVELS, assignResponsibility(), createSession(), destroySession() (+29 more)

### Community 2 - "Community 2"
Cohesion: 0.06
Nodes (29): GET(), POST(), PATCH(), GET(), POST(), GET(), POST(), POST() (+21 more)

### Community 3 - "Community 3"
Cohesion: 0.08
Nodes (24): DELETE(), GET(), POST(), PUT(), GET(), getSessionCid(), POST(), GET() (+16 more)

### Community 4 - "Community 4"
Cohesion: 0.09
Nodes (9): GoogleCalendarProvider, MicrosoftCalendarProvider, CalendarProvider, getCalendarProvider(), GET(), POST(), checkCalendarHealth(), syncEvent() (+1 more)

### Community 5 - "Community 5"
Cohesion: 0.09
Nodes (18): POST(), POST(), DELETE(), GET(), POST(), PUT(), isTaskLocked(), logAuditEvent() (+10 more)

### Community 6 - "Community 6"
Cohesion: 0.07
Nodes (13): DELETE(), POST(), PUT(), recalculateKpiForProgram(), GET(), GET(), DELETE(), GET() (+5 more)

### Community 7 - "Community 7"
Cohesion: 0.12
Nodes (16): GET(), appendTransaction(), BUDGET_SHEET_MAP, fetchWorkbook(), getBudgetLines(), getMonthlyTrend(), getSheetData(), getSheetForProject() (+8 more)

### Community 8 - "Community 8"
Cohesion: 0.11
Nodes (14): ParticipantDashboard(), StaffDashboard(), useI18n(), AdminOpReports(), formatLabel(), MonthlyBreakdown(), MONTHS, ReportCard() (+6 more)

### Community 9 - "Community 9"
Cohesion: 0.12
Nodes (12): CHART_COLORS, CHART_COLORS_CSS, DAYS, DAYS_SHORT, getCurrentWeek(), getWeekNumber(), MONTHS, MONTHS_SHORT (+4 more)

### Community 10 - "Community 10"
Cohesion: 0.14
Nodes (11): cn(), DAYS, EVENT_COLORS, EVENT_DOTS, MONTHS, QuickAccessPanel(), ROLE_HIERARCHY, SEVERITY_SORT (+3 more)

### Community 11 - "Community 11"
Cohesion: 0.31
Nodes (14): createPage(), getDatabase(), isConfigured(), notionFetch(), projectToProperties(), queryDatabase(), taskToProperties(), updatePage() (+6 more)

### Community 12 - "Community 12"
Cohesion: 0.17
Nodes (6): AdminDashboard(), DAYS, getCalendarDays(), ICONS, MONTHS, STATUS_CONFIG

### Community 13 - "Community 13"
Cohesion: 0.21
Nodes (7): POST(), POST(), POST(), sendEmail(), sendInviteEmail(), sendPasswordResetEmail(), sendWelcomeEmail()

### Community 14 - "Community 14"
Cohesion: 0.18
Nodes (9): DashboardLayout(), NAV_KEY_MAP, NAV_RESPONSIBILITY_MAP, NAVIGATION_MATRIX, RESPONSIBILITY_BYPASS_ROLES, SidebarContent(), tnav(), ThemeContext (+1 more)

### Community 15 - "Community 15"
Cohesion: 0.17
Nodes (6): ACCESS_COLORS, ACCESS_LABELS, ACCESS_LEVELS, ACCESS_SHORT, LEVELS_ORDER, MODULE_CATEGORIES

### Community 17 - "Community 17"
Cohesion: 0.24
Nodes (7): DELETE(), GET(), POST(), DELETE(), GET(), POST(), PUT()

### Community 18 - "Community 18"
Cohesion: 0.2
Nodes (4): DAY_HEADERS, EVENT_COLORS, EVENT_DOTS, MONTHS

### Community 20 - "Community 20"
Cohesion: 0.32
Nodes (4): getCurrentWeek(), getWeekNumber(), StaffOpReport(), STATUS_CONFIG

### Community 21 - "Community 21"
Cohesion: 0.29
Nodes (5): ProjectDetail(), STATUS_BG, STATUS_COLORS, TASK_STATUS_BG, TASK_STATUS_COLORS

### Community 22 - "Community 22"
Cohesion: 0.33
Nodes (4): GET(), PATCH(), POST(), PUT()

### Community 24 - "Community 24"
Cohesion: 0.33
Nodes (4): config, publicApiPaths, publicPaths, softAuthPaths

### Community 25 - "Community 25"
Cohesion: 0.33
Nodes (4): ACCESS_COLORS, ACCESS_LABELS, ACCESS_SHORT, MODULE_CATEGORIES

### Community 26 - "Community 26"
Cohesion: 0.53
Nodes (5): AdminTasks(), formatStatusLabel(), getStatusBg(), getStatusColor(), STATUS_CONFIG

### Community 27 - "Community 27"
Cohesion: 0.53
Nodes (5): AdminBlockers(), formatSeverity(), getSeverityBg(), getSeverityColor(), SEVERITY_CONFIG

### Community 29 - "Community 29"
Cohesion: 0.53
Nodes (5): DB_PATH, GET(), getDb(), POST(), saveDb()

### Community 30 - "Community 30"
Cohesion: 0.47
Nodes (5): buildFingerprint(), categorizeError(), GET(), PATCH(), POST()

### Community 31 - "Community 31"
Cohesion: 0.47
Nodes (4): DELETE(), GET(), POST(), PUT()

### Community 32 - "Community 32"
Cohesion: 0.4
Nodes (4): DELETE(), GET(), PATCH(), POST()

### Community 35 - "Community 35"
Cohesion: 0.4
Nodes (5): CATEGORIES, cn(), STATUS_CONFIG, STATUS_OPTIONS, TaskManager()

### Community 37 - "Community 37"
Cohesion: 0.5
Nodes (3): AdminFinanceDashboard(), formatCurrency(), PROJECTS

### Community 40 - "Community 40"
Cohesion: 0.4
Nodes (4): DELETE(), GET(), PATCH(), POST()

### Community 41 - "Community 41"
Cohesion: 0.6
Nodes (3): DELETE(), GET(), POST()

### Community 42 - "Community 42"
Cohesion: 0.6
Nodes (4): fireInvite(), GET(), POST(), PUT()

### Community 43 - "Community 43"
Cohesion: 0.4
Nodes (3): GET(), POST(), PUT()

### Community 46 - "Community 46"
Cohesion: 0.4
Nodes (3): EN, FR, LOCALE_REGISTRY

### Community 48 - "Community 48"
Cohesion: 0.5
Nodes (3): COLUMN_TO_STATUS, KANBAN_COLUMNS, ProjectKanbanBoard()

### Community 49 - "Community 49"
Cohesion: 0.5
Nodes (3): AdminProjects(), STATUS_BG, STATUS_COLORS

### Community 54 - "Community 54"
Cohesion: 0.67
Nodes (3): DELETE(), GET(), POST()

### Community 55 - "Community 55"
Cohesion: 0.5
Nodes (3): DELETE(), GET(), POST()

### Community 56 - "Community 56"
Cohesion: 0.67
Nodes (3): db, execute(), getPool()

### Community 57 - "Community 57"
Cohesion: 0.5
Nodes (3): DELETE(), GET(), POST()

## Knowledge Gaps
- **88 isolated node(s):** `publicPaths`, `publicApiPaths`, `softAuthPaths`, `config`, `fr` (+83 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **55 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `initDb()` connect `Community 2` to `Community 0`, `Community 1`, `Community 3`, `Community 4`, `Community 5`, `Community 6`, `Community 134`, `Community 136`, `Community 133`, `Community 132`, `Community 139`, `Community 140`, `Community 135`, `Community 138`, `Community 137`, `Community 13`, `Community 17`, `Community 22`, `Community 30`, `Community 31`, `Community 32`, `Community 39`, `Community 40`, `Community 41`, `Community 42`, `Community 43`, `Community 51`, `Community 54`, `Community 55`, `Community 56`, `Community 57`, `Community 58`, `Community 69`, `Community 70`, `Community 71`, `Community 72`, `Community 73`, `Community 74`, `Community 75`, `Community 76`, `Community 77`, `Community 78`, `Community 79`, `Community 80`?**
  _High betweenness centrality (0.121) - this node is a cross-community bridge._
- **Why does `requireAuth()` connect `Community 0` to `Community 1`, `Community 2`, `Community 3`, `Community 4`, `Community 5`, `Community 6`, `Community 134`, `Community 136`, `Community 133`, `Community 132`, `Community 139`, `Community 140`, `Community 135`, `Community 138`, `Community 137`, `Community 13`, `Community 17`, `Community 22`, `Community 29`, `Community 31`, `Community 32`, `Community 39`, `Community 40`, `Community 41`, `Community 42`, `Community 43`, `Community 51`, `Community 52`, `Community 54`, `Community 55`, `Community 57`, `Community 58`, `Community 69`, `Community 70`, `Community 71`, `Community 72`, `Community 73`, `Community 74`, `Community 75`, `Community 76`, `Community 77`, `Community 78`, `Community 79`, `Community 80`?**
  _High betweenness centrality (0.079) - this node is a cross-community bridge._
- **Why does `GET()` connect `Community 4` to `Community 0`, `Community 2`?**
  _High betweenness centrality (0.028) - this node is a cross-community bridge._
- **Are the 204 inferred relationships involving `initDb()` (e.g. with `GET()` and `GET()`) actually correct?**
  _`initDb()` has 204 INFERRED edges - model-reasoned connections that need verification._
- **Are the 169 inferred relationships involving `requireAuth()` (e.g. with `GET()` and `GET()`) actually correct?**
  _`requireAuth()` has 169 INFERRED edges - model-reasoned connections that need verification._
- **Are the 28 inferred relationships involving `getSession()` (e.g. with `PUT()` and `PUT()`) actually correct?**
  _`getSession()` has 28 INFERRED edges - model-reasoned connections that need verification._
- **Are the 30 inferred relationships involving `useI18n()` (e.g. with `TeacherProfile()` and `SubmissionsHub()`) actually correct?**
  _`useI18n()` has 30 INFERRED edges - model-reasoned connections that need verification._