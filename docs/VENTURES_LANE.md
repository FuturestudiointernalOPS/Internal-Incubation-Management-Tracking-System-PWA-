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
| **L2** | Move decision logic out of the ventures routes into `services/ventures/`, split the big services | `ventures-l2` | ⏳ in progress — slice L2.1 (sessions) to test |

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

---

## L2 — Ventures lane: decisions out of the controllers

### Method (from `PLAN_DE_TRAVAIL_STAGIAIRES.md` §6 and `LAYER_SPLIT.md` §6)
- A route keeps only: authenticate, validate the request shape, call the
  service, shape the HTTP response. **Response shapes never change.**
- Decision code moves to `src/services/ventures/` — no SQL there, no
  `next/server` (guarded by `src/__tests__/server/services-boundaries.test.js`).
- The service imports the **same facades** the route used (`@/lib/…`,
  `@/models/…`) so the route-level tests' `jest.mock` keep intercepting.
- A characterisation test pins the moved decision before/with the move.
- New services are listed in the lane barrel `src/services/ventures/index.js`.

### Lane routes (97 files, line counts at the start of L2)
| Route (under `src/app/api/`) | Lines |
|---|---|
| `journey-reports/route.js` | 42 |
| `journey-templates/route.js` | 19 |
| `knowledge/route.js` | 163 |
| `venture-kpi-definitions/route.js` | 67 |
| `venture-member-invites/[token]/route.js` | 86 |
| `venture-options/route.js` | 100 |
| `venture-permissions/matrix/route.js` | 62 |
| `venture-permissions/responsibilities/route.js` | 86 |
| `venture-permissions/scopes/route.js` | 18 |
| `venture-plan-templates/apply/route.js` | 45 |
| `venture-plan-templates/route.js` | 71 |
| `ventures/assigned/route.js` | 33 |
| `ventures/[id]/action-plans/route.js` | 92 |
| `ventures/[id]/advisors/route.js` | 58 |
| `ventures/[id]/analytics/route.js` | 53 |
| `ventures/[id]/assignments/resolve/route.js` | 93 |
| `ventures/[id]/blockers/route.js` | 76 |
| `ventures/[id]/business-model/route.js` | 93 |
| `ventures/[id]/calendar/route.js` | 58 |
| `ventures/[id]/changes/route.js` | 40 |
| `ventures/[id]/coaches/route.js` | 126 |
| `ventures/[id]/coaching/route.js` | 87 |
| `ventures/[id]/coach-invite/route.js` | 85 |
| `ventures/[id]/dashboard/route.js` | 38 (was 307 — slice L2.6) |
| `ventures/[id]/deliverables/route.js` | 243 (was 309 — slice L2.5) |
| `ventures/[id]/deliverables/upload/route.js` | 45 |
| `ventures/[id]/documents/[docId]/permissions/route.js` | 87 |
| `ventures/[id]/documents/[docId]/reviews/route.js` | 64 |
| `ventures/[id]/documents/[docId]/transition/route.js` | 58 |
| `ventures/[id]/documents/[docId]/versions/route.js` | 62 |
| `ventures/[id]/documents/route.js` | 159 |
| `ventures/[id]/document-types/route.js` | 85 |
| `ventures/[id]/document-types/[typeId]/route.js` | 73 |
| `ventures/[id]/feedback/route.js` | 83 |
| `ventures/[id]/followups/route.js` | 28 |
| `ventures/[id]/founders/[founderId]/reactivate/route.js` | 40 |
| `ventures/[id]/founders/[founderId]/route.js` | 117 |
| `ventures/[id]/founders/[founderId]/suspend/route.js` | 40 |
| `ventures/[id]/founders/route.js` | 120 |
| `ventures/[id]/founders/transfer-ownership/route.js` | 48 |
| `ventures/[id]/fundraising/route.js` | 103 |
| `ventures/[id]/history/route.js` | 98 |
| `ventures/[id]/interviews/route.js` | 53 |
| `ventures/[id]/investment-readiness/route.js` | 103 |
| `ventures/[id]/investment/route.js` | 52 |
| `ventures/[id]/investors/route.js` | 74 |
| `ventures/[id]/journey/apply-journey-template/route.js` | 61 |
| `ventures/[id]/journey/apply-template/route.js` | 91 |
| `ventures/[id]/journey/archive/route.js` | 52 |
| `ventures/[id]/journey/delete/route.js` | 47 |
| `ventures/[id]/journey/duplicate/route.js` | 67 |
| `ventures/[id]/journey-report/route.js` | 197 |
| `ventures/[id]/journey/route.js` | 247 (was 445 — slices L2.2, L2.9) |
| `ventures/[id]/journey/save-template/route.js` | 83 |
| `ventures/[id]/knowledge/route.js` | 146 |
| `ventures/[id]/kpis/route.js` | 131 |
| `ventures/[id]/lead/route.js` | 119 |
| `ventures/[id]/lifecycle/route.js` | 98 |
| `ventures/[id]/member-invitations/route.js` | 85 |
| `ventures/[id]/members/route.js` | 284 (was 383 — slice L2.3) |
| `ventures/[id]/milestones/archive/route.js` | 68 |
| `ventures/[id]/milestones/duplicate/route.js` | 62 |
| `ventures/[id]/milestones/reorder/route.js` | 54 |
| `ventures/[id]/milestones/route.js` | 221 (was 306 — slice L2.7) |
| `ventures/[id]/my-access/route.js` | 166 |
| `ventures/[id]/notes/route.js` | 233 |
| `ventures/[id]/operating-plans/[planId]/route.js` | 100 |
| `ventures/[id]/operating-plans/[planId]/sections/route.js` | 133 |
| `ventures/[id]/operating-plans/route.js` | 63 |
| `ventures/[id]/plan-import/route.js` | 217 (was 284 — slice L2.8) |
| `ventures/[id]/playbook/route.js` | 170 |
| `ventures/[id]/pmf/route.js` | 53 |
| `ventures/[id]/progress-reports/route.js` | 130 |
| `ventures/[id]/progress/route.js` | 103 |
| `ventures/[id]/reports/route.js` | 76 |
| `ventures/[id]/retros/route.js` | 51 |
| `ventures/[id]/route.js` | 173 |
| `ventures/[id]/sessions/route.js` | 234 (was 555 — slices L2.1, L2.9) |
| `ventures/[id]/sessions/upload/route.js` | 49 |
| `ventures/[id]/staff-assignments/route.js` | 98 |
| `ventures/[id]/standups/route.js` | 65 |
| `ventures/[id]/startup-profile/route.js` | 150 |
| `ventures/[id]/startup-profile/submit/route.js` | 92 |
| `ventures/[id]/submissions/review-queue/route.js` | 78 |
| `ventures/[id]/tasks/archive/route.js` | 45 |
| `ventures/[id]/tasks/duplicate/route.js` | 50 |
| `ventures/[id]/tasks/route.js` | 230 (was 330 — slice L2.4) |
| `ventures/[id]/tasks/[taskId]/submissions/route.js` | 224 |
| `ventures/[id]/timeline/route.js` | 110 |
| `ventures/[id]/validations/route.js` | 92 |
| `ventures/[id]/venture-history/route.js` | 72 |
| `ventures/[id]/verification/documents/[docId]/versions/route.js` | 100 |
| `ventures/[id]/verification/route.js` | 175 |
| `ventures/[id]/verification/status/route.js` | 51 |
| `ventures/[id]/verification/upload/route.js` | 52 |
| `ventures/route.js` | 186 |
| `venture-templates/route.js` | 83 |

