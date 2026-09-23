# Venture OS — Handover

**For:** the developer taking this over.
**Repo:** `C:\Gwin Prod\ImpactOS-FutureStudio` · Next.js App Router
**Branches:** `G` = staging (where we work) · `main` = production · `Ventures` = the working branch

Read §1 and §2 before touching anything. §5 is the work list; §6 is the list of
things that will cost you a day each if nobody tells you.

---

# 1. What we designed

## 1.1 The one chain

```
VENTURE
  └── JOURNEY          a progression phase  ("Family & Friends Fundraising")
        └── MILESTONE  an outcome to reach   ("Pitch Deck")
              ├── TASK         the work
              ├── DELIVERABLE  the evidence
              └── SESSION      the human support
```

Everything hangs off that chain. A task, a deliverable and a session all belong
to a **milestone**; a milestone belongs to a **journey**; a journey belongs to a
**venture**. Nothing in this model floats free — if you find yourself building
something that does, you have misread it.

## 1.2 The three ideas that make it what it is

These are the design decisions that everything else follows from. If you
re-litigate one of them, you will break something that looks unrelated.

**① A Journey is a framework, not the active work.**
A manager can define all five Journeys on day one. What the Venture sees is
governed by *activation*, not by existence. A locked Journey is planned work,
not missing work.

**② One milestone open at a time.**
Milestones are released **sequentially**. Completing one unlocks the next. A new
milestone starts `locked` unless it is the stage's first, or follows a completed
one. A **Journey closes automatically** when every milestone in it is complete —
manual close is deliberately refused. A Journey with no milestones never closes.

**③ Three artefacts, three homes.**

| Artefact | Home | Direction | Who writes it |
|---|---|---|---|
| **Memo** | the session row | **out** — sent to the Venture | whoever books the session |
| **Milestone record** | the milestone | **in** — the manager's own judgement | the manager |
| **Journey report** | the journey | **up** — to Super Admin | the Lead Manager |

They are deliberately *not* copies of each other. A memo is not a report, and a
milestone record is not a memo. Merging them looks tidy and destroys the point.

## 1.3 The visibility rule — the map, and the seal

> **The Venture sees the whole map and walks only the part it has reached.**

Every Journey and every Milestone is listed with its **real** status and **real**
counts. The **work** inside a not-yet-released (`locked`) item is withheld, and
the row is stamped `sealed: true`.

This replaced behaviour that **deleted** future work from the payload. That
deletion is why founders kept reporting "where did everything go?", and why a
progress bar read `2/2` on a Journey that actually held eight milestones.

| | Not yet reached (`locked`) | Current | Past |
|---|---|---|---|
| **Journey** | Name, lock badge, target date, real `x/y` count | Name, objective, description, target date | Same, struck through |
| **Milestone** | Title, "Locked", target date | Title, status, target date, **deliverables**, booking | Same, completed |
| **Work** (tasks, deliverables, evidence) | **withheld** | available | available |

**Counts are real.** `milestone_counts` is recomputed over **every** milestone,
sealed ones included. A founder on Journey 1 of 5 sees `2/8` for their current
Journey and can see that four more follow. Progress means what it says.

**Why a sealed milestone still shows its target date:** the founder is working
*towards* the roadmap, so the shape and timing of the plan are theirs to see. The
*thinking* inside it — objective, description, strategy notes — is not. If you
would rather a sealed milestone show only its title, that is a one-line change in
`src/lib/ventureVisibility.js` (`MILESTONE_MAP_FIELDS`).

## 1.4 The founder experience, in one place

**What the founder can do**

| Action | Founder | Notes |
|---|---|---|
| Read the roadmap | ✅ | Whole map, per §1.3 |
| Open a released milestone | ✅ | Current + past only |
| Submit a deliverable | ✅ | Upload or link, on a released milestone |
| Book a session | ✅ | **Only against the current milestone** — enforced server-side |
| Edit the session Memo | ✅ | One note per session, replaced not appended |
| Reschedule a session | ✅ | Open to members |
| Cancel a session | ✅ | Open to members |
| Delete a session | ✅ | **Open to members today** — see §5.2 |
| Reschedule/cancel *staff* sessions | ❌ | Governed by the matrix cell `calendar.schedule` |

