# STANDARDS.md — ImpactOS Engineering Conventions

> Version: 1.0 | Enforced conventions. These are rules the runtime must follow when implementing in this project.

## 1. JavaScript (ES Modules)

- Project uses `.js` files with ES module syntax (`import`/`export`), not TypeScript. No `.ts` / `.tsx` files exist in the codebase.
- `jsconfig.json` provides path aliases only (`@/*` → `./src/*`).
- No `any` types (no TypeScript). Validate inputs at function boundaries with explicit checks.
- Prefer `const` over `let`; never use `var`.
- Use named exports from utility modules; default exports for components and page modules.

## 2. Lint & Format

- `npm run lint` (ESLint 9 + `next/core-web-vitals`) must pass for touched files.
- Follow existing formatting: 2-space indent, double quotes, trailing commas, semicolons.
- Do not change formatter config mid-task.

## 3. File & Folder Conventions

| Area | Convention | Example |
|---|---|---|
| Routes | role-based folders under `src/app/` | `src/app/admin/op-reports/`, `src/app/staff/op-report/` |
| API routes | `src/app/api/<domain>/route.js` (App Router) | `src/app/api/tasks/route.js` |
| Shared components | PascalCase under `src/components/<domain>/` | `src/components/ui/AppCard.js`, `src/components/tasks/TaskManager.js` |
| Lib modules | camelCase under `src/lib/` | `src/lib/auth.js`, `src/lib/db.js` |
| Hooks | camelCase under `src/lib/hooks/` | `src/lib/hooks/useApi.js` |
| Locales | JSON under `src/locales/<lang>/` | `src/locales/en/common.json` |
| Migrations | SQL under `src/migrations/` or `supabase/migrations/` | `supabase/migrations/20260701_create_finance_schema.sql` |
| Scripts | `.js` / `.mjs` under `scripts/` | `scripts/sync-finance.js` |

## 4. Internationalization (i18n) — CRITICAL

- **Every user-visible string MUST use the `t()` function.** No exceptions. No hardcoded English.
- New strings require entries in BOTH `src/locales/en/` and `src/locales/fr/` with mirrored key structure.
- English is the source of truth; missing French key → shows English value (graceful fallback).
- Use existing key namespaces before creating new ones: `common.*`, `auth.*`, `navigation.*`, `admin.*`, `reports.*`, `staff.*`, `status.*`, `time.*`, `errors.*`, `pm.*`, `participant.*`, plus the feature namespaces (`lms.*`, `membership.*`, `venture.*`, `investor.*`, `forms.*`, `finance.*`, `messaging.*`, `crm.*`, `team.*`, …).
- See `AGENTS.md` for the full namespace table and file structure.

## 5. Design System & Styling

- **Use CSS variables for ALL colors:** `var(--text-primary)`, `var(--surface-1)`, `var(--border-primary)`, etc.
- **NO hardcoded hex colors in JSX.** No `#fff`, `#0a0a1a`, `#f1f5f9`, etc.
- **NO `dark:` Tailwind variants** — these respond to OS preference, not our `data-theme` attribute.
- **NO Tailwind slate/white/black classes** for themed text or backgrounds (`text-slate-500`, `bg-white`, `text-black`).
- Acceptable Tailwind utility classes: `bg-surface-1`, `bg-surface-2`, `bg-surface-3`, `text-muted`, `text-tertiary`, `border-soft`.
- Semantic status colors (`text-emerald-500`, `text-rose-500`, `text-amber-500`, `text-indigo-500`) are allowed ONLY for status indicators — not general UI.
- Chart colors use `var(--chart-*)` tokens.
- Reuse `src/components/ui/` primitives (AppCard, AppButton, AppInput, AppSelect, AppModal, AppTable, AppBadge, AppStatusBadge, AppTabs, AppEmptyState, AppPagination, Skeleton) before building new ones.
- Theme toggling uses `useTheme()` from `src/lib/ThemeProvider.js`. Never set `data-theme` directly on `<html>`.

## 6. Auth & Permissions

- New protected pages must call `requireAuth([allowedRoles])` or `requireSession()` at the top — no exceptions.
- New API routes must call `requireAuth()` before any data access. Do not trust client-supplied role claims.
- Use `requireCapability(module, capability, minLevel)` for module-level authorization beyond basic role checks.
- Never use the Supabase service role key (`SUPABASE_SERVICE_ROLE_KEY`) in client components — it bypasses RLS and must stay server-side.
- Do not import `supabase.js` (anon key) for write operations that should use the service role (e.g., file uploads, admin provisioning).
- The access-profile system (`requireCapability` / access profiles) is the current path for permission enforcement; every route also sits behind the central gate in `src/proxy.js`.