### Slice L2.1 — `ventures/[id]/sessions` (555 → 298 lines) — ✅ done

| New file | What moved into it |
|---|---|
| `src/services/ventures/sessionBooking.js` | `checkSessionBooking(body, now)`: the create rules (memo required, milestone required, date + time required, minimum lead time, materials) → `{ ok, sessionNote, milestoneRef, materials }` or `{ ok: false, error }` with the exact former message |
| `src/services/ventures/sessionNotices.js` | who is told about a session and with which words: `notifySessionScheduled` (coach, founders if venture-facing, Lead Managers), `notifySessionUpdated`, `notifySessionCancelled`, `notifySessionRescheduled`, `emailVentureAboutSession`, `fmtWhen` — texts, template keys and dedupe keys unchanged |
| `src/__tests__/ventures/session-booking-rules.test.js` | 7 characterisation tests of `checkSessionBooking` |

Stays in the route (HTTP boundary): `requireVentureScopedAccess`, the
`calendar.schedule` management denial (it answers a 403), object-level
ownership (`sessionBelongsToVenture`), the founder bookable-milestone check,
deliverable / coach resolution, the writes and every response.

Checks: `npm test` 3563/3563 (incl. the existing route suites
`venture-session-note`, `venture-session-memo-delivery`,
`ventures/session-booking-authority`, `phase5b-venture-pilot`), `npx eslint`
0 errors, `npm run build` OK.

