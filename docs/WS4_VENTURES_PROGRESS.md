# WS4 — Progress indicators and calculations: completion report

Branch: `Ventures` · Starting point: `3fee03156` · Implementation commits: `e674f1520` … `279402bc6`

This records what WS4 changed, what was verified, and what remains outside its scope.
Production data was not touched.

---

## 1. What changed

### A. Data Room is the canonical Investment Readiness metric

* The investment screen, the Venture directory and the Intelligence dashboard already read
  the Data Room engine from the earlier WS4 work.
* **Added:** the admin investment **analytics** screen and **investor matching** now read the
  same Data Room completeness instead of the retired ten-category assessment table.
  An indeterminate Venture stays indeterminate (`null` → « — »), never a fake 0%.
* The retired `/api/ventures/[id]/investment` route keeps its 410 response, and the service,
  model and historical assessment tables are preserved.
* No second readiness formula is active. Roadmap Progress and Stage & Evidence Score remain
  separate indicators.

### B. Profile Completion retired

* Removed the admin dashboard Profile Completion widget and its link to the non-existent
  wizard route.
* Removed the matching “Profile” health tile.
* Removed the `startup_profiles`-based calculation from the dashboard aggregate.
* The founder dashboard's figure is relabelled **Venture setup** and now clearly means the
  Venture's own record (team, documents, business model, discovery), not profile completeness.
* No new profile wizard was built.

### C. Roadmap Progress

* The existing roadmap readiness engine remains the canonical Roadmap Progress metric.
* Archived journey stages, milestones and tasks are excluded.
* Only the latest submission version per task counts towards the deliverables component.
* The operating report counts reviewed submissions once per task, matching the engine.
* User-facing labels now say **Roadmap progress** in English and **Avancement du parcours**
  in French; the stale “derived investment readiness” wording is gone.

### D. Milestones and tasks

* The stale average-milestone-progress field was removed from the progress endpoint.
  The dashboard shows **Milestones completed** from actual milestone status.
* Task completion uses `done | accepted | completed` in analytics, timeline progress,
  team productivity, workload, assignment matching and the milestone report.
* Archived tasks are excluded from completion, workload, distribution and timeline queries.
* The `delayed` milestone metric now means “past its date and neither completed nor
  cancelled”, using `COALESCE(target_date, due_date)`; the never-written `status='delayed'`
  literal is gone.

### E. Business-stage scoring

* `mvp` scores as `early_traction`, `scale` as `scaling` (`lib/ventureStage`), reused by the
  dashboard, the legacy readiness engine and investor matching. Stage matching also treats
  the aliases as equal.

### F. Documents and legacy records

* The Data Room catalogue is the official document list; legacy rows stay visible, badged
  **Legacy**, and do not enter completeness until re-filed with the existing Edit action.
* Reclassification is metadata-only and keeps every version (covered by a new test).
* The dashboard's document total is now a real `COUNT(*)`; it used to be the length of the
  five-row widget list, so it was capped at 5.
* Soft-deleted documents stay excluded from the dashboard total.

### G. Overdue calculations

* Intelligence and the analytics store use `COALESCE(target_date, due_date)` and exclude
  archived milestones.
* The timeline's overdue/delayed/upcoming queries use the same terminal task statuses and
  archive filter.
* The operating report's overdue **KPI** now reports the full count while its list stays
  capped at 50 for display.

### H. KPI module

* The KPI API and its status literals were deliberately left unchanged.

### I. Retiring the ten-category API

* No active screen calls it; the route answers with the shared retired shape, and the
  historical service/model/tables are preserved.

### Journey entry points

* Business Model, Discovery, Validation and PMF are reachable again from Journey.
* Documents remain in the Data Room tab; the obsolete document-upload tool was not restored.

---

## 2. Files modified in the WS4 correction commits

