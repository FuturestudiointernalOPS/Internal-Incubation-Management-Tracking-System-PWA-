# PRODUCTION TEST — branch `G` → `main`

**This document is the definition of "production test".**
When the phrase *"production test"* is used, this is the list to run — item by
item, with a status for each, before anything is promoted to production.

- **Scope:** the promotion of branch **`G`** (staging) into **`main`** (production).
  Its content-identical twin is the **`Ventures`** branch: push to both, keep them level.
- **Not in scope:** other branches (`A`, `dev`, personal branches) and other
  products (`LMS`, `Investor_OS`). Those need their own checklist.
- **Deployment shape:** manual. There are no CI workflows in the repo
  (`.github/workflows` does not exist). "Deploy" means *the host pulls the branch*.

---

## 0. Why this exists

Production `main` and staging `G` are **not just different code — they are
different databases.** Staging's permission tables were populated by hand during
development. Production's were not, and the code does **not** create them at
boot.

> **"It works on staging" is not evidence it works in production. Same code, different data.**

Two rules follow from that:

1. **Code readiness ≠ deployment readiness.** A green build proves nothing about
   whether production has the rows the code now reads.
2. **Never promote without the data steps in §4 and §5.** Skipping them does not
   fail loudly — it presents as *"everyone lost their permissions"*.

---

## 1. Branches and what "in sync" means

| Branch | Role | Check |
|---|---|---|
| `origin/main` | **Production** (`origin/HEAD → origin/main`) | `git --no-pager log -1 origin/main` |
| `origin/G` | **Staging** | `git --no-pager log -1 origin/G` |
| `origin/Ventures` | Twin of `G` — must always match byte for byte | `git --no-pager log -1 origin/Ventures` |

- Verify `main` is a **strict ancestor** of the promoted commit before expecting a
  clean promotion: `git merge-base --is-ancestor origin/main HEAD`
- Push to **both** `G` and `Ventures`. Confirm all four refs (local `G`, local
  `Ventures`, `origin/G`, `origin/Ventures`) sit on the same hash afterwards.
- Never force-push. Never hand-resolve a conflict without asking.

---

## 2. Pre-flight (read-only, before anything changes)

Run these and record the output. This is the *measure* step.

```sh
git --no-pager log --oneline --count origin/main..HEAD   # size of the delta
git --no-pager diff --stat origin/main..HEAD             # surface area
npx jest --runInBand                                     # whole suite, no path exclusions
npm run i18n:parity                                      # must be: Missing 0
npm run lint                                             # 0 errors
npm run build                                            # must compile
```

Also worth reading before promoting:

```sh
node scripts/authz-venture-coverage.mjs   # venture route gate census (filesystem only)
node scripts/audit-phase10-safety.mjs     # ineligible grants, inactive/missing role defaults
node scripts/dryrun-eligibility-policy.mjs
```

**Env-file trap.** `.env.local` and `.env.prod-verify` point at **production**;
`.env.staging` and `.env.audit-staging` point at **staging**. Several scripts read
`.env.local` **first**, so they target production by default. Check the script's
env preference before running it. Some scripts are staging-only by design
(`scripts/phase1-bulk-upload.mjs` exits unless a staging URL is present) — those
must be reimplemented as SQL for production, never "repointed" by hand.

---

## 3. Decisions that must be made *before* promoting

These are product calls, not defects. Do not guess them.

| # | Decision | Where it lands | Status |
|---|---|---|---|
| D1 | Should Program Managers keep **publishing courses / enrolling** people? (`lms.publish`/`enroll`/`assign` were retired in favour of `lms.edit`, which no seeded profile holds) | grant `lms.edit` to the Program Manager profile | **OPEN** |
| D2 | Do **alumni / completed participants** keep the ability to attach files? | `/api/upload` predicate | **OPEN** (Venture people were added; alumni question remains) |
| D3 | Should the retired **teacher** role keep review authority on form runs? (`action=review` is now SA/admin/PM) | `form-runs` route | **CLOSED** — the teacher persona was removed from the product (owner decision), so there is no role left to grant |
| D4 | Is the **Venture Application form** flagged `settings.venture_application = true` on production? Without it, approving an application creates nothing, while direct API creation is retired (410) | `platform_forms` row | **VERIFY** |

