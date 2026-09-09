# ImpactOS — Phase I6A Brief (Gate-Bridge Completion: Venture, Investor & remaining cohorts)

Status: implemented, staging-safe. Committed per mini-phase gate.

## Method

Four read-only cohort analyses (teacher/program-staff ×12 files, founder/contacts
×4, investor ×3, team ×2) applied the I5 conversion rule per call site:
**convert only where a real downstream membership/capability gate decides for
every session; never convert where the role list IS the security decision.**

## Converted (4 handlers, 2 files)

| File | Handler | Downstream decision (unchanged) |
|---|---|---|
| `api/ventures/[id]/members/route.js` | GET | `checkAccess` — active `venture_members` row OR active `venture_staff_assignments`; global bypass SA/developer/admin; archived-state gate. |
| 〃 | POST | `checkAccess` + `checkMutateAccess` (founder row OR `founders:manage` capability from the configurable venture permission matrix) + archived gate. |
| 〃 | PATCH | same as POST. |
| `api/investor/profile/route.js` | GET | own-profile read — model hard-scopes `WHERE ip.user_id = session.cid`; no cross-user path, no role branch. |

Effect: a **baseline Member** who holds a real venture membership (founder or
team) or an active venture staff assignment can now operate the roster surface,
and a Member whose investor context exists (`investor_profiles` row) can read
their own profile — while unassigned sessions are still denied at the same
per-venture/per-row gates that decided before. No current holder loses anything
(venture roster: staff/PM/teacher without membership were already 404'd
downstream; investor profile: SA/staff/PM read their own — usually null — row
exactly as before).

Documented delta: `developer` sessions may now mutate rosters (previously only
listed on GET). This aligns POST/PATCH with the venture module's own
`checkMutateAccess` global bypass (developer = module authority) and GET's list.
No developer accounts exist on staging; flagged for confirmation.

## Deferred — locked watchlist (19 files)

Every other contextual-role allowlist stays **role-listed** until a real
downstream gate exists. Each entry below carries its hardening recipe
(contract-locked in `identity-gate-bridge.test.js` so removal without the gate
fails CI):

| File | Why deferred / what to build first |
|---|---|
| `contacts/route.js` GET | role = scope directory read; `cidFilter` lets any listed role fetch any contact. Build: close cidFilter, gate with `requireAuthorization("contacts","view")`, self-scope participants/founders. |
| `contacts/search/route.js` GET | branch split is **role-keyed** (`isExternal = participant/founder`), not membership-keyed; member-founders fall into the internal branch and would be denied even after conversion. Build: membership-keyed branch (participant_programs / venture_members). |
| `families/route.js` GET | unscoped family list; no program context. |
| `participant-programs/route.js` GET | cross-participant enrollment read, no session predicate. |
| `platform/ai/route.js`, `analyze`, `evaluate-submission`, `evaluation-scores` | AI spend/auto-approve/emails/PII; no context in request. Needs capability or management gate + server-side record resolution. ⚠️ Pre-existing gap found: `evaluate-submission` GET + `platform/ai` GET/`analyze` GET have **no requireAuth at all**. |
| `platform/form-runs/route.js` (review, send_result_emails) | can approve/reject + email applicants; needs run→program resolution + assignment gate first (product decision: who may operate platform review). |
| `programs/route.js` GET | whole program directory; no context in request. |
| `teacher/reports/route.js`, `v2/teacher/reports` | client-supplied `teacher_id`/`teacher_name` (spoofable). Build: derive identity from `session.cid` + `resolveProgramAssignment`. |
| `v2/teacher/fulfillment` | program-scoped PII read, zero downstream auth. |
| `v2/teacher/full-state` | scope chain keyed on client-supplied `cid` query. Build: bind to `session.cid` + assignment verification. |
| `investor/campaigns/route.js` GET | unscoped campaign list + per-campaign investor counts; visibility column never applied. |
| `investor/pipeline/route.js` GET | own-scope on 1 of 3 branches; `venture_id` branch returns cross-investor rows. |
| `teams/route.js` GET | own-team scope exists only in comments — any listed role can read any team + member PII. Build: session-bound own-scope (`contacts.v2_team_id` / entity cid). |
| `upload/route.js` POST | no context in request; role list = eligibility for public-bucket writes. Product decision needed (callers span surfaces). |
| `ventures/[id]/history/route.js` GET | founders pass on the allowlist alone (no membership check); ⚠️ pre-existing bug: staff/PM/teacher gate references unbound `db` → guaranteed 500 (the 2 lint errors already in the repo-wide report). Build: import `db`, add `venture_members` check for founder path, then convert. |

## Cross-cutting discoveries (new defect log — separate hardening queue)

1. `platform/ai/evaluate-submission` GET + `platform/ai` GET/`analyze` GET: no authentication at all (pre-existing).
2. `ventures/[id]/history` GET: unbound `db` (guaranteed 500 for staff/PM/teacher) — pre-existing lint errors.
3. `teams` GET: own-team restriction never enforced server-side (member PII exposure for listed roles) — pre-existing.
4. `contacts` GET: `cidFilter` over-read for participant/founder roles — pre-existing.
5. Member-baseline investors pass the converted own-profile GET but the capability-gated writes (`requireAuthorization("investor","create")`) stay role-scoped in eligibility — investor eligibility must become context-aware in the Permission-Center backlog before investor OS is fully usable by member-baseline investors.

## Safety

- Same rule as I5: converts only where the downstream gate decides; unassigned
  sessions still denied; no current holder loses access; no resolver change; no
  DB change; no production.
- Contract test extended: converts locked (bare counts + machinery presence),
  deferrals locked (19 files must keep contextual lists), pm watchlist kept.