Two things worth stating on their own:

- The session gate governs the **staff path only**. A Venture's own members are
  deliberately untouched — a founder books and manages their own Venture's
  sessions.
- There is **no separate "request a session" flow** on the Venture side, and there
  does not need to be: a founder books directly. The LMS has a request-a-coach
  queue (`lms_coaching_requests`), but it is **course-bound** — a learner asks
  about a lesson — and has no Venture equivalent. If you want an ask-the-manager
  flow (a founder asks, the manager schedules), that is **new work, not a
  setting**.

---

# 2. How it is meant to be used

## 2.1 The cast

| Role | Responsibility | Not responsible for |
|---|---|---|
| **Super Admin** | defines and governs the framework | day-to-day coordination |
| **Lead Manager** (venture manager) | coordinates the Venture through the framework | owning the global framework |
| **Coach / Facilitator** | supports within an **assigned scope** | owning the journey |
| **Venture** (founder/team) | executes the released work | seeing unreleased work |

The Manager is the **operator**. The Coach is the **support specialist**. The
Venture is the **executor**. The Super Admin is the **framework owner**. They all
work on the same records — **authority and scope** are what differ, not the data.

## 2.2 What each may actually do

Verified against the code, not from memory:

| Action | Who |
|---|---|
| Add / reorder / delete / **complete** a milestone | Lead Manager (`milestones.edit`) or Super Admin |
| Define a deliverable | Lead Manager or Super Admin |
| **Review** a deliverable | Super Admin, or a Lead Manager (venture-wide), **or a Coach whose assigned scope covers that milestone** |
| Book / move / cancel a **staff** session | matrix cell `calendar.schedule` — a **Coach cannot book** (they hold `calendar.view`) |
| Book a session **as the Venture** | the Venture's own members — deliberately exempt from the gate above |
| Write internal notes | **staff only** — a founder gets 404 |
| See the unsealed roadmap | privileged role (`staff`, `super_admin`, `program_manager`, `admin`) |

Two rules worth stating on their own:

- **A session cannot exist outside a milestone**, must carry a **Memo**, and must
  start at least `SESSION_MIN_LEAD_MINUTES` (30) ahead. A **founder may only book
  their current milestone** — enforced server-side by `assertBookableMilestone`.
- **Internal notes never leave the staff side.** They are scope-filtered, not
  just permission-filtered: a coach sees the notes inside their assignment.

## 2.3 The notes, precisely — there are three, and they are different

People confuse these constantly. They are not three views of one thing.

| | Where it lives | Compulsory? | Who reads it |
|---|---|---|---|
| **Session Memo** | `venture_sessions.description` | ✅ at booking | the Venture — it is the brief |
| **Session note** | `venture_session_notes` | — | staff, and the Super Admin's history view |
| **Milestone internal note** | `venture_notes` | — | staff only, within scope |

A session has **exactly one Memo**. Editing it **replaces** the text — a session
deliberately does not accumulate briefs.

## 2.4 Data bank (formerly Verification)

The area is now labelled **Data bank** in both languages:

| Key | English | French |
|---|---|---|
| `venture.verification` | Data bank | Banque de données |
| `vadmin.detail.verification` | Data bank | Banque de données |
| `vadmin.dashboard.verification` | Data bank | Banque de données |
| `vadmin.dashboard.openVerification` | Open Data bank | Ouvrir la banque de données |
| `vadmin.detail.openVerification` | Open Data bank | Ouvrir la banque de données |
| `vadmin.dashboard.noVerificationData` | No data bank records | Aucune donnée dans la banque de données |

This is a **label change only**. The route, the table, the API and every
identifier still say `verification`, because renaming them would be a migration
with no user-visible benefit.

