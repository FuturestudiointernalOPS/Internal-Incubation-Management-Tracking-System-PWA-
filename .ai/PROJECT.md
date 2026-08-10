# PROJECT.md — ImpactOS Project Knowledge

> Version: 1.0 | Project-specific knowledge only. No generic engineering guidance (that lives in SYSTEM.md + core).
> Verified against the codebase 2026-08-10. When facts drift, update this file — do not delete history without a decision.

## 1. Snapshot

- **App:** ImpactOS — startup development & innovation ecosystem operating system (incubation, acceleration, venture tracking, investor intelligence).
- **Stack:** Next.js 16 (App Router) · React 19 · JavaScript (ES modules) · Tailwind CSS 3 · PostgreSQL (via `pg`) + Supabase (storage/admin).
- **Key libs:** `@supabase/supabase-js`, `bcryptjs`, `framer-motion`, `lucide-react`, `recharts`, `xlsx`, `jspdf` + `html2canvas` (PDF exports), `resend` + `nodemailer` + `mailgen` (email), `@google/generative-ai` (AI), `papaparse`, `uuid`, `ws`.
- **Scripts:** `npm run dev` · `build` · `start` · `lint` (ESLint 9 + `next/core-web-vitals`) · `sync-finance` (Google Sheets sync).
- **Deployment:** Vercel. Two branches: `main` (production, auto-deploys), `dev` (staging, preview deploys).

## 2. Architecture

### 2.1 Routes — role-based dashboards

| Route | Role | Notes |
|---|---|---|
| `/admin` | `super_admin` | Full platform: programs, projects, staff, reports, intelligence, finance, permissions |
| `/pm` | `program_manager` | Scoped to assigned programs/projects |
| `/staff` | `staff` | Weekly op-report submission, own tasks/blockers |
| `/teacher` | `teacher` | Teaching dashboard |
| `/participant` | `participant` | Participant-facing views, program enrollment, rituals, progress |
| `/developer` | `developer` / `intern` | Internal engineering dashboard |
| `/investor` | `investor` | Investor portal (in development) |
| `/login`, `/register`, `/forgot-password`, `/setup-password`, `/invite`, `/activate` | public | Auth flows |
| `/api/*` | public (gated per-route) | ~70+ API route handlers, grouped by domain |

**No centralized middleware.** Auth is enforced per-page/per-route via `requireAuth()`, `requireSession()`, and `requireCapability()` in `src/lib/auth.js`. Each role's top-level `layout.js` exports `dynamic = "force-dynamic"` to disable static caching for authenticated pages.

Sidebar navigation and role→route resolution live in `src/components/layout/DashboardLayout.js` (`NAVIGATION_MATRIX`).

### 2.2 Auth model

- **Custom cookie-session auth** (not Supabase Auth). Sessions are server-side rows in `user_sessions`, referenced by an `impactos_session` cookie, 24h expiry (extendable via "remember me").
- `src/lib/auth.js` — issue, verify, destroy sessions. `requireSession(allowedRoles)`, `requireAuth(allowedRoles)`, `requireProjectAccess(projectId)` guard functions.
- **Permission system** layered on top of roles: `PERMISSION_MODULES` (projects, programs, users, reports, messaging, finance, engineering, contacts, permissions, internal_comms, settings), `ACCESS_LEVELS` (NONE → FULL). `hasCapability()` / `requireCapability()` enforce fine-grained access.
- **Access profiles V2** (`getUserEffectiveCapabilitiesV2`, `requireCapabilityV2`): role-default profiles (Super Admin, Staff, PM, Participant, Developer, etc.) with per-user overrides.
- **Responsibilities** system: named responsibilities (Finance Management, Program Management, etc.) assignable to users.

### 2.3 Data layer

- **`src/lib/db.js`** — single Postgres connection pool (`pg`), lazy-initialized from `DATABASE_URL`. All DB access via `db.execute({sql, args})`. Supports `?` → `$N` parameter translation and auto-retry on connection errors. Includes `db.transaction(callback)`.
- **SQL inline in route handlers** — no dedicated data-access layer. The same query patterns repeat across multiple routes (see known issues in MEMORY.md).
- **Migrations** in two places: `src/migrations/*.sql` (historical, manually applied) and `supabase/migrations/` (timestamped, idempotent).
- **Two legacy SQLite files** (`src/lib/impactos.db`, `src/lib/impact_os_v2.db`) — pre-Postgres artifacts, not used by the current `db.js`. Tracked in git as binary files; team should confirm whether they can be removed.

### 2.4 Domain modules

