# Wave 3 — the 500–600 line band

> Companion to [`LAYER_SPLIT.md`](LAYER_SPLIT.md). The main journal is updated by
> the parallel size lane (slices 164+); this file records the **wave 3** pass —
> the purely cosmetic descent of every remaining source file in the **500–600**
> band below the **500** soft target.

## The rule (unchanged from the guardrail)

- Hard ceiling **600** — `npm run check:lines` fails above it (in `--block` mode).
- Soft target **500** — flags a warning above it.
- Wave 3 shrinks the soft band. It does not change any behaviour, any SQL, any
  rendered output, any route or any translation key.

`npm run check:lines` ignores test files, migrations and config.

## Result

| Band | Before | After |
|---|---|---|
| Files over 500 (soft) | 40 | **1** (`src/lib/db.js`, see below) |
| Files over 600 (hard) | — | untouched by this wave |

`src/lib/db.js` (568 → still 568) is the **only** leftover and is deliberately
**deferred**: the plan marks the two infrastructure files over 500 as optional
(no hard breach, and the Postgres pool engine is the riskiest file to move).
No request left the data layer and no compatibility re-export was added.

## Slices

Data layer — `x.js` becomes a thin barrel over a cohesive sibling `x/` folder.
Every statement is byte-identical; every export name and import path is unchanged.

| File (before) | After | New modules |
|---|---:|---|
| `src/models/projects.js` (595) | 32 | `projects/{core,reads,admin,approvals,updates,reports}.js` |
| `src/models/programMembership.js` (563) | 34 | `programMembership/{programStaff,v2ProgramStaff,participantPrograms,participantProgramDetail,contactPrograms}.js` |
| `src/models/authFlows.js` (553) | 47 | `authFlows/{sessionLogin,login,invite,activate,familyInvite,passwordReset,resendInvite,account}.js` |
| `src/models/facilitation.js` (548) | 36 | `facilitation/{invites,reviews,evaluation,attendance,feedback,deliverables}.js` |
| `src/models/ventureJourney.js` (531) | 36 | `ventureJourney/{journeyStages,kpis,lifecycle,validations,businessModel,playbook,pmf,history}.js` |
| `src/models/formRuns/readsAndHelpers.js` (511) | 34 | `formRuns/readsAndHelpers/{helpers,reads,decisionEmails,reviews}.js` |
| `src/models/forms/submissions.js` (504) | 28 | `forms/submissions/{statusReads,migrations,writes,listing,responses}.js` |
| `src/models/investor/diligenceAndPipeline.js` (561) | 23 | `diligenceAndPipeline/{diligence,documents,pipeline}.js` |
| `src/models/authorization/bootstrap.js` (588) | 32 | `bootstrap/{schema,roleDefaults,responsibilities}.js` |
| `src/models/platform/resultPdf.js` (558) | 16 | `resultPdf/{shared,submission,composed}.js` |
| `src/services/platform/intents.js` (505) | 34 | `intents/{list,create,update,delete,detail,tasks}.js` |

Helpers / infrastructure / hooks / actions:

| File (before) | After | What moved |
|---|---:|---|
| `src/lib/masterNavigation.js` (592) | 36 | `masterNavigation/{nodes,access,builders}.js` (pure config + builders) |
| `src/components/permissions/matrixHelpers.js` (558) | 26 | `matrixHelpers/{featureRows,capabilities,toggles,state,origins,coverage}.js` |
| `src/app/admin/communications/contacts/useContactsState.js` (590) | 294 | `useContactsMutations.js` (fetch flows), hook return shape unchanged |
| `src/app/platform/runs/useRunsState.js` (531) | 475 | `useRunsUiState.js` (screen state), names re-destructured |
| `src/app/pm/programs/[id]/actions/curriculum.js` (559) | 18 | `curriculum{Sessions,Requirements}.js` + barrel |

Views and pages — display blocks move to sibling components; the parent keeps
state, reads, actions and navigation; values and callbacks pass down as props
(no wrapper component inserted, no rendered-output change).

