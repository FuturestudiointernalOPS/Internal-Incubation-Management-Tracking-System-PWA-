# ImpactOS — FutureStudio Operational Control

Internal incubation management & tracking system for FutureStudio: programs, projects, tasks, blockers, weekly reports, and staff/participant management across multiple roles.

> **AI Agents: Read [`AI_AGENT_INSTRUCTIONS.md`](AI_AGENT_INSTRUCTIONS.md) before making any changes.**
> Critical rules for i18n, component usage, and build requirements.

## Stack

- **Framework:** [Next.js](https://nextjs.org) (App Router), React
- **Database:** PostgreSQL (via `pg`), with [Supabase](https://supabase.com) for auth/storage
- **Styling:** Tailwind CSS + custom design tokens (see [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md))
- **Email:** [Resend](https://resend.com) + Mailgen templates, Nodemailer as fallback
- **AI:** Google Generative AI (`@google/generative-ai`)
- **Storage:** Vercel Blob (file uploads)
- **Exports:** `xlsx`, `jspdf`, `html2canvas` (reports/data export)
- **i18n:** custom `t()` system, English + French (`src/locales/`)
- **Charts:** Recharts
- **Deployment:** Vercel

## Roles

The app serves six roles, each with its own dashboard under `src/app/`:

| Role | Route prefix | Description |
|---|---|---|
| `super_admin` | `/admin` | Full platform control — programs, projects, staff, reports, intelligence |
| `program_manager` | `/pm` | Manages assigned programs/projects, reviews staff reports |
| `staff` | `/staff` | Submits weekly op-reports, tracks tasks/blockers |
| `teacher` | `/teacher` | Teaching-specific dashboard |
| `participant` | `/participant` | Program participant view |
| `developer` / `intern` | `/developer` | Internal engineering dashboard |

Role resolution and the sidebar navigation matrix live in `src/components/layout/DashboardLayout.js`.

### Test accounts (staging)

Seeded staging users — **staging only, never use these against production**:

| # | Role | Email | Password |
|---|---|---|---|
| 1 | `super_admin` | `superadmin@impactos.staging` | `ImpactOS2026!` |
| 2 | `staff` | `staff1@impactos.staging` | `ImpactOS2026!` |
| 3 | `staff` | `staff2@impactos.staging` | `ImpactOS2026!` |
| 4 | `developer` | `developer@impactos.staging` | `ImpactOS2026!` |
| 5 | `participant` | `participant@impactos.staging` | `ImpactOS2026!` |
| 6 | `program_manager` | `pm@impactos.staging` | `ImpactOS2026!` |
| 7 | `teacher` | `teacher@impactos.staging` | `ImpactOS2026!` |
| 8 | `admin` | `admin@impactos.staging` | `ImpactOS2026!` |
| 9 | `investor` | `investor@impactos.staging` | `ImpactOS2026!` |
| 10 | `mentor` | `mentor@impactos.staging` | `ImpactOS2026!` |

> Note: `admin`, `investor`, and `mentor` (#8–10) don't currently appear in the role-checking logic (`src/lib/auth.js`, `DashboardLayout.js`'s `NAVIGATION_MATRIX`) — only the six roles in the table above the navigation matrix are actually wired up. These three are likely seeded ahead of planned features. Logging in as one of them probably falls through to the `participant` view or similar default — worth confirming with the team before relying on them.

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

### Database migrations

SQL migrations live in `src/migrations/`. Schema-change scripts (Node/`.mjs`) live in `scripts/migrations/` — run individually with `node scripts/migrations/<file>.mjs`, they're idempotent (safe to re-run, skip already-applied changes).

## Project Structure

```
src/
  app/            Next.js App Router — pages per role (admin/, staff/, pm/, teacher/, participant/, developer/)
    api/          148 API route handlers, grouped by domain (see docs/API.md)
  components/
    layout/       DashboardLayout, sidebar, navigation matrix
    dashboard/    Dashboard-specific widgets
    tasks/        Task/blocker UI
    messaging/    Internal comms UI
    ui/           Reusable design-system components (AppCard, AppButton, etc.)
  lib/            DB client, auth, shared business logic, hooks/, integrations/
  locales/        i18n strings — en/ and fr/, mirrored key structure
  migrations/     SQL schema migrations
  utils/          Small shared utilities (caching, prefetch)
scripts/
  migrations/     Node migration/seed scripts (historical + re-runnable)
  *.js            Reusable ops tooling (E2E tests, cleanup runner, orphan audit)
docs/             Architecture, API reference, module reference, tickets, audits
```

## Documentation

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — how the app fits together (auth, roles, data flow, i18n)
- [`docs/API.md`](docs/API.md) — all API routes, grouped by domain, with purpose
- [`docs/MODULES.md`](docs/MODULES.md) — `src/lib`, `src/components`, `src/utils` reference
- [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md) — design tokens, reusable components, styling rules
- [`AI_AGENT_INSTRUCTIONS.md`](AI_AGENT_INSTRUCTIONS.md) — rules for AI agents editing this codebase (i18n is mandatory, no exceptions)
- [`docs/TICKET_*.md`](docs) — feature specs (implemented features archived here as historical record; `TICKET_intelligence_module.md` at repo root is still active/pending)

## Deployment

Deployed on [Vercel](https://vercel.com). See [Next.js deployment docs](https://nextjs.org/docs/app/building-your-application/deploying) for general guidance.
