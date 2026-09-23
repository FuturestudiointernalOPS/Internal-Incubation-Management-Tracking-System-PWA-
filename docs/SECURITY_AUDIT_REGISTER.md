# 🔐 Security Audit — Application Register

**Date** : 2026-09-23
**Branch audited** : `A`
**Method** : read-only static review of every `src/app/api/**/route.js` (403 route files) and the modules they call (`src/lib/**`, `src/models/**`), grouped by domain; the most severe findings were re-verified line by line. No live exploitation, no production data touched.
**Companion** : technical-debt and M1 findings remain in `docs/SECURITY_AUDIT_M1.md` and `docs/ARCHITECTURE_TECH_DEBT.md`.

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
| XPROG-1 | Scope | `pm/{teams,curriculum,reports,export}`, `teams`, `lms/coaching-requests` | Global capability without program scope; `SELECT *` team passwords. (feedback + group-members reads fixed in Lot 3.) | **OPEN — Lot 3 remainder** |
| BOLA-CRM-1 | BOLA | `group-members` POST | Membership insert still has no program scope (unscoped read fixed in Lot 3). | **OPEN — Lot 3 remainder** |
| IDOR-TASK-1 | BOLA | `tasks/carryover` | ✅ fixed in Lot 3. | **FIXED** |
| IDOR-TASK-2 | BOLA | `tasks` | Staff/PM may list any `user_id`'s tasks; authz compares the client-supplied `user_id`; `supervisor_id` self-grant. | **OPEN — Lot 3** |
| BOLA-FORM-2 | BOLA | `submissions` | Team sessions read other teams' submissions; score writes without program scope. | **OPEN — Lot 4 remainder** |
| PUB-3 | Business logic | `respond` | Writes responses attributed to a caller-supplied `cid`, with no anchoring. | **OPEN — Lot 4 remainder** |
| AUTHZ-VEN-1 | Privilege grant | `ventures/[id]/coach-invite` | ✅ fixed in Lot 4. | **FIXED** |
| LMS-1 | Enumeration | `verify/certificate` (`models/lms/certificates.js`) | ✅ fixed in Lot 4. | **FIXED** |
| UPLOAD-1 | Upload | `upload`, `profile/photo`, `lms/*` | ✅ validation fixed in Lot 4; **still OPEN: buckets are public** (need private + signed URLs). | **OPEN — Lot 4 remainder** |
| BOLA-FORM-1 | BOLA | `run-export`, `platform/form-runs` (`submission_id`), `platform/…/report-file`, `platform/ai/evaluation-scores` | Capability-only reads of any run/submission/report (participant PII). | **OPEN — Lot 4 remainder** |
| SCOPE-LMS-1b | Scope | `lms/program-requirements/[id]` PUT/DELETE | Requirement id is not resolved to its program before mutation. | **OPEN — Lot 4 remainder** |
| CSRF-1 | CSRF | state-changing **GET** routes (`engineering/permissions/seed*`, `sync-context-grants`, `program-types`) | `SameSite=Lax` lets a top-level cross-site navigation trigger mutations. | **OPEN — Lot 5** |
| DEP-1 | Dependencies | `npm audit` | CRITICAL/HIGH `tar` via `unpdf → canvas`; no upstream fix. | **OPEN — Lot 5** |

### 3.3 P2

