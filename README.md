# ImpactOS

Startup development and innovation-ecosystem operating system: incubation
programmes, venture tracking, investor intelligence and internal operations, in
one platform. Built for incubators, accelerators, venture studios, programme
managers and investors — it began as Future Studio's internal tool.

> **New to the project?**
> Read [`OVERVIEW.md`](OVERVIEW.md) for the big picture (what the product is,
> who uses it, how the code is organised), then [`CONTRIBUTING.md`](CONTRIBUTING.md)
> for setup, the non-negotiable rules and the quality gates.
>
> **AI agents: read [`AGENTS.md`](AGENTS.md) before making any changes.**

## The five pillars

Everything in the product serves at least one of these. A feature that serves
none of them should not be built.

| Pillar | Scope | Primary users |
|---|---|---|
| **Operations OS** | Internal work: tasks, standups, retros, blockers, projects, reporting | Staff, managers |
| **Program OS** | Incubation programmes: curriculum, sessions, deliverables, participants, progress | Managers, participants |
| **Venture OS** | The startup's track: stages, milestones, deliverables, investment readiness | Founders, coaches |
| **Investor OS** | Investor view: discovery, pipeline, due diligence, portfolio | Investors |
| **Ecosystem OS** | The network: directory, opportunities, partnerships *(long-term vision)* | The ecosystem |

See [`OVERVIEW.md`](OVERVIEW.md) for the domain map and [`PRODUCT.md`](PRODUCT.md)
for the full product reference.

---

## Environments

| Environment | Branch | Vercel | Database |
|---|---|---|---|
| **Production** | `main` | Auto-deploys on push | Production Supabase |
| **Staging** | `G` (twin: `Ventures`) | Preview deploys | Staging Supabase |

Staging and production are **different databases** — the same code does not
imply the same data.

### Staging database

- **Supabase URL:** `https://mbpaxrfhqqclzyiefuab.supabase.co`
- **Credentials:** environment files are gitignored — ask a team member. On the
  reference machine, `.env.local` points at **this staging database**, so local
  writes land in shared data.
- **Env vars for Vercel Preview:** upload `impactos-staging.env` to Vercel →
  Settings → Environment Variables → Preview scope.

---

## Stack