## 7. Data Access

- All database queries go through `db.execute({sql, args})` from `src/lib/db.js`.
- Use `?` placeholders — the executor translates to `$1, $2, …` automatically.
- Use `db.transaction(callback)` for multi-statement operations that must be atomic.
- **Do not write SQL inline in route handlers** — put each query in a named function under `src/models/<domain>.js` (see `docs/MVC_REFACTOR.md`).
- SQLite-isms (`datetime('now')`) are auto-translated to Postgres (`NOW()`), but prefer native Postgres syntax in new code.
- Never write to `id` columns — rely on `gen_random_uuid()` defaults.

## 8. Database / Migrations

- New schema changes go in `supabase/migrations/` with a `YYYYMMDD_description.sql` timestamp prefix.
- Style: idempotent (`IF NOT EXISTS` / `IF EXISTS`), `gen_random_uuid()` for UUIDs, `TIMESTAMPTZ` + `NOW()`, `DECIMAL` for money/scores.
- Destructive changes (DROP, column removal, data loss): require explicit user approval; prefer soft flags/voids.
- After schema changes: grep the codebase for the affected table/column and fix any query that still references the old shape.
- Do NOT create a new migration in `src/migrations/` — use `supabase/migrations/` for all new schema work.

## 9. Pages & Rendering

- Layouts that render session-derived content (`admin/layout.js`, `facilitator/layout.js`, `platform/layout.js`, the `*/messages` layouts) MUST export `dynamic = "force-dynamic"`. Never remove it where present.
- New pages outside these layouts that use client hooks (`useI18n()`, `useTheme()`, `useRouter()`, `localStorage`) must also export `dynamic = "force-dynamic"`.
- Public pages (login, register, forgot-password, invite, activate, setup-password) do NOT need `force-dynamic`.

## 10. Sprint 01 Engineering Rules

During the Operations OS stabilization sprint, these additional rules apply:

- **Do not rebuild.** Understand existing implementation first, then extend/fix.
- **Do not redesign the UI** unless a business rule or usability defect requires it. No personal-preference changes.
- **Test as an end user** before writing code. Document what's broken.
- **Preserve backwards compatibility.** No existing workflow may break.
- **Reuse over duplicate:** APIs, components, DB tables, services, utils, global styles. Create new only when nothing suitable exists.
- **6-phase workflow:** Comprehension → Functional Testing → Analysis → Implementation → Validation → Submission. Must follow this order.

## 11. The `.ai` Framework Itself

- Follow the runtime: `SYSTEM.md` orchestrates, skills do the work, PROJECT/MEMORY/STANDARDS provide knowledge.
- Do not put project knowledge in skills; do not put skills in this file.
- If a convention changes, update STANDARDS.md in the same change that introduces it.

## 12. Testing

- Run everything with `npm test` (`jest --runInBand`); a single suite with
  `npx jest src/__tests__/<name>.test.js`.
- **Default environment is `node`** — services, routes and pure modules run there and
  mock `@/lib/db` + `@/lib/auth` + `@/lib/authorization` (see
  `src/__tests__/helpers/fakeLmsDb.js` for the in-memory DB interpreter).
- **Component tests opt into jsdom** with a docblock pragma on the first line:

  ```js
  /**
   * @jest-environment jsdom
   *
   * …
   */
  ```

  The pragma must be followed by a blank line, otherwise the following text is read
  as part of the environment name. `@babel/preset-react` (automatic runtime) is
  configured for every test file.
- **Component test conventions**
  (see `src/__tests__/lms-section-resources-upload-ui.test.js`):
  - `@testing-library/react` (`render`, `screen`, `fireEvent`, `waitFor`);
  - mock the network, never the component: assert on the request contract and the
    rendered result (`fetch` is replaced by a `jest.fn` that answers by URL);
  - `lucide-react` is mapped to its CJS build in the jest config, so icons render
    for real without transforming `node_modules`;
  - mock `framer-motion` with **stable** passthrough components (a fresh component
    type per `motion.x` access remounts the subtree and detaches the nodes your
    assertions hold);
  - `useI18n()` outside a provider returns the key itself, so asserting a key
    string both checks the text AND proves it goes through `t()`;
  - `fireEvent.drop(target, { dataTransfer: { files: [file] } })` simulates a drop
    (jsdom has no `DataTransfer`);
  - assert previews/embeds are NOT rendered before interaction — "nothing loads by
    itself" is part of the contract.
- Every new behavior ships with tests; a fix ships with the test that would have
  caught it. Report pre-existing failures separately instead of fixing them silently.
