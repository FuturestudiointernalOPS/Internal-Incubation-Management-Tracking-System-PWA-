# Graph Report - src  (2026-07-03)

## Corpus Check
- Large corpus: 351 files · ~254,137 words. Semantic extraction will be expensive (many Claude tokens). Consider running on a subfolder, or use --no-semantic to run AST-only.

## Summary
- 1013 nodes · 1427 edges · 203 communities (139 shown, 64 thin omitted)
- Extraction: 61% EXTRACTED · 39% INFERRED · 0% AMBIGUOUS · INFERRED: 550 edges (avg confidence: 0.8)
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
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
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
- [[_COMMUNITY_Community 59|Community 59]]
- [[_COMMUNITY_Community 60|Community 60]]
- [[_COMMUNITY_Community 62|Community 62]]
- [[_COMMUNITY_Community 63|Community 63]]
- [[_COMMUNITY_Community 65|Community 65]]
- [[_COMMUNITY_Community 66|Community 66]]
- [[_COMMUNITY_Community 67|Community 67]]
- [[_COMMUNITY_Community 69|Community 69]]
- [[_COMMUNITY_Community 70|Community 70]]
- [[_COMMUNITY_Community 71|Community 71]]
- [[_COMMUNITY_Community 72|Community 72]]
- [[_COMMUNITY_Community 73|Community 73]]
- [[_COMMUNITY_Community 74|Community 74]]
- [[_COMMUNITY_Community 76|Community 76]]
- [[_COMMUNITY_Community 77|Community 77]]
- [[_COMMUNITY_Community 78|Community 78]]
- [[_COMMUNITY_Community 79|Community 79]]
- [[_COMMUNITY_Community 80|Community 80]]
- [[_COMMUNITY_Community 81|Community 81]]
- [[_COMMUNITY_Community 82|Community 82]]
- [[_COMMUNITY_Community 83|Community 83]]
- [[_COMMUNITY_Community 84|Community 84]]
- [[_COMMUNITY_Community 85|Community 85]]
- [[_COMMUNITY_Community 86|Community 86]]
- [[_COMMUNITY_Community 87|Community 87]]
- [[_COMMUNITY_Community 88|Community 88]]
- [[_COMMUNITY_Community 89|Community 89]]
- [[_COMMUNITY_Community 95|Community 95]]
- [[_COMMUNITY_Community 96|Community 96]]
- [[_COMMUNITY_Community 97|Community 97]]
- [[_COMMUNITY_Community 98|Community 98]]
- [[_COMMUNITY_Community 99|Community 99]]
- [[_COMMUNITY_Community 100|Community 100]]
- [[_COMMUNITY_Community 102|Community 102]]
- [[_COMMUNITY_Community 103|Community 103]]
- [[_COMMUNITY_Community 104|Community 104]]
- [[_COMMUNITY_Community 132|Community 132]]
- [[_COMMUNITY_Community 133|Community 133]]
- [[_COMMUNITY_Community 134|Community 134]]
- [[_COMMUNITY_Community 135|Community 135]]
- [[_COMMUNITY_Community 136|Community 136]]
- [[_COMMUNITY_Community 137|Community 137]]
- [[_COMMUNITY_Community 138|Community 138]]
- [[_COMMUNITY_Community 139|Community 139]]
- [[_COMMUNITY_Community 148|Community 148]]
- [[_COMMUNITY_Community 149|Community 149]]
- [[_COMMUNITY_Community 150|Community 150]]
- [[_COMMUNITY_Community 151|Community 151]]
- [[_COMMUNITY_Community 152|Community 152]]
- [[_COMMUNITY_Community 153|Community 153]]
- [[_COMMUNITY_Community 154|Community 154]]
- [[_COMMUNITY_Community 155|Community 155]]
- [[_COMMUNITY_Community 156|Community 156]]
- [[_COMMUNITY_Community 157|Community 157]]
- [[_COMMUNITY_Community 195|Community 195]]
- [[_COMMUNITY_Community 200|Community 200]]