```
src/app/admin/ventures/[id]/analytics/page.js
src/app/admin/ventures/[id]/investment/page.js
src/app/admin/ventures/[id]/reports/page.js
src/app/api/ventures/[id]/journey-report/route.js
src/app/api/ventures/[id]/progress/route.js
src/components/ventures/venture-dashboard/HealthSummary.js
src/components/ventures/venture-dashboard/MetricsColumn.js
src/components/ventures/workspace/tabs/DashboardHistoryTabs.js
src/locales/en/vadmin.json
src/locales/en/venture.json
src/locales/fr/vadmin.json
src/locales/fr/venture.json
src/models/intelligence.js
src/models/ventureAnalyticsStore.js
src/models/ventureInvestorMatchingStore.js
src/models/ventureReadinessStore.js
src/models/ventureTimelineStore.js
src/models/ventureWorkspace/dashboardAndCheckins.js
src/models/ventureWorkspace/journeyAndReports/journeyReports.js
src/services/ventures/dashboard.js
src/services/ventures/investmentAnalytics.js
src/services/ventures/investorMatching.js
src/__tests__/venture-dashboard-readiness.test.js
src/__tests__/venture-progress.test.js
src/__tests__/ventures/data-room-writes.test.js
src/__tests__/ws4-readiness.test.js
```

---

## 3. Tests executed and actual results

| Check | Command | Result |
|---|---|---|
| WS4 contract | `npx jest --runInBand src/__tests__/ws4-readiness.test.js` | **22 passed** |
| Focused readiness/progress | `npx jest --runInBand ws4-readiness venture-progress venture-dashboard-readiness venture-readiness-report data-room-writes` | **all passed** |
| Data Room suite | `npx jest --runInBand src/__tests__/ventures/data-room.test.js data-room-writes` | **passed** |
| Venture regression set | `npx jest --runInBand src/__tests__/ventures src/__tests__/venture-*.test.js` | 80 of 87 suites passed; the 7 failing suites fail identically on unmodified `HEAD` |
| Full suite | `npm test` | 8093 passed, 83 failed in 17 suites — **all 17 reproduced on unmodified `HEAD`** |
| Lint | `npm run lint` | **0 errors** (261 pre-existing warnings) |
| Production build | `npm run build` | **succeeded** (`.next/BUILD_ID` written) |
| i18n parity | `npm run i18n:parity` | **0 missing, 0 obsolete** (identical-word warnings only) |

The pre-existing failing suites are:
`ventures/api`, `ventures/ventures`, `ventures/lead`, `ventures/staff-actor`,
`ventures/templates`, `venture-document-types`, `venture-company-status`,
`server/auth-boundaries`, `reminders-routes`, `verification-upload`,
`journey-report-deliverables`, `responsibility-assign-decisions`,
`journey-delete-super-admin`, `permissions-characterization`,
`profile-role-rule-phase-b`, `identity-gate-bridge`, `deliverable-upload-access`.

They were reproduced after stashing every WS4 change, so they are not regressions from this
work.

---

## 4. Outstanding issues

1. **Staging acceptance was not run in this session.** The production test in
   `docs/PRODUCTION_TEST.md` still has to be worked item by item against staging before
   promotion. Build success is not a substitute.
2. **Pre-existing test failures** listed above need their own fix pass; they are unrelated to
   WS4.
3. **Data Bank (verification) readiness** remains on its own legacy page and API. That page is
   no longer linked from any active workspace; it was left intact rather than deleting a
   compliance workflow. It is documented as separate from Investment Readiness.
4. **No database migration** was introduced by WS4.
5. **WS5** is audited in `docs/WS5_DATA_ROOM_AUDIT.md`.

---

## 5. Addendum — Venture Setup displayed « — »

**Cause.** The founder count compared the readable Venture code with the membership
table's internal identifier column. PostgreSQL refused the comparison, the whole progress
read failed, and the screen rendered the failure as « — » regardless of the profile.

**Fix.** The count now compares both identifiers as text (works for either generation of
the column), and the optional probes degrade to zero instead of taking the whole read down.
A successful profile save also refreshes the record and the score immediately, so the
30-second read cache cannot serve the previous value.

**Verified read-only against the current database:** the three Ventures now compute to
**15 %**, **23 %** and **46 %** instead of « — ».