| ID | Category | Location | Risk | Status |
|---|---|---|---|---|
| RATE-1 | Rate limiting | `auth/login`, `auth/session-login`, `auth/reset-password` | ✅ fixed in Lot 5 (limits are per process — a shared store is needed for multi-instance). | **FIXED** |
| RATE-2 | Rate limiting | `s/public-submit`, `/api/public/courses`, `/api/errors` (POST), uploads, AI routes | Public/expensive endpoints still unthrottled; IP spoofable via `X-Forwarded-For`. | **OPEN — Lot 5 remainder** |
| HDR-1 | Headers | `next.config.mjs` | ✅ fixed in Lot 5 (CSP is report-only). | **FIXED** |
| ERR-1 | Error handling | many routes | `error.message` returned in 500s (SQL/driver detail). | **OPEN — Lot 5** |
| AUTH-4 | Enumeration | `auth/login`, `auth/reset-password` | Distinct 403/404 responses reveal account existence; timing oracle. | **OPEN — Lot 5** |
| SECRET-1 | Passwords | `auth/login`, `auth/session-login`, team/group passwords | Clear-text comparison fallback; shared/team passwords stored in clear. | **OPEN — Lot 5** |
| IMPL-1 | Correctness | `src/lib/api/createHandler.js` | ✅ fixed in Lot 5. | **FIXED** |
| AUTH-5 | Enumeration | `auth/setup-password/validate` (GET), `auth/activate` (GET) | ✅ fixed in Lot 5. | **FIXED** |
| AUTHZ-ADM-3 | Token / mass assignment | `admin/approve-user` | ✅ fixed in Lot 3. | **FIXED** |
| AUTHZ-ADM-4 | Scope | `facilitators/invite-bulk`, `programs`, `admin/projects/[id]/reports/generate` | `program_manager` skips the assignment check; staff edit any program; unscoped report write. | **OPEN — Lot 3** |
| AUTHZ-ADM-5 | Self-assignment | `access-profiles/assign`, `responsibilities/assign` | No self-assignment guard; `allowed_roles` not enforced. | **OPEN — Lot 3** |
| AUTHZ-CRM-1 | Scope | `notifications` (create), `contact-emails`, `team-tasks` | Forged notices to any recipient; staff manage any contact's emails; team tasks with no team scope. | **OPEN — Lot 3** |
| PUB-CONTACTS-1 | Mass assignment | `contacts` POST | Anonymous caller may still supply `program_id`/other fields (role/status now clamped). | **OPEN — Lot 3** |
| DATA-2 | Exposure | `lms/courses/[id]` | ✅ fixed in Lot 4 (answer key stripped). | **FIXED** |
| SCOPE-LMS-1 | Scope | `lms/program-requirements` | ✅ fixed in Lot 4. | **FIXED** |
| MASS-VEN-1 | Mass assignment | `ventures/[id]/members` | ✅ fixed in Lot 4. | **FIXED** |
| SECRET-3 | Passwords | `teams`, `pm/teams` | Team passwords generated with `Math.random()` and stored in clear. | **OPEN — Lot 5** |
| AUTHZ-GLOBAL-1 | Scope | `ventures/[id]/knowledge` (resource update/delete), `ventures/[id]/coaches` (PATCH/DELETE coach) | Global catalogs mutated by any venture editor; no venture dimension exists. | **OPEN — needs a platform-capability decision** |
| PUB-2 | Business logic | `s/public-draft` | Draft answers read/overwritten by slug+email, no token. | **OPEN — Lot 4 remainder** |
| WHO-1 | Webhook | `webhooks/resend` | Non-constant-time signature compare; no timestamp/replay window. | **OPEN — Lot 6** |

### 3.4 P3