**Still pending, by decision:** what a Data bank *rule* is. The step names
(`Business Registration`, `Founder Identity`, …), the statuses (`Draft`,
`Pending Review`, `Verified`, `Rejected`) and the review workflow are untouched
and still say "verification". Defining what constitutes verification — and
therefore what the Data bank actually holds — remains **product work, not a
coding task**. Do not guess it.

---

# 3. Case study — AgriNova

Use this to sanity-check any change. It touches every part of the model.

### The setting

David is the **Lead Manager** for AgriNova. Sarah is the **GTM Coach**.
Awa is the **founder**. Super Admin has built a five-Journey framework.

### Step 1 — Super Admin lays the framework

Five Journeys are defined for AgriNova, in order:

```
1  Family & Friends Fundraising   ● active
2  Go-To-Market                   🔒 locked
3  Product Validation             🔒 locked
4  Revenue & Traction             🔒 locked
5  Investment Preparation         🔒 locked
```

Only Journey 1 is active. Journeys 2–5 exist — David sees them all as planned
work, and the founder will see them as **sealed** rows on the map.

### Step 2 — Super Admin saves the framework as a template

Because a five-Journey framework is reusable, it is saved to the template library
(`POST /journey/save-template`), which copies stages + bound milestones +
top-level tasks as **structure only** — no submissions, no reviews, no history.
It can then be applied to a new Venture as fresh rows (first stage active, rest
locked; `409` if the Venture already has stages). This is why every Venture can
differ while nothing is rebuilt by hand.

### Step 3 — David turns Journey 1 into work

Journey 1 contains five milestones. Only the first is open:

```
Milestone 1  Pitch Deck            ● not_started   ← the only one anyone can work on
Milestone 2  Business Plan         🔒 locked
Milestone 3  Digital Presence      🔒 locked
Milestone 4  Idea Validation       🔒 locked
Milestone 5  Raise $10K            🔒 locked
```

David breaks *Pitch Deck* into tasks, and defines the deliverable the Venture must
produce: **Pitch Deck PDF**, with review required. He can define deliverables —
that is his `milestones.edit` authority. Sarah could not, and would not be able to
complete the milestone either.

### Step 4 — Awa books a session

Awa opens Journey 1. She sees **all five milestones** — the real map, real
counts — but only *Pitch Deck* is openable. Milestones 2–5 render as locked rows:
title, lock badge, target date. No description, no tasks, no deliverables. She
cannot open them, and if she tried to reach one directly the server would refuse.

She books a session on *Pitch Deck* — permitted, because the founder path is
exempt from the `calendar.schedule` gate, and *Pitch Deck* is her **current**
milestone. The booking **requires** a Memo:

> *"Bring your draft deck. We will work through the problem and solution slides."*

That Memo is the brief she was told about. It is the only note on that session.

### Step 5 — David adds Sarah

David schedules the session and assigns **Sarah — GTM Coach**. The platform then
does the coordination nobody should do by hand:

- the session appears on **Sarah's** calendar, and on **Awa's**, and on David's;
- each gets an **in-app notification** and an **email**;
- the session carries its milestone context, so Sarah opens it knowing which
  Journey and milestone she is supporting.

Note what Sarah *cannot* do: she could not have booked this session herself. A
coach supports the work; they do not define the calendar. She also sees the
roadmap **unsealed** — she needs to know where the Venture is going to support it.

### Step 6 — Awa submits the deliverable

She uploads `Pitch Deck v1.pdf` against the **Pitch Deck PDF** deliverable.
Status becomes `submitted`. Evidence is private: the row stores a storage path,
and reads mint short-lived signed URLs only for viewers who already passed the
Venture access gate.

### Step 7 — Review, and the fork in the road

Sarah can review it — the milestone is inside her assigned scope, and
`canReviewDeliverable` grants review to a scoped coach. She has two buttons:

```
Approve              → deliverable approved
Request Changes      → rejection_reason is required, and Awa is told
```

