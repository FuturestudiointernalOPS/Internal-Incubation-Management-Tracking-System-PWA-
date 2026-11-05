# Future Studio — Venture Engagement, Session Documentation and Follow-up Management

**Assignment:** existing-system assessment, industry practice review and solution recommendation
**Scope:** Ventures module — sessions, memos, internal notes, reporting, tasks, action items, history
**Mode:** read-only. Nothing in this document has been implemented.
**Branch assessed:** `Ventures` @ `7b138936a`, plus the uncommitted Journey vocabulary work (`note_kind`, Notes sections, session feedback in the Notes panel).
**Date:** 2026-11-05

Evidence convention: `[V]` verified by reading code in this pass · `[P]` taken from a previous audit in this repository · `[U]` unverified (no code evidence or no data read).

---

## 1. Executive summary

**The foundation exists, and it is stronger than the problem statement assumes.** A venture already has dated sessions with a coach, participants, materials, a memo, appended notes, action items and attendance. Almost every field §2 asks for has a home somewhere.

**What is missing is not storage — it is one record.** Today an engagement is spread across three objects with no link between them:

- `venture_sessions` — the appointment, with its one free-text memo (`description`)
- `venture_session_notes` — appended notes (`shared` / `coach_feedback`)
- `venture_session_action_items` — commitments with owner, due date and status, **not connected to `venture_tasks`**

Nothing captures *recommendations*, *decisions*, *what the founder promised* or *when to meet again* as data. They live, if at all, inside free text.

**Three findings that change the answer:**

1. **`session_type` already exists** (default `coaching`, `pitch_review` used elsewhere), but every booking screen hardcodes `coaching`. Engagement types are a UI decision, not a schema one.
2. **Follow-up continuity is the weakest area (12.5%)**, not documentation. A successor can read everything only by opening each session in turn.
3. **Confidentiality, verified:** `get_session` returns all session notes — including `coach_feedback` — to any caller holding `ventures.view`, which includes founders. The `shared` / `coach_feedback` distinction is written but never enforced on read.

**Recommendation in one line:** treat **Sessions as the engagement spine**, add **one structured memo record (1:1)**, **link action items to Tasks**, and build **one read-only engagement timeline** — do not create a second notes system, a second task system, or a second history.

**Coverage:** 20 of 36 requirement units (≈ **56 %**) exist in some accessible form; only 13 of 36 (≈ **36 %**) are usable by a person today without developer help. Methodology in §8.

---

## 2. Current system audit

### A. Sessions `[V]`

| Question | Finding | Evidence |
|---|---|---|
| How created | `POST /api/ventures/[id]/sessions` → `action: "create_session"`; `checkSessionBooking` enforces: memo required, milestone required, date+time in the future, ≤ 5 materials from this venture's uploader | `services/ventures/sessionBooking.js` |
| Who schedules | **Founders** book their own venture's sessions (exempt from the staff gate). **Staff** need `calendar.schedule` in the matrix — the only matrix cell enforced anywhere | `services/ventures/sessionAuthority.js`; route `create_session` |
| Linked to venture | `venture_sessions.venture_id` (internal id); also `milestone_ref`, `journey_stage_id`, `task_id`, `deliverable_id` (soft refs, no FKs) | `src/migrations/020_venture_sessions.sql`; `insertSessionFull` |
| Founders participate | `founder_cid`, `founder_name`; `venture_facing = TRUE` puts it on the venture calendar | `listVentureFacingSessionsForCalendar` |
| Staff participants | **One** `coach_contact_id` / `coach_name` per session. Additional staff can be added only as invitees | `sessionInvitees` |
| External participants | `venture_session_invitees` — email + name + status; invited by staff (management gate) | `add_invitee` branch; `SessionInvitees.js` |
| Attendance | `venture_session_attendance` (participant_type `founder/coach/advisor`, status `pending/attended/absent/late/excused`), **written by an API with no UI caller** | route `record_attendance`; no component call found |
| Memo / notes | One memo on the row (`description`), edited in place; appended notes in `venture_session_notes` (`note_type` default `shared`, `coach_feedback` from the staff panel) | `updateSession`; `addSessionNote` |
| Decisions / action items | Action items table with owner, priority, due date, status, `completed_at`. **No decisions field.** | `venture_session_action_items` |
| Completed sessions preserved | Yes — status changes, row persists; cancelled sessions remain and leave the calendars | `cancelSession`; calendar push |
| Previous sessions accessible | Yes — per venture, filtered, newest first | `listSessions` |