| File (before) | After | Extracted |
|---|---:|---|
| `src/components/dashboard/UnifiedDashboard.js` (578) | 494 | `unified-dashboard/WorkspaceGrid.js` |
| `src/components/dashboard/StandupRetroView.js` (524) | 317 | `standup-retro-view/TaskRow.js` |
| `src/components/dashboard/AssignmentsView.js` (505) | 486 | `assignments-view/FiltersBar.js` |
| `src/components/dashboard/profile-view/ProfileViewContent.js` (505) | 484 | `profile-view/ProfileSaveActions.js` |
| `src/components/ventures/DocumentTypeManager.js` (519) | 399 | `DocumentTypeManager/DocumentTypeList.js` |
| `src/components/ventures/plan-import/PlanReview.js` (503) | 482 | `plan-import/PlanReviewActions.js` |
| `src/components/ventures/workspace/tabs/JourneyPlaybookTabs.js` (515) | 464 | `JourneyPlaybookTabs/FounderMilestoneDeliverables.js` |
| `src/components/ventures/workspace/tabs/VerificationTab.js` (510) | 408 | `VerificationTab/VerificationDocumentSteps.js` |
| `src/components/permissions/ProgramPortfolioDefaultAction.js` (556) | 329 | `ProgramPortfolioDefaultAction/ResultDialog.js` |
| `src/components/permissions/permission-center/AuditView.js` (520) | 420 | `permission-center/AuditFilters.js` |
| `src/components/permissions/permission-center/PersonAccessScreen.js` (551) | 493 | `permission-center/shared/applyOptimisticQuickAction.js` |
| `src/components/pm/FacilitatorsPanel.js` (575) | 448 | `facilitators-panel/FacilitatorsSections.js` |
| `src/components/lms/LearnerPlayer.js` (518) | 388 | `learner-player/CourseContent.js` |
| `src/components/layout/DashboardLayout.js` (586) | 474 | `layout/shell/ShellBanners.js` |
| `src/components/admin/platform/import/ImportView.js` (586) | 470 | `ImportView/ImportDoneStep.js` |
| `src/app/admin/projects/page.js` (524) | 489 | `components/admin/projects/list/{ProjectsContent,ProjectsModals}.js` |
| `src/app/admin/system/page.js` (573) | 276 | `components/admin/system/*` (one per tab + constants) |
| `src/app/admin/work/page.js` (583) | 387 | `components/admin/work/{KanbanBoard,KanbanTaskCard}.js` |
| `src/app/admin/communications/responses/page.js` (530) | 480 | `components/admin/communications/responses/ResponsesRetargetModal.js` |
| `src/app/admin/intelligence/page.js` (553) | 25 | `components/admin/intelligence/{IntelligenceView,intelligenceUi}.js` |
| `src/app/admin/lms/registrations/page.js` (572) | 213 | `components/admin/lms/registrations/LmsRegistrationsView.js` |
| `src/app/admin/pending-users/page.js` (552) | 222 | `components/admin/pending-users/PendingUsersView.js` |
| `src/app/team/[id]/page.js` (589) | 446 | `components/team/team-workspace/TeamWorkspaceView.js` |

## Verification

- **Guardrail** — `npm run check:lines`: the soft band dropped from 40 to 1
  (`src/lib/db.js`). No new hard violation.
- **ESLint** — `npx eslint` on every touched file and new folder: **0 errors**.
- **Behaviour** — `npm test`: **316/317 suites, 4840/4841 tests**. The single
  failure, `platform-ai-evaluate-once.test.js`, reads the parallel lane's
  mid-split `src/app/platform/runs/review/[submissionId]/page.js` (not touched
  by this wave) — the same blocker the main journal records for slices 164–170.
- **Build** — `next build` cannot run green for the same reason: that in-flight
  file currently has a syntax error. No file from this wave is implicated.
- **SQL / surface** — model splits were diffed against `git show HEAD`: every
  statement byte-identical and every export name identical. View splits preserve
  the exact set of id="t"/class names/routes per the slicing agents' diffs.
- **Commits** — one commit per source file (see `git log` on branch `A`).

## Needs a human eye before promotion

The plan flags the most shared surfaces for a before/after visual pass. Three
were touched here and **still need a browser review**: the app shell
(`DashboardLayout`), the messaging responses screen
(`admin/communications/responses`), and the profile view
(`dashboard/profile-view/ProfileViewContent`). All three are behind tests/lint,
but "green build is not the production test".
