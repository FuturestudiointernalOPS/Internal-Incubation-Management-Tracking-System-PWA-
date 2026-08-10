# MEMORY.md — Durable Project Knowledge

> Version: 1.0 | Curated, reusable knowledge only. **Never store chat history or full conversations.**
> Add entries when a decision or fact becomes reusable. If this file grows beyond ~150 lines, prune or split.

## Architecture Decisions

- **Custom cookie-session auth over Supabase Auth** — `impactos_session` cookie, `user_sessions` table, 24h expiry. Supabase is used for storage and admin operations, not the primary login flow. No `middleware.js` — auth enforced per-page via `requireAuth()` / `requireSession()`.
- **No centralized middleware** — intentional choice: every page/route enforces its own auth. Trade-off: ~30 API routes lack auth, 39 use `requireAuth(null)` (no role gate). Middleware is a known remediation task (see ARCHITECTURE_TECH_DEBT.md Wave 1).
- **Role + capability dual auth** — roles (`super_admin`, `program_manager`, `staff`, `teacher`, `participant`, `developer`) get you in the door; capabilities (per-module ACCESS_LEVELS from NONE to FULL) decide what you can do. V2 access profiles layer adds group-based overrides.
- **5 Pillar architecture** — Operations OS, Program OS, Venture OS, Investor OS, Ecosystem OS. Each pillar builds on the previous; none ships until its foundation is stable.
- **CSS variable theming over Tailwind dark mode** — `data-theme` attribute on `<html>`, CSS custom properties, NO `dark:` variants. Theme managed by `ThemeProvider` + `localStorage`. This avoids OS-level dark mode conflicts.
- **Custom i18n engine** — not `next-intl` or similar. `t()` function with deep key resolution, English fallback, French mandatory. Locale files split by feature area under `src/locales/en/` and `src/locales/fr/` with mirrored key structure.
- **Single Postgres pool** — `src/lib/db.js` with `pg.Pool`, connection retry, `?` → `$N` translation, statement timeout, forensic tracing. No ORM. SQL is written inline in route handlers (known tech debt).
- **Deployed on Vercel** — `main` = production (auto-deploy), `dev` = staging (preview deploys). Staging Supabase at `mbpaxrfhqqclzyiefuab.supabase.co`.

## Reusable Facts

- **Roles:** `super_admin` | `program_manager` | `staff` | `teacher` | `participant` | `developer` | `investor` | `mentor`. Investor and mentor are seeded but not yet wired into role-checking logic.
- **Session cookie:** `impactos_session`, constant `SESSION_COOKIE_NAME` in `src/lib/auth.js`. 24h default, extendable via "remember me" flag.
- **Task statuses:** `pending | in_progress | completed | blocked | cancelled`. Enforced by `STATUS_CONFIG` in `src/lib/constants.js`.
- **Task priorities:** `Critical | High | Medium | Low`.
- **Blocker severity:** `critical | high | medium | low`. Color-coded via `SEVERITY_COLORS`.
- **Standup/retro cycle:** one user = one weekly standup. Monday: system checks for existing, prompts creation if missing. End of week: retro reconciles all tasks → mark completed or raise blocker.
- **Project task correlation:** any task linked to a project automatically contributes to that project's reports and progress calculations.
- **i18n key namespaces:** `common.*` (generic UI), `auth.*`, `navigation.*`, `admin.*`, `reports.*`, `staff.*`, `status.*`, `time.*`, `errors.*`, `teacher.*`, `pm.*`, `participant.*`. See `AI_AGENT_INSTRUCTIONS.md` for the full table.
- **Design tokens (CSS vars):** `--bg-primary`, `--surface-1/2/3`, `--text-primary/secondary/tertiary`, `--border-primary/secondary`, `--brand-orange: #FF6600`, `--brand-blue: #0066FF`. Never hardcode hex colors in JSX.
- **Status colors (semantic, not themed):** `text-emerald-500` (success), `text-rose-500` (danger), `text-amber-500` (warning), `text-indigo-500` (info).
- **DB `uuid` generation:** uses `gen_random_uuid()` via pgcrypto extension.
- **Postgres parameter style:** `?` placeholders in code are translated to `$1, $2, …` by `db.execute()`.
- **Force-dynamic:** every role dashboard layout (`admin/layout.js`, `staff/layout.js`, etc.) exports `dynamic = "force-dynamic"`. Never remove this — session-derived content must not be statically cached.
- **Calendar integration:** Microsoft Graph API (client-credentials), with Google Calendar as a stub. Sync engine pushes local events to the external provider.
- **Notion sync:** one-way push (ImpactOS → Notion) for tasks and projects.
- **Finance sync:** Google Sheets → ImpactOS via `src/lib/finance.js`, run with `npm run sync-finance`.
- **File storage:** Vercel Blob (primary) + Supabase Storage (secondary/fallback).
- **Email:** Resend (primary), Nodemailer + Mailgen (templates/fallback).

