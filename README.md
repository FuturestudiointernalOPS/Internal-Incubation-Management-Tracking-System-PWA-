# ImpactOS — FutureStudio Operational Control

Internal incubation management & tracking system for FutureStudio: programs, projects, tasks, blockers, weekly reports, and staff/participant management across multiple roles.

> **AI Agents: Read [`AGENTS.md`](AGENTS.md) before making any changes.**
> Critical rules for i18n, component usage, and build requirements.

## Environments

| Environment | Branch | Vercel | Database |
|---|---|---|---|
| **Production** | `main` | Auto-deploys on push | Production Supabase |
| **Staging** | `dev` | Preview deploys | Staging Supabase |

### Staging Database

- **Supabase URL:** `https://mbpaxrfhqqclzyiefuab.supabase.co`
- **Credentials:** See `.env.staging` (gitignored, ask a team member)
- **Env vars for Vercel Preview:** Upload `impactos-staging.env` to Vercel → Settings → Environment Variables → Preview scope

---

## Stack

- **Framework:** [Next.js](https://nextjs.org) (App Router), React
- **Database:** PostgreSQL (via `pg`), with [Supabase](https://supabase.com) for auth/storage
- **Styling:** Tailwind CSS + custom design tokens (see [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md))
- **Email:** [Resend](https://resend.com) + Gmail API (`googleapis`)
- **AI:** DeepSeek (`deepseek-chat`) — mentor feedback parsing and insights
- **Storage:** Supabase Storage (file uploads)
- **Exports:** `read-excel-file` / `write-excel-file` (Excel), `jspdf` + `html2canvas` (PDF)
- **i18n:** custom `t()` system, English + French (`src/locales/`)
- **Charts:** Recharts
- **Deployment:** Vercel (Node.js 22+)

---

## Roles

The app serves several roles, each with its own dashboard under `src/app/`:

| Role | Route prefix | Default Profile | Description |
|---|---|---|---|
| `super_admin` | `/admin` | Super Admin Default | Full platform control — programs, projects, staff, reports, intelligence |
| `program_manager` | `/pm` | Program Manager | Manages assigned programs/projects, reviews staff reports |
| `staff` | `/staff` | Staff Default | Submits weekly op-reports, tracks tasks/blockers |
| `participant` | `/participant` | Participant Default | Program participant view |
| `facilitator` | `/facilitator` | Facilitator | Program facilitation |
| `investor` | `/investor` | Investor | Investor portal |
| `finance` | `/finance` | Finance | Finance workspace |
| `crm` | `/crm` | CRM | Contacts, membership, timeline |
| `team` | `/team` | Team | Team workspace |

Role resolution and the sidebar navigation matrix live in `src/lib/masterNavigation.js` (rendered by `src/components/layout/DashboardLayout.js`).

### Test accounts (staging)

Seeded staging users — **staging only, never use these against production**. All use password **`ImpactOS2026!`**:

| # | Role | Email |
|---|---|---|
| 1 | `super_admin` | `superadmin@impactos.staging` |
| 2 | `staff` | `staff1@impactos.staging` |
| 3 | `staff` | `staff2@impactos.staging` |
| 4 | `developer` | `developer@impactos.staging` |
| 5 | `participant` | `participant@impactos.staging` |
| 6 | `program_manager` | `pm@impactos.staging` |
| 7 | `admin` | `admin@impactos.staging` |
| 8 | `investor` | `investor@impactos.staging` |
| 9 | `mentor` | `mentor@impactos.staging` |

> Note: `admin`, `investor`, and `mentor` (#7–9) are seeded but have no dedicated dashboard: `/admin` admits only `super_admin` (and the session's effective capabilities), and there is no `/mentor` surface. `investor` has its own `/investor` portal, and all three resolve to an access profile in `src/lib/auth.js` (`seedDefaultAccessProfiles`). Sidebar masks live in `src/lib/masterNavigation.js` (`ROLE_ACCESS`).

---

## Getting Started

### Prerequisites

- Node.js, npm
- A PostgreSQL database (connection string in `DATABASE_URL`)
- Environment variables — see `.env.local` (not committed; ask a team member for values). Known keys include `DATABASE_URL`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `NEXT_PUBLIC_APP_URL`, Supabase keys.

### Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Other scripts

```bash
npm run build   # production build
npm run start   # serve production build
npm run lint    # eslint
```

### Initialize a database

There is no single bootstrap script: apply the SQL migrations (`src/migrations/`, `supabase/migrations/`) and run the seed scripts under `scripts/migrations/` (e.g. `seed_demo_all.mjs`). Access profiles and responsibilities are seeded by `seedDefaultAccessProfiles()` / `seedDefaultResponsibilities()` in `src/lib/auth.js`.

### Database migrations

SQL migrations live in `src/migrations/`. Schema-change scripts (Node/`.mjs`) live in `scripts/migrations/` — run individually with `node scripts/migrations/<file>.mjs`, they're idempotent.

---

## Git Workflow

```
dev  →  merge into main  →  push main (triggers production deploy)
```

- **`dev`** — staging, safe to break
- **`main`** — production, deployable only

---

## Project Structure

```
src/
  app/            Next.js App Router — pages per role (admin/, staff/, pm/, participant/, facilitator/, investor/, finance/, crm/, team/)
    api/          403 API route handlers, grouped by domain (see docs/API.md)
  components/
    layout/       DashboardLayout, sidebar, navigation matrix
    dashboard/    Dashboard-specific widgets
    tasks/        Task/blocker UI
    messaging/    Internal comms UI
    ui/           Reusable design-system components (AppCard, AppButton, etc.)
  lib/            DB client, auth, shared business logic, hooks/, integrations/
  locales/        i18n strings — en/ and fr/, mirrored key structure
  migrations/     SQL schema migrations
  utils/          Small shared utilities (caching)
scripts/
  migrations/     Node migration/seed scripts (historical + re-runnable)
  *.js            Reusable ops tooling (E2E tests, cleanup runner, orphan audit)
docs/             Architecture, API reference, module reference, tickets, audits
```

---

## Documentation

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — how the app fits together (auth, roles, data flow, i18n)
- [`docs/API.md`](docs/API.md) — all API routes, grouped by domain, with purpose
- [`docs/MODULES.md`](docs/MODULES.md) — `src/lib`, `src/components`, `src/utils` reference
- [`docs/MVC_REFACTOR.md`](docs/MVC_REFACTOR.md) — the Model–View–Controller layering guide
- [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md) — design tokens, reusable components, styling rules
- [`AGENTS.md`](AGENTS.md) — rules for AI agents editing this codebase (i18n is mandatory, no exceptions)
- [`docs/TICKET_*.md`](docs) — feature specs (implemented features archived here)

---

## Deployment

Deployed on [Vercel](https://vercel.com). See [Next.js deployment docs](https://nextjs.org/docs/app/building-your-application/deploying) for general guidance.
