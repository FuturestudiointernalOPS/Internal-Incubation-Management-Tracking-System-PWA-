# Ventures lane — work log (Fiche 2)

> Owner: the **Ventures** intern — `docs/REPARTITION_STAGIAIRES.md`, Fiche 2
> (tasks **B7** and **L2**). Recipe and rules: `docs/PLAN_DE_TRAVAIL_STAGIAIRES.md`.
> This file is updated **at the end of every step**, in the same commit or the
> next one: what changed, where, why, and how it was checked.

## Scope (exclusive)

| Kind | Paths |
|---|---|
| Services | `src/services/ventures/**` |
| Routes | `src/app/api/ventures/**`, `src/app/api/venture-*/**`, `src/app/api/journey-reports/**`, `src/app/api/journey-templates/**`, `src/app/api/knowledge/**` |
| Models | `src/models/venture*` (incl. every `venture*Store.js`) |
| Components | `src/components/ventures/JourneyManagerPanel.js`, `src/components/ventures/workspace/tabs/JourneyPlaybookTabs.js` → new files in `src/components/ventures/journey/` |
| Not mine | `VentureDashboard.js`, `PlanImportPanel.js` (lead), program routes (`api/programs`, `api/pm`, `api/v2…`) |

## Status

| Task | What | Branch | Status |
|---|---|---|---|
| **B7** | Split the Journey manager panel and the founder Journey tab | `ventures-b7` | ✅ done (`8a6d3559`, `58e9f5b8`) |
| **L2** | Move decision logic out of the ventures routes into `services/ventures/`, split the big services | `ventures-l2` | ⏳ in progress |

---

## B7 — Journey panel split

### Rules followed
- **Behaviour identical**: code moved verbatim; markup, classes, texts unchanged.
- Each extracted block receives the parent values it uses **as props of the same
  name** (state, setters, handlers, loop values). The parent keeps all state and
  every write; the new components only render.
- **Public exports unchanged**: `JourneyManagerPanel({ ventureId })` (used by
  `admin/ventures/[id]/journey`, `staff/ventures/[id]`, `participant/ventures/[id]`)
  and `{ JourneyTab, BusinessModelTab }` (used by `participant/ventures/[id]`).
- `src/__tests__/journey-status-lexicon.test.js` reads both parent files and
  requires them to use `@/lib/ventureStatuses` themselves → those usages stayed
  in the parents.

### Sizes
| File | Before | After |
|---|---|---|
| `src/components/ventures/JourneyManagerPanel.js` | 2 617 | 1 761 |
| `src/components/ventures/workspace/tabs/JourneyPlaybookTabs.js` | 654 | 515 |

### Inventory — `src/components/ventures/journey/`
| File | On screen | From | Commit |
|---|---|---|---|
| `journeyShapers.js` | (no UI) shape of the journey / sessions / reports reads, date-picker bounds | Panel | `8a6d3559` |
| `JourneyConfirmModal.js` | confirmation: complete / archive a milestone; archive / restore / delete journeys | Panel | `8a6d3559` |
| `MilestoneSessionsList.js` | sessions booked on a milestone + memo edit | Panel | `8a6d3559` |
| `JourneyArchiveToolbar.js` | Active / Archived, Select all, bulk archive / delete | Panel | `58e9f5b8` |
| `JourneySaveTemplateForm.js` | "Save as template" | Panel | `58e9f5b8` |
| `JourneyApplyTemplateBar.js` | "From template" | Panel | `58e9f5b8` |
| `JourneyAddStageForm.js` | "Add journey" | Panel | `58e9f5b8` |
| `JourneyReportSection.js` | a journey's reports, missing closing report, report composer | Panel | `58e9f5b8` |
| `MilestoneReviewInbox.js` | Venture submissions on a milestone's tasks + review decisions | Panel | `58e9f5b8` |
| `MilestoneDeliverables.js` | deliverables of an open milestone | Panel | `58e9f5b8` |
| `MilestoneSessionBooking.js` | book a session on a milestone (staff) | Panel | `58e9f5b8` |
| `AddMilestoneForm.js` | "Add milestone" | Panel | `58e9f5b8` |
| `FounderSessionBooking.js` | the Venture books its session on the current milestone | Founder tab | `58e9f5b8` |
| `FounderMilestoneSessions.js` | sessions booked on a milestone + memo (founder) | Founder tab | `58e9f5b8` |
| `FounderMilestoneTasks.js` | a milestone's tasks + submit for review | Founder tab | `58e9f5b8` |
| `BusinessModelTab.js` | Business Model tab (re-exported by `JourneyPlaybookTabs.js`) | Founder tab | `58e9f5b8` |

### Checks
`npm test` 3552/3552 · `npx eslint` 0 errors (`no-undef` also clean on the moved
code) · `npm run build` OK · manual: `/admin/ventures/<id>/journey` (confirmations,
booked sessions + memo, milestone date bounds, toolbar, template forms, add
journey / milestone, reports, deliverables).

### Notes
- Do not run `npm run build` while `npm run dev` is running (same `.next`
  folder): the dev server froze.
- The README staging test accounts (`@impactos.staging`) are absent from the
  database `.env.local` points to.