Manual test: `/admin/ventures/<id>/journey` → open a milestone → Book session
(a memo, a date at least the minimum lead time ahead) → the session appears in
the milestone list; refusals (no memo, too soon) show the same messages.

### Slice L2.2 — `ventures/[id]/journey` (445 → 267 lines) — ✅ done

| New file | What moved into it |
|---|---|
| `src/services/ventures/journeyRead.js` | `attachJourneyWork({ ventureParam, dbId, stages, signEvidence })` (GET): attaches milestones per stage, deliverables per milestone (the failed-read flag `deliverablesUnavailable`), task execution counts, `milestone_counts`, and resolves the template provenance (`templateSource`) |
| `src/services/ventures/journeyStageActions.js` | `runJourneyStageTransition` (PATCH: activate / lock / complete / reset / delete / move — refusals as `{ error, status }`, same messages and codes), `recordJourneyStageEdit` (field history of an edit), `recordJourneyStageTransition` (history of a transition) |

Stays in the route: the session and `operating_plan` gates (create / edit /
manage), the date-driven activation, the stage lookup, the audience projection
(sealed / unsealed), every response — and the **evidence signing**
(`signEvidence`, passed to the service): `deliverable-upload-access.test.js`
requires the controller to own who receives a usable evidence URL.

Checks: `npm test` 3567/3567 (incl. `venture-journey-gating`,
`deliverable-upload-access`), `npx eslint` 0 errors, `npm run build` OK.

### Slice L2.3 — `ventures/[id]/members` (383 → 284 lines) — ✅ done

| New file | What moved into it |
|---|---|
| `src/services/ventures/memberRoster.js` | `deliverVentureMemberInvitation` (in-app notice for account holders on a first send, the invitation email, the delivery outcome recorded → `{ emailSent, emailError }`), `afterVentureMemberRemoved` and `afterVentureMemberUpdated` (drop the remembered access answers, membership history row, context-grant reconcile), `applyContextGrants` |

Stays in the route, on purpose: the session, `checkAccess` /
`checkMutateAccess`, the archived-Venture gate, the request validation and the
writes. Three source-reading tests pin parts of it to the controller:
`venture-label-surfaces` (`getVentureDisplayNameByCode`),
`security-lot4-forms-lms` (`MEMBER_ROLES`, "permissions must be an object"),
`identity-gate-bridge` (bare `requireAuth` ×3). This is why the file stays a
little above 250 lines.

Checks: `npm test` 3569/3569 (incl. `ventures/member-invite-api`),
`npx eslint` 0 errors.

### Slice L2.4 — `ventures/[id]/tasks` (330 → 230 lines) — ✅ done

| New file | What moved into it |
|---|---|
| `src/services/ventures/taskBoard.js` | `buildTaskBoard(tasks, edges, includeArchived)` (archived filter, Kanban columns, dependency decoration — pure), `checkTaskStatusChange` (the hard dependency gate for Venture-side actors → 409 with `blocked_by`, then the review-required completion gate → 403), `afterTaskUpdate` (release the tasks a completed task was blocking, sync the block state, milestone follows a status change), `syncMilestoneForTask`, `TASK_PROCEED_STATUSES` |
| `src/__tests__/ventures/task-board.test.js` | 4 characterisation tests of `buildTaskBoard` |

Stays in the route: scoped access, object-level ownership, the comments /
attachments / review actions, request validation, the writes, every response.