---

## 4. Data steps to run on production (in this order)

Nothing here is automatic. This is the part that most often gets skipped.

### 4.1 Snapshot first — the rollback source

No script exists. Export these tables **before the first request of the new build**:

```sql
SELECT * FROM feature_eligibility;
SELECT * FROM responsibilities;
SELECT * FROM user_responsibilities;
SELECT * FROM access_profile_capabilities;
SELECT * FROM role_access_profile_defaults;
SELECT * FROM role_capabilities;
SELECT * FROM venture_staff_assignments;
```

### 4.2 Confirm the access vocabulary landed

```sql
SELECT name FROM authz_migrations WHERE name = 'feature-key-alignment-v1';
```

The first request after deploy renames feature keys (`program_management→programs`,
`project_ownership`/`tasks→operations`, `reporting→reports`, `investor→investors`,
`user_management→security`, `system_settings`/`engineering→settings`,
`knowledge_base`/`intelligence→knowledge`, `messaging`/`internal_comms→communication`)
and merges responsibilities. **Until it completes, every non-Super-Admin is denied
on ~10 of 12 features.**

### 4.3 Seed the access profiles (as Super Admin, signed in)

```
GET /api/engineering/permissions/seed-access-profiles
```

Creates the `Founder` and `Venture Member` profiles, grants `ventures.view` /
`ventures.edit` to Staff Default + Program Manager, and re-adds the Staff Default
capabilities. **Uses `DO UPDATE` — it overwrites admin edits. Snapshot (§4.1) first.**

### 4.4 Apply the context grants

```
GET /api/engineering/permissions/sync-context-grants
```

Additive, stamped `ctx:…` grants for founders and team members. Requires §4.3 first
(unmapped while the profile id is NULL).

### 4.5 Bulk import (only if D-question says so)

`bulk_upload.execute` has no grant source anywhere in the codebase. As of
commit `41704c45` the route also accepts the CRM `contacts.create` capability, so
CRM holders work without this step. Mirror the legacy holders only if a stricter
answer is chosen.

### 4.6 Eligibility rows (now largely automatic)

- `member` → ventures: handled by `eligibility-ventures-member-v1`.
- `founder` → ventures: handled by `eligibility-ventures-founder-v1` (added in `41704c45`).
- If a database somehow still lacks them, insert idempotently:

```sql
INSERT INTO feature_eligibility (feature_key, identity_type, identity_value, eligible)
VALUES ('ventures','role','founder',1)
ON CONFLICT (feature_key, identity_type, identity_value) DO NOTHING;
```

---

## 5. Database schema steps

`ensureVentureSchema()` is runtime DDL and runs from **only four paths**
(`/api/ventures/promote`, `/api/s/public-submit`, `…/journey/save-template`,
`createVentureFromSubmission`). A production database that has never run one of
them is **missing** the newer columns and tables.

**Symptoms if skipped:**
- archiving or deleting a **milestone/task** → 500 (writes `is_archived` unguarded)
- marking a **notification** read → 500
- notifications silently not appearing (every path is wrapped in `try/catch {}`)
- journey template apply → 500 (`relation venture_journey_templates does not exist`)

**Fix:** apply the DDL before or immediately after deploy, or trigger one of the
four paths once as staff. `migrations/venture_phase2_spine.sql` covers **only**
the milestones/tasks/sessions/submissions slice — it does **not** cover the
notification columns, journey templates, `venture_reports`, or the archive columns.

Columns that must exist (idempotent form):