**Verdict:** sessions can serve as the engagement foundation. The gap is the *record of what happened*, not the meeting.

### B. Internal notes `[V]`

| Question | Finding |
|---|---|
| Who can create | Super Admin (global); delegated staff with an active assignment and `internal_notes:create` |
| Venture-specific | Yes — `venture_notes.venture_id` |
| Linked to staff | `author_cid`, `author_name` |
| Timestamps | `created_at`, `updated_at` |
| Editable / deletable | **No edit route.** Delete = **soft archive** (`is_archived`), author may retract their own |
| Categorised | Only `note_kind` (`milestone` / `activity`), added this week; no tags, no topics |
| Visible to founders | **Never** — the route answers 404, "no existence leak" |
| Access restrictions | Matrix `internal_notes` + assignment scope: a scoped coach sees only their milestone's notes |
| Follow-up references | None — free text, no links to tasks or other notes |

**Verdict:** keep as an auxiliary staff instrument. It should **not** become the engagement record: it has no participants, no decisions, no follow-up and no founder visibility.

### C. Memos `[V]`

There is **no memo table**. "Memo" in the product means the session's `description` — one per session, edited in place, never appended. What the manual calls *Session memos* is that field.

| Question | Finding |
|---|---|
| Purpose | The brief: why the session exists and what it covers |
| Linked to session | Yes (the row itself) |
| Author | `created_by` on the session; the memo edit does not record its own author |
| Participants | On the session, not on the memo |
| Decisions / recommendations | Not structured — free text only |
| Review / approval | None |
| Versioned | **No** — edited in place, previous text lost |
| In venture history | Only through the session |

**Verdict:** this is the right place to grow the engagement record, but it cannot stay a single free-text field.

### D. Reporting `[V]`

Four distinct things carry the word "report":

| Artefact | Purpose | Table / route | Authored by | Audience |
|---|---|---|---|---|
| **Founder reporting** | baseline, monthly, quarterly, events — the venture's numbers | `venture_metrics_monthly`, `venture_baseline`, quarterly tables | founder | validated by staff; read by all |
| **Journey report** | progress / closing report for one **stage** | `venture_reports` (`report_kind`, period, summary, completed, outstanding, support, challenges, recommendation, status) | Venture Manager | the studio |
| **Reports (admin)** | business snapshot, charts, impact panel | reads the calculated metric layer | system | Super Admin |
| **Reporting (admin)** | monthly report review queue | reads submissions | Super Admin | Super Admin |
| **Venture updates** `[P]` | monthly / quarterly narrative | `venture_updates` | **investor APIs only** | investor |

**Boundary:** reporting is *periodic, quantitative, venture-level*. It is not an engagement record and must not host one.

### E. Tasks and action items `[V]`

| | `venture_tasks` | `venture_session_action_items` |
|---|---|---|
| Owner | assignee + assignments table | `owner_cid` / `owner_name` (free text-ish) |
| Due date | yes | yes |
| Status | `backlog/todo/in_progress/review/done/blocked/cancelled` | `pending/in_progress/completed/cancelled` |
| Review | submissions + `approved` / `changes_requested` | none |
| Milestone link | yes | no |
| UI | Tasks tab, board, founder "my work" | admin sessions page: **add title only** |
| Link between them | **none** | **none** |

**Verdict:** session outcomes cannot create follow-up tasks today. The action-item table is a second, weaker task list — the exact duplication §E forbids.

### F. Venture activity and history `[V]`

Four write-only logs plus one session log:

