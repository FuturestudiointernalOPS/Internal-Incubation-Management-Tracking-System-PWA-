# ImpactOS — Agent Instructions

This file is read by AI coding agents working on this project.
If you are an AI agent: STOP and read this entire document before making any changes.

---

## Production test — what the phrase means

When the user says **"production test"**, they mean **`docs/PRODUCTION_TEST.md`**:
the pre-promotion checklist for branch **`G` → `main`**. Work it item by item and
report a status for each one. It is *not* `npm test` and *not* `npm run build` —
production and staging are **different databases**, so a green build never
substitutes for it.

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
import { Skeleton, TableSkeleton } from "@/components/ui/Skeleton";
import { useDialogs } from "@/components/ui/DialogProvider";
```

Page-level building blocks shared by EVERY role (admin, staff, participant, pm…) — use
these instead of hand-rolling a banner, KPI, section heading or link card, so no page
looks like it was written by someone else (styles: `src/components/staff/staff.css`,
the `stf-*` kit, loaded once in `src/app/layout.js`):
```jsx
import PageHero from "@/components/ui/PageHero";     // home-page banner (kicker, title, subtitle, action)
import KpiCard from "@/components/ui/KpiCard";       // one figure
import StatusCard from "@/components/ui/StatusCard"; // a figure with a state: tone g | o | r
import SectionHead from "@/components/ui/SectionHead"; // lettered section heading (+ action)
import LinkCard from "@/components/ui/LinkCard";     // navigation card (onClick or href)
```
Tabs, entries and data are each role's own; the look is never. Use `stf-grid`, `stf-card`,
`stf-tw` (tables), `stf-tag`, `stf-btn` for layout, cards, tables, tags and buttons.
Colours: only tokens or the Tailwind families (they are remapped to the charter palette in
`tailwind.config.js`) — never a new hex.

For in-app confirmation, prompts and notices — never the browser's own pop-ups:
```jsx
const { confirm, prompt, alert } = useDialogs();

