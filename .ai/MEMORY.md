# MEMORY.md — Durable Project Knowledge

> Version: 1.0 | Curated, reusable knowledge only. **Never store chat history or full conversations.**
> Add entries when a decision or fact becomes reusable. If this file grows beyond ~150 lines, prune or split.

## Architecture Decisions

- **Custom cookie-session auth over Supabase Auth** — `impactos_session` cookie, `user_sessions` table, 24h expiry. Supabase is used for storage and admin operations, not the primary login flow. A central gate (`src/proxy.js`, Next.js middleware) validates the session cookie on every request; `requireAuth()` / `requireSession()` remain the per-page/per-route layer.
- **Central gate + per-route guards** — `src/proxy.js` validates the session cookie on every request (redirect to `/login` for pages, 401 for API). Routes keep their own `requireAuth()` role gate on top. Current state: `docs/AUTHZ_CURRENT_STATE.md`.
- **Role + capability dual auth** — roles (`super_admin`, `program_manager`, `staff`, `participant`, plus `facilitator`, `investor`, `finance`, `crm`, `team`, `founder`, `member`) get you in the door; capabilities (per-module ACCESS_LEVELS from NONE to FULL) decide what you can do. The access-profile layer adds group-based overrides.
- **5 Pillar architecture** — Operations OS, Program OS, Venture OS, Investor OS, Ecosystem OS. Each pillar builds on the previous; none ships until its foundation is stable.
- **CSS variable theming over Tailwind dark mode** — `data-theme` attribute on `<html>`, CSS custom properties, NO `dark:` variants. Theme managed by `ThemeProvider` + `localStorage`. This avoids OS-level dark mode conflicts.
- **Custom i18n engine** — not `next-intl` or similar. `t()` function with deep key resolution, English fallback, French mandatory. Locale files split by feature area under `src/locales/en/` and `src/locales/fr/` with mirrored key structure.
- **Single Postgres pool** — `src/lib/db.js` with `pg.Pool`, connection retry, `?` → `$N` translation, statement timeout, forensic tracing. No ORM. All SQL lives in `src/models/**` (MVC refactor); routes call models.
- **Deployed on Vercel** — `main` = production (auto-deploys on push), `G` = staging (`Ventures` is its twin; keep the two level), `dev` = retired. Promoting staging to `main` is a manual procedure (`docs/PRODUCTION_TEST.md`) — staging and production are different databases, so `npm test` / `npm run build` never substitute for it. Staging Supabase at `mbpaxrfhqqclzyiefuab.supabase.co`.

## Reusable Facts

- **Roles (nav/session):** `super_admin` | `program_manager` | `staff` | `participant` | `facilitator` | `investor` | `finance` | `crm` | `team` | `founder` | `member`. The `teacher` and `developer` personas were removed from the product; their route segments, API surface and locale namespaces are gone.
- **Session cookie:** `impactos_session`, constant `SESSION_COOKIE_NAME` in `src/lib/auth.js`. 24h default, extendable via "remember me" flag.
- **Task statuses:** `pending | in_progress | completed | blocked | cancelled`. Enforced by `STATUS_CONFIG` in `src/lib/constants.js`.
- **Task priorities:** `Critical | High | Medium | Low`.
- **Blocker severity:** `critical | high | medium | low`.
- **Standup/retro cycle:** one user = one weekly standup. Monday: system checks for existing, prompts creation if missing. End of week: retro reconciles all tasks → mark completed or raise blocker.
- **Project task correlation:** any task linked to a project automatically contributes to that project's reports and progress calculations.
- **i18n key namespaces:** `common.*`, `auth.*`, `navigation.*`, `admin.*`, `reports.*`, `staff.*`, `status.*`, `time.*`, `errors.*`, `pm.*`, `participant.*`, plus feature namespaces (`lms.*`, `membership.*`, `venture.*`, `investor.*`, `forms.*`, `finance.*`, `messaging.*`, `crm.*`, `team.*`, …). 30 locale files per language under `src/locales/{en,fr}/`. See `AGENTS.md` for the full table.
- **Design tokens (CSS vars):** `--bg-primary`, `--surface-1/2/3`, `--text-primary/secondary/tertiary`, `--border-primary/secondary`, `--brand-orange: #FF6600`, `--brand-blue: #0066FF`. Never hardcode hex colors in JSX.
- **Status colors (semantic, not themed):** `text-emerald-500` (success), `text-rose-500` (danger), `text-amber-500` (warning), `text-indigo-500` (info).
- **DB `uuid` generation:** uses `gen_random_uuid()` via pgcrypto extension.
- **Postgres parameter style:** `?` placeholders in code are translated to `$1, $2, …` by `db.execute()`.
- **Force-dynamic:** session-only sections export `dynamic = "force-dynamic"` at their layout level (e.g. `admin/layout.js`, `facilitator/layout.js`, `platform/layout.js`, and the `*/messages` layouts). Never remove it where present — session-derived content must not be statically cached.
- **Calendar integration:** Microsoft Graph API (client-credentials), with Google Calendar as a stub (`src/models/integrations/calendar/*`). The sync engine pushes Platform form-run deadlines to the external provider.
- **Notion sync:** one-way push (ImpactOS → Notion) for Platform form submissions and runs.
- **Finance sync:** Google Sheets → ImpactOS via `src/lib/finance.js`, run with `npm run sync-finance`.
- **File storage:** Supabase Storage (`src/lib/storage.js`) — public buckets for knowledge-bank files and task attachments, plus a private `deliverable-evidence` bucket read through short-lived signed URLs.
- **Email:** Resend (primary) + the Gmail API via `googleapis` (`src/lib/email.js`, `src/lib/mailer.js`). Templates are rendered by the in-house template engine in `email.js`.