| Log | Shape | Written by | Read by |
|---|---|---|---|
| `venture_history` | `event_type`, `description`, `metadata` | `addVentureHistory` (notes, venture updates, stage events) | some panels |
| `venture_activity_log` | `action`, `actor`, `details` | `logVentureActivity`, Data Room, lead change | admin Activity, lead-manager dashboard |
| `venture_change_log` | field-level `old_value` → `new_value` | `recordVentureChange` | `VentureChangeLogPanel` |
| `venture_audit_logs` | authorisation audit | authz layer | admin |
| `venture_session_activity` | per-session `action` | session service | not found in UI `[U]` |

**Verdict:** a unified engagement history is **not** a new table — it is a read model over sessions + memos + notes + action items, projected into one timeline. The four logs must not be merged now (different audiences, different payloads), but a canonical-owner statement per surface is required.

---

## 3. Existing feature overlap analysis

Current state, from the user's own list:

| Concept | What it actually is | Overlaps with | Correct owner |
|---|---|---|---|
| **Session** | appointment + memo + materials + invitees | memo, participants | **engagement spine** |
| **Memo** | the session's description | notes | **part of the engagement record** |
| **Internal Notes** | staff asides on a milestone | activity reports | **auxiliary, keep separate** |
| **Activity report** | an internal note with `note_kind='activity'` | notes | **auxiliary, keep separate** |
| **Session notes** | appended notes on a session | memo | **fold into the engagement record** |
| **Action items** | weak task list on a session | `venture_tasks` | **commitments → Tasks** |
| **Journey report** | stage-level structured report | nothing | **reporting** |
| **Founder reporting** | the venture's numbers | nothing | **reporting** |
| **Venture updates** | investor-only narrative | nothing | **investor module** |

**The four genuine overlaps** (all pre-existing):

1. Session memo vs session notes — both narrative, both about the same meeting.
2. Session action items vs venture tasks — two task lists, one without review.
3. Internal notes vs activity reports — same table, two names (fixed this week with `note_kind`; the *concept* still overlaps).
4. Four history logs — same events, different shapes.

---

## 4. Industry practice review

How venture studios, accelerators and portfolio teams actually do this `[U]` (general practice, not a code finding):

| Pattern | Who does it | What it teaches |
|---|---|---|
| **Activity + Task pair** | Salesforce, HubSpot, Dynamics | A *meeting* is an activity; follow-ups are *tasks* with owners and due dates. Two objects, never one. |
| **Engagement timeline** | Affinity, DealCloud, Attio | The relationship view is a **merge** of activities, notes, emails and tasks — not a table. |
| **Office hours with a written debrief** | YC, Techstars, Antler | A fixed record per session: what was asked, what was advised, what the founder must do next. |
| **Decision log** | Portfolio ops, PMO practice | Decisions are dated, owned and revisitable — separate from the narrative. |
| **Handover pack** | Studio practice | When a partner changes, the successor reads the last 3 engagements + open commitments, not the whole archive. |

**The seven concepts, defined for Future Studio:**

| # | Concept | Question it answers | Lifetime |
|---|---|---|---|
| 1 | **Appointment** (scheduled session) | When will we meet? | future-dated, editable |
| 2 | **Engagement** (completed interaction) | Did it happen, who was there? | frozen once documented |
| 3 | **Internal note** | What did we observe, for ourselves? | private, editable by author |
| 4 | **Engagement memo** | What was discussed, advised, agreed? | frozen after submission, versioned on change |
| 5 | **Decision** | What was agreed, by whom, when? | permanent, revisitable |
| 6 | **Action item** (commitment) | Who owes what, by when? | open → done, linked to Tasks |
| 7 | **Performance report** | How is the venture doing this period? | periodic, quantitative |

**Terminology recommendation:** rename the *user-facing* label of a completed session to **Engagement**, and keep the tab name **Sessions** for the calendar view. Two words for the two lifetimes, one object. Avoid "Memo" as a tab name entirely — it becomes "Engagement record".

---

## 5. Recommended business workflow

Mapping the five steps of §5 onto what exists:

