# 🔐 Security Audit — Application Register

**Date** : 2026-09-23
**Branch audited** : `A`
**Method** : read-only static review of every `src/app/api/**/route.js` (403 route files) and the modules they call (`src/lib/**`, `src/models/**`), grouped by domain; the most severe findings were re-verified line by line. No live exploitation, no production data touched.
**Companion** : the earlier M1 findings remain in `docs/SECURITY_AUDIT_M1.md`.

> This is the living register. Every finding has a **status**. "OPEN" means the risk is still present in the code today.

---

## 0. Baseline (state at audit time)

| Check | Result |
|---|---|
| `npm test` | 158 suites / 2038 tests pass |
| `npm run build` | success (middleware active) |
| `npx eslint .` | 0 errors, 4 pre-existing warnings (`src/lib/hooks/useApi.js`) |
| `npm audit` | 4 vulnerabilities (1 critical, 3 high) — all `tar` via `unpdf → canvas`. Runtime exploitability low (see DEP-1). |
| Tracked `.env` | none (`.env*` gitignored) |
| Hardcoded secrets in `src/` | none detected |

---

## 1. Status legend

| Status | Meaning |
|---|---|
| **FIXED — Lot 0** | Corrected with the P0 batch (auth/registration/token leaks). |
| **FIXED — Middleware** | Corrected with the `proxy.js` allowlist alignment. |
| **FIXED — Lot 1** | Corrected with the venture object-level authorization batch. |
| **FIXED — Lot 2** | Corrected with the investor own-scope batch. |
| **FIXED — Lot 3** | Corrected with the admin/auth/session/scope batch. |
| **FIXED — Lot 4** | Corrected with the forms/LMS/upload batch. |
| **FIXED — Lot 5** | Corrected with the P2 hardening batch. |
| **FIXED — Lot 6** | Corrected with the P3 hardening batch. |
| **FIXED — Lot 7** | Corrected with the program-scope batch (team/group management). |
| **FIXED — Lot 8** | Corrected with the curriculum/reports/export scope + separation-of-duties batch. |
| **FIXED — Lot 9** | Corrected with the remaining admin/staffing scope batch. |
| **FIXED — Lot 10** | Corrected with the task-scope fail-closed / supervisor / anonymous-contact batch. |
| **FIXED — Lot 11** | Corrected with the team-board scope + team-credential exposure batch. |
| **FIXED — Lot 12** | Corrected with the submission scope + LMS requirement scope batch. |
| **FIXED — Lot 13** | Corrected with the platform Runs `submitter_id` BOLA (remainder = a governance decision). |
| **FIXED — Lot 14** | Corrected with the ERR-1 error-handling sweep on the audit-touched surfaces. |
| **OPEN** | Still present. Fix order in §4. |

---

## 2. Fixed

### 2.1 Lot 0 — P0 batch

| ID | Category | Location | Was | Status |
|---|---|---|---|---|
| AUTHZ-1 | Access control | `POST /api/contacts` | Anonymous caller could set `role`/`status` from the body → mint a `super_admin` account. | **FIXED — Lot 0** |
| AUTH-1 | Auth / token | `POST /api/auth/invite`, `POST /api/auth/setup-password` | The invite response returned the live password-setup token, and one was minted even for an already-activated account → any `staff`/`PM` could take over any account (incl. `super_admin`). | **FIXED — Lot 0** |
| AUTHZ-2 | Auth / data | `POST /api/investor/register` | Anonymous; stored passwords **in clear text** and flipped any existing account to `investor`. | **FIXED — Lot 0** |
| AUTHZ-3 | Data exposure | `GET /api/families?registration_id=` | Returned `SELECT *` including the group's shared login passwords. | **FIXED — Lot 0** |
| PUB-1 | Integrity | `POST /api/public/register` | Rewrote `password`/`name`/`group_name` of any existing account by email. | **FIXED — Lot 0** |
| — | Regression tests | `src/__tests__/security-p0-regressions.test.js` | 8 tests pin the above. | **FIXED — Lot 0** |

### 2.2 Middleware alignment

| ID | Category | Location | Was | Status |
|---|---|---|---|---|
| MW-1 | Routing | `src/proxy.js` | Public pages called APIs the middleware blocked (`/api/public`, `/api/families`, `/api/verify`); the pages `/register/*`, `/join/*`, `/verify/*` were themselves redirected to `/login`. Public registration/join/certificate verification were unusable anonymously. | **FIXED — Middleware** |

### 2.3 Lot 1 — venture object-level authorization

Pattern fixed everywhere: an editor of venture A could act on a row of venture B by sending B's row id (the route only proved access to the venture in the URL).

| ID | Location | Was | Status |
|---|---|---|---|
| IDOR-V1 | `ventures/[id]/tasks` | `task_id`, `milestone_id`, `comment_id`, `attachment_id`, review — unscoped. | **FIXED — Lot 1** |
| IDOR-V2 | `ventures/[id]/milestones` | `UPDATE … WHERE id = ?` (no venture) + misaligned retry args. | **FIXED — Lot 1** |
| IDOR-V3 | `ventures/[id]/deliverables` | `GET ?milestone_id=` cross-venture read. | **FIXED — Lot 1** |
| IDOR-V4 | `ventures/[id]/verification` | `delete_document` unscoped (any authenticated user); `add_comment` `author_type` from the body (staff spoofing). | **FIXED — Lot 1** |
| IDOR-V5 | `ventures/[id]/documents` | detail / shares / access_logs / update / delete / share / revoke_share unscoped. | **FIXED — Lot 1** |
| IDOR-V6 | `ventures/[id]/sessions` | 9 actions on `session_id` + `update_action_item` unscoped. | **FIXED — Lot 1** |
| IDOR-V7 | `ventures/[id]/coaches` | `remove_assignment` unscoped. | **FIXED — Lot 1** |
| IDOR-V8 | `ventures/[id]/fundraising` | opportunity detail/update/delete/note/activity unscoped. | **FIXED — Lot 1** |
| IDOR-V9 | `ventures/[id]/investors` | `update_match` unscoped. | **FIXED — Lot 1** |
| IDOR-V10 | `ventures/[id]/knowledge` | user-scoped reads accepted a client `user_cid`. | **FIXED — Lot 1** |
| — | Helper + tests | `src/lib/ventureOwnership.js`, `src/__tests__/security-lot1-idor.test.js` | New scope helper + 9 regression tests. | **FIXED — Lot 1** |

