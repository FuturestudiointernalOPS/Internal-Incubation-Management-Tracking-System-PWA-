# ImpactOS — Agent Instructions

This file is read by AI coding agents working on this project.
If you are an AI agent: STOP and read this entire document before making any changes.

---

## 1. Internationalization (i18n) — CRITICAL

**Every user-visible string MUST use the `t()` function.** No exceptions.

```jsx
// ✅ CORRECT
<h2>{t("reports.table.task")}</h2>
<button>{t("common.save")}</button>
<span>{t("status.active")}</span>

// ❌ WRONG — hardcoded English
<h2>Task</h2>
<button>Save</button>
<span>Active</span>
```

### How to add a new translatable string

1. In your component:
   ```jsx
   <p>{t("staff.section.tasksWorkedOn")}</p>
   ```

2. Add the key+value to the English locale file:
   ```json
   // src/locales/en/staff.json
   { "staff": { "section": { "tasksWorkedOn": "Tasks Worked On This Week" } } }
   ```

3. Add the French translation:
   ```json
   // src/locales/fr/staff.json
   { "staff": { "section": { "tasksWorkedOn": "Tâches effectuées cette semaine" } } }
   ```

### Existing key namespaces (use these before creating new ones)

| Namespace | Location | Purpose |
|---|---|---|
| `common.*` | `en/common.json` | Generic UI: save, cancel, close, search, filter, loading, noResults |
| `auth.*` | `en/auth.json` | Login, password, authentication |
| `navigation.*` | `en/navigation.json` | Sidebar labels |
| `admin.*` | `en/admin.json` | Admin dashboard labels, section titles, descriptions |
| `reports.*` | `en/reports.json` | Report labels, table headers, filter options, status |
| `reports.table.*` | `en/reports.json` | Table column headers (task, project, status, etc.) |
| `reports.filter.*` | `en/reports.json` | Filter dropdown options |
| `staff.*` | `en/staff.json` | Staff dashboard, op-report labels, section titles |
| `staff.table.*` | `en/staff.json` | Staff table headers |
| `staff.opReport.*` | `en/staff.json` | Staff op-report specific labels |
| `staff.categories.*` | `en/staff.json` | Category dropdown options |
| `status.*` | `en/status.json` | Status labels (active, pending, completed, blocked, etc.) |
| `time.*` | `en/time.json` | Time labels (today, week, month, created, due, etc.) |
| `time.months.*` | `en/time.json` | Month names (january, february, etc.) |
| `time.days.*` | `en/time.json` | Day abbreviations (sun, mon, tue, etc.) |
| `errors.*` | `en/errors.json` | Error messages |
| `teacher.*` | `en/teacher.json` | Teacher dashboard labels |
| `pm.*` | `en/pm.json` | Program manager labels |
| `participant.*` | `en/participant.json` | Participant labels |

### Fallback behavior

- Missing French key → shows English value
- Missing English key → shows the key name itself (e.g. `"staff.section.missingKey"`) as a visible signal

### File structure

```
src/locales/
├── en/
│   ├── common.json
│   ├── admin.json
│   ├── reports.json
│   ├── staff.json
│   ├── status.json
│   ├── time.json
│   ├── auth.json
│   ├── navigation.json
│   ├── errors.json
│   ├── teacher.json
│   ├── pm.json
│   └── participant.json
└── fr/
    └── (same filenames as en/)
```

---

## 2. Build Requirements

### All admin pages must use `force-dynamic`

The `/admin` route segment has a shared layout at `src/app/admin/layout.js` that exports `dynamic = "force-dynamic"`. This exists because all admin pages use `"use client"` + `useI18n()`, which cannot be statically prerendered.

**Do NOT remove this.** If you create a new route segment (e.g., `src/app/admin/new-feature/page.js`), it will automatically inherit the dynamic behavior from the parent layout.

### If you create a new route segment outside /admin

You may need to add `export const dynamic = "force-dynamic"` if the page:
- Uses `"use client"` AND
- Uses `useI18n()`, `useTheme()`, `useRouter()`, `localStorage`, or any browser-only API

---

## 3. Component Library

All reusable UI components are in `src/components/ui/`. Import them directly:

```jsx
import AppCard from "@/components/ui/AppCard";
import AppButton from "@/components/ui/AppButton";
import AppInput from "@/components/ui/AppInput";
import AppSelect from "@/components/ui/AppSelect";
import AppModal from "@/components/ui/AppModal";
import AppTable from "@/components/ui/AppTable";
import AppBadge from "@/components/ui/AppBadge";
import AppStatusBadge from "@/components/ui/AppStatusBadge";  // Uses shared STATUS_CONFIG
import AppTabs from "@/components/ui/AppTabs";
import AppEmptyState from "@/components/ui/AppEmptyState";
import AppPagination from "@/components/ui/AppPagination";
import AppErrorBoundary from "@/components/ui/AppErrorBoundary";
import { Skeleton, TableSkeleton, CardSkeleton } from "@/components/ui/Skeleton";
```

For data fetching:
```jsx
import { useApi, useApiMulti } from "@/lib/hooks/useApi";
```

For shared constants:
```jsx
import { STATUS_CONFIG, MONTHS, formatLabel, getWeekNumber, formatDate } from "@/lib/constants";
```

---

## 4. Design System Rules

See `DESIGN_SYSTEM.md` for the full guide. Key rules:

- Use CSS variables for ALL colors: `style={{ color: "var(--text-primary)" }}` or `className="text-[var(--text-primary)]"`
- NO hardcoded hex colors in JSX
- NO `dark:` Tailwind variants (use CSS variables instead)
- NO `text-slate-*`, `text-white`, `text-black` for theme text
- Use `bg-surface-1`, `bg-surface-2`, `bg-surface-3` for backgrounds
- Use `AppStatusBadge` instead of inline status badge rendering

---

## 5. Project Structure

```
src/
├── app/                  ← Next.js App Router pages
│   ├── admin/            ← Super Admin routes (28 pages)
│   │   ├── layout.js     ← force-dynamic (DO NOT REMOVE)
│   │   ├── page.js       ← Dashboard
│   │   ├── op-reports/   ← Operational reports
│   │   ├── intelligence/ ← Intelligence module
│   │   └── ...
│   ├── staff/            ← Staff routes
│   ├── pm/               ← Program Manager routes
│   ├── teacher/          ← Teacher routes
│   ├── participant/      ← Participant routes
│   └── api/              ← API routes (~60+ handlers)
├── components/
│   ├── layout/
│   │   └── DashboardLayout.js  ← Sidebar + header wrapper
│   └── ui/               ← Reusable components
├── lib/
│   ├── hooks/
│   │   └── useApi.js     ← Data fetching hooks
│   ├── i18n.js           ← Translation engine
│   ├── locales.js        ← Locale loader
│   ├── constants.js      ← Shared constants
│   ├── ThemeProvider.js  ← Theme context
│   └── ...
└── locales/              ← Translation files (en + fr)
```

---

## 6. Before Making Changes — Checklist

- [ ] Read this file
- [ ] Read `DESIGN_SYSTEM.md`
- [ ] If adding UI text: use `t("namespace.key")` and update BOTH `en/` and `fr/` locale files
- [ ] If creating a new page inside `/admin/*`: no action needed (layout already has force-dynamic)
- [ ] If creating a new page outside `/admin/*`: add `export const dynamic = "force-dynamic"` if using client hooks
- [ ] If adding a new component: put it in `src/components/ui/` and update `DESIGN_SYSTEM.md`
- [ ] Run `npm run build` to verify zero errors