| Step | Reuse | Add | Owner |
|---|---|---|---|
| **1. Create** | `venture_sessions` + booking rules + invitees | an **engagement type** picker (the column already exists) | founder or staff |
| **2. Document** | session row + memo + participants | **structured memo**: discussion, recommendations, decisions, founder commitments, staff commitments, next engagement date | the staff member who attended |
| **3. Preserve** | append-only rows, `created_by` | **freeze on submit**; a correction creates version N+1 | system |
| **4. Follow up** | action items | link each commitment to a **`venture_tasks`** row; a **venture-level open-commitments** view | the successor |
| **5. Continue** | new session on the same venture | reference the previous engagement (optional `follows_up_session_id`) | the successor |

**The handover scenario, answered:** Lead Manager B opens the venture → **Engagements** view → sees, newest first: each engagement with date, author, participants, memo, decisions, commitments and their status; then a single "Open commitments" list across all engagements, each linking to its task. That is the whole requirement, and it does not need a new store.

---

## 6. Proposed information architecture

```
Venture
│
├── Engagements  (the spine — venture_sessions)
│     ├── Appointment: when, where, timezone, venture_facing
│     ├── Context: journey stage · milestone · deliverable · task
│     ├── Participants
│     │     ├── Coach (platform contact) + staff invitees
│     │     ├── Founder(s)
│     │     ├── External invitees (email)
│     │     └── Attendance (recorded after the fact)
│     ├── Engagement record (1:1 memo, versioned)
│     │     ├── Discussion / issues
│     │     ├── Recommendations (who advised what, why)
│     │     ├── Decisions (agreed / unresolved)
│     │     ├── Founder commitments  ──┐
│     │     └── Staff commitments     ─┤
│     ├── Action items ────────────→ Tasks (existing board, review, my-work)
│     └── Attachments / materials
│
├── Internal notes (unchanged: milestone-scoped, staff-only, auxiliary)
│
├── Reports
│     ├── Journey report (per stage, progress / closing)
│     └── Founder reporting (baseline / monthly / quarterly) — untouched
│
└── History (read model): merges engagements, notes, tasks, status changes
```

**What moves where:**

| Component | Decision | Why |
|---|---|---|
| Sessions | **Reuse, relabel "Engagement" once documented** | it already holds time, participants, context, materials |
| Session memo | **Keep, and grow** into the structured record | it is the only thing attached to a meeting |
| Session appended notes | **Fold into the record** — one memo + a change history | two narratives of one meeting is the confusion |
| Internal notes | **Keep separate** | different lifecycle, staff-only, milestone-scoped |
| Action items | **Keep the row, add `task_id`** | the commitment stays with the engagement; execution lives in Tasks |
| Tasks | **Unchanged** | never duplicate a task system |
| Journey reports | **Unchanged** | reporting, not engagements |
| History logs | **Read model only** | do not merge tables |

---

## 7. Proposed technical architecture

### 7.1 Reuse map

| Need | Existing | Change |
|---|---|---|
| Engagement row | `venture_sessions` | use `session_type` as the engagement type; stop hardcoding `coaching` |
| Memo | `description` | keep as the brief; structured fields go to a 1:1 table |
| Participants | `coach_contact_id`, `founder_cid`, `venture_session_invitees` | add staff invitees to the UI (backend exists) |
| Attendance | `venture_session_attendance` | surface the existing `record_attendance` action in the session detail |
| Commitments | `venture_session_action_items` | add `task_id` (nullable), surface owner/due/status in UI |
| Follow-up date | — | `next_engagement_at` on the engagement record |
| History | 4 logs | read model; no schema merge |

### 7.2 Proposed additive schema (not implemented)