Say she requests changes: *"Include the interview methodology and the customer
segmentation."* Awa is notified, revises, resubmits. **The history is kept** —
review is a state on the record, not an overwrite.

### Step 8 — Completion, and the chain moves

David (or Super Admin — nobody else) marks *Pitch Deck* **completed**. Three
things happen without a second instruction:

```
Pitch Deck            ✓ completed
Business Plan         🔒 → ● unlocked     (the next locked milestone releases)
Awa is notified       "Milestone approved"
```

The Venture's inventory of evidence grows — and Investment Readiness, which is
**derived from the progression** and never a hardcoded checklist, moves with it.

### Step 9 — The Journey closes itself

When the last milestone in Journey 1 is completed:

```
Family & Friends Fundraising   ✓ completed
Go-To-Market                   🔒 → ● active    (next journey becomes current)
```

Nobody clicked "close journey" — a Journey cannot be closed by hand. If somebody
*had* added a sixth milestone first, the Journey would have stayed open, which is
correct: an unfinished plan is not a finished phase.

### Step 10 — The three artefacts land in their three homes

- The **Memo** went **out**, to Awa, when the session was booked.
- David's **milestone record** stayed **in** — his own judgement, for whoever
  inherits this Venture.
- When Journey 1 closed, a **Journey report** was owed **up** to Super Admin.

A year later, a new manager opens AgriNova and reconstructs the whole story:
progression → milestones → deliverables → reviews → sessions → memos → notes.
That is **institutional memory**, and it is the actual point of the system.

---

# 4. Where the code lives

```
src/app/api/ventures/[id]/
  journey/route.js            ← the member's roadmap read + stage management
  milestones/route.js         ← milestone list / create / patch (status, progress)
  deliverables/route.js       ← define + review
  sessions/route.js           ← booking, memo, reschedule, cancel
  notes/route.js              ← staff internal notes (scope-filtered)
  my-access/route.js          ← what the current viewer may do (read back)

src/lib/
  ventureMilestoneEngine.js   ← ★ START HERE  (325 lines, self-documenting header)
  ventureVisibility.js        ← the seal (map vs work)
  venturePermissions.js       ← the matrix, defaults, and the boot corrections
  ventureJourneys.js          ← stages
  ventureDeliverables.js      ← define/review authority
  ventureSessionRules.js      ← the 30-minute lead time, materials
  ventureScopedAccess.js      ← the ONE venture gate
  ventureAuth.js              ← roleIsPrivileged, isStaffActorForVenture
```

**The single best entry-point file is `src/lib/ventureMilestoneEngine.js`.** Its
header explains the progression model, and it contains the authority helper
(`canManageMilestones`) that the rest of the feature imitates.

### Where the seal is enforced

One projection, two readers — so the surfaces cannot drift apart:

```
                    src/lib/ventureVisibility.js
                     (the only definition of "sealed")
                                │
                ┌───────────────┴───────────────┐
                ▼                               ▼
   GET /api/ventures/[id]/journey      GET /api/ventures/[id]/milestones
        (stages + milestones)              (flat milestone list)
```

Before this, the two readers disagreed: the journey read hid the future while the
milestone list handed the founder the entire roadmap, description and objective
included. Sealing one and not the other would have been theatre.

**Who gets the unsealed view.** Both readers decide the same way in practice — a
**privileged role** (`roleIsPrivileged`: `staff`, `super_admin`,
`program_manager`, `developer`, `admin`). The journey read additionally unseals
for a viewer who holds Journey authoring access on this Venture (the
`operating_plan` capabilities, which is what a Lead Manager is granted).

Lead Managers and Coaches are **internal staff** — they carry the `staff` role
and the `lead_manager` responsibility code — so they always hold the unsealed
view and nothing about their surfaces changes. A founder or team member reaches
these routes through Venture *membership*, not through a staff assignment, so
membership is what leaves them sealed.