## Frequently Used Utilities

- `src/lib/db.js` — `db.execute({sql, args})`, `db.transaction(callback)`, `initDb()`.
- `src/lib/auth.js` — `createSession`, `getSession`, `requireAuth`, `requireSession`, `requireCapability`, `hasCapability`.
- `src/lib/i18n.js` — `I18nProvider`, `useI18n`, `t()`.
- `src/lib/ThemeProvider.js` — `ThemeProvider`, `useTheme`.
- `src/lib/constants.js` — `STATUS_CONFIG`, `MONTHS`, `DAYS`, `formatDate`, `formatLabel`, `getWeekNumber`.
- `src/lib/hooks/useApi.js` — `useApi`, `useApiMulti` (generic data fetching with caching).
- `src/lib/audit.js` — `logAuditEvent`, `isTaskLocked` (6-day lock).
- `src/lib/taskAudit.js` — `logTaskEvent`, `ACTION_TYPES` (immutable assignment audit).
- `src/lib/storage.js` — `uploadFile`.
- `src/lib/email.js` — `sendInviteEmail`, `sendWelcomeEmail`, `sendPasswordResetEmail`.
- `src/lib/standupUpsert.js` — auto-creates weekly standup when tasks are created.
- `src/utils/impactCache.js` — `IMPACT_CACHE` (localStorage caching under `impactos_cache_` prefix).

## Known Issues & Technical Debt

1. **Route auth** — `src/proxy.js` gates every request centrally, but each route still needs its own role gate (`requireAuth([roles])`). A route that forgets it is session-gated but not role-gated. See `docs/AUTHZ_CURRENT_STATE.md`.
2. **God files** — 33 files > 500 lines, including 4 files > 2000 lines: `pm/programs/[id]/page.js` (5001 lines), `staff/op-report/page.js` (3579), `admin/op-reports/page.js` (2294), `TaskManager.js` (2117). Single-responsibility principle violations — changing one feature risks breaking unrelated ones.
3. **Model layer** — SQL lives in named functions under `src/models/**`; routes orchestrate them. Some API routes under `src/app/api/ventures/**` still call the db directly — see `docs/MVC_REFACTOR.md` for the remaining work.
4. **Schema drift** — historical divergence between code and the live schema; verify queries against the live schema when touching older domains. Tracked in `docs/SECURITY_AUDIT_REGISTER.md` and the migration files.
5. **Tests** — 186 Jest suites (2,486 tests) under `src/__tests__/` (`npm test`). Run them before promoting; a green build alone never substitutes for the production test (`docs/PRODUCTION_TEST.md`).
6. **Duplicate migration locations** — SQL migrations in both `src/migrations/` and `supabase/migrations/`. No single source of truth for the current schema shape.
7. **Legacy facades** — some `src/lib/*.js` files only re-export from `@/models/*` so old import paths keep working; new code imports from `@/models/*` directly.
8. **API boilerplate** — `createHandler()` (`src/lib/api/createHandler.js`) wraps auth + error handling for new routes; many older handlers still repeat the pattern by hand.
9. **48 dynamically-built SQL queries** — cannot be statically validated. Manual review still needed.
10. **Schema source of truth** — there is no concatenated schema snapshot; the authoritative schema source is the live staging database (plus `src/migrations/` and `supabase/migrations/`).

## Maintenance Notes

- Update MEMORY.md when: an architecture decision is made, a known issue is fixed (move to "Resolved" — delete after two releases), or a utility becomes canonical.
- Never append raw conversation text. Facts only.
- If a schema migration is applied, note the change here and in the relevant migration file.