if (!(await confirm({ message: t("…"), tone: "danger" }))) return; // → boolean
const name = await prompt({ message: t("…"), defaultValue: current }); // → string | null
await alert({ message: t("…") });
```
`DialogProvider` is mounted once in `src/app/layout.js`. Options: `message` (required),
`title`, `hint`, `tone: "danger"` for destructive actions, `confirmLabel`, `cancelLabel`,
and for prompts `defaultValue`, `placeholder`, `inputLabel`, `inputType`, `required`,
`validate`. A `message` containing `"\n"` renders the rest as a quieter hint line.

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
- Confirmations, prompts and notices go through `useDialogs()` — NEVER `window.confirm`, `window.prompt` or `window.alert`, which ignore the theme and freeze the tab

---

## 5. Project Structure

```
src/
├── app/                  ← Next.js App Router pages
│   ├── admin/            ← Super Admin routes (91 pages)
│   │   ├── layout.js     ← force-dynamic (DO NOT REMOVE)
│   │   ├── page.js       ← Dashboard
│   │   ├── op-reports/   ← Operational reports
│   │   ├── intelligence/ ← Intelligence module
│   │   └── ...
│   ├── staff/            ← Staff routes
│   ├── pm/               ← Program Manager routes
│   ├── participant/      ← Participant routes
│   └── api/              ← API routes (thin controllers, 403 handlers)
├── components/
│   ├── layout/
│   │   └── DashboardLayout.js  ← Sidebar + header wrapper
│   └── ui/               ← Reusable components
├── models/               ← MODEL layer — all SQL + domain logic (MVC)
│   ├── tasks.js          ← one file per domain (blocks, projects,
│   │                        programs, contacts, authFlows, groups,
│   │                        authorization, investor…)
│   └── lms/              ← domain folders (lms, authorization,
│                           finance, platform, integrations)
├── lib/                  ← INFRASTRUCTURE ONLY (db, auth sessions, i18n,
│   │                        email transport, storage, hooks) + facades
│   │                        re-exporting relocated domain modules
│   ├── hooks/
│   │   └── useApi.js     ← Data fetching hooks
│   ├── i18n.js           ← Translation engine
│   ├── locales.js        ← Locale loader
│   ├── constants.js      ← Shared constants
│   ├── ThemeProvider.js  ← Theme context
│   └── ...
└── locales/              ← Translation files (en + fr)
```

### MVC layering (see `docs/MVC_REFACTOR.md` and `docs/LAYER_SPLIT.md`)

- **M (repository) — `src/models/`**: every `db.execute` lives here as a named
  function. API routes, pages, components and services must **never** run SQL or
  import `@/lib/db`. Models hold data access only — no decisions, no HTTP.
- **S — `src/services/<domain>/`**: use-case and decision logic ("may they?",
  "what runs next?"). Services read through `src/models/**`, never run SQL, and
  never import `@/lib/db`. New decision code goes here. Guarded by
  `src/__tests__/server/services-boundaries.test.js`.
- **C — `src/app/api/**/route.js`**: thin controllers — auth, validation,
  service/model orchestration, response shaping.
- **V — pages + `src/components/`**: rendering only; fetch via controllers.
- Legacy domain modules were relocated to `src/models/` behind facades: some
  `src/lib/*` files (e.g. `src/lib/taskAudit.js`) now only re-export
  from `@/models/*`. New code imports from `@/models/*` directly.

### DashboardLayout — rendered by section layouts, NOT by pages

`src/components/layout/DashboardLayout.js` (sidebar + header shell) is rendered **once**
by each top-level section layout so it survives client-side navigation (no remount,
no re-fetch of the auth/badge chain on every link click):

| Section | Layout | Shell role |
|---|---|---|
| `/admin/*` | `src/app/admin/layout.js` | `super_admin` (from session) |
| `/staff/*` | `src/app/staff/layout.js` | `staff` |
| `/pm/*` | `src/app/pm/layout.js` | `program_manager` |
| `/participant/*` | `src/app/participant/layout.js` | `participant` |
| `/facilitator/*` | `src/app/facilitator/layout.js` | `facilitator` |
| `/investor/*` | `src/app/investor/layout.js` | `investor` |
| `/finance/*` | `src/app/finance/layout.js` | `finance` |
| `/crm/*` | `src/app/crm/layout.js` | `crm` |
| `/team/*` | `src/app/team/layout.js` | `team` |

**Do NOT wrap a page in `<DashboardLayout>` anymore.** Pages simply return their own
content; the section layout provides the shell. The `role` prop is only a pre-session
fallback: the effective role is always the connected user's session role, and the
sidebar is built from that role + the user's effective capabilities. The visited page
never selects a role.

---

## 6. Before Making Changes — Checklist

- [ ] Read this file
- [ ] Read `DESIGN_SYSTEM.md`
- [ ] If adding UI text: use `t("namespace.key")` and update BOTH `en/` and `fr/` locale files
- [ ] If creating a new page inside `/admin/*`: no action needed (layout already has force-dynamic)
- [ ] If creating a new page outside `/admin/*`: add `export const dynamic = "force-dynamic"` if using client hooks
- [ ] If adding a new component: put it in `src/components/ui/` and update `DESIGN_SYSTEM.md`
- [ ] If asking for a confirmation, a typed value or an acknowledgement: use `useDialogs()` — never the browser's `confirm` / `prompt` / `alert`
- [ ] If adding/editing a page: return only the page content — the section layout already renders `<DashboardLayout>` (see table above)
- [ ] If adding/editing data access or SQL: put the query in `src/models/<domain>.js` (models only; never in routes/pages)
- [ ] Run `npm run lint` (0 errors) and `npm run build` to verify zero errors
- [ ] Promoting to production (branch `G` → `main`): run the **production test** — `docs/PRODUCTION_TEST.md`

---

## 7. Local dev troubleshooting

### A 404 on a route whose file exists

Symptom: `GET`/`POST` on an API route answers `200` or `401`, while a *sibling*
route answers `404` — even though its `route.js` is on disk and exports the
method. The server log shows `404 in ~50ms` and nothing else. A page whose
`fetch` expected JSON then shows a misleading "network" error, because the
`response.json()` throws on the HTML error page.

Cause: Turbopack's route manifest goes stale. On this workstation two things
make that easy to hit — a `package-lock.json` in `/home/harry-hounsou` that is
outside the Git repository, and a stray copy of the whole project sitting next to
it as `Part_time_Future_Studio (Copy)/`. Next warns about the first at startup:

```
Warning: Next.js ignored package-lock.json in /home/harry-hounsou because it is
outside the current Git repository
```

Fix — rebuild the manifest from scratch:

```bash
rm -rf .next && npm run dev
```

Do **not** paper over it with `turbopack.root` in `next.config.mjs`: it needs a
machine-absolute path, which would be committed and break CI and every other
workstation.

### Confirming a route is actually registered

An unauthenticated request is a free routing probe — the auth gate answers
`401` for a route that exists, and `404` for one that does not:

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/api/ventures/VNT-1/document-types/18
```

`405` instead of `401`/`404` means the path resolved but that HTTP method is not
exported.

### `.env.local` points at staging

The local dev server reads `DATABASE_URL` from `.env.local`, which on this
workstation is the **staging** Supabase project. Browsing admin screens writes to
staging. Schema is *not* an exception — see the runtime migration note in
`src/lib/db.js`: unless `SKIP_RUNTIME_SCHEMA_MAINTENANCE` is set, the app applies
its own `CREATE TABLE IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS` on first use.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