This is a **read projection, not an authorization mechanism** — it grants and
denies nothing, and is deliberately not a seventh authority mechanism.

> **Known migration.** `roleIsPrivileged` is on the legacy-role retirement list.
> "May this viewer see unreleased work?" is *not* the same question as
> `milestones.edit` — a Coach holds no edit rights and must still see the
> roadmap — so there is no existing matrix cell that answers it. When roles are
> retired, this predicate needs a home in the canonical model (an eligibility or
> capability that means "sees the roadmap"). Until then it is the same predicate
> the journey read already used, kept identical on purpose: **two readers, one
> answer.**

### 4.1 The reference pattern — copy this, don't invent a seventh

There are **six** mechanisms that can decide venture authority today. Only two of
them consult the permission matrix:

| Consult the matrix | Decide independently |
|---|---|
| `hasVentureCapability` | `canManageMilestones` |
| `allowsPlanAction` | `canDefineDeliverables` |
| | `canReviewDeliverable` (via `ventureScope`) |
| | `roleIsPrivileged` / `isStaffActorForVenture` |

**Do not add a seventh.** The intended pattern, already proven twice:

```
   matrix cell (venture_permission_matrix)
        ↓
   the route reads it              hasVentureCapability(...)
        ↓
   my-access reports it back       GET /api/ventures/[id]/my-access
        ↓
   a parity test pins the pair
```

`calendar.schedule` was the first. `milestones.edit` is the second. When you need
an authority decision, **migrate to this pattern** rather than writing a new
predicate — a UI that reports something the route does not enforce is worse than
no UI at all.

---

# 5. What is left

## 5.1 Do these first

**1 — Milestone *unlocking* is not gated.** *(the one real hole)*
Completing a milestone is Lead-Manager-only. **Setting `locked → not_started` is
not** — anyone who passes `requireVentureScopedAccess({ capability: "edit" })`
can release work the manager deliberately held back. The existing test asserts
this as intended ("non-completion transitions stay open"), so the test must change
with the behaviour.
*Open question to settle first:* does `ventures.edit` reach founders? The matrix
only covers staff responsibilities, so that is a **database** question, not a code
one — check `my-access` as a founder.

**2 — Consolidate the six authority mechanisms.** (§4.1)
This is the highest-value refactor in the codebase. Six places can decide
authority, so "why can this person do that?" has six possible answers. Migrating
the four independent ones onto the matrix + the reference pattern makes the answer
*one* thing — and it is the difference between a system you can reason about and
one you have to memorise. `milestones.edit` shows the shape; do the same for
deliverables next.

**3 — Land the work.** Commit and push to `G` (push to `G` only — `main`
auto-deploys).

## 5.2 Then

**4 — Finish the seal's UI half.** The API sends `sealed: true/false`; the
components already render locked *stages* (opacity, 🔒, locked chip) but the
milestone cards do not yet read the flag. Also: `JourneyPlaybookTabs.js` ~L352
carries a now-false comment ("locked milestones are already filtered out"), and
its `firstOpenId` lookup should skip `locked` rows:

```js
// src/components/ventures/workspace/tabs/JourneyPlaybookTabs.js ~L356
find((x) => x.status !== "completed" && x.status !== "locked")
```

The server refuses a bad booking either way (`assertBookableMilestone`), so this
is polish, not a hole.

**5 — Session delete.** Members can **delete** a session today. A cancelled
session keeps its history; a deleted one does not. Recommendation: make
`delete_session` manager-only and let founders cancel instead.

**6 — Data bank rules.** See §2.4 — a **product decision**, not a coding task.

## 5.3 Later, and by explicit decision

**7 — Legacy role retirement.** The target architecture is:

```
Identity → Eligibility → Capability → Assignment/Scope → Restrictions → RLS
```

"Coach", "Founder", "Investor" should remain contextual **labels**. What must be
retired is **role-as-authority** — `if (role === "admin")`. A seven-phase plan
exists: Phase 0 is a **read-only audit** producing a Legacy Role Retirement Map.
**Do not start by deleting roles.**

