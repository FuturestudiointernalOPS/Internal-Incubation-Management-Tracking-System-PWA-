# Intelligence Module — Supervisor Feedback & Decisions

> Decision record for the discussions held with the supervisor about the
> **Intelligence** module (`/admin/intelligence`) on the
> `feature/interns-data-analysis` branch. Companion to
> [`INTELLIGENCE_METRICS_PROPOSAL.md`](./INTELLIGENCE_METRICS_PROPOSAL.md),
> which lists the proposed metrics. This document captures **what was decided,
> what was excluded, and the final state of the sidebar** so the reasoning is
> not lost.

---

## 1. Summary of decisions

| # | Decision | Detail |
|---|---|---|
| D1 | Scope: implement **all new metrics** from the proposal | Every metric marked "New — to build" must be built, with the two exclusions below. |
| D2 | **Exclude — Coach analytics aggregate (Venture OS)** | Attendance, scores, hours per coach were NOT implemented. Another plan owns it. |
| D3 | **Exclude — Investor OS new metrics** | Funnel conversion, burn-rate per program, budget execution rate were NOT implemented. Investor OS is handled by another plan; nothing may be added at that level. |
| D4 | **Investor OS must remain untouched** | The existing investor metric (the "report" / executive analysis, cf. `src/app/api/investor/executive-dashboard/route.js`) must be preserved exactly as it was. Only read-only reuse of its already-computed metrics is acceptable. |
| D5 | Sidebar: **new top-level `INTELLIGENCE` entry right after `OPERATIONS`** | A new element, not the relocation of an existing one. |
| D6 | Sidebar: **single top-level entry, no duplicate** | After clarifying that the French label "Renseignement" and the English "Intelligence" are the same i18n node, the entry lives only at the top level (after OPERATIONS). Nothing is restored under Base de connaissances. |
| D7 | Investor pillar on the Intelligence page stays as-is | The reused Investor OS metrics (pipeline distribution, fundraising amounts, active relationships) were already delivered in iteration 1 and remain unchanged, read-only. |

---

## 2. The Investor scope — why nothing was touched

The supervisor was explicit: **do not touch the Investor metric**, the entire
Investor OS measurement must be preserved exactly as it was when the related
report (executive analysis) was produced.

Verified deliverables:

- `/api/investor/executive-dashboard` (`src/app/api/investor/executive-dashboard/route.js`)
  — untouched.
- `src/models/investor.js`, `src/models/investorRelations.js` — untouched.
- `git status` shows **no** modified Investor files.
- `src/models/intelligence.js` — `getInvestorMetrics()` was **not modified**
  this iteration; it only **reuses** already-computed data
  (`investment_pipeline`, `fundraising_campaigns`, `investment_decisions`,
  `relationship_workspaces`) with read-only `SELECT`s.
- The "New — to build" Investor metrics (funnel conversion, burn-rate per
  program, budget execution rate) were intentionally **not implemented**.

> Note: `docs/INTELLIGENCE_METRICS_PROPOSAL.md` lists Investor OS as one of the
> four pillars (for the aggregated view). "Do not touch" means: do not change
> the underlying investor computations and do not add new investor metrics — the
> aggregated page may only *display* what the product already computes.

---

## 3. The sidebar — "Renseignement" vs "Intelligence"

Context that caused an initial misunderstanding:

- Sidebar labels are rendered through i18n
  (`DashboardLayout`: `t(tnav(item.id)) || item.name`).
- The node `navigation.intelligence` maps to **"Intelligence"** in English
  (`src/locales/en/navigation.json`) and **"Renseignement"** in French
  (`src/locales/fr/navigation.json:93`). It is **one and the same node/page**.
- The old sidebar had this node as a leaf child of **Base de connaissances**
  (KNOWLEDGE), pointing to `/admin/intelligence` — a plain link, **no
  container, no extra sub-pages** (verified via git: the node is a simple
  `{ id: "intelligence", name: "INTELLIGENCE", href: "/admin/intelligence" }`).

### Requested outcome (confirmed)

> Create a brand-new element named `INTELLIGENCE` positioned **right after**
> `OPERATIONS` in the sidebar. Do not move the old one; keep a **single** entry
> (no duplicate under Base de connaissances).

Final state of `src/lib/masterNavigation.js` (super_admin):

```
… finance · operations · INTELLIGENCE · reports · knowledge · lms · security · settings
```

- `MASTER_NAVIGATION`: top-level leaf `{ id: "intelligence", ... }` placed
  between the `operations` section and the `reports` section.
- `ROLE_ACCESS.super_admin.top`: `…, "operations", "intelligence", "reports", …`.
- `ROLE_ACCESS.super_admin.children.knowledge`: only `["knowledge_base"]`.
- `src/__tests__/navigation.test.js`: the `super_admin` fixture must be updated
  to match this new projection (top-level `intelligence`, removed from
  `knowledge` sub-items) — this is the only stale test after the change.

### The placeholder is gone

The old page content ("coming soon" + PENDING badge that said the Intelligence
page was not yet available) has been **fully replaced** by the real module; no
"not available" message remains anywhere.

---

## 4. What was implemented (scope kept)

| Pillar | Implemented metrics |
|---|---|
| **Operations OS** | Task statuses (reused), blockers (reused), weekly op-report compliance **+ standup & retro rates**, **carryover rate**, **completion rate**, **avg blocker resolution time** |
| **Program OS** | Active programs / headcount / avg KPI rate (reused), **program health** (execution × engagement → on-track / at-risk / critical), **deliverables submission rate**, engagement rate per program |
| **Venture OS** | Readiness distribution, avg portfolio readiness, overdue milestones (reused), **portfolio ≥ venture aggregation** |
| **Investor OS** | **Reused only** — pipeline distribution, fundraising amounts, active relationships. Read-only. No new metrics. |
| **CRM (new)** | Invitation → activation rate, contact base growth (total / last 30 days / monthly) |

## 5. Verification status

| Gate | Result |
|---|---|
| `npx jest src/__tests__/intelligence.test.js` | 7/7 passed |
| Full `npm test` | 2554/2555 — the 1 failure is the stale `navigation.test.js` fixture (see D6 / §3) |
| `npm run i18n:parity` | Missing 0 / Obsolete 0 |
| `npm run lint` (changed files) | 0 errors |
| `npm run build` | green |
| Live `GET /api/intelligence/metrics` | HTTP 200 — pillars: ventures, investor, programs, operations, contacts |
| Live `/admin/intelligence` | HTTP 200 |

## 6. Note on the `navigation.test.js` fixture & status

> **What is a "fixture"?** `src/__tests__/navigation.test.js` hard-codes the
> *expected* sidebar projection for every role. For `super_admin` it lists the
> exact top-level order and each section's children, and the test compares it
> against the real output of `buildRoleNav(role)`.
>
> **Rule**: any change to `src/lib/masterNavigation.js` that alters a role's
> projection **must** be mirrored in that fixture, otherwise `npm test` fails
> (the suite would be red). Always run the full test suite before
> committing navigation changes.

### Status

- [x] Update `src/__tests__/navigation.test.js` super_admin fixture so
      `intelligence` is a top-level node right after `operations` (and removed
      from the `knowledge` sub-items). → commit `19fa2d15`. Full suite:
      2555/2555 green.
- [x] Commit the work (1 file = 1 commit) — 10 commits, pushed to
      `feature/intelligence-metrics`.