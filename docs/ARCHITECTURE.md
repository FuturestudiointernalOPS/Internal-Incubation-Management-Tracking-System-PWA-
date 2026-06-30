# Architecture

How ImpactOS fits together. For setup/run instructions see the root [README](../README.md). For route-by-route and function-by-function reference see [API.md](API.md) and [MODULES.md](MODULES.md).

## Overview

Next.js App Router app, one Postgres database, six role-based dashboards sharing one codebase. No separate backend service — `src/app/api/` route handlers are the backend, `src/app/<role>/` pages are the frontend, both deployed together on Vercel.

## Authentication & Sessions

Custom cookie-session auth, not Supabase Auth (Supabase is used for storage/admin tasks elsewhere, not the primary login flow):

- `src/lib/auth.js` is the auth module. Sessions are server-side records in a `user_sessions` Postgres table, referenced by a `impactos_session` cookie (`SESSION_COOKIE_NAME`), 24h expiry (`SESSION_DURATION_HOURS`).
- `createSession(userCid, userRole)` — issues a session on login, deletes the user's prior sessions first (single active session per user).
- `getSession()` — reads the current session from the cookie + DB.
- `requireSession(allowedRoles)` / `requireAuth(allowedRoles)` — guard functions called at the top of pages/route handlers; redirect or 401 if no valid session or role mismatch.
- `requireProjectAccess(projectId)` — additional per-resource guard for project-scoped data.

No `middleware.js` at the project root — auth is enforced per-page/per-route via these functions, not centrally. Each role's top-level `layout.js` (e.g. `src/app/admin/layout.js`) sets `export const dynamic = "force-dynamic"` to disable static caching for authenticated pages, since session-derived content must never be served from a static cache.

## Permissions

Beyond role (`super_admin`/`program_manager`/`staff`/`teacher`/`participant`/`developer`), there's a finer-grained capability system in `src/lib/auth.js`:

- `PERMISSION_MODULES` — named permission domains (e.g. finance, reports).
- `ACCESS_LEVELS` — graded access (none → full) per module.
- `getUserEffectiveCapabilities(userCid, userRole, module)` / `getUserFullPermissionMatrix(userCid, userRole)` — resolve a user's actual capabilities, combining role defaults with per-user group overrides (`getUserGroups`).
- `hasCapability(...)` / `requireCapability(module, capability, minLevel)` — checks used inside route handlers for module-level authorization beyond basic role checks.

This is why some routes check role AND capability — role gets you in the door, capability decides what you can do once inside.

## Data Layer

- `src/lib/db.js` — single Postgres connection pool (`pg`), lazy-initialized from `DATABASE_URL`. All DB access goes through this module's `execute()`-style query wrapper.
- `src/migrations/*.sql` — schema migrations, applied manually/historically.
- `scripts/migrations/*.mjs` — Node-based migration/seed/backfill scripts, re-runnable (check for "already exists" before erroring).
- Two legacy SQLite files (`src/lib/impactos.db`, `src/lib/impact_os_v2.db`) are present in the repo from an earlier pre-Postgres iteration — not used by the current `db.js` (which is Postgres-only). Worth confirming with the team whether these can be removed; they're tracked in git as binary files.

## Roles & Routing

| Role | Routes under `src/app/` | Notes |
|---|---|---|
| `super_admin` | `admin/` | Full platform: programs, projects, staff, intelligence (in progress), op-reports |
| `program_manager` | `pm/` | Scoped to assigned programs/projects |
| `staff` | `staff/` | Weekly op-report submission, own tasks/blockers |
| `teacher` | `teacher/` | Teaching dashboard |
| `participant` | `participant/` | Participant-facing views, also `register-participant/`, `participant/` signup flows |
| `developer` / `intern` | `developer/` | Internal engineering dashboard |

Sidebar navigation and role→route resolution live in `src/components/layout/DashboardLayout.js` (`NAVIGATION_MATRIX`).

## Internationalization (i18n)

Custom translation engine (`src/lib/i18n.js`), **not** `next-intl` or similar — every user-facing string must go through `t()`. English is the fallback language. Locale files are split by feature area under `src/locales/en/` and `src/locales/fr/` (mirrored key structure — see `AI_AGENT_INSTRUCTIONS.md` for the full namespace table). This is enforced by convention, not a lint rule — AI agents and contributors are expected to follow `AI_AGENT_INSTRUCTIONS.md` directly.

## External Integrations

| Concern | Module | Provider |
|---|---|---|
| Email | `src/lib/email.js`, `src/lib/mailer.js` | Resend (primary) + Nodemailer/Mailgen (templates/fallback) |
| AI — mentor feedback parsing | `src/lib/deepseek.js` | DeepSeek API (`deepseek-chat`) — parses mentor recording transcriptions into structured feedback |
| AI — other | `src/lib/gemini.js` | Google Generative AI |
| File storage | `src/lib/storage.js` | Vercel Blob |
| Auth/admin storage | `src/lib/supabase.js`, `src/lib/supabase-admin.js` | Supabase |
| Audit trail | `src/lib/audit.js`, `src/lib/taskAudit.js` | Internal — writes to an audit log table, surfaced via `/api/audit-log` |
| Error reporting | `src/lib/reportError.js` | Internal — surfaced via `/api/errors` |

## Rendering & Caching

Authenticated dashboard routes use `export const dynamic = "force-dynamic"` at the layout level — this is intentional, not an oversight: session/role-derived content must not be statically generated or cached, since two users hitting the same URL must see different data.

## Reporting & Exports

Reports support export to Excel (`xlsx`) and PDF (`jspdf` + `html2canvas` for chart/DOM capture). Charting via Recharts. Weekly op-reports (`src/app/staff/op-report/`) and admin-side aggregated reports (`src/app/admin/op-reports/`) are the two largest pages in the app by line count — see [MODULES.md](MODULES.md) for specifics if working in that area.