**8 — RLS.** Postgres row-level security is the intended second boundary, and it
is **last** on purpose: consolidate the application's authorization first, or the
database will enforce a model the app has not agreed on yet.

**9 — Suspended by design.** **KPIs** are off the MVP dashboard — the existing KPI
functionality must be left intact, not deleted. **Investment Readiness** stays
derived from progression, never hardcoded.

---

# 6. Landmines

Each of these has already cost time once.

**The permission matrix**
- `seedVenturePermissions` **only seeds an EMPTY matrix.** An edited default
  therefore never reaches an already-seeded database. Corrections run on every
  boot instead, guarded by `updated_by IS NULL`.
- `facilitatorDefaults()` **inherits `coachDefaults()`.** Correcting coach alone
  silently **widens** facilitator authority. This exact bug was caught once — do
  not regress it.

**The schema**
- **Two `ventures` table generations exist** — `010_ventures.sql` uses
  `company_name`, the newer one uses `name`. Query before you assume; never
  `SELECT name` blind.
- `venture_journey_stages.id` is **UUID**.
- **`venture_milestones.id` type is unresolved.** The code already defends with
  `milestone_id::text = ANY(?)`. Check before writing a new join.
- `venture_id` is a **VNT code (TEXT)** in `venture_members` and
  `venture_staff_assignments`, but a **UUID** elsewhere. `resolveVentureCode`
  exists for this. Skipping the conversion silently denies every delegated
  manager — it has happened.

**The rules**
- **Never add a seventh authority mechanism.**
- `roleIsPrivileged` is **too broad** for cross-venture endpoints (it admits
  staff and program managers). Use `isStaffActorForVenture` there.
- Never remove a security check merely because it looks redundant. Replace its
  decision *source* with the canonical engine, prove parity, **then** remove it.

**The tooling**
- `apply-migrations.mjs` defaults to **`.env.audit-readonly`, which has no
  `DATABASE_URL`.** Scratch scripts must read `.env.local` and **guard on the
  project ref** before writing.
- `npm install` strips `libc` metadata from `package-lock.json` (sharp/@next-swc
  Linux binaries). Harmless — **revert it**, don't commit it.
- `.env.staging` has a **stale password**; staging auth fails from a script.
- **Parallel terminal calls race.** A `git fetch` run alongside
  `git log origin/X` once produced a stale analysis that nearly reported "nothing
  new" when 25 commits existed. **Fetch first, then read.**

**The locale files**
- **Every user-visible string must use `t()`**, with keys in BOTH `en/` and `fr/`.
  A missing English key renders the **key name itself** — that is the signal, not
  a bug in the engine.
- Locale JSON is fragile: always
  `node -e "JSON.parse(require('fs').readFileSync('...','utf8'))"` after editing.

---

# 7. Definition of done, and how to check it

Before any push:

```bash
npm run i18n:parity     # Missing must be 0
npm test
npm run lint            # 0 errors
```

Design system: CSS variables only, **no hex in JSX**, no `dark:` variants — use
`var(--text-primary)`, `bg-surface-1|2|3`, and the shared components in
`src/components/ui/`.

Promoting to production (`G` → `main`) means running **`docs/PRODUCTION_TEST.md`**
— that document *is* the definition of "production test". It is not `npm test`
and not `npm run build`; staging and production are different databases, so a
green build never substitutes for it.

---

# 8. The one paragraph to remember

A Venture progresses through **Journeys**, each holding **Milestones**, each
holding **Tasks, Deliverables and Sessions**. Staff define the framework, activate
one Journey at a time, and release one Milestone at a time. The Venture sees the
**whole map** and works only the part it has been given. Completing the last
milestone in a Journey closes it, and the next one becomes current. A Memo goes
**out** to the Venture, the milestone record stays **in** with the manager, and a
Journey report goes **up** to Super Admin. Everything is kept, and the founder
sees only the part of the story they are meant to be acting on.