```sql
-- 1. The structured record, 1:1 with the session.
CREATE TABLE venture_engagement_record (
  id SERIAL PRIMARY KEY,
  session_id INTEGER NOT NULL UNIQUE REFERENCES venture_sessions(id) ON DELETE CASCADE,
  discussion TEXT,               -- what was discussed
  recommendations JSONB,         -- [{ text, by_cid, by_name, rationale }]
  decisions JSONB,               -- [{ text, status: 'agreed'|'open', decided_at }]
  founder_commitments JSONB,     -- [{ text, owner_name, due_date }]
  staff_commitments JSONB,       -- [{ text, owner_cid, due_date }]
  next_engagement_at TIMESTAMPTZ,
  follows_up_session_id INTEGER REFERENCES venture_sessions(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft',    -- draft | submitted
  version INTEGER NOT NULL DEFAULT 1,
  created_by TEXT, submitted_by TEXT, submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. A commitment is executable work, not a copy of it.
ALTER TABLE venture_session_action_items
  ADD COLUMN IF NOT EXISTS task_id INTEGER,
  ADD COLUMN IF NOT EXISTS status_note TEXT;
```

Why a 1:1 table rather than columns on the session: the memo is a *document* (versioned, frozen on submit, owned by an author), while the session is a *calendar event* (movable, cancellable, attendance-tracked). Merging their lifecycles would let rescheduling rewrite a submitted record.

### 7.3 Read model, not a new table

`GET /api/ventures/[id]/engagements` composes:
sessions + record + participants + action items (with task status) + linked notes, ordered by date, with an `open_commitments` block. No writes. This is the handover screen.

### 7.4 Access control

| Record | Internal only | Shared with venture | Restricted |
|---|---|---|---|
| Engagement memo | drafts and `submitted` staff-only until published | published summary (`venture_facing`) | recommendations rationale can be staff-only |
| Session notes `coach_feedback` | **must become staff-only on read** (currently not) | — | — |
| Internal notes | always | — | author + matrix |
| Action items | internal owner view | the founder-facing items they own | — |

**Verified gap:** the POST gate for all session actions is `ventures.edit`, which founders hold. A founder can therefore call `add_note` with `note_type: "coach_feedback"`, and `get_session` returns every note to them. `venture_facing` exists on the session but not on the notes.

---

## 8. Coverage matrix

**Method.** The unit is one *information requirement* as stated in §2 and §5 — 36 units, equally weighted, scored 1 (exists and a person can use it), 0.5 (schema/API exists but no UI, or the field exists without enforcement), 0 (absent). Unused tables and disconnected APIs are **not** counted as working. "Usable today" recomputes the same list with every 0.5 capped to 0, which is what a staff member can actually do without help.

| # | Requirement | Status | Score |
|---|---|---|---|
| A1 | Session linked to a venture | `[V]` exists | 1 |
| A2 | Date, time, timezone | `[V]` exists | 1 |
| A3 | Engagement type (meeting / review / fundraising…) | column exists, UI hardcodes `coaching` | 0.5 |
| A4 | Reschedule / cancel / delete | `[V]` exists | 1 |
| A5 | Past sessions preserved and readable | `[V]` exists | 1 |
| A6 | Per-venture session list | `[V]` exists | 1 |
| B1 | One narrative memo per engagement | `[V]` exists | 1 |
| B2 | Structured memo (recommendations, decisions, commitments) | absent | 0 |
| B3 | Appended notes on a session | `[V]` exists | 1 |
| B4 | Staff-only internal notes | `[V]` exists | 1 |
| B5 | Memo correctable with history | editable in place, no version | 0.5 |
| B6 | Per-record visibility control | `venture_facing` on session; notes ignore `note_type` | 0.5 |
| C1 | Multiple staff participants | one coach; others only via invitees | 0.5 |
| C2 | Founder participants | one `founder_cid`; others via invitees | 0.5 |
| C3 | External participants | `[V]` invitees by email | 1 |
| C4 | Attendance record | table + API, **no UI caller** | 0.5 |
| C5 | Participant roles | `participant_type` in attendance only | 0.5 |
| D1 | Action item with owner | API yes; admin UI sends title only | 0.5 |
| D2 | Due date on a commitment | API only | 0.5 |
| D3 | Commitment status / completion | columns + update API, no UI caller | 0.5 |
| D4 | Link to existing tasks | absent | 0 |
| D5 | Venture-wide open-commitments list | absent | 0 |
| E1 | Chronological engagement history | sessions list | 1 |
| E2 | Chronological notes history | Notes tab | 1 |
| E3 | Unified engagement timeline | absent | 0 |
| E4 | Handover read in one place | scattered across tabs | 0.5 |
| E5 | Decisions as data | absent | 0 |
| F1 | Next-engagement date | absent | 0 |
| F2 | Outstanding commitments surfaced | absent | 0 |
| F3 | Ownership transfer keeps history | `LEAD_CHANGED` logged; engagements not linked | 0.5 |
| F4 | Successor notified | absent | 0 |
| G1 | Author + timestamp on notes | `[V]` exists | 1 |
| G2 | Author + timestamp on bookings | `created_by`, `created_at` | 1 |
| G3 | Staff vs shared enforced | declared, not enforced on read | 0.5 |
| G4 | Edit history on records | change log for entities; not for notes/memos | 0.5 |
| G5 | Founder access to the shared record | `venture_facing` (calendar only) | 0.5 |