## God Nodes (most connected - your core abstractions)
1. `initDb()` - 222 edges
2. `requireAuth()` - 186 edges
3. `getSession()` - 39 edges
4. `useI18n()` - 38 edges
5. `logAuditEvent()` - 10 edges
6. `GET()` - 9 edges
7. `GET()` - 9 edges
8. `recalculateKpiProgress()` - 9 edges
9. `MicrosoftCalendarProvider` - 9 edges
10. `ingestFromSheet()` - 9 edges

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

## Communities (203 total, 64 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.05
Nodes (33): POST(), GET(), GET(), POST(), GET(), POST(), GET(), GET() (+25 more)

### Community 1 - "Community 1"
Cohesion: 0.06
Nodes (33): GET(), POST(), PATCH(), GET(), POST(), DELETE(), GET(), PATCH() (+25 more)

### Community 2 - "Community 2"
Cohesion: 0.06
Nodes (19): GET(), POST(), DELETE(), POST(), PUT(), recalculateKpiForProgram(), GET(), GET() (+11 more)

### Community 3 - "Community 3"
Cohesion: 0.08
Nodes (21): POST(), POST(), GET(), getSessionCid(), POST(), DELETE(), GET(), POST() (+13 more)

### Community 4 - "Community 4"
Cohesion: 0.09
Nodes (9): GoogleCalendarProvider, MicrosoftCalendarProvider, CalendarProvider, getCalendarProvider(), GET(), POST(), checkCalendarHealth(), syncEvent() (+1 more)

### Community 5 - "Community 5"
Cohesion: 0.16
Nodes (18): buildProgramMap(), ingestFromSheet(), parseBudgetLines(), parseProjectSheet(), parseTransactions(), syncDataSource(), BUDGET_SHEET_MAP, excelDateToISO() (+10 more)

### Community 6 - "Community 6"
Cohesion: 0.12
Nodes (16): GET(), POST(), DELETE(), GET(), POST(), PUT(), getSession(), GET() (+8 more)

### Community 7 - "Community 7"
Cohesion: 0.12
Nodes (13): ParticipantDashboard(), MonthlyTrendChart(), ParticipantProgramDetailPage(), useI18n(), AdminOpReports(), formatLabel(), MonthlyBreakdown(), MONTHS (+5 more)

### Community 8 - "Community 8"
Cohesion: 0.18
Nodes (17): ACCESS_LEVELS, getAccessProfileCapabilities(), getUserEffectiveCapabilities(), getUserEffectiveCapabilitiesV2(), getUserEffectiveProfile(), getUserFullPermissionMatrix(), getUserFullPermissionMatrixV2(), getUserGroups() (+9 more)

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
Cohesion: 0.18
Nodes (11): GET(), getBudgetLines(), getDataSources(), getMonthly(), getSummary(), getTransactions(), insertTransaction(), parseFiscalYear() (+3 more)

### Community 13 - "Community 13"
Cohesion: 0.16
Nodes (9): DashboardLayout(), NAV_KEY_MAP, NAV_RESPONSIBILITY_MAP, NAVIGATION_MATRIX, RESPONSIBILITY_BYPASS_ROLES, SidebarContent(), tnav(), ThemeContext (+1 more)

### Community 14 - "Community 14"
Cohesion: 0.17
Nodes (6): AdminDashboard(), DAYS, getCalendarDays(), ICONS, MONTHS, STATUS_CONFIG

### Community 15 - "Community 15"
Cohesion: 0.21
Nodes (7): POST(), POST(), POST(), sendEmail(), sendInviteEmail(), sendPasswordResetEmail(), sendWelcomeEmail()

### Community 16 - "Community 16"
Cohesion: 0.17
Nodes (6): ACCESS_COLORS, ACCESS_LABELS, ACCESS_LEVELS, ACCESS_SHORT, LEVELS_ORDER, MODULE_CATEGORIES

### Community 18 - "Community 18"
Cohesion: 0.24
Nodes (8): DELETE(), GET(), POST(), PUT(), logPermissionAudit(), PUT(), GET(), PUT()

### Community 19 - "Community 19"
Cohesion: 0.24
Nodes (7): DELETE(), GET(), POST(), DELETE(), GET(), POST(), PUT()