Checks: `npm test` 3575/3575 (incl. `venture-task-dependency-gate`,
`security-lot1-idor`), `npx eslint` 0 errors.

### Slice L2.5 — `ventures/[id]/deliverables` (309 → 243 lines) — ✅ done

| New file | What moved into it |
|---|---|
| `src/services/ventures/deliverableReview.js` | `readDeliverableDecision(body)` (approved / changes_requested, comments required for changes — pure), `afterDeliverableSubmitted` (milestone status follows its deliverables, never completed by a submission), `afterDeliverableReviewed` (history row, milestone status with completion authority, milestone / journey completion notices and history) |
| `src/__tests__/ventures/deliverable-decision.test.js` | 3 characterisation tests of `readDeliverableDecision` |

Stays in the route: `requireVentureAccess` / `requireVentureScopedAccess`
(`module: "ventures"`, review on `capability: "view"`), `canDefineDeliverables`,
`canReviewDeliverable`, the evidence fields and `dateOrNull(body[field])` —
all pinned to the controller by `deliverable-upload-access` and `venture-input`.

Checks: `npm test` 3580/3580, `npx eslint` 0 errors.

### Slice L2.6 — `ventures/[id]/dashboard` (307 → 38 lines) — ✅ done

| New file | What moved into it |
|---|---|
| `src/services/ventures/dashboard.js` | `buildVentureDashboard({ ventureParam, isInternalViewer })`: every widget section (profile completion, Venture info, team, notifications, recent activity, verification, documents, meetings, KPIs, coaching, investment readiness), each failing independently, with the audience rules (internal audit stream and 'sa' feed for internal viewers only; the Venture-facing allowlist for everyone else) |

Stays in the route: `requireVentureScopedAccess` (`module: "ventures"`, pinned by
`phase5b-venture-pilot`), the `isInternalViewer` decision from the session, the
timing (`meta.duration_ms`) and the response.

Checks: `npm test` 3584/3584, `npx eslint` 0 errors.

### Slice L2.7 — `ventures/[id]/milestones` (306 → 221 lines) — ✅ done

| New file | What moved into it |
|---|---|
| `src/services/ventures/milestoneCompletion.js` | `recordMilestoneEdit` (field-level history of a save, non-fatal), `settleMilestoneCompletion` (complete the milestone, immediate release, founders notified, history, automatic close of a journey whose milestones are all done → returns the closed journey for `journey_completed`) |

Stays in the route: scoped access, `canManageMilestones` /
`isMilestoneLeadAuthority`, the field validation and the update clauses
(`isValidCid(body.owner_cid)`, `cidOrNull(body.owner_cid)`,
`dateOrNull(target_date)`, `dateOrNull(body.start_date)` — pinned by
`security-lot6-hardening` and `venture-input`), the write and the response.

Checks: `npm test` 3584/3584 (incl. `venture-milestone-gating`,
`staging-venture-progression`), `npx eslint` 0 errors.

### Slice L2.8 — `ventures/[id]/plan-import` (284 → 217 lines) — ✅ done