**By capability area (formal → usable today):**

| Area | Formal | Usable today |
|---|---|---|
| Session management (A) | 5.5 / 6 — **92 %** | 5 / 6 — 83 % |
| Memo & note-taking (B) | 4.0 / 6 — **67 %** | 3 / 6 — 50 % |
| Participant tracking (C) | 3.0 / 5 — **60 %** | 1 / 5 — 20 % |
| Action-item management (D) | 1.5 / 5 — **30 %** | 0 / 5 — 0 % |
| Engagement history (E) | 2.5 / 5 — **50 %** | 2 / 5 — 40 % |
| Follow-up continuity (F) | 0.5 / 4 — **12.5 %** | 0 / 4 — 0 % |
| Permissions & auditability (G) | 3.0 / 5 — **60 %** | 2 / 5 — 40 % |
| **Overall** | **20.0 / 36 — 55.6 %** | **13 / 36 — 36.1 %** |

**Limitations.** Equal weights are an assumption, not an agreed priority. Usage volumes were not measured in this pass `[U]`; a capability counts even if nobody uses it (attendance is the clearest example). The unit list is derived from §2 and §5 of the assignment, not from Future Studio's sign-off.

---

## 9. Risk assessment and mitigation

| # | Risk | Potential impact | Mitigation |
|---|---|---|---|
| R1 `[V]` | `get_session` returns `coach_feedback` to founders | Confidential staff commentary exposed | Filter by `note_type` + viewer before returning; treat `coach_feedback` as staff-only |
| R2 `[V]` | Founders hold `ventures.edit`, so they can post any session action, including `add_note` with `note_type: coach_feedback` | Fabricated or self-serving staff-style notes | Allowlist by role per action; authorship is already stored, enforce it |
| R3 `[V]` | Session action items are a second task list (no `task_id`) | Two truths about the same commitment | Add `task_id`; create through the existing task service; never a second board |
| R4 `[V]` | Four history logs write overlapping events | Timeline disagreements, duplicate notifications | Declare one canonical owner per surface; read model merges, tables stay |
| R5 `[V]` | `session_type` always `coaching` | Engagement types look supported but are not | Wire the picker; keep old rows as `coaching` (no data rewrite) |
| R6 `[V]` | Memo editable in place, no version | A submitted engagement can be silently rewritten | Freeze on submit; corrections create version N+1 (same rule as founder reports) |
| R7 `[V]` | Attendance API has no UI writer | "Attendance is tracked" is false in practice | Surface it in the session detail, or stop claiming it |
| R8 `[V]` | Notes are archive-only, no edit | Corrections create duplicate notes | Either an edit route with history, or an explicit "supersedes" link |
| R9 `[V]` | Scoped assignments (coach on one milestone) hide other engagements | A successor with a narrow scope sees a partial history | Handover requires a **venture-wide** assignment; state it in the assignment UI |
| R10 `[U]` | Historical sessions have only a free-text `description` | Structured fields will be empty for past engagements | No backfill; mark legacy engagements as "narrative only" |
| R11 `[V]` | `venture_updates` is investor-API-only | A narrative channel exists but no one can write it | Leave it; do not use it for engagements |
| R12 `[U]` | Notification fan-out on memo submission | Staff/founder notification fatigue | One notice per submitted memo, not per edit |
| R13 `[V]` | Signed material URLs expire | A handover reader clicks a dead link | Re-mint on read (already the pattern); never cache URLs in the memo |

