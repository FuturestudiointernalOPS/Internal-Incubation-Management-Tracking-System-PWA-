# Proposed metrics — Intelligence Module

> Proposal document for the supervisor. Summarizes the metrics that the
> **Intelligence** module (`/admin/intelligence`) aggregates and displays,
> pillar by pillar, plus what the product already computes vs what we need to build.

## Overview

The product tracks 4 measurable worlds ("OS"). A metric = **one activity
question answered by a number**, carried over time.

| Pillar | World measured | Guiding question |
|---|---|---|
| **Operations OS** | internal team (staff) | Is the staff performing well? |
| **Program OS** | incubation programs | Are the programs on track? |
| **Venture OS** | supported startups | Are the startups investment-ready? |
| **Investor OS** | investors and money | Where does funding stand? |

The **added value**: instead of reading thousands of rows of data, the
Intelligence page aggregates these questions into **a single view** and makes
trends visible (hence its name).

---

## 📊 Operations OS — "is the staff performing well?"

### Already computed by the product (reused)
| Metric | Question answered | Source |
|---|---|---|
| Task statuses (total / completed / in progress / blocked / carried over / pending) | Is the team progressing? | `/api/admin/analytics` → `getTaskStatusStats` |
| Blockers (active / resolved) | Is the team blocked? | `getBlockerStatusStats` |
| Weekly reports submitted (standups / retros) for the week | Does staff submit their reports? | `getSubmittedReportCountsByWeek` |

### New — to build
| Metric | Question answered |
|---|---|
| **Op-report compliance rate** = submitters / total staff | How many people file their weekly report? (discipline) |
| **Carryover rate** = carried-over tasks / total | Share of work never finished on time (bad signal) |
| **Completion rate** = completed tasks / total | Does the team meet its objectives? |
| **Average blocker resolution time** | Do blockers get resolved quickly? |

---

## 📈 Program OS — "are the programs on track?"

### Already computed by the product (reused)
| Metric | Question answered | Source |
|---|---|---|
| Number of active programs | How many programs are running? | `countActiveV2Programs` |
| Staff and participants | What population is covered? | `countStaffContacts` / `countParticipantContacts` |
| **Program KPI completion rate** | Is each program's overall goal met? | `getProgramKpiSummary` (`kpi_progress` table) |

### New — to build
| Metric | Question answered |
|---|---|
| **Program health** (execution × engagement) | Is the program salvageable, at risk or critical? |
| Deliverables submission rate per program | Do participants hand in their work? |

---

## 🚀 Venture OS — "are the startups progressing?"

### Already computed by the product (reused)
| Metric | Question answered | Source |
|---|---|---|
| **Investment readiness** (score 0–100 / level) | Is the startup ready to raise funds? | `calculateInvestmentReadiness` / `investment_assessments` |
| Startup profile completion | Are the entry details complete? | `startup_profiles` |
| **Invest analytics** per startup (readiness + matches + pipeline + data room) | Full per-startup view | `/api/venture/.../invest-analytics` |

### New — to build (platform aggregates)
| Metric | Question answered |
|---|---|
| **Readiness level distribution** (not ready → fundraising ready) | What does the startup portfolio look like? |
| **Average portfolio readiness score** | Is the portfolio progressing globally? *(already implemented)* |
| **Overdue milestones** (past due date, not completed) | Is the startup program facing headwinds? *(already implemented)* |
| **Coach analytics** aggregate (attendance, scores, hours) | Is coaching effective? |

---

## 💰 Investor OS — "investors and money"

### Already computed by the product (reused)
| Metric | Question answered | Source |
|---|---|---|
| Pipeline by stage (interested → meeting → due diligence → invested) | How many investors at each stage? | `/api/investor/executive-dashboard` |
| Amounts (target `target_raise`, raised `current_raised`, committed) | How much money committed vs expected? | `fundraising_campaigns` / `investment_decisions` |
| Active relationships & total invested | How are investor relationships doing? | `relationship_workspaces` |
| Finance dashboard (Planned / Spending / Revenue / Remaining) | Is the budget under control? | `/api/finance/summary` |

### New — to build
| Metric | Question answered |
|---|---|
| **Funnel conversion** (% moving from one stage to the next) | Is the investor funnel effective? |
| **Burn-rate per program** | How much does each program cost per month? |
| **Budget execution rate** = spending / budget | Is the budget being consumed healthily? |

---

## 👥 CRM — "the contact list" (mostly to build)

### New — to build
| Metric | Question answered |
|---|---|
| **Invitation → activation rate** | How many invitees actually activate their account? (adoption funnel) |
| **Contact base growth** | Is the database growing? |

---

## Already delivered (iteration 1)

The module skeleton is functional on `feature/interns-data-analysis`:

- **Aggregate endpoint** `GET /api/intelligence/metrics` (`super_admin` role) →
  `src/models/intelligence.js`: ventures, investor, programs, operations.
- **Page** `/admin/intelligence`: summary cards, readiness distribution,
  pipeline chart, fundraising, program health, task statuses and report
  compliance.
- **i18n fr/en**, tests (5), lint and build green.

Next iterations: the metrics marked *to build* above.

---

## Appendix — technical data sources

| Table / function | Role |
|---|---|
| `tasks`, `blockers`, `v2_op_reports` | Operations OS |
| `v2_programs`, `kpi_progress`, `v2_kpis` | Program OS |
| `ventures`, `venture_milestones`, `investment_assessments`, `startup_profiles` | Venture OS |
| `investment_pipeline`, `fundraising_campaigns`, `investment_decisions`, `relationship_workspaces` | Investor OS |
| `src/models/adminOps.js` | Reusable aggregation queries |
| `src/models/dashboard.js` (`getProgramKpiSummary`) | Program KPI rate |