```sql
ALTER TABLE v2_notifications ADD COLUMN IF NOT EXISTS entity_venture_id TEXT;
ALTER TABLE v2_notifications ADD COLUMN IF NOT EXISTS entity_journey_stage_id TEXT;
ALTER TABLE v2_notifications ADD COLUMN IF NOT EXISTS entity_milestone_id TEXT;
ALTER TABLE v2_notifications ADD COLUMN IF NOT EXISTS entity_task_id TEXT;
ALTER TABLE v2_notifications ADD COLUMN IF NOT EXISTS entity_session_id TEXT;
ALTER TABLE v2_notifications ADD COLUMN IF NOT EXISTS template_key TEXT;
ALTER TABLE v2_notifications ADD COLUMN IF NOT EXISTS params JSONB;
ALTER TABLE v2_notifications ADD COLUMN IF NOT EXISTS dedupe_key TEXT;
ALTER TABLE v2_notifications ADD COLUMN IF NOT EXISTS seen_at TIMESTAMPTZ;
ALTER TABLE v2_notifications ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;
ALTER TABLE venture_notes     ADD COLUMN IF NOT EXISTS attachments JSONB;
ALTER TABLE venture_sessions  ADD COLUMN IF NOT EXISTS coach_contact_id TEXT;
ALTER TABLE venture_milestones ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE venture_milestones ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
ALTER TABLE venture_milestones ADD COLUMN IF NOT EXISTS archived_by TEXT;
ALTER TABLE venture_tasks     ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE venture_tasks     ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
ALTER TABLE venture_tasks     ADD COLUMN IF NOT EXISTS archived_by TEXT;
ALTER TABLE venture_journey_stages ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE venture_journey_stages ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
ALTER TABLE venture_journey_stages ADD COLUMN IF NOT EXISTS archived_by TEXT;
ALTER TABLE venture_journey_stages ADD COLUMN IF NOT EXISTS source_template_type TEXT;
ALTER TABLE venture_journey_stages ADD COLUMN IF NOT EXISTS source_template_id TEXT;
```

Plus the `CREATE TABLE IF NOT EXISTS` blocks for `venture_reports`,
`venture_journey_templates`, `venture_journey_template_stages`,
`venture_journey_template_milestones`, `venture_journey_template_tasks` — copy
them verbatim from `src/lib/ventures.js`.

**Also verify the milestone id type** (two conflicting generations exist):

```sql
SELECT data_type FROM information_schema.columns
WHERE table_name = 'venture_milestones' AND column_name = 'id';
```

---

## 6. Environment and infrastructure

| Item | Rule | Status |
|---|---|---|
| `DATABASE_URL` host | Must be a Supabase pooler (`pooler.supabase.com` / `:6543`) **or** a direct connection. A non-matching pooler (self-hosted pgbouncer, Supavisor custom domain, RDS proxy) rejects the `statement_timeout` **startup parameter** — that would be a total DB outage | **CLEARED** — every env file is `…pooler.supabase.com:6543`, which the code's regex detects, so `options` is not sent |
| Runtime `TZ` | Must be **UTC**. Two calendar paths derive days differently (`to_char` DB-side vs `toISOString()` JS-side), so a non-UTC host can show Venture sessions on the wrong day near midnight | verify at deploy |
| `deliverable-evidence` bucket | Private (`public: false`), auto-created on first upload | confirm the service-role key is set |
| `SUPABASE_SERVICE_ROLE_KEY` / `NEXT_PUBLIC_SUPABASE_URL` | Needed for signed reads of private evidence and for result-PDF email | verify (already required today) |
| Email transport | Session/coach/lead-manager notifications fail **silently** if misconfigured | verify |
| `IDENTITY_STOP_ROLE_MUTATION` / `IDENTITY_DERIVE_LEGACY_ROLE` | **Leave unset in production.** Both default off; enabling them changes session-role derivation for all founders/participants/facilitators, and the companion backfill is staging-only | do not set |

---

## 7. The first-request migration burst

`resolveAuthorizationContext` awaits ~16 authz migrations in `Promise.all` with
**no `.catch()`**, *before* the Super Admin short-circuit. One failure means:

- every authorized request returns **500 `errors.authzSystemFailure`**
- the marker is not recorded, so the whole set **re-runs on every request**
- Super Admin is not exempt

**So:** snapshot (§4.1) → deploy during low traffic → immediately make **one
authenticated request** and watch for `authzSystemFailure`. If it appears, roll
back rather than retrying.

---

## 8. Manual walkthrough in staging (do this, not just the tests)

Walk these as real accounts. "Tests pass" does not cover any of it.