**Not a risk, verified:** sessions, notes and attendance rows are append-only in practice (cancellation keeps the row), so no historical data is at risk from this work.

---

## 10. Implementation roadmap

Each phase is independently valuable and reversible. Nothing here is authorised.

| Phase | Content | Reuses | New | Effort |
|---|---|---|---|---|
| **E0** | Truth fixes, no new concept: enforce `note_type` on read; stop returning coach feedback to founders; add `session_type` picker | route guards, existing columns | none | S |
| **E1** | **Engagement record** (1:1 table) with the six fields + submit/freeze; UI on the session detail | session row, memo | 1 table, 1 endpoint | M |
| **E2** | **Commitments → Tasks**: `task_id` on action items; "Create task" from a commitment; open-commitments list on the venture | `venture_tasks` service | 1 column, 1 view | M |
| **E3** | **Engagement timeline** read model + handover screen (venture-wide) | sessions, notes, tasks, logs | 1 read endpoint, 1 screen | M |
| **E4** | Attendance and role capture in the UI; participant editing | `record_attendance`, invitees | screens only | S |
| **E5** | Reporting polish: next-engagement cadence on the venture dashboard | readiness/roadmap cards | small | S |

**Sequencing rule:** E0 first — it is the only phase that closes a live confidentiality gap. E1 before E2: a commitment needs an owner record before it can become a task.

---

## 11. Decision register

| # | Decision | Options | Recommendation | Implications | Approval |
|---|---|---|---|---|---|
| D1 | Foundation for engagements | (a) extend Sessions (b) new Engagements table (c) notes | **(a) Sessions** | (b) duplicates scheduling; (c) loses participants and dates | Pending |
| D2 | Official engagement record | (a) 1:1 memo table (b) columns on session (c) free text stays | **(a)** | (b) lets rescheduling rewrite a submitted record; (c) fails §5 step 2 | Pending |
| D3 | Internal notes | (a) keep separate (b) merge into engagements (c) retire | **(a) keep** | merging exposes staff asides to founders or forces staff-only on the whole record | Pending |
| D4 | Session appended notes | (a) fold into the record (b) keep separate | **(a)** | one narrative per meeting; legacy notes stay readable | Pending |
| D5 | Founder visibility | (a) published summary only (b) whole record (c) nothing | **(a)** | the venture must be able to read what was agreed; internal rationale stays staff-only | Pending |
| D6 | Formal memo required? | (a) every engagement (b) only types flagged formal (c) optional | **(b)** | every engagement is too heavy; optional loses the record | Pending |
| D7 | Commitments → Tasks | (a) link (`task_id`) (b) duplicate (c) leave separate | **(a)** | one execution list; the engagement keeps the promise | Pending |
| D8 | Who may create / edit / approve / close | (a) as today (`ventures.edit` + matrix) (b) staff-only authorship (c) author + manager | **(b) staff-only authorship, author may correct before submit** | closes R2; founders keep booking | Pending |
| D9 | Handover of responsibility | (a) reassign the venture-wide assignment (b) copy assignments (c) manual | **(a)**, with a pre-transfer "open commitments" check | existing `LEAD_CHANGED` log already records it | Pending |
| D10 | Historical notes and memos | (a) leave as narrative (b) migrate (c) archive | **(a)** | no invented history; the timeline shows them as narrative | Pending |

---

## What this assessment does not claim

- It does not measure how often these features are actually used `[U]`.
- It does not assert that every screen reachable by API is reachable by a user — the opposite is documented.
- It does not propose merging the four history logs, the two task lists' storage, or the report families.
- It does not authorise any work. Phase E0 is the only item with a safety argument for going first.