### 2.4 Lot 2 — investor own-scope

Pattern fixed everywhere: the self-service guard admitted an investor on role/capability (or on the existence of a profile) but never bound a resource to the caller, so one investor could read or mutate another's pipeline, workspace, document, evaluation or organization.

| ID | Location | Was | Status |
|---|---|---|---|
| BOLA-INV-1 | `src/models/authorization/investorScope.js` + all `investor/**` routes | No own-scope binding anywhere. New helper (`resolveInvestorScope`, `investorOwnsPipeline/Workspace/DdRequest/DdDocument`, `isInvestorManagement`). | **FIXED — Lot 2** |
| BOLA-INV-2 | `investor/relationships` | Non-`investor` session ran the unfiltered query; `?id=` detail unscoped. Query now scopes on the profile, not the role string. | **FIXED — Lot 2** |
| BOLA-INV-3 | `investor/diligence/documents` | Cross-investor document download (incl. `file_data`) and upload into any `request_id`. | **FIXED — Lot 2** |
| BOLA-INV-4 | `investor/diligence`, `decisions`, `evaluation`, `organizations`, `relationships/meetings`, `meetings` | `pipeline_id` / `request_id` / `workspace_id` / `org id` unscoped; role-string inequality bypass in the DD transitions. | **FIXED — Lot 2** |
| AUTHZ-INV-1 | `investor/kpis`, `investor/updates` | Any capability holder could forge KPIs on any venture or publish updates on any venture. Writes now require management. | **FIXED — Lot 2** |
| — | Tests | `src/__tests__/security-lot2-investor-scope.test.js` | 9 regression tests. | **FIXED — Lot 2** |

### 2.5 Lot 3 — admin, auth, session and scope

| ID | Location | Was | Status |
|---|---|---|---|
| AUTH-2 | `auth/impersonate`, `auth/quick-login` | No authn — the env flag (and its client-visible `NEXT_PUBLIC_` twin) was the only gate. Both now require a live `super_admin` session. | **FIXED — Lot 3** |
| AUTH-3 | `auth/setup-password`, `auth/reset-password`, `profile` | Password change/reset left old sessions alive. Now purges sessions (profile keeps only the current one, via `deleteUserSessionsExcept`). | **FIXED — Lot 3** |
| AUTHZ-ADM-1 | `engineering/permissions` | `promote_super_admin`/`remove_super_admin` were gated only by `assign_capabilities`. Now require the `super_admin` role. | **FIXED — Lot 3** |
| AUTHZ-ADM-2 | `admin/bulk-upload`, `contacts` PUT | CSV / `role` written to arbitrary contacts. Import clamps to `IMPORTABLE_ROLES` without the assign-roles capability; `contacts` PUT only writes `role` for a role-assignment holder. | **FIXED — Lot 3** |
| AUTHZ-ADM-3 | `admin/approve-user` | Returned the live setup token; `role` and the audit actor came from the body. Token no longer returned; role allow-listed; actor from the session. | **FIXED — Lot 3** |
| BOLA-ADM-1 | `projects/members`, `projects` DELETE, `admin/projects/[id]/approvals` | Invite/remove members, delete a project, or approve another project's request by id. Now project-scoped (`requireProjectAccess`) and the approval request must belong to the URL project. | **FIXED — Lot 3** |
| IDOR-TASK-1 | `tasks/carryover` | Any authenticated user could carry over / flip anyone's task; attribution from the body. Now owner/assignee/supervisor-or-staff, attribution from the session. | **FIXED — Lot 3** |
| BOLA-CRM-1 | `contacts/full-state` | Client-chosen `pm_id` + ungated global registry branch. Non-management callers are now pinned to their own scope. | **FIXED — Lot 3** |
| — | `group-members`, `feedback` | Unscoped membership dump (now requires `group_id`); participants can read every program's feedback (now management-only) and write feedback as anyone (now bound to their own cid). | **FIXED — Lot 3** |
| — | Tests | `src/__tests__/security-lot3-admin-authz.test.js` | 16 source-level invariant tests. | **FIXED — Lot 3** |

### 2.6 Lot 4 — forms, LMS and uploads

| ID | Location | Was | Status |
|---|---|---|---|
| INJ-1 | `platform/form-runs` | The `migrate` action ran an arbitrary SQL string from the request body via `db.execute` (super_admin). Action and helper removed. | **FIXED — Lot 4** |
| LMS-1 | `models/lms/certificates.js` | The public verification accepted the SEQUENTIAL certificate number, making the URL enumerable (learner name + course). Only the random token is accepted now. | **FIXED — Lot 4** |
| AUTHZ-VEN-1 | `ventures/[id]/coach-invite` | `responsibility_code`/`scope_type` came from the body, so a plan-manage holder could mint a `lead_manager`. Allow-listed to coach/facilitator + venture-wide. | **FIXED — Lot 4** |
| MASS-VEN-1 | `ventures/[id]/members` | Client `role`/`permissions` written unvalidated. Role allow-list, permissions must be an object. | **FIXED — Lot 4** |
| DATA-2 | `lms/courses/[id]` | `correct_answer` returned to a `lms.view` holder. The answer key is stripped unless the caller may `lms.edit`. | **FIXED — Lot 4** |
| SCOPE-LMS-1 | `lms/program-requirements` (GET/POST), `lms/coaching-requests` | Program scope added (`requireProgramScope`). | **FIXED — Lot 4** |
| UPLOAD-1 (part) | `upload`, `profile/photo`, `lms/courses/thumbnail`, `lib/storage.js`, `lib/lms/sectionResourceFiles.js` | Validation was MIME **OR** extension, so a file with a safe extension and a hostile content type passed. Now requires a valid extension AND a compatible (or absent) declared type. | **FIXED — Lot 4 (part — bucket privacy below)** |
| — | Tests | `src/__tests__/security-lot4-forms-lms.test.js` (+ 3 LMS suites updated) | 11 regression tests. | **FIXED — Lot 4** |

### 2.7 Lot 5 — P2 hardening