| New file | What moved into it |
|---|---|
| `src/services/ventures/planImportFlow.js` | `choosePlanSheet(sheets, requestedSheet)` (the caller's answer, else "Tracker", else the only sheet; otherwise a question with the sheet list — pure), `proposePlanFromSheet` (existing programme, interpretation, sheet summary, stored draft), `applyPlanDraft` (open-draft check, last edits saved first, apply → `{ error, status }` or `{ result }`) |
| `src/__tests__/ventures/plan-sheet-choice.test.js` | 5 characterisation tests of `choosePlanSheet` |

Stays in the route: scoped access (`ventures.view` / `ventures.edit`), the
multipart reading, the 5 MB limit, the file read, the correction flow
(`revisePlanProposal`), discard, every response and status code.

Checks: `npm test` 3591/3591, `npx eslint` 0 errors, `npm run build` OK.

### Slice L2.9 — finishing `sessions` and `journey` — ✅ done

| New / changed file | What moved into it |
|---|---|
| `src/services/ventures/sessionBookingTargets.js` (new) | `resolveSessionBookingTargets`: the founder bookable-milestone check (date-driven activation first; 403 with the reason), the optional deliverable (must belong to the milestone; 400), the coach's platform identity |
| `src/services/ventures/sessionAuthority.js` (new) | `checkSessionManagement`: who may define the calendar — delegated staff need `calendar.schedule`; the Venture's own members, global authority and participation (memo, attendance, action items) are untouched. Returns the 403 body; the route sends it |
| `src/services/ventures/journeyStageActions.js` | + `addJourneyStage` (name required, first journey active / others upcoming, last in order, dates cut to YYYY-MM-DD, insert, history) |

`sessions`: 298 → 234 lines. `journey`: 267 → 247 lines.

Checks: `npm test` 3595/3595 (incl. `ventures/session-booking-authority`),
`npx eslint` 0 errors, `npm run build` OK.

### Lane status after L2.9
Every lane route that was above 250 lines is now under it, except
`ventures/[id]/members` (284): its remaining lines are the gates and the
validation that three tests pin to the controller (see L2.3).

| Route | Before | After |
|---|---|---|
| `ventures/[id]/sessions` | 555 | 234 |
| `ventures/[id]/journey` | 445 | 247 |
| `ventures/[id]/members` | 383 | 284 |
| `ventures/[id]/tasks` | 330 | 230 |
| `ventures/[id]/deliverables` | 309 | 243 |
| `ventures/[id]/dashboard` | 307 | 38 |
| `ventures/[id]/milestones` | 306 | 221 |
| `ventures/[id]/plan-import` | 284 | 217 |

New services in `src/services/ventures/` (all listed in `index.js`):
`sessionBooking`, `sessionBookingTargets`, `sessionAuthority`, `sessionNotices`,
`journeyRead`, `journeyStageActions`, `memberRoster`, `taskBoard`,
`deliverableReview`, `dashboard`, `milestoneCompletion`, `planImportFlow`.
New tests in `src/__tests__/ventures/`: `session-booking-rules`, `task-board`,
`deliverable-decision`, `plan-sheet-choice`.

**Still open in L2:** splitting the big services (~~`planImport.js` 1 178~~ → L2.10,
`milestoneEngine.js` 548, `submissions.js` 526, `journey.js` 520,
`verification.js` 487, `profile.js` 441, `schema.js` 410) and the smaller
routes that still import a model directly.

### Slice L2.10 — splitting `services/ventures/planImport.js` (1 178 lines) — ✅ done

The module is now a folder; `planImport.js` stays as a 113-line barrel that
re-exports **exactly** the former public surface (named exports + default), so
`@/models/venturePlanImport`, the controller and the six plan-import test
suites are unchanged. Code moved verbatim (checked token by token against the
original).

| File in `src/services/ventures/planImport/` | Lines | Content |
|---|---|---|
| `prompt.js` | 162 | the analyst's system prompt, `MAX_PLAN_PROMPT_CHARS` / `MAX_PLAN_CONTEXT_CHARS`, `renderPlanSheets`, `buildPlanPrompt` |
| `proposal.js` | 284 | `deriveProposalDates`, `normalizeJourneys`, `collectTaskRefs`, `validateDependencyRefs`, `resolveProposalOwners`, `knownOwnerCids`, `computeProposalStats`, `collectUnmatchedOwners` (+ internal helpers) |
| `interpret.js` | 148 | `buildExistingProgramme`, `interpretPlanSheet` |
| `draft.js` | 137 | `getOpenPlanImport`, `getPlanImport`, `createPlanImport`, `updatePlanImportProposal`, `discardPlanImport` |
| `revise.js` | 246 | the correction prompt, `diffProposals`, `revisePlanProposal` |
| `apply.js` | 224 | `applyPlanImport` (one transaction) |

Helpers shared between parts (`newUuid`, `toText`…) are exported from their
part for the sibling imports only; the barrel does not re-export them.

Checks: `npm test` 3607/3607 (incl. `venture-plan-import`, `venture-plan-draft`,
`venture-plan-apply`, `venture-decisions`, `venture-phase4`,
`venture-external-assignments`), `npx eslint` 0 errors, `npm run build` OK.