| ID | Category | Location | Status |
|---|---|---|---|
| LOG-1 | Logging | `src/lib/auth.js` logs a session-token prefix. | **OPEN — Lot 6** |
| CSV-1 | Formula injection | `ventures/[id]/reports`, `analytics` exports. | **OPEN — Lot 6** |
| IMP-1 | Impersonation | `is_impersonation` never persisted on `user_sessions`. | **OPEN — Lot 6** |
| XSS-1 | Stored (low) | `src/app/s/[runId]/page.js` renders `successMessage` via `dangerouslySetInnerHTML` (form-author content; submitted values are escaped). | **OPEN — Lot 6** |
| AUD-1 | Audit integrity | `admin/approve-user`, `admin/reject-user`, `tasks/comments` accept the actor name from the body. | **OPEN — Lot 6** |
| SECRET-2 | Secrets in URL | `notifications/{due-reminders,overdue}`, `context-grants-sweep` pass `?key=`. | **OPEN — Lot 6** |
| SYS-1 | Config | `system/database` comment says super_admin but the gate is `settings.edit`. | **OPEN — Lot 6** |
| DATA-1 | Exposure | `families` / `v2_teams` / `contacts` / `dd_documents` `SELECT *` shapes. | partially addressed (Lot 0/2) |
| MVC-1 | Layering | SQL inside routes (`investor/executive-dashboard`, `venture-permissions/*`, milestone/session lookups). | **OPEN — ongoing** |
| SYS-2 | Config | `program-types` GET runs DDL (`ensureProgramTypeOptionsTable`). | **OPEN — Lot 6** |
| LOGIC-1 | Correctness | `projects/invitations/respond` compares `session.name` to `inviter_id`. | **OPEN — Lot 6** |
| LOGIC-2 | Validation | `timeline add_dependency` source/target ids unvalidated; `milestones` `owner_cid` unvalidated. | **OPEN — Lot 6** |
| DATA-3 | Exposure | `data/route.js` keys off caller input (super_admin only). | **OPEN — Lot 6** |
| LMS-3 | Validation | `lms/enrollments` accepts a client `source` and an unvalidated target user. | **OPEN — Lot 6** |

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
Lot 6  (P3 hardening) ← next
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

---

## 7. Pending work backlog (suspended tasks)

Everything below is **still present in the code today**. Grouped by the lot that will carry it; `§x.y` repeats the severity from §3.

### Lot 3 — remainder (P1)

- `pm/{teams,curriculum,reports,export}`, `teams`, `lms/coaching-requests` — program scope (§3.2 XPROG-1).
- `group-members` POST — membership insert without program scope (§3.2 BOLA-CRM-1).
- `access-profiles/assign`, `responsibilities/assign` — self-assignment guard + `allowed_roles` enforcement (§3.3 AUTHZ-ADM-5).
- `facilitators/invite-bulk`, `programs`, `admin/projects/[id]/reports/generate` — program scope (§3.3 AUTHZ-ADM-4).
- `notifications` (create), `contact-emails`, `team-tasks` — scope (§3.3 AUTHZ-CRM-1).
- `tasks` listing — `user_id` scope, authz on the client-supplied `user_id`, `supervisor_id` self-grant (§3.2 IDOR-TASK-2).
- `contacts` POST — anonymous `program_id` / other fields (§3.3 PUB-CONTACTS-1).

### Lot 4 — remainder (P1)

- **UPLOAD-1 (buckets)** — `upload`, `profile/photo`, `lms/*`: buckets are public; need private buckets + signed URLs.
- **BOLA-FORM-1** `run-export`, `platform/form-runs` (`submission_id`), `platform/…/report-file`, `platform/ai/evaluation-scores` — run/submission scope.
- **BOLA-FORM-2** `submissions` — team-session reads + score writes.
- **PUB-3** `respond` — identity anchoring. **PUB-2** `s/public-draft` — draft token.
- **SCOPE-LMS-1b** `lms/program-requirements/[id]` PUT/DELETE — resolve the requirement's program.

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

### Lot 6 — P3

- LOG-1, CSV-1, IMP-1, XSS-1, AUD-1, SECRET-2, SYS-1, SYS-2, LOGIC-1, LOGIC-2, DATA-3, LMS-3, MVC-1.

### Product decisions required (not code fixes)

- **AUTHZ-GLOBAL-1** — who owns the global catalogs (`knowledge_resources`, `venture_coaches`)?
- **LOGIC-INV-1** — should an investor's self-declared "invested" need staff confirmation?
- **§6.5** — investor approval status / self-registration `active`.
- **§6.4** — legacy clear-text passwords: migration needed before removing the fallback.
- **AUTH-2 note** — impersonation is staging-only; the env flag should lose its `NEXT_PUBLIC_` variant.