| ID | Location | Was | Status |
|---|---|---|---|
| HDR-1 | `next.config.mjs` | No security headers. Added HSTS, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `X-Frame-Options`, and a **report-only** CSP (enforcing CSP needs a dedicated design pass — the app uses inline scripts and third-party frames). | **FIXED — Lot 5** |
| RATE-1 | `auth/login`, `auth/session-login`, `auth/reset-password` | No throttle on credential auth. Now 20/IP + 10/account per 15 min on the logins, 10/IP on reset. | **FIXED — Lot 5** |
| AUTH-5 | `auth/activate` (GET), `auth/setup-password/validate` (GET) | Unthrottled token probes returning PII. Now 20/IP per 15 min. | **FIXED — Lot 5** |
| IMPL-1 | `lib/api/createHandler.js`, `lib/auth.js` | Never attached `req.session`. Now the wrapper resolves the session ONCE, hands it to `requireAuth(roles, session)` (new optional param) and attaches it — same number of reads as before, so no route changes behaviour. | **FIXED — Lot 5** |
| — | Tests | `src/__tests__/security-lot5-hardening.test.js` (+ 2 suites adjusted for the new guard signature) | 9 regression tests. | **FIXED — Lot 5** |

### 2.8 Lot 6 — P3 hardening

| ID | Location | Was | Status |
|---|---|---|---|
| LOG-1 | `src/lib/auth.js` | Session logs printed a token prefix (cookie and stored token). The lines now carry no token material. | **FIXED — Lot 6** |
| IMP-1 | `src/lib/auth.js` | `is_impersonation` was never written on `user_sessions`, so an impersonated session was indistinguishable. Now persisted (with an idempotent column self-heal) and returned on the session. | **FIXED — Lot 6** |
| CSV-1 | `src/lib/csv.js` | `rowsToCsv` emitted `=…`/`+…`/`@…` cells verbatim, so an export opened in a spreadsheet executed the formula. Formula-leading cells are now prefixed with `'` (plain negative numbers are left alone). | **FIXED — Lot 6** |
| XSS-1 | `src/app/s/[runId]/page.js` | The public success message was injected with `dangerouslySetInnerHTML`. Now rendered through `sanitizeRichText`. | **FIXED — Lot 6** |
| AUD-1 | `admin/reject-user`, `tasks/comments` | The audit actor name came from the request body. Both now take it from the session. | **FIXED — Lot 6** |
| SECRET-2 | `notifications/{due-reminders,overdue}`, `engineering/permissions/context-grants-sweep` | The cron secret travelled in the URL (`?key=`), so it landed in logs and referrers. Read from `x-cron-secret` first, `?key=` kept only as a fallback for existing schedulers. | **FIXED — Lot 6 (header preferred; URL fallback retained)** |
| SYS-1 | `POST /api/system/database` | The comment said super_admin but the gate was `settings.edit`. Now `requireAuth(["super_admin"])`. | **FIXED — Lot 6** |
| SYS-2 | `GET /api/program-types` | The GET ran DDL (`ensureProgramTypeOptionsTable`) on every read. The read no longer creates tables. | **FIXED — Lot 6** |
| LOGIC-1 | `projects/invitations/respond` | The cancel path compared `session.name` to `inviter_id`. Now compares a cid. | **FIXED — Lot 6** |
| LOGIC-2 | `ventures/[id]/timeline`, `ventures/[id]/milestones`, `lib/ventureInput` | Dependency `source/target` types and ids were unvalidated (`parseInt` could be `NaN`); milestone `owner_cid` was stored as-is. Types are allow-listed (`milestone`/`task`), ids must be positive integers, and the owner must be a bounded string (`cidOrNull`/`isValidCid`). | **FIXED — Lot 6** |
| DATA-3 | `data/route.js` | The JSON store keyed off caller input without an own-property / array guard (prototype-pollution shape). Now `hasOwnProperty` + `Array.isArray`. | **FIXED — Lot 6** |
| LMS-3 | `lms/enrollments` | A client-supplied `source` and an unvalidated target user were accepted. `source` is forced to `"admin"` and the target is validated. | **FIXED — Lot 6** |
| WHO-1 | `webhooks/resend` | Svix signatures were compared with `Array.includes` (not constant time) and accepted at any age. Now `crypto.timingSafeEqual` on every candidate plus a 5-minute freshness window. | **FIXED — Lot 6** |
| — | Tests | `src/__tests__/security-lot6-hardening.test.js` | 22 source-level invariant tests. | **FIXED — Lot 6** |

### 2.9 Lot 7 — program scope on team/group management

| ID | Location | Was | Status |
|---|---|---|---|
| XPROG-1 (part) | `pm/teams`, `teams` | Authorised on a global `programs.edit` capability only, so a delegated holder could add members to, rename or delete another program's squad. Now the target program is resolved (from the body, or from the team row) and `requireProgramScope({ wave: "groups" })` is enforced before any write. | **FIXED — Lot 7 (part — `pm/curriculum`, `pm/reports`, `pm/export` below)** |
| BOLA-CRM-1 | `group-members` POST | The membership insert had no program scope, so any staff could add a participant to any group. The group's program is now resolved and scope-checked (a missing group is a 404, never a write). | **FIXED — Lot 7** |
| — | Tests | `src/__tests__/security-lot7-program-scope.test.js` (13 behavioural tests) + `program-scope-coverage.test.js` (3 census entries) | In-scope writes and out-of-scope refusals, for both a body-supplied program and a program resolved from the record. | **FIXED — Lot 7** |

### 2.10 Lot 8 — curriculum/reports/export scope + separation of duties

| ID | Location | Was | Status |
|---|---|---|---|
| XPROG-1 (part) | `pm/curriculum`, `pm/reports`, `pm/export` | Authorised on the global `programs.edit` / `reports.export` capability without scope. Worse, `pm/curriculum`'s record actions (`toggle_status`, `toggle_deliverable`, `assign_team`, `anchor_material`) mutated a row by id while scoping on the CLIENT-supplied `program_id`, so a forged program_id could write into another program. The program is now resolved from the RECORD itself (session/requirement), never from the body, then `requireProgramScope({ wave: "content" })` is enforced. | **FIXED — Lot 8** |
| AUTHZ-ADM-5 (part) | `access-profiles/assign`, `responsibilities/assign` | Nothing stopped an actor from granting capabilities to THEMSELVES. Both PUTs now refuse a self-target (403) — separation of duties, applied to every role including Super Admin. | **FIXED — Lot 8** |
| — | Tests | `src/__tests__/security-lot8-scope-selfassign.test.js` (16 behavioural tests) + `program-scope-coverage.test.js` (3 census entries) | Forged-body-program refusal, record-resolution proof, self-assignment refusal, Super Admin bypass of scope (but not of the self-guard). | **FIXED — Lot 8** |