1. **Super Admin** — open a Venture, Journey, a milestone, a deliverable, sessions.
2. **Staff with an assignment** — same screens; confirm milestone edit saves.
3. **Staff without an assignment** — must be refused *explicitly* (403 + `X-Authz-Decision`), never silently shown partial data.
4. **Founder** — their own workspace; can submit a deliverable; **cannot** change the Venture's status.
5. **Team member** (a `member`-role account with a `venture_members` row) — can open the Venture they were given; **cannot** edit.
6. **Coach** (scoped to a milestone) — can review that deliverable; cannot see unrelated milestones or internal notes.
7. **Program Manager** — course publish / enrol **(see D1)**.
8. **Participant with a completed enrolment** — attach a file to an assignment and a message **(see D2)**.
9. **Venture creation end-to-end** — approve one application; confirm the Venture appears **(see D4)**.
10. **CRM holder** — bulk contact import.
11. **A stale cached page** — hard-refresh off, click around: an old client talking to the new API is the most common "it broke after deploy" report.
12. **A removed Venture member** — confirm they lose access immediately.

---

## 9. Post-deploy verification

```sh
npm run verify:alignment        # expects exit 0 / ALIGNED; connects to production first via .env.local
node scripts/verify-deployment.mjs
node scripts/authz-venture-coverage.mjs
```

- `GET /api/engineering/permissions/venture-strict-audit` → `viewMissing` and
  `editMissing` must be **empty** for everyone who works in Ventures.
- Confirm no `errors.authzSystemFailure` in the logs in the first minutes.

**Known verifier noise — do not chase it:**
- `verify-deployment.mjs` asserts "Staff Default = 11 capabilities"; later
  backfills legitimately add more, so expect a spurious FAIL there.
- `authz-venture-coverage.mjs` is a **file census**, not a runtime check. It exits 1
  while any legacy gate remains in the source, and prints a "STRICT MODE" line
  referencing `AUTHZ_VENTURE_STRICT`, a flag that no longer exists in `src/`.
- `verify:alignment`'s "warning" class (a default feature→role pair absent) exits 0
  on purpose — the migration never overwrites admin edits, so absence is ambiguous.

---

## 10. Rollback plan

- The application rolls back with `git revert` / redeploying the previous commit.
- **The database does not.** `feature-key-alignment-v1` renames and **deletes**
  rows (feature keys, merged responsibilities) and is not reversible by a code
  revert. `ensureLmsCapabilityRetirement` **deletes** `lms.publish|enroll|assign`
  rows from five grant tables.
- That is why §4.1's snapshot is mandatory, not optional. Without it there is no
  way back for the permission data.

---

## 11. Already cleared — don't re-investigate

| Item | Verdict |
|---|---|
| `statement_timeout` sent as a connection **startup parameter** | **Not a risk.** Every env file uses `…pooler.supabase.com:6543`, which the code's regex matches, so `options` is omitted |
| `/api/ventures` directory scoping for staff/PM | **Parity with production, not a change.** The predicate is identical before and after |
| `POST /api/ventures` returning 410 `LEGACY_FLOW_RETIRED` | **Pre-existing.** Already live on `main`; not introduced by this promotion |
| `/api/ventures/[id]/verification` response shape | Additive — `file_url` is kept alongside `file_url_signed`; both consumers read `?? ` fallback |
| Deleted/renamed API routes | None that a client can call. `/admin/ventures/[id]/milestones` now redirects to `/journey`, so old bookmarks survive |

---

## 12. Standing unknowns (repo cannot answer these — query production)

- Contents of production's `Staff Default` profile (three separate out-of-band
  writers exist and disagree).
- Whether `ventures|founder` / `ventures|member` eligibility rows already exist.
- How many production contacts are `role='member'` with an active `venture_members` row.
- Whether production's `venture_milestones.id` is `SERIAL` or `UUID`.
- Whether production has any `venture_staff_assignments` rows at all (the
  `venture_own` scope resolves membership **or** assignment; if both are empty for a
  person, the gate refuses them even with the capability).
- Which `authz_migrations` markers production has already recorded.

---

## 13. Fixed in code — verify, don't re-diagnose

| Commit | Fix |
|---|---|
| `8c25bde5` | Undefined variables in the venture + responsibility routes: the status-assignment guard never ran (a founder could change their Venture's status), non-admin lifecycle transitions returned 500, and the responsibility base grant silently granted nothing |
| `41704c45` | Deliverables no longer gate on a `milestones` capability module that does not exist; founder eligibility catch-up migration; `Venture Member` profile + `member` role mapping; `/api/upload` accepts Venture people; bulk import accepts the CRM create capability |

**Still open in code:** §3 D1–D4.