- **Framework:** [Next.js](https://nextjs.org) 16 (App Router), React 19
- **Language:** JavaScript (ES modules) — no TypeScript in this codebase
- **Runtime:** Node.js **22 or newer** (`package.json` enforces it)
- **Database:** PostgreSQL via `pg`; [Supabase](https://supabase.com) for file
  storage and admin tasks — **not** the login flow (auth is custom, see below)
- **Styling:** Tailwind CSS + custom design tokens ([`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md))
- **Email:** [Resend](https://resend.com) + Gmail API (`googleapis`)
- **AI:** DeepSeek (`deepseek-chat`) — feedback parsing and insights
- **Storage:** Supabase Storage (file uploads)
- **Exports:** `read-excel-file` / `write-excel-file` (Excel), `jspdf` + `html2canvas` (PDF)
- **i18n:** custom `t()` engine, English + French (`src/locales/`)
- **Charts:** Recharts
- **Deployment:** Vercel

---

## Roles

Each role has its own area, under its own address prefix:

| Role | Prefix | What it does |
|---|---|---|
| `super_admin` | `/admin` | Full platform: programmes, projects, staff, ventures, investors, finance, security |
| `program_manager` | `/pm` | Manages assigned programmes and projects, reviews staff reports |
| `staff` | `/staff` | Submits weekly op-reports, tracks own tasks and blockers |
| `participant` | `/participant` | Programme participant view: deliverables, progress, certificates |
| `facilitator` | `/facilitator` | Programme facilitation |
| `investor` | `/investor` | Investor portal |
| `finance` | `/finance` | Finance workspace |
| `crm` | `/crm` | Contacts, membership, timeline |
| `team` | `/team` | Team workspace |

Two **contextual** roles have no dedicated prefix: `founder` and `member`. They
exist inside the Venture and Programme surfaces, attached to a specific venture.

Sidebar navigation is defined once in `src/lib/masterNavigation.js` (the master
tree plus per-role masks) and built for the connected user by capabilities;
`src/components/layout/DashboardLayout.js` only renders it. The effective role is
**always** the session user's — never the page being visited.

### Test accounts (staging)

Seeded staging users — **staging only, never use these against production**. All
use password **`ImpactOS2026!`**:

| # | Role | Email |
|---|---|---|
| 1 | `super_admin` | `superadmin@impactos.staging` |
| 2 | `staff` | `staff1@impactos.staging` |
| 3 | `staff` | `staff2@impactos.staging` |
| 4 | `participant` | `participant@impactos.staging` |
| 5 | `program_manager` | `pm@impactos.staging` |
| 6 | `investor` | `investor@impactos.staging` |

> **Caution:** some older seeded accounts (`developer`, `admin`, `mentor`) belong
> to personas that were retired from the product or that never had a surface of
> their own. They may no longer work. The authority is the live staging data —
> check there before relying on an account. Access profiles are seeded by the
> authorization model layer, not by `src/lib/auth.js`.

---

## Getting Started

### Prerequisites

- **Node.js 22+** and npm
- A PostgreSQL connection string (`DATABASE_URL`)
- Environment variables in `.env.local` (not committed — ask a team member).
  Known keys: `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`,
  `RESEND_FROM_EMAIL`, `NEXT_PUBLIC_APP_URL`.

> Before running any script that **writes** to the database, check which database
> it targets. Some tools read `.env.local` first (the shared staging database);
> at least one migration tool defaults to a **production** env file. See
> [`CONTRIBUTING.md`](CONTRIBUTING.md) §2.

### Run locally

```bash
npm install
npm run dev           # http://localhost:3000
```

### Scripts

```bash
npm run dev               # development server
npm run build             # production build
npm run start             # serve the production build
npm run lint              # eslint (must be 0 errors)
npm test                  # full jest suite
npm run i18n:parity       # translation key parity (Missing must be 0)

npm run verify:alignment      # feature/capability alignment
npm run db:align              # apply the alignment migration
npm run backfill:founder-ledger
npm run sync-finance          # Google Sheets -> ImpactOS
```

A single test file: `npx jest src/__tests__/<name>.test.js`.

---

## Database & migrations

- **New schema work goes in `supabase/migrations/`** — idempotent SQL with a
  `YYYYMMDD_` date prefix.
- Do **not** add new files to `src/migrations/` or the legacy root `migrations/`
  folder; those are historical.
- Schema-change scripts (Node/`.mjs`) live in `scripts/migrations/` — run them
  individually, they are idempotent.
- **There is no single bootstrap script**, and there is no concatenated schema
  snapshot: the authoritative reference is the **live staging database**. Verify
  older domains against it before assuming a shape.
- Destructive changes (dropping tables or data) require explicit approval — prefer
  soft flags over deletion.

---

## Git workflow & deployment

```
your branch  →  G (staging, twin: Ventures)  →  main (production, promotion only)
```

- **`G`** (and its twin `Ventures`, which must stay identical) — staging, safe to break
- **`main`** — production; it only ever receives a promotion
- Promoting to `main` is a **manual, item-by-item** procedure — see
  [`docs/PRODUCTION_TEST.md`](docs/PRODUCTION_TEST.md). It is not `npm test` and
  not `npm run build`: staging and production are different databases.
- Day-to-day branch rules and conventions: [`CONTRIBUTING.md`](CONTRIBUTING.md)
- `dev` is a legacy staging branch and no longer receives work.

---

## Project structure

```
src/
  app/            Next.js App Router — 180+ pages, one folder per role
                  (admin/, staff/, pm/, participant/, facilitator/, investor/,
                   finance/, crm/, team/, platform/) plus public flows
    api/          400+ API route handlers — thin controllers, grouped by domain
  models/         DATA LAYER — every SQL statement lives here, as named functions
  server/
    auth/         Authentication: "who is calling?" (session, cookie, password)
    authz/        Authorization: "may they do this, to this resource?"
  components/
    layout/       The dashboard shell (sidebar + header)
    ui/           Reusable design-system components (AppCard, AppButton, ...)
    dashboard/ tasks/ messaging/ ventures/ permissions/ …
  lib/            Infrastructure: db pool, i18n, email, storage, hooks,
                  integrations — plus facades re-exporting moved domain modules
  locales/        Translations — en/ and fr/, mirrored key structure
scripts/
  migrations/     Node migration/seed scripts (historical + re-runnable)
docs/             Architecture, API reference, audits, tickets, runbooks
```

---

## Documentation

**Start here**

- [`OVERVIEW.md`](OVERVIEW.md) — the big picture: product, roles, domains, request
  path, permission model, vocabulary
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — setup, non-negotiable rules, quality
  gates, branch model, known traps
- [`AGENTS.md`](AGENTS.md) — rules for AI agents editing this codebase

**Product**

- [`PRODUCT.md`](PRODUCT.md) — product reference, five pillars, roadmap
- [`docs/HANDOVER_VENTURES.md`](docs/HANDOVER_VENTURES.md) — Venture OS handover

**Engineering**

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — how the app fits together
- [`docs/SERVER_LAYERS.md`](docs/SERVER_LAYERS.md) — where server code goes
- [`docs/MVC_REFACTOR.md`](docs/MVC_REFACTOR.md) — the layering guide and its state
- [`docs/API.md`](docs/API.md) — API routes, grouped by domain
- [`docs/MODULES.md`](docs/MODULES.md) — module-by-module reference
- [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md) — design tokens and reusable components

**Security & operations**

- [`docs/SECURITY_AUDIT_REGISTER.md`](docs/SECURITY_AUDIT_REGISTER.md) — findings fixed and still open
- [`docs/AUTHZ_CURRENT_STATE.md`](docs/AUTHZ_CURRENT_STATE.md) — the permission system
- [`docs/PRODUCTION_TEST.md`](docs/PRODUCTION_TEST.md) — the promotion procedure
- [`.ai/STANDARDS.md`](.ai/STANDARDS.md) — enforced conventions
