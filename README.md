# ImpactOS — FutureStudio Operational Control

> **AI Agents: Read `AI_AGENT_INSTRUCTIONS.md` before making any changes.**

Internal incubation management and tracking system for FutureStudio.

---

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

## Roles & Access

| Role | Default Profile | Description |
|---|---|---|
| `super_admin` | Super Admin Default | Full system access |
| `staff` | Staff Default | Projects, messaging, reports |
| `admin` | Staff Default | Operations, user management, settings |
| `developer` | Developer | Tasks, standups, retros, projects |
| `program_manager` | Program Manager | Programs, participants, reports, comms |
| `teacher` | Instructor | Program delivery, grading, communication |
| `participant` | Participant Default | Own programs, assignments, messaging |
| `investor` | Mentor | Participant progress, messaging |
| `mentor` | Mentor | Participant progress, messaging |

---

## Staging Test Users

All staging users share password: **`ImpactOS2026!`**

| Role | Email |
|---|---|
| super_admin | `superadmin@impactos.staging` |
| staff | `staff1@impactos.staging` |
| staff | `staff2@impactos.staging` |
| developer | `developer@impactos.staging` |
| participant | `participant@impactos.staging` |
| program_manager | `pm@impactos.staging` |
| teacher | `teacher@impactos.staging` |
| admin | `admin@impactos.staging` |
| investor | `investor@impactos.staging` |
| mentor | `mentor@impactos.staging` |

---

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Initialize Staging Database

```bash
node scripts/init_staging_db.js
```

This creates all tables, access profiles, responsibilities, and seeds the 10 test users above.

---

## Git Workflow

```
dev  →  merge into main  →  push main (triggers production deploy)
```

- **`dev`** — staging, safe to break
- **`main`** — production, deployable only

---

## Documentation

- **[Platform Audit](docs/AUDIT_DOCUMENT.md)** — Complete audit of every page, route, tab, filter, and action in ImpactOS
- **[Sidebar Reference](docs/Super_Admin_Sidebar_Reference.html)** — Super Admin sidebar structure
- **Tickets:** [Sidebar Refactor](docs/TICKET_sidebar_refactor.md) · [Unified Staff Report](docs/TICKET_unified_staff_report_view.md) · [Weekly Summary Redesign](docs/TICKET_weekly_summary_redesign.md)

## Tech Stack

- **Framework:** Next.js (App Router)
- **Database:** Supabase (PostgreSQL)
- **Auth:** bcryptjs + cookie-based sessions
- **Deployment:** Vercel