## Frequently Used Utilities

- `src/lib/db.js` — `db.execute({sql, args})`, `db.transaction(callback)`, `initDb()`.
- `src/lib/auth.js` — `createSession`, `getSession`, `requireAuth`, `requireSession`, `requireCapability`, `requireCapabilityV2`, `hasCapability`.
- `src/lib/i18n.js` — `I18nProvider`, `useI18n`, `t()`.
- `src/lib/ThemeProvider.js` — `ThemeProvider`, `useTheme`.
- `src/lib/constants.js` — `STATUS_CONFIG`, `STATUS_LIST`, `SEVERITY_COLORS`, `formatDate`, `formatLabel`, `getWeekNumber`, `CHART_COLORS`.
- `src/lib/hooks/useApi.js` — `useApi`, `useApiMulti` (generic data fetching with caching).
- `src/lib/reportError.js` — `reportError`, `createSafeFetch` (client-side error reporting).
- `src/lib/audit.js` — `logAuditEvent`, `isTaskLocked` (6-day lock).
- `src/lib/taskAudit.js` — `logTaskEvent`, `ACTION_TYPES` (immutable assignment audit).
- `src/lib/storage.js` — `uploadFile`, `deleteFile`.
- `src/lib/email.js` — `sendInviteEmail`, `sendWelcomeEmail`, `sendPasswordResetEmail`.
- `src/lib/standupUpsert.js` — auto-creates weekly standup when tasks are created.
- `src/utils/impactCache.js` — `IMPACT_CACHE` (localStorage caching under `impactos_cache_` prefix).
- `src/utils/prefetch.js` — `prefetchData`, `getPrefetchedData` (pre-navigation data loading).

## Known Issues & Technical Debt

1. **No centralized middleware** — 30 API routes lack auth, 39 use `requireAuth(null)` (no role check). Every new route must manually remember to add auth; one omission = one breach. Fix is planned (ARCHITECTURE_TECH_DEBT.md Wave 1).
2. **God files** — 33 files > 500 lines, including 4 files > 2000 lines: `pm/programs/[id]/page.js` (5001 lines), `staff/op-report/page.js` (3579), `admin/op-reports/page.js` (2294), `TaskManager.js` (2117). Single-responsibility principle violations — changing one feature risks breaking unrelated ones.
3. **No data-access layer** — SQL queries are written inline in route handlers. The same query patterns are duplicated across multiple files. If a table changes, N files must be updated. A `src/lib/db/queries/` module is planned.
4. **Schema drift — 162 broken SQL statements** — code and live database schema have diverged in ~12 clusters (password reset, participant enrollment, campaign emails, rituals, curriculum, forms, KPI progress, attendance). These code paths throw 500 errors at runtime. Documented in `docs/SCHEMA_DRIFT_AUDIT.md`; fixes partially applied in 3 batches.
5. **Zero automated tests** — 0 unit, integration, or E2E tests across 355+ files. Every change relies on manual verification. Regression risk on every edit.
6. **Duplicate migration locations** — SQL migrations in both `src/migrations/` and `supabase/migrations/`. No single source of truth for the current schema shape.
7. **Legacy SQLite files** — `src/lib/impactos.db` and `src/lib/impact_os_v2.db` are tracked in git as binary files from a pre-Postgres era. Not used by current code. Should be confirmed safe to remove.
8. **API boilerplate duplication** — ~120 route handlers repeat the same try/catch + `NextResponse.json` pattern (~800 lines of pure duplication). A `createHandler()` wrapper is planned.
9. **48 dynamically-built SQL queries** — cannot be statically validated. Manual review still needed.
10. **1 debug endpoint leaks schema info** — `debug-db/project-tasks` returns raw query results without auth. Fix is planned (Wave 1).
11. **Cron endpoint without auth** — `notify-deadlines` can be triggered by anyone. Fix is planned.
12. **Upload uses anon key** — file uploads use the Supabase anonymous key with public-write RLS. Should use service role key server-side.
13. **`staging_complete_schema.sql` is not present** — unlike the SchoolAid project this framework was cloned from, ImpactOS does not have a concatenated schema snapshot. The authoritative schema source is the live staging database.

## Maintenance Notes

- Update MEMORY.md when: an architecture decision is made, a known issue is fixed (move to "Resolved" — delete after two releases), or a utility becomes canonical.
- Never append raw conversation text. Facts only.
- If a schema migration is applied, update the relevant cluster in `docs/SCHEMA_DRIFT_AUDIT.md` and note the change here.