### 2.11 Lot 9 — scope on the remaining admin/staffing surfaces

| ID | Location | Was | Status |
|---|---|---|---|
| AUTHZ-ADM-4 | `programs` PUT, `facilitators/invite-bulk`, `admin/projects/[id]/reports/generate` | `programs` PUT let any staff edit ANY program; `facilitators/invite-bulk` let a `program_manager` skip the assignment check entirely; the report-generate route wrote a weekly report onto any project id. Now: `requireProgramScope({ wave: "content" })` on the program update, `requireProgramScope({ wave: "enrollment" })` for EVERY invite-bulk caller (staff keep the stricter assigned-PM check on top), and `requireProjectAccess(id)` on the report (matching its sibling admin project surfaces). | **FIXED — Lot 9** |
| — | Tests | `src/__tests__/security-lot9-admin-scope.test.js` (8 behavioural tests) + `program-scope-coverage.test.js` (2 census entries) | The old `program_manager` bypass is now refused; the staff-not-PM path stays refused; scoped writes still work; project membership governs the report. | **FIXED — Lot 9** |

### 2.12 Lot 10 — task scope, supervisor grant, anonymous contact enrollment

| ID | Location | Was | Status |
|---|---|---|---|
| IDOR-TASK-2 | `models/tasks.js` (`getTasksByFilters`), `tasks` route | A non-super-admin whose scope was not recognised (or absent) fell through to an UNFILTERED list of every task — a latent fail-open. `supervisor_id` (which grants read/edit access to a task) could be set by any caller. Now the filter FAILS CLOSED (`AND 1 = 0`) and only a staff-side role may set/change the supervisor. (The controller's own `user_id` scoping was re-verified as already correct.) | **FIXED — Lot 10** |
| PUB-CONTACTS-1 | `contacts` POST | An anonymous public submission could name any `program_id` and enroll its new contact into that program. `program_id`/`program_name` are now honoured only for an authenticated caller (role/status were already clamped). | **FIXED — Lot 10** |
| — | Tests | `src/__tests__/security-lot10-tasks-contacts.test.js` (6 tests) | Fail-closed filter (real model), supervisor gating, anonymous `program_id` dropped. | **FIXED — Lot 10** |

### 2.13 Lot 11 — team board scope + team credential exposure

| ID | Location | Was | Status |
|---|---|---|---|
| AUTHZ-CRM-1 (part) | `team-tasks` | The board had no team scope: any holder of the global `tasks.*` capability could read and mutate ANY team's tasks. A new guard resolves the team's program and enforces `requireProgramScope({ wave: "groups" })` for delegated callers, management is unscoped, a team-entity session may only touch its OWN board, and a task mutation resolves the task's team first. | **FIXED — Lot 11 (part — `contact-emails`/`notifications` below)** |
| XPROG-1 (remainder) | `teams` GET, `pm/teams` GET + `models/{teams,groups}` (`SELECT *`) | The team reads returned the shared team username/password to every authorized reader. Non-management callers now receive the roster through `stripTeamCredentials` (shared `src/lib/teamCredentials.js`); management keeps them. | **FIXED — Lot 11** |
| — | Tests | `src/__tests__/security-lot11-team-scope.test.js` (10 tests) + `program-scope-coverage.test.js` (1 census entry) | Foreign-board refusal, team own-board binding, own-program works, management bypass, credential stripping both ways. | **FIXED — Lot 11** |

### 2.14 Lot 12 — submission scope + LMS requirement scope

| ID | Location | Was | Status |
|---|---|---|---|
| BOLA-FORM-2 | `submissions` GET/PUT | A team-entity session could read ANY team's submissions by choosing `team_id` or `program_id` (neither was bound), and the score write (PUT) had no program scope at all. The team filter is now bound server-side to the session's own team, and the score write resolves/requires the program and enforces `requireProgramScope({ wave: "content" })`. | **FIXED — Lot 12** |
| SCOPE-LMS-1b | `lms/program-requirements/[id]` PUT/DELETE + `models/lms/programRequirements` | The requirement id from the URL was never resolved to its program. New `getRequirementProgramId` + `requireProgramScope({ wave: "lms" })`. | **FIXED — Lot 12** |
| — | Config | `models/authorization/programScopeWaves` + census | The `lms` wave the LMS routes already used was undeclared (drift). It is now a first-class wave, and the three LMS surfaces are censused. | **FIXED — Lot 12** |
| — | Tests | `src/__tests__/security-lot12-submissions-lms.test.js` (8 tests) + `program-scope-coverage.test.js` (4 census entries) | Team own-team binding, foreign-team refusal, program-scoped score write, requirement detach/edit scope. | **FIXED — Lot 12** |

### 2.15 Lot 13 — platform Runs `submitter_id` BOLA

| ID | Location | Was | Status |
|---|---|---|---|
| BOLA-FORM-1 (part) | `GET /api/platform/form-runs?submitter_id=X` | The id came straight from the query string, so any `runs.view` holder could read ANY user's submissions. The target is now bound to the session; only a Super Admin may name someone else (the self-service path is `my_submissions`). | **FIXED — Lot 13** |
| — | Tests | `src/__tests__/security-lot13-runs.test.js` (3 tests) | The branch binds to the session, the raw id is no longer passed through, the self path still binds to `session.cid`. | **FIXED — Lot 13** |

### 2.16 Lot 14 — ERR-1 error-handling sweep

| ID | Location | Was | Status |
|---|---|---|---|
| ERR-1 (part) | `program-types`, `run-export`, `submissions`, `team-tasks`, `system/database`, `webhooks/resend` | 500 bodies returned `error.message`, which can carry driver/SQL/stack detail to the client. A shared `serverError(error, { log, status, message })` helper now logs the real error server-side and answers with `errors.somethingWrong`. | **FIXED — Lot 14 (swept surfaces)** |
| — | Tests | `src/__tests__/security-lot14-error-handling.test.js` (8 tests) | The helper never serializes the caught error and the swept routes carry no raw `error.message`. | **FIXED — Lot 14** |

> Note: the remaining ERR-1, RATE-2, CSRF-1 and AUTH-4 surfaces (`s/public-submit`, `public/courses`, `errors`, `lib/rate-limit.js`, `engineering/permissions/seed*`, `sync-context-grants`, `auth/login|reset-password|session-login`) were **being edited concurrently** (auth refactor) at the time of this batch, so they are left untouched and will be completed once that lands.

---

## 3. OPEN — residual register

**Severity**: P0 = auth bypass / privilege escalation / unauthorized data access / secret / injection / RCE · P1 = IDOR / stored XSS / CSRF / SSRF / dangerous upload / business-logic bypass · P2 = rate limiting / weak validation / info exposure · P3 = hardening.

### 3.1 P0

| ID | Category | Location | Risk | Severity | Status |
|---|---|---|---|---|---|
| INJ-1 | Injection | `POST /api/platform/form-runs` action `migrate` | ✅ fixed in Lot 4 (action removed). | **FIXED** |

### 3.2 P1

| ID | Category | Location | Risk | Status |
|---|---|---|---|---|
| LOGIC-INV-1 | Business logic | `investor/pipeline` | Client sets `stage:"invested"` + `amount` → writes `investment_decisions`, inflates campaign totals, notifies admins. Own-scoped but unconfirmed by staff. | **OPEN** |
| BOLA-ADM-1 | BOLA | `projects/members`, `projects` DELETE, `admin/projects/[id]/approvals` | ✅ fixed in Lot 3 (see §2.5). | **FIXED** |
| AUTHZ-ADM-1 | Privilege escalation | `engineering/permissions` | ✅ fixed in Lot 3. | **FIXED** |
| AUTHZ-ADM-2 | Mass assignment | `admin/bulk-upload`, `contacts` PUT | ✅ fixed in Lot 3. | **FIXED** |
| AUTH-2 | Auth | `auth/impersonate`, `auth/quick-login` | ✅ fixed in Lot 3. | **FIXED** |
| AUTH-3 | Session | password change/reset paths | ✅ fixed in Lot 3. | **FIXED** |
| XPROG-1 | Scope | `pm/{teams,curriculum,reports,export}`, `teams`, `lms/coaching-requests` | ✅ fully fixed (Lots 4/7/8) — program scope everywhere, and the `SELECT *` team credentials are now management-only (Lot 11). | **FIXED** |
| BOLA-CRM-1 | BOLA | `group-members` POST | ✅ fixed in Lot 7 (program scope on the membership insert; unscoped read fixed in Lot 3). | **FIXED** |
| IDOR-TASK-1 | BOLA | `tasks/carryover` | ✅ fixed in Lot 3. | **FIXED** |
| IDOR-TASK-2 | BOLA | `tasks` | ✅ fixed in Lot 10 (listing fails closed; `supervisor_id` reserved to staff-side roles). | **FIXED** |
| BOLA-FORM-2 | BOLA | `submissions` | ✅ fixed in Lot 12 (team filter bound server-side; score write program-scoped). | **FIXED** |
| PUB-3 | Business logic | `respond` | Writes responses attributed to a caller-supplied `cid`, with no anchoring. | **OPEN — Lot 4 remainder** |
| AUTHZ-VEN-1 | Privilege grant | `ventures/[id]/coach-invite` | ✅ fixed in Lot 4. | **FIXED** |
| LMS-1 | Enumeration | `verify/certificate` (`models/lms/certificates.js`) | ✅ fixed in Lot 4. | **FIXED** |
| UPLOAD-1 | Upload | `upload`, `profile/photo`, `lms/*` | ✅ validation fixed in Lot 4; **still OPEN: buckets are public** (need private + signed URLs). | **OPEN — Lot 4 remainder** |
| BOLA-FORM-1 | BOLA | `run-export`, `platform/form-runs` (`submission_id`, `timeline`, `scoring`), `platform/form-runs/report-file`, `platform/ai/evaluation-scores` | ✅ the `submitter_id` read is fixed in Lot 13. The rest is a **governance decision** (§6.7): the platform Runs domain is global and capability-gated with no tenant dimension, so it cannot be scoped without a product choice. | **OPEN — governance decision** |
| SCOPE-LMS-1b | Scope | `lms/program-requirements/[id]` PUT/DELETE | ✅ fixed in Lot 12 (program resolved from the requirement). | **FIXED** |
| CSRF-1 | CSRF | state-changing **GET** routes (`engineering/permissions/seed*`, `sync-context-grants`, `program-types`) | `SameSite=Lax` lets a top-level cross-site navigation trigger mutations. | **OPEN — Lot 5** |
| DEP-1 | Dependencies | `npm audit` | CRITICAL/HIGH `tar` via `unpdf → canvas`; no upstream fix. | **OPEN — Lot 5** |

### 3.3 P2

| ID | Category | Location | Risk | Status |
|---|---|---|---|---|
| RATE-1 | Rate limiting | `auth/login`, `auth/session-login`, `auth/reset-password` | ✅ fixed in Lot 5 (limits are per process — a shared store is needed for multi-instance). | **FIXED** |
| RATE-2 | Rate limiting | `s/public-submit`, `/api/public/courses`, `/api/errors` (POST), uploads, AI routes | Public/expensive endpoints still unthrottled; IP spoofable via `X-Forwarded-For`. | **OPEN — Lot 5 remainder** |
| HDR-1 | Headers | `next.config.mjs` | ✅ fixed in Lot 5 (CSP is report-only). | **FIXED** |
| ERR-1 | Error handling | many routes | `error.message` returned in 500s (SQL/driver detail). ✅ swept in Lot 14 for the audit-touched surfaces (shared `src/lib/apiError.js`). **Remainder blocked by the concurrent auth refactor.** | **OPEN — part** |
| AUTH-4 | Enumeration | `auth/login`, `auth/reset-password` | Distinct 403/404 responses reveal account existence; timing oracle. | **OPEN — Lot 5** |
| SECRET-1 | Passwords | `auth/login`, `auth/session-login`, team/group passwords | Clear-text comparison fallback; shared/team passwords stored in clear. | **OPEN — Lot 5** |
| IMPL-1 | Correctness | `src/lib/api/createHandler.js` | ✅ fixed in Lot 5. | **FIXED** |
| AUTH-5 | Enumeration | `auth/setup-password/validate` (GET), `auth/activate` (GET) | ✅ fixed in Lot 5. | **FIXED** |
| AUTHZ-ADM-3 | Token / mass assignment | `admin/approve-user` | ✅ fixed in Lot 3. | **FIXED** |
| AUTHZ-ADM-4 | Scope | `facilitators/invite-bulk`, `programs`, `admin/projects/[id]/reports/generate` | ✅ fixed in Lot 9 (program scope on all three; report scoped by project membership). | **FIXED** |
| AUTHZ-ADM-5 | Self-assignment | `access-profiles/assign`, `responsibilities/assign` | ✅ self-assignment guard added in Lot 8. `allowed_roles` left advisory BY DESIGN (see §6). | **FIXED (self-guard)** |
| AUTHZ-CRM-1 | Scope | `notifications` (create), `contact-emails`, `team-tasks` | ✅ `team-tasks` team-scoped in Lot 11. **Still OPEN: `contact-emails` (scope needs a contact→program rule) and `notifications` create (recipient scope is a product decision).** | **OPEN — parts** |
| PUB-CONTACTS-1 | Mass assignment | `contacts` POST | ✅ fixed in Lot 10 (anonymous callers can no longer set `program_id`/`program_name`; role/status were clamped earlier). | **FIXED** |
| DATA-2 | Exposure | `lms/courses/[id]` | ✅ fixed in Lot 4 (answer key stripped). | **FIXED** |
| SCOPE-LMS-1 | Scope | `lms/program-requirements` | ✅ fixed in Lot 4. | **FIXED** |
| MASS-VEN-1 | Mass assignment | `ventures/[id]/members` | ✅ fixed in Lot 4. | **FIXED** |
| SECRET-3 | Passwords | `teams`, `pm/teams` | Team passwords generated with `Math.random()` and stored in clear. | **OPEN — Lot 5** |
| AUTHZ-GLOBAL-1 | Scope | `ventures/[id]/knowledge` (resource update/delete), `ventures/[id]/coaches` (PATCH/DELETE coach) | Global catalogs mutated by any venture editor; no venture dimension exists. | **OPEN — needs a platform-capability decision** |
| PUB-2 | Business logic | `s/public-draft` | Draft answers read/overwritten by slug+email, no token. | **OPEN — Lot 4 remainder** |
| WHO-1 | Webhook | `webhooks/resend` | ✅ fixed in Lot 6 (constant-time compare + 5-minute freshness window). | **FIXED** |

### 3.4 P3

| ID | Category | Location | Status |
|---|---|---|---|
| LOG-1 | Logging | `src/lib/auth.js` logs a session-token prefix. | ✅ fixed in Lot 6. | **FIXED** |
| CSV-1 | Formula injection | `ventures/[id]/reports`, `analytics` exports. | ✅ fixed in Lot 6 (`rowsToCsv` prefixes formula cells). | **FIXED** |
| IMP-1 | Impersonation | `is_impersonation` never persisted on `user_sessions`. | ✅ fixed in Lot 6. | **FIXED** |
| XSS-1 | Stored (low) | `src/app/s/[runId]/page.js` renders `successMessage` via `dangerouslySetInnerHTML` (form-author content; submitted values are escaped). | ✅ fixed in Lot 6 (`sanitizeRichText`). | **FIXED** |
| AUD-1 | Audit integrity | `admin/approve-user`, `admin/reject-user`, `tasks/comments` accept the actor name from the body. | ✅ fixed in Lot 6. | **FIXED** |
| SECRET-2 | Secrets in URL | `notifications/{due-reminders,overdue}`, `context-grants-sweep` pass `?key=`. | ✅ header `x-cron-secret` preferred in Lot 6; `?key=` kept as fallback for existing schedulers. | **FIXED (part)** |
| SYS-1 | Config | `system/database` comment says super_admin but the gate is `settings.edit`. | ✅ fixed in Lot 6 (`requireAuth(["super_admin"])`). | **FIXED** |
| DATA-1 | Exposure | `families` / `v2_teams` / `contacts` / `dd_documents` `SELECT *` shapes. | partially addressed (Lot 0/2) |
| MVC-1 | Layering | SQL inside routes (`investor/executive-dashboard`, `venture-permissions/*`, milestone/session lookups). | **OPEN — ongoing** |
| SYS-2 | Config | `program-types` GET runs DDL (`ensureProgramTypeOptionsTable`). | ✅ fixed in Lot 6. | **FIXED** |
| LOGIC-1 | Correctness | `projects/invitations/respond` compares `session.name` to `inviter_id`. | ✅ fixed in Lot 6 (cid compare). | **FIXED** |
| LOGIC-2 | Validation | `timeline add_dependency` source/target ids unvalidated; `milestones` `owner_cid` unvalidated. | ✅ fixed in Lot 6 (type allow-list, positive ints, `cidOrNull`). | **FIXED** |
| DATA-3 | Exposure | `data/route.js` keys off caller input (super_admin only). | ✅ fixed in Lot 6 (`hasOwnProperty` + `Array.isArray`). | **FIXED** |
| LMS-3 | Validation | `lms/enrollments` accepts a client `source` and an unvalidated target user. | ✅ fixed in Lot 6 (source forced to admin). | **FIXED** |

---

## 4. Recommended fix order

```
Lot 0  (P0)          ✅ done — anonymous escalation, token leak, clear-text passwords, group credential leak
Middleware           ✅ done — public API/page allowlist alignment
Lot 1  (P1 venture)  ✅ done — object-level authorization on the venture surface
Lot 2  (P1 investor) ✅ done — own-scope every investor route
Lot 3  (P1 admin/authz) ✅ mostly done — impersonation, role escalation, session purge, project BOLA, task carryover; remainder: `pm/*` + `teams` + `lms/coaching-requests` program scope, `access-profiles`/`responsibilities` self-assignment, `facilitators/invite-bulk`, `admin/projects/[id]/reports/generate`, `notifications`/`contact-emails`/`team-tasks`
Lot 4  (P1 forms/LMS/upload) ✅ mostly done — arbitrary SQL removed, certificate token-only, upload validation, coach-invite/members privilege allow-lists, LMS answer key, LMS program scope; remainder: public buckets, run/submission scope (`run-export`, `form-runs submission_id`, `report-file`, `evaluation-scores`, `submissions`), `respond` identity, `s/public-draft`, `program-requirements/[id]`, `pm/*` + `teams` program scope, `access-profiles`/`responsibilities` self-assignment
Lot 5  (P2 hardening) ✅ mostly done — headers, credential rate limits, token-probe limits, IMPL-1 (`req.session`); remainder: ERR-1 (error-message leakage), CSRF-1 (state-changing GETs), AUTH-4 (enumeration, UX decision), SECRET-1/3 (clear-text passwords), DEP-1 (`tar`)
Lot 6  (P3 hardening) ✅ done — LOG-1 token logs, CSV-1 formula injection, IMP-1 impersonation flag, XSS-1 `sanitizeRichText`, AUD-1 session actor, SECRET-2 header secret, SYS-1/2 config, LOGIC-1/2 validation, DATA-3 prototype guard, LMS-3 source, WHO-1 constant-time webhook; remainder: MVC-1 (SQL-in-routes, ongoing)
Lot 7  (P1 scope) ✅ partial — program scope on `pm/teams`, `teams`, `group-members`; remainder below
Lot 8  (P1 scope) ✅ done — `pm/curriculum`/`pm/reports`/`pm/export` program scope (resolved from the record) + self-assignment guard
Lot 9  (P1 scope) ✅ done — `programs` PUT, `facilitators/invite-bulk`, project report generation
Lot 10 (P1/P2) ✅ done — task listing fails closed, supervisor reserved to staff, anonymous contact enrollment closed
Lot 11 (P1/P2) ✅ done — team board scoped to its team/program; shared team credentials are management-only
Lot 12 (P1) ✅ done — submission scope (team binding + program-scoped score writes) and LMS requirement scope
Lot 13 (P1) ✅ done — platform Runs submitter read bound to the session (remainder = governance decision)
Lot 14 (P2) ◻ partial — ERR-1 sweep on the audit-touched surfaces; the rest of Lot 5 is blocked by the concurrent auth refactor
```

Each lot: `npx eslint .` · `npm test` · `npm run build`, plus a security regression test per finding.

---

## 5. Verified-clean (checked, no finding)

- **SQL injection** : every query path reviewed uses `?` placeholders through `db.execute`; dynamic fragments are placeholder generators or hard-coded column allow-lists. The only exception is INJ-1 (deliberate raw SQL, super_admin).
- **CORS** : no `Access-Control-Allow-*` headers anywhere → same-origin default.
- **SSRF** : no server-side `fetch` of a user-supplied URL (AI/mail/Notion use configured endpoints only).
- **Path traversal** : storage keys are built server-side (`src/lib/storageNames.js`).
- **XSS (rich text)** : `RichTextContent` → `sanitizeRichText` strips every attribute except a validated `http(s)` href.
- **Session cookie flags** : `HttpOnly`, `Secure` (prod), `SameSite=Lax`, tokens stored hashed (SHA-256).

---

## 6. Residual risks to accept or schedule

1. **Global catalogs** (`knowledge_resources`, `venture_coaches`) have no tenant dimension — fixing requires a product decision on who owns the global catalog (a platform capability). Currently editable by any venture editor (AUTHZ-GLOBAL-1).
2. **Impersonation** is a staging feature; the residual risk is a misconfigured production environment (AUTH-2). Recommendation: drop the `NEXT_PUBLIC_` variant from the server gate.
3. **`tar`** has no upstream fix; reachable only through `canvas`'s native build, not the PDF read path (DEP-1).
4. **Legacy clear-text passwords** (SECRET-1) — a data migration is required before the fallback can be removed.
5. **Investor approval status** — `requireInvestorSelfServiceAuthorization` ignores `investor_profiles.approval_status`, and self-registration stores an `active` contact. Whether an unapproved investor should reach the portal is a product decision; resource binding is now enforced regardless (Lot 2).
6. **`allowed_roles` is advisory by design** — `src/lib/featureAccess.js` states it "NEVER blocks an assignment": the Permission Manager shows an amber warning when a responsibility's feature cannot serve the user's role, and the assignment is allowed on purpose (an administrator can override). The self-assignment guard (Lot 8) closes the escalation path; making `allowed_roles` a hard gate would change an intended workflow, so it is left as a decision.
7. **Platform Runs is a global domain (BOLA-FORM-1)** — `platform_form_runs` has no tenant/program dimension, so `runs.view` / `runs.edit` / `reports.export` are the only boundary and a capability holder can read any run's participant PII (`run-export`, the `submission_id`/`timeline`/`scoring` reads, `report-file`, `evaluation-scores`). Two options, a decision is required: (a) make a run visible only to its `platform_form_run_assignments` (user/group/program targets); or (b) keep these capabilities admin-only and grant them deliberately. The `submitter_id` read was the one unambiguous defect and is fixed (Lot 13).

---

## 7. Pending work backlog (suspended tasks)

Everything below is **still present in the code today**. Grouped by the lot that will carry it; `§x.y` repeats the severity from §3.

### Lot 3 — remainder (P1)

- `notifications` (create), `contact-emails` — scope (§3.3 AUTHZ-CRM-1). `notifications` create needs a product decision on recipient scope (see §6); `contact-emails` needs a contact→program rule.

✅ Done in Lot 7: `pm/teams`, `teams` (program scope), `group-members` POST. ✅ Done in Lot 8: `pm/curriculum`, `pm/reports`, `pm/export` (program scope), `access-profiles/assign` + `responsibilities/assign` (self-assignment guard); `allowed_roles` left advisory (§6). ✅ Done in Lot 9: `programs` PUT, `facilitators/invite-bulk`, project report generation (AUTHZ-ADM-4). ✅ Done in Lot 10: task listing fail-closed + supervisor gating (IDOR-TASK-2); anonymous contact enrollment closed (PUB-CONTACTS-1). ✅ Done in Lot 11: `team-tasks` team scope; `SELECT *` team credentials are management-only (XPROG-1).

### Lot 4 — remainder (P1)

- **UPLOAD-1 (buckets)** — `upload`, `profile/photo`, `lms/*`: buckets are public; need private buckets + signed URLs.
- **BOLA-FORM-1 (remainder)** `run-export`, `platform/form-runs` (`submission_id`/`timeline`/`scoring`), `platform/…/report-file`, `platform/ai/evaluation-scores` — **governance decision** (§6.7); the `submitter_id` read is fixed (Lot 13).
- **PUB-3** `respond` — identity anchoring. **PUB-2** `s/public-draft` — draft token (both need a client-flow change).

✅ Done in Lot 12: **BOLA-FORM-2** (`submissions` team binding + program-scoped score writes), **SCOPE-LMS-1b** (`lms/program-requirements/[id]`), and the undeclared `lms` wave is now first-class.

### Lot 4 — done ✅

- **INJ-1** arbitrary SQL removed · **LMS-1** certificate token-only · **UPLOAD-1 (validation)** extension AND type · **AUTHZ-VEN-1** coach-invite allow-list · **MASS-VEN-1** member role/permissions validated · **DATA-2** LMS answer key stripped · **SCOPE-LMS-1** program scope on program-requirements + coaching-requests.

### Lot 5 — P2

- **RATE-2** — public/expensive endpoints (`s/public-submit`, `/api/public/courses`, `/api/errors`, uploads, AI) still unthrottled; `X-Forwarded-For` is spoofable.
- **ERR-1** — many routes still return `error.message` in 500s.
- **CSRF-1** — state-changing GETs (`engineering/permissions/seed*`, `sync-context-grants`, `program-types`).
- **AUTH-4** — account enumeration (login 403 vs 401, reset 404 vs 401) — a UX decision.
- **SECRET-1 / SECRET-3** — clear-text comparison fallback; team passwords (`Math.random()`, stored clear).
- **DEP-1** — `tar` via `unpdf → canvas` (no upstream fix).
- Shared rate-limit store (the limiter is per process).

### Lot 5 — done ✅

- **HDR-1** headers (+ report-only CSP) · **RATE-1** credential rate limits · **AUTH-5** token-probe limits · **IMPL-1** `createHandler` attaches `req.session` (one read, shared with the guard).

### Lot 6 — P3 ✅

- **LOG-1** token material removed from logs · **CSV-1** formula-cell prefixing · **IMP-1** `is_impersonation` persisted · **XSS-1** `sanitizeRichText` on the public success message · **AUD-1** audit actor from the session · **SECRET-2** `x-cron-secret` header preferred (URL fallback kept) · **SYS-1** database route gated to `super_admin` · **SYS-2** `program-types` GET no longer runs DDL · **LOGIC-1** invitation cancel compares a cid · **LOGIC-2** dependency type/id + milestone owner validation · **DATA-3** prototype-key guard · **LMS-3** enrollment source forced · **WHO-1** constant-time webhook signature + freshness window.

### Lot 7 — P1 scope ✅ partial

- **XPROG-1 (part)** — `requireProgramScope({ wave: "groups" })` on `pm/teams` (POST/PATCH/DELETE) and `teams` (POST/PUT/DELETE); **BOLA-CRM-1** — program scope on the `group-members` POST. Census extended (3 entries); 13 behavioural tests.

### Lot 8 — P1 scope ✅

- **XPROG-1 (part)** — program scope on `pm/curriculum`, `pm/reports`, `pm/export`, with the program resolved from the RECORD (never the body). **AUTHZ-ADM-5 (part)** — self-assignment refused on `access-profiles/assign` and `responsibilities/assign`. Census extended (3 entries); 16 behavioural tests.

### Lot 9 — P1 scope ✅

- **AUTHZ-ADM-4** — `requireProgramScope({ wave: "content" })` on `programs` PUT; `requireProgramScope({ wave: "enrollment" })` on `facilitators/invite-bulk` for every caller (the `program_manager` bypass removed); `requireProjectAccess(id)` on the project report generator. Census extended (2 entries); 8 behavioural tests.

### Lot 10 — P1/P2 ✅

- **IDOR-TASK-2** — `getTasksByFilters` fails closed (`AND 1 = 0`) when a non-super-admin's scope is unrecognised; `supervisor_id` (access-granting) is now settable only by a staff-side role on create and update. **PUB-CONTACTS-1** — anonymous submissions can no longer name a `program_id`. 6 tests.

### Lot 11 — P1/P2 ✅

- **AUTHZ-CRM-1 (part)** — the team task board is now team-scoped (program-scoped for delegated callers, own-board for a team session; task mutations resolve the task's team). **XPROG-1 remainder** — shared team credentials are stripped for non-management readers. New helper `src/lib/teamCredentials.js`. Census extended (1 entry); 10 tests.

### Lot 12 — P1 ✅

- **BOLA-FORM-2** — the team filter on `submissions` GET is bound to the session's own team; the score write (PUT) resolves/requires the program. **SCOPE-LMS-1b** — `lms/program-requirements/[id]` resolves its program. The `lms` program-scope wave is now declared and censused (3 surfaces). 8 tests.

### Lot 13 — P1 ✅

- **BOLA-FORM-1 (part)** — the platform Runs `submitter_id` read is bound to the session (a Super Admin may still name someone else). The rest of BOLA-FORM-1 is a governance decision (§6.7). 3 tests.

### Lot 14 — P2 ◻ partial

- **ERR-1 (swept)** — `program-types`, `run-export`, `submissions`, `team-tasks`, `system/database`, `webhooks/resend` now answer 5xx through the shared `src/lib/apiError.js` helper. 8 tests.
- **Blocked**: RATE-2, the remaining ERR-1, CSRF-1 (engineering routes) and AUTH-4 sit in files under the concurrent auth refactor — to complete once it lands.

### Remaining after Lot 14

- **BOLA-FORM-1 remainder** — platform Runs visibility (governance decision, §6.7).
- **Lot 4 remainder** (P1) — UPLOAD-1 buckets (private + signed URLs); PUB-3 `respond` identity + PUB-2 `s/public-draft` token (client-flow changes).
- **Lot 5 remainder** (P2) — RATE-2, remaining ERR-1, CSRF-1 (engineering routes), AUTH-4, SECRET-1/3, DEP-1, shared rate-limit store (all currently blocked by the concurrent auth refactor).
- **AUTHZ-CRM-1 remainder** — `contact-emails`; `notifications` create (product decision).
- **Product decisions** — `allowed_roles` (§6.6); notification-recipient scope; platform Runs visibility (§6.7).
- **MVC-1** (ongoing) — SQL still inline in a few routes.

### Product decisions required (not code fixes)

- **AUTHZ-GLOBAL-1** — who owns the global catalogs (`knowledge_resources`, `venture_coaches`)?
- **LOGIC-INV-1** — should an investor's self-declared "invested" need staff confirmation?
- **§6.5** — investor approval status / self-registration `active`.
- **§6.4** — legacy clear-text passwords: migration needed before removing the fallback.
- **AUTH-2 note** — impersonation is staging-only; the env flag should lose its `NEXT_PUBLIC_` variant.