### Community 20 - "Community 20"
Cohesion: 0.2
Nodes (4): DAY_HEADERS, EVENT_COLORS, EVENT_DOTS, MONTHS

### Community 21 - "Community 21"
Cohesion: 0.25
Nodes (6): ProjectDetail(), StaffProjectDetail(), STATUS_BG, STATUS_COLORS, TASK_STATUS_BG, TASK_STATUS_COLORS

### Community 23 - "Community 23"
Cohesion: 0.32
Nodes (4): getCurrentWeek(), getWeekNumber(), StaffOpReport(), STATUS_CONFIG

### Community 24 - "Community 24"
Cohesion: 0.29
Nodes (7): CATEGORIES, cn(), PRIORITY_CONFIG, PRIORITY_OPTIONS, STATUS_CONFIG, STATUS_OPTIONS, TaskManager()

### Community 25 - "Community 25"
Cohesion: 0.29
Nodes (3): CAT, ErrorLogsView(), SEV

### Community 26 - "Community 26"
Cohesion: 0.33
Nodes (4): GET(), PATCH(), POST(), PUT()

### Community 27 - "Community 27"
Cohesion: 0.38
Nodes (4): DeveloperStandup(), getCurrentWeek(), getWeekNumber(), STATUS_CONFIG

### Community 29 - "Community 29"
Cohesion: 0.33
Nodes (4): config, publicApiPaths, publicPaths, softAuthPaths

### Community 30 - "Community 30"
Cohesion: 0.33
Nodes (4): ACCESS_COLORS, ACCESS_LABELS, ACCESS_SHORT, MODULE_CATEGORIES

### Community 31 - "Community 31"
Cohesion: 0.53
Nodes (5): AdminTasks(), formatStatusLabel(), getStatusBg(), getStatusColor(), STATUS_CONFIG

### Community 32 - "Community 32"
Cohesion: 0.53
Nodes (5): AdminBlockers(), formatSeverity(), getSeverityBg(), getSeverityColor(), SEVERITY_CONFIG

### Community 34 - "Community 34"
Cohesion: 0.53
Nodes (5): DB_PATH, GET(), getDb(), POST(), saveDb()

### Community 35 - "Community 35"
Cohesion: 0.47
Nodes (4): DELETE(), GET(), POST(), PUT()

### Community 36 - "Community 36"
Cohesion: 0.4
Nodes (4): DELETE(), GET(), PATCH(), POST()

### Community 37 - "Community 37"
Cohesion: 0.47
Nodes (5): buildFingerprint(), categorizeError(), GET(), PATCH(), POST()

### Community 38 - "Community 38"
Cohesion: 0.47
Nodes (4): DELETE(), GET(), POST(), PUT()

### Community 41 - "Community 41"
Cohesion: 0.4
Nodes (4): GET(), PUT(), assignResponsibility(), removeResponsibility()

### Community 42 - "Community 42"
Cohesion: 0.4
Nodes (4): createSession(), setSessionCookieOnResponse(), POST(), POST()

### Community 45 - "Community 45"
Cohesion: 0.6
Nodes (4): fireInvite(), GET(), POST(), PUT()

### Community 46 - "Community 46"
Cohesion: 0.6
Nodes (3): DELETE(), GET(), POST()

### Community 47 - "Community 47"
Cohesion: 0.4
Nodes (3): GET(), POST(), PUT()

### Community 50 - "Community 50"
Cohesion: 0.4
Nodes (3): EN, FR, LOCALE_REGISTRY

### Community 52 - "Community 52"
Cohesion: 0.5
Nodes (3): COLUMN_TO_STATUS, KANBAN_COLUMNS, ProjectKanbanBoard()

### Community 53 - "Community 53"
Cohesion: 0.5
Nodes (3): AdminProjects(), STATUS_BG, STATUS_COLORS

### Community 57 - "Community 57"
Cohesion: 0.5
Nodes (3): DELETE(), GET(), POST()

### Community 58 - "Community 58"
Cohesion: 0.67
Nodes (3): db, execute(), getPool()