- **Operations OS** (`src/app/staff/op-report/`, `src/components/tasks/TaskManager.js`): weekly standups, retros, personal tasks, project tasks, blockers, carry-over, reporting. This is Pillar 1 — the foundation.
- **Program OS** (`src/app/pm/`, `src/app/participant/`, `src/components/dashboard/`): program management, curriculum, sessions, deliverables, assignments, cohorts, attendance, progress tracking. Pillar 2.
- **Venture OS** (`src/app/api/ventures/`, `src/lib/ventures.js`, `src/lib/ventureAuth.js`): startup profiles, milestones, KPIs, investment-readiness scoring. Pillar 3 — current priority.
- **Investor OS** (`src/app/investor/`, `src/app/api/investor/`): deal pipeline, startup discovery, due diligence center, portfolio tracking. Pillar 4 — planned.
- **Messaging** (`src/components/messaging/MessagingChat.js`, `src/app/api/messages/`, `internal-comms/`): DM, group, program, and broadcast messaging.
- **Finance** (`src/lib/finance.js`, `src/app/finance/`, `src/app/api/finance/`): budget tracking, Google Sheets integration, transaction management.
- **AI** (`src/lib/deepseek.js`, `src/lib/gemini.js`): mentor feedback parsing (DeepSeek), general AI (Gemini).
- **i18n** (`src/lib/i18n.js`, `src/lib/locales.js`, `src/locales/en/`, `src/locales/fr/`): custom `t()` translation engine, English + French mandatory.
- **Design system** (`src/components/ui/`, `src/lib/ThemeProvider.js`, `src/lib/constants.js`): CSS variable–driven theme, reusable components (AppCard, AppButton, AppTable, etc.).
- **Integrations** (`src/lib/integrations/`): Microsoft Graph Calendar sync, Notion sync.

### 2.5 Key database tables (partial — see `supabase/migrations/` for authoritative sources)

Core tables: `user_sessions`, `contacts`, `tasks`, `projects`, `programs` (`v2_programs`), `standups`, `retros`, `blockers`, `v2_sessions`, `v2_document_requirements`, `v2_submissions`, `v2_attendance`, `v2_teams`, `v2_kpis`, `kpi_progress`, `fin_transactions`, `fin_budgets`, `access_profiles`, `permission_grants`, `permission_restrictions`, `responsibilities`, `messages` (`v2_messages`), `notifications`, `audit_logs`, `error_logs`.

**⚠️ Schema drift:** 162 confirmed broken SQL statements across the codebase (see `docs/SCHEMA_DRIFT_AUDIT.md`). Code and schema have diverged in ~12 clusters — password reset pipeline, participant enrollment, campaign emails, rituals, curriculum, and others are non-functional. Fixes are sequenced but incomplete.

## 3. Business Rules (non-negotiable)

1. **5 Pillars strategy:** every feature must serve at least one of — operational visibility, startup development, program execution, investment readiness, or ecosystem collaboration. If a feature serves none of these, it should not be built.
2. **Pillar 1 foundation:** Operations OS must be complete, stabilized, and validated before building on top of it. No new OS work until Pillar 1 passes all acceptance criteria.
3. **i18n mandatory:** every user-facing string (page, modal, component, notification, email, validation message, label) must exist in **both English and French** via `t()`. Not done until French is present.
4. **Existing implementation first:** never rebuild, never redesign. Understand the current code → test as an end user → compare with spec → extend/fix, don't replace.
5. **One user = one weekly standup per operational week:** no duplicate standups for the same user in the same week.
6. **Task assignment requires acceptance:** no task becomes another user's responsibility without explicit Accept/Decline. Assignment history is preserved.
7. **Blocker resolution:** only the blocker creator can mark it resolved. A task with active blockers cannot be completed.
8. **Parent task completion:** parent tasks are completable only when all required subtasks are completed AND all active blockers are resolved.
9. **Destructive operations:** never DROP/delete financial or audit data — flag/void instead.
10. **RLS + app-level checks:** Row Level Security alone is not sufficient. App code must also enforce scoping.
11. **No redesign:** Sprint 01 explicitly forbids UI redesign. Change UI only when a business rule or usability defect requires it. No personal-preference changes.

## 4. Strategic Roadmap

| Phase | Status | Focus |
|---|---|---|
| **Phase 1** — Foundation (Operations OS) | ✅ In place | Tasks, standups, retros, internal reporting |
| **Phase 2** — Program Management | 🔄 In progress | Programs, cohorts, sessions, deliverables, mentorship |
| **Phase 3** — Venture OS | 🎯 Current priority | Startup framework, milestones, investment-readiness score |
| **Phase 4** — Investor Intelligence | 📋 Planned | Dashboard, pipeline, due diligence, portfolio |
| **Phase 5** — Ecosystem Platform | 🔭 Long-term | Public marketplace, ecosystem intelligence |

### Sprint 01 — Operations OS Stabilization (active)

**Goal:** stabilize, not rebuild. Operations OS already has substantial implementation. 10 modules (M1–M10): personal tasks, weekly standups, retros, projects, categories, blockers, messaging, task assignments, org reporting, operational indicators.

**6-phase developer workflow mandated:**
1. **Comprehension** — explore, understand the business workflow, do not code before mastering.
2. **Functional testing** — test as an end user. Document bugs and missing behavior.
3. **Analysis** — compare with validated operational model.
4. **Implementation** — fix bugs, complete missing features, preserve compatibility.
5. **Validation** — re-test, verify no regressions, correct permissions, accurate reports.
6. **Submission** — accepted only if all bugs resolved, business behavior correct, E2E validated, no unnecessary UI changes.
