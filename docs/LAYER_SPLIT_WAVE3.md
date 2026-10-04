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
| Files over 500 (soft) | 40 | **0** from this wave |
| Files over 600 (hard) | — | untouched by this wave |

All 40 files in the band are now under 500, including the two infrastructure
ones: `src/lib/masterNavigation.js` (592 → 36, config/builders modules) and
`src/lib/db.js` (568 → 470, instrumentation moved to `lib/db/metrics.js`).
No request left the data layer and no compatibility re-export was added.

> The guardrail still lists a handful of files in the 500–600 band while the
> parallel size lane splits the last `>600` files (their own slices); none of
> them belong to this wave.

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
| `src/lib/db.js` (568) | 470 | `lib/db/metrics.js` (thresholds, counters, slow-query reporter, `getDbMetrics`); `getPoolStats` stays with the pool and passes `waiting` in — `@/lib/db` surface unchanged |
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

## Repair — `src/app/platform/runs/review/[submissionId]/page.js`

The working tree carried a broken, uncommitted stub of this screen (duplicate
`EMPTY_LIST`, an invalid empty JSX attribute, hard-coded values) plus six stub
section components rendering placeholder text. Neither had ever been committed.
The screen is restored from its last known-good committed version (747 lines)
and then genuinely split the same way as the rest of this wave:

- The page keeps **all logic** — the four reads, state, the AI-evaluate POST, the
  review POST, the dimension-override bookkeeping — and shrinks to **357 lines**.
- Display moves into real components under `components/platform/runs/review/`:
  `ReviewHeader` (47), `ApplicantSection` (60), `ApplicationSection` (65),
  `AIEvaluationSection` (276), `DecisionSection` (73), `HistorySection` (43) — JSX
  moved verbatim, values/callbacks passed down, no wrapper component added.
- Because the logic stays in the page, `platform-ai-evaluate-once.test.js` (the
  "a page load cannot run the model" guard) passes **unchanged**.

## Verification

- **Guardrail** — `npm run check:lines`: every file in the 500–600 band, `db.js`
  included, is now clear. No new hard violation.
- **ESLint** — `npx eslint` on every touched file and new folder: **0 errors**.
  The repo-wide lint still reports 8 errors, all in the parallel lane's
  `admin/integrations/*` files — none touched here.
- **Behaviour** — `npm test`: **317/317 suites, 4841/4841 tests** (the review-page
  repair removed the previously single failing suite).
- **SQL / surface** — model splits were diffed against `git show HEAD`: every
  statement byte-identical and every export name identical. View splits preserve
  the exact set of class names / i18n keys / routes per the slicing agents' diffs.
- **Build** — `next build` was not run here (a shared, global build would race the
  parallel lane's in-flight edits); the pre-existing `db.js`-adjacent syntax error
  in the review page is gone, so the previous build blocker is cleared.
- **Commits** — one commit per file/slice (see `git log` on branch `A`).

## Needs a human eye before promotion

The plan flags the most shared surfaces for a before/after visual pass. Three
were touched here and **still need a browser review**: the app shell
(`DashboardLayout`), the messaging responses screen
(`admin/communications/responses`), and the profile view
(`dashboard/profile-view/ProfileViewContent`). All three are behind tests/lint,
but "green build is not the production test".