### Community 59 - "Community 59"
Cohesion: 0.67
Nodes (3): DELETE(), GET(), POST()

### Community 60 - "Community 60"
Cohesion: 0.67
Nodes (3): DELETE(), GET(), POST()

### Community 65 - "Community 65"
Cohesion: 0.67
Nodes (3): seedDefaultRoleCapabilities(), GET(), POST()

## Knowledge Gaps
- **91 isolated node(s):** `publicPaths`, `publicApiPaths`, `softAuthPaths`, `config`, `fr` (+86 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **64 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `initDb()` connect `Community 1` to `Community 0`, `Community 2`, `Community 3`, `Community 4`, `Community 5`, `Community 6`, `Community 8`, `Community 12`, `Community 15`, `Community 18`, `Community 19`, `Community 148`, `Community 149`, `Community 150`, `Community 151`, `Community 152`, `Community 153`, `Community 154`, `Community 155`, `Community 156`, `Community 26`, `Community 157`, `Community 35`, `Community 36`, `Community 37`, `Community 38`, `Community 41`, `Community 42`, `Community 44`, `Community 45`, `Community 46`, `Community 47`, `Community 54`, `Community 57`, `Community 58`, `Community 59`, `Community 60`, `Community 65`, `Community 76`, `Community 77`, `Community 78`, `Community 79`, `Community 80`, `Community 81`, `Community 82`, `Community 83`, `Community 84`, `Community 85`, `Community 86`, `Community 87`, `Community 88`, `Community 89`, `Community 97`, `Community 98`, `Community 99`?**
  _High betweenness centrality (0.122) - this node is a cross-community bridge._
- **Why does `requireAuth()` connect `Community 0` to `Community 1`, `Community 2`, `Community 3`, `Community 4`, `Community 5`, `Community 6`, `Community 8`, `Community 12`, `Community 15`, `Community 18`, `Community 19`, `Community 148`, `Community 149`, `Community 150`, `Community 151`, `Community 152`, `Community 153`, `Community 154`, `Community 155`, `Community 156`, `Community 26`, `Community 157`, `Community 34`, `Community 35`, `Community 36`, `Community 38`, `Community 41`, `Community 44`, `Community 45`, `Community 46`, `Community 47`, `Community 54`, `Community 55`, `Community 57`, `Community 59`, `Community 60`, `Community 65`, `Community 76`, `Community 77`, `Community 78`, `Community 79`, `Community 80`, `Community 81`, `Community 82`, `Community 83`, `Community 84`, `Community 85`, `Community 86`, `Community 87`, `Community 88`, `Community 89`, `Community 97`, `Community 98`?**
  _High betweenness centrality (0.086) - this node is a cross-community bridge._
- **Why does `useI18n()` connect `Community 7` to `Community 132`, `Community 133`, `Community 134`, `Community 135`, `Community 136`, `Community 137`, `Community 138`, `Community 139`, `Community 10`, `Community 13`, `Community 14`, `Community 21`, `Community 23`, `Community 25`, `Community 27`, `Community 31`, `Community 32`, `Community 33`, `Community 43`, `Community 52`, `Community 53`, `Community 69`, `Community 70`, `Community 71`, `Community 72`, `Community 73`, `Community 74`?**
  _High betweenness centrality (0.035) - this node is a cross-community bridge._
- **Are the 220 inferred relationships involving `initDb()` (e.g. with `GET()` and `GET()`) actually correct?**
  _`initDb()` has 220 INFERRED edges - model-reasoned connections that need verification._
- **Are the 184 inferred relationships involving `requireAuth()` (e.g. with `GET()` and `GET()`) actually correct?**
  _`requireAuth()` has 184 INFERRED edges - model-reasoned connections that need verification._
- **Are the 34 inferred relationships involving `getSession()` (e.g. with `PUT()` and `PUT()`) actually correct?**
  _`getSession()` has 34 INFERRED edges - model-reasoned connections that need verification._
- **Are the 37 inferred relationships involving `useI18n()` (e.g. with `SubmissionsHub()` and `TeacherCalendar()`) actually correct?**
  _`useI18n()` has 37 INFERRED edges - model-reasoned connections that need verification._