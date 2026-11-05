# Venture Engagement Management and Recurring Meeting Schedules

**Assignment:** technical assessment and implementation planning
**Extends:** `docs/VENTURE_ENGAGEMENT_ASSESSMENT.md` (read-only discovery, 2026-11-05)
**Mode:** assessment only. Nothing here is implemented.
**Branch assessed:** `Ventures` @ `5c751662d` (the session-note confidentiality fix is already shipped)
**Date:** 2026-11-05

Evidence convention: `[V]` verified in code during this pass · `[P]` previous audit in this repository · `[U]` unverified.

---

## 0. Does this brief answer the open decisions?

Partly. It **closes four** of the ten decisions from the previous register and **opens five new ones**.

| Previous decision | Status after this brief |
|---|---|
| D1 — Sessions as the engagement foundation | **Answered: yes.** Stated explicitly in §§2, 4, 13. |
| D2 — One structured, versioned memo (1:1 table) | **Still open.** §5 asks for the structure and the freeze rule but not for the storage shape. |
| D3 — Internal notes stay separate | **Answered: yes.** §4 lists them as their own component; §13 forbids parallel systems. |
| D4 — Fold appended session notes into the record | **Not addressed.** |
| D5 — Founder visibility | **Half answered:** "published engagement summaries" is now the stated model (§11), but "published by whom, and what is in a summary" is not decided. |
| D6 — Formal memo required, per meeting type | **Still open.** §5 explicitly asks us to assess it. |
| D7 — Commitments link to existing Tasks | **Answered: yes.** §§6, 13 are unambiguous: Tasks stays the source of truth, no second system. |
| D8 — Who may create / edit / approve / close | **Still open.** §11 asks the question; it does not answer it. |
| D9 — Handover mechanics | **Still open.** §3.4 states the requirements (schedule survives, history intact, commitments checked) but not the mechanism. |
| D10 — Historical notes and memos | **Answered: preserve.** §13: "Do not silently migrate or reinterpret historical notes." |
| — | **New:** schedule entity shape, exception model, recurrence generation strategy, timezone policy, reminder channel, schedule permissions. |
| — | **Already implemented** between the assessment and this brief: the two confidentiality gaps (§11) — `get_session` no longer returns notes or preparation notes to non-staff, `add_note` is staff-only and `note_type` is an allowlist (`5c751662d`). |

**Recommendation:** approve D2, D4, D6, D8, D9 before any phase beyond P1. The rest can be decided inside the phase that needs them.

---

## A. Executive summary

Recurring schedules are the one thing the platform genuinely lacks; the engagement record is the other. Everything else — appointments, participants, materials, invites, notifications, calendar sync, reminders, tasks, audit — already exists and should be reused.

**The direction:**

1. A **new `venture_session_schedules` table** holding the recurrence *pattern* (frequency, per-day slots, validity, staff, type, timezone) plus a **version chain** for "modify from here on".
2. A **Materialiser** — the existing daily cron pattern (`/api/reminders/sweep`) gains a sibling that creates concrete `venture_sessions` rows N days ahead, idempotently, keyed on `(schedule_id, occurrence_key)`.
3. Sessions remain the appointment; a **1:1 engagement record** is added for what happened; **commitments link to `venture_tasks`**; a **read-model timeline** serves handover.
4. Recurrence is **materialised, not delegated to Google**: the calendar integration already builds events from `venture_sessions`, so one row per occurrence gives correct behaviour for exceptions, cancellations and per-occurrence edits for free.

**Why materialise instead of an RRULE string:** Google's `recurrence` field cannot express "skip the 12th", "move this one to Thursday", or "the memo of this occurrence", and a calendar-side edit would silently diverge from the platform. One row per occurrence keeps the platform authoritative — the same reason `activateDueStages` materialises state rather than deriving it on read.

**Coverage:** scheduling requirements are ~**12.5 %** covered today (only single-session booking exists); engagement requirements stand at **55.6 % formal / 36 % usable** from the previous assessment.

---

## B. Current-state audit

### B.1 What already exists and is reusable `[V]`

| Capability | Where | Verdict |
|---|---|---|
| Session row (time, tz, coach, founder, materials, invitees, context) | `venture_sessions` | Reuse as the occurrence |
| Booking validation (memo, milestone, future date, ≤5 materials) | `services/ventures/sessionBooking.js` | Reuse for each generated occurrence |
| Staff authority to define the calendar | `calendar.schedule` matrix cell via `sessionAuthority.js` | Reuse for schedules |
| Founder booking | founders book their own sessions, exempt from the staff gate | Reuse; they do **not** get schedules |
| Notifications (scheduled / updated / cancelled / rescheduled) | `services/ventures/sessionNotices` | Reuse for generated sessions |
| Google Calendar push | `googleCalendar.syncUser`, `pushSessionToCalendars` | Reuse; events are built from session rows |
| Scheduled job pattern | `/api/reminders/sweep` daily, `/api/reporting/stage-sweep` weekly, both in `vercel.json`, authenticated by shared secret | Reuse exactly |
| Reminder rules engine | `venture_reminders` (trigger start/finish, `days_before`, scope, work-item kind) | Extend, do not duplicate |
| Tasks board | `venture_tasks` + submissions/reviews | Reuse; link commitments |
| Internal notes | `venture_notes` (milestone-scoped, staff-only, `note_kind`) | Reuse unchanged |
| Audit | `venture_history`, `venture_activity_log`, `venture_change_log`, `venture_session_activity` | Reuse; one canonical owner per surface |

### B.2 What is incomplete `[V]`

- **No recurrence anywhere.** `recurrence`, `rrule` and `recurring` do not appear in the source. Sessions are created one at a time by a human.
- **`session_type` is fixed to `coaching`** by every booking screen (`booking.js`, `JourneyPlaybookTabs`, `DataRoomSessionModal`), although the column defaults and `pitch_review` is used by one readiness counter.
- **Action items** have owner, due date and status but **no `task_id`** and no UI beyond the admin session page adding a title.
- **Attendance** has a table and an API action with **no UI caller**.
- **No structured engagement record**: `venture_sessions.description` is the only narrative, and it is edited in place.
- **No timeline**: staff handover means opening sessions one by one.

### B.3 What must not be duplicated (constraint §13)

Tasks · Notes · Calendar · History. The design below adds **one schedule table** and **one exception table**, and links to the rest.

---

## C. Proposed architecture

```
venture_session_schedules   (NEW — the rule, never the history)
  id, venture_id, title, description, session_type,
  requirement_level        'none' | 'summary' | 'memo'      -- decides if a memo is required
  timezone                 IANA, default from the venture
  frequency                daily | weekly | biweekly | monthly | custom
  interval                 every N (custom / true biweekly)
  slots JSONB              [{ weekday: 2, start: "16:00", minutes: 30 },
                            { weekday: 5, start: "15:00", minutes: 30 }]
  valid_from DATE, valid_until DATE NULL, max_occurrences INT NULL
  status                   active | paused | ended
  staff_cid, staff_name    -- the CURRENT owner; changing it does not touch past sessions
  version INT, supersedes_id, created_by, created_at, updated_at
        │
        │ 1—N  (materialised occurrences)
        ▼
venture_sessions   (EXISTING + 3 columns)
  + schedule_id, occurrence_key, schedule_version
  UNIQUE (schedule_id, occurrence_key)        -- duplicate prevention, idempotent sweep
  + status includes 'skipped'                 -- an exception that never happened
        │
        ├── 1—1  venture_engagement_record    (NEW — what happened, versioned)
        │          discussion, recommendations JSONB, decisions JSONB,
        │          founder_commitments JSONB, staff_commitments JSONB,
        │          next_engagement_at, status draft|submitted, version
        │
        ├── 1—N  venture_session_notes        (EXISTING — staff-only, unchanged)
        └── 1—N  venture_session_action_items (EXISTING + task_id → venture_tasks)

venture_session_schedule_exceptions (NEW — the deviations)
  schedule_id, occurrence_key, kind 'skip' | 'cancel' | 'move',
  moved_to TIMESTAMPTZ, reason, created_by, created_at
  UNIQUE (schedule_id, occurrence_key, kind)

venture_tasks  (EXISTING — untouched; the commitment stores its task_id)
```

**Invariants**

1. A schedule never stores a completed meeting — only the rule.
2. A session is the only place a meeting exists; deleting a schedule never deletes sessions.
3. Editing a schedule copies it (new version, `supersedes_id`) and closes the old one at `valid_until`; **no past session is rewritten**.
4. `occurrence_key` is the UTC instant of the occurrence; it is what makes the sweep idempotent and what an exception addresses.

**Why not RRULE (iCalendar) storage?** It cannot carry per-day different durations cleanly for editing, it is opaque to a form UI, and exceptions would still need this table. Exporting to an RRULE string later (for Google) remains possible.

---

## D. User workflows

### D.1 Create a recurring schedule
Venture → Sessions → **Recurring schedule**. Choose type, staff member, timezone (defaults to the venture's), frequency, days with per-day start time and duration, start date, optional end or occurrence cap. The form refuses a pattern that produces zero occurrences. Created `paused` until the first generation, so nothing books itself before the manager has seen the preview.

### D.2 Generate upcoming sessions
The daily sweep materialises **60 days ahead** (configurable): for each active schedule, compute the occurrences inside the horizon that do not already exist, insert one session per occurrence with `schedule_id`, `occurrence_key`, `schedule_version`, then notify and push calendars exactly as a manual booking does. Idempotent by unique key — a second run the same day creates nothing.

### D.3 Modify or reschedule one occurrence
Open the session → *This occurrence only*. Two effects:
- a change of time → `venture_session_schedule_exceptions` row of kind `move`, plus the session update;
- a skip/cancel → exception `skip`/`cancel` and the session status changes.
The schedule is untouched; future occurrences keep their pattern.

### D.4 Modify from here on
*This and following occurrences* → the current schedule gets `valid_until = (day before the chosen date)` and `status='ended'`; a new schedule row is created with `supersedes_id` pointing at it. Already-materialised future sessions that are **not yet documented** are cancelled and regenerated from the new version; **documented or completed sessions are never touched**.

### D.5 Conduct and document the meeting
After the session, the staff member opens the engagement record: objective, discussion, challenges, recommendations, decisions, commitments, next date. Saves a draft; submits when done. Submitting freezes version N. A correction after submission creates version N+1 and keeps N (same rule the founder's monthly report already uses).

### D.6 Record decisions and commitments
Decisions are entered on the record with a status (`agreed` / `open`). Commitments are entered with owner and due date. Any commitment can be **pushed to the Tasks board**, which creates a `venture_tasks` row and stores `task_id` back on the commitment — one record, one execution.

### D.7 Track outstanding commitments
A venture-level panel lists every commitment whose task is not complete, across all engagements, with owner, due date and the engagement it came from.

### D.8 Review the engagement history
Venture → **Engagements** (read model): schedule changes, sessions held, sessions cancelled or skipped, memos (published summary or full record per permission), decisions, commitments and their status, newest first.

### D.9 Hand over
Reassign the staff member on the schedule and the venture assignment. The schedule stays active; past sessions keep their author. Before the transfer completes, the handover panel shows **open commitments** and the last three engagements. `LEAD_CHANGED` is already logged.

---

## E. Coverage assessment

**Method.** Same discipline as the previous assessment: the unit is one requirement as stated in the brief; 1 = exists and a person can use it, 0.5 = schema/API exists without a working UI, 0 = absent. Unused tables are not counted.

### E.1 Scheduling requirements (12 units)

| # | Requirement | Today | Score |
|---|---|---|---|
| S1 | Define a recurring pattern | absent | 0 |
| S2 | Several days with different slots | absent | 0 |
| S3 | Validity window / occurrence cap | absent (per-session dates only) | 0 |
| S4 | Pause / resume / end | absent | 0 |
| S5 | Generate upcoming sessions | absent (manual booking only) | 0 |
| S6 | Duplicate prevention | absent | 0 |
| S7 | Modify one occurrence | **exists** — edit / reschedule / cancel a single session | 0.5 |
| S8 | Modify future occurrences | absent | 0 |
| S9 | End and replace a schedule | absent | 0 |
| S10 | Skip / reschedule / cancel an exception | **partly** — the session can be cancelled or moved, no exception record | 0.5 |
| S11 | Schedule change history | absent (`venture_change_log` covers entities, not schedules) | 0 |
| S12 | Staff reassignment keeps the schedule | **partly** — assignments can change; no schedule exists | 0.5 |
| | **Total** | | **1.5 / 12 — 12.5 %** |

### E.2 Engagement requirements

Unchanged from `docs/VENTURE_ENGAGEMENT_ASSESSMENT.md` §8: **20 / 36 — 55.6 %** formally, **13 / 36 — 36.1 %** usable. The confidentiality items (R1, R2 in that document) have since moved from 0 to 1 and are shipped.

### E.3 Reuse / modify / new

| Bucket | Items |
|---|---|
| **Reuse unchanged** | `venture_tasks`, `venture_notes`, calendar push, notification services, sweep authentication, audit logs |
| **Reuse with an added column** | `venture_sessions` (+`schedule_id`, `occurrence_key`, `schedule_version`), `venture_session_action_items` (+`task_id`) |
| **New** | `venture_session_schedules`, `venture_session_schedule_exceptions`, `venture_engagement_record` |
| **New read model** | `GET /api/ventures/[id]/engagements` (no table) |

---

## F. Risk assessment

Severity: **S1** data loss or confidentiality · **S2** wrong history or broken workflow · **S3** annoyance.

| # | Risk | Sev | Likelihood | Impact | Mitigation |
|---|---|---|---|---|---|
| F1 | Sweep creates duplicate sessions (two runs, retries, overlapping horizon) | S2 | High | Duplicate meetings, duplicate calendar entries | `UNIQUE (schedule_id, occurrence_key)` + `ON CONFLICT DO NOTHING`; the sweep reports created/skipped counts |
| F2 | "Modify from here on" rewrites history | S1 | Medium | Completed meetings change | Version chain; only *undocumented, future* occurrences are regenerated; past rows never updated |
| F3 | DST shifts a 16:00 meeting to 15:00 | S2 | Medium (Africa/Porto-Novo has none today, but the timezone is configurable) | Wrong meeting time | Compute each occurrence in the schedule's IANA zone; store UTC. Requires a timezone helper — see decision N4 |
| F4 | Two staff edit the same schedule concurrently | S2 | Low | Lost edit | `version` column, compare-and-set; 409 on mismatch |
| F5 | Recurring sessions flood Google Calendar (60 days × many ventures) | S3 | Medium | Sync cost, clutter | Horizon is configurable; sync is already per-user and best-effort |
| F6 | Cancelled generated sessions linger in calendars | S2 | Medium | People attend a cancelled meeting | Reuse the existing cancel path that pushes calendars; verify the sync deletes removed events `[U]` |
| F7 | Two reminder systems fire (rule engine + session notices) | S3 | High | Double email | Give sessions their own trigger in `venture_reminders`; do not add a second mailer |
| F8 | Memo edited after submission without trace | S1 | Medium | Disputed record | Freeze on submit; corrections create version N+1 |
| F9 | Commitments duplicate tasks | S2 | Medium | Two truths | `task_id` is the only bridge; creating a task from a commitment is one-way and idempotent |
| F10 | Scoped assignment hides part of the history from a successor | S2 | Medium | Incomplete handover | Handover requires a venture-wide assignment (state it in the UI) |
| F11 | Founders creating schedules or memos | S1 | Low | Confusion, or an audit trail owned by the venture | `calendar.schedule` for schedules; memo submission staff-only |
| F12 | Generated sessions violate booking rules (milestone missing) | S2 | Medium | Sweep failures | Generation requires a milestone on the schedule; validate before insert; report refusals, never drop silently |
| F13 | Cron secret reused for a new endpoint | S1 | Low | Unauthorised generation | Reuse `resolveSweepAuthorization`; no new secret |
| F14 | Performance: N ventures × 60 days | S3 | Low | Slow sweep | Batch per schedule; indexed `(schedule_id, occurrence_key)` |
| F15 | Historical sessions without a schedule | S3 | Certain | Confusing UI | `schedule_id` NULL means "booked by hand" and is shown as such |

---

## G. Implementation roadmap

| Phase | Content | Depends on | Priority |
|---|---|---|---|
| **P0** | ~~Session-note confidentiality~~ | — | **Done** (`5c751662d`) |
| **P1** | `venture_session_schedules` + exceptions schema; generator service; daily sweep; preview UI (read-only) that shows the next 8 occurrences **without creating anything** | — | **Highest** — the preview is how the pattern is agreed before it books anything |
| **P2** | Create / edit / pause / end schedule UI; materialisation enabled | P1 | High |
| **P3** | One-occurrence and from-here-on edits; exception rows; regenerate future | P2 | High |
| **P4** | `venture_engagement_record` (1:1, versioned, freeze on submit) + session types | P2 | High |
| **P5** | Commitments → `venture_tasks` (`task_id`), outstanding-commitments panel | P4 | Medium |
| **P6** | Engagement timeline read model + handover screen | P3–P5 | Medium |
| **P7** | Session reminders in `venture_reminders`; calendar polish (recurring marker, cancelled removal) | P2 | Low |

**Sequencing rule:** ship P1's preview before P2's generation. A recurring pattern that books before anyone has seen it is the one mistake this feature cannot take back.

---

## H. Decision register

### H.1 Answered by this brief (for confirmation)

| # | Decision | Answer | Confirmed? |
|---|---|---|---|
| D1 | Sessions as the foundation | Yes | Pending confirmation |
| D3 | Internal notes stay separate | Yes | Pending confirmation |
| D7 | Commitments use the existing Tasks board | Yes | Pending confirmation |
| D10 | Historical notes/memos preserved, not migrated | Yes | Pending confirmation |

### H.2 Still open from the previous register

| # | Decision | Options | Recommendation |
|---|---|---|---|
| D2 | Storage of the engagement record | (a) 1:1 table (b) columns on the session (c) stay free text | **(a)** — the memo is a document with its own lifecycle; a session is an event |
| D4 | Appended session notes | (a) fold into the record (b) keep separate | **(a)** for new notes; legacy rows stay readable |
| D5 | What founders see | (a) published summary only (b) whole record (c) nothing | **(a)**, with publishing an explicit staff act |
| D6 | Which engagements require a memo | (a) all (b) per type (c) optional | **(b)** — a `requirement_level` on the schedule and the session type |
| D8 | Who may create / edit / submit | (a) as today (b) staff-only authorship, author may correct before submit (c) author + manager | **(b)**; managers may publish summaries |
| D9 | Handover mechanics | (a) reassign the venture-wide assignment (b) copy assignments (c) manual | **(a)** with an open-commitments check |

### H.3 New decisions for recurring schedules

| # | Decision | Options | Recommendation | Trade-off |
|---|---|---|---|---|
| N1 | Where recurrence lives | (a) new schedule table + materialised sessions (b) RRULE text on each session (c) Google-side recurrence | **(a)** | (b) cannot express exceptions; (c) puts the truth outside the platform |
| N2 | Generation timing | (a) daily cron sweep (b) on read (c) on schedule save only | **(a)**, reusing the existing sweep pattern | (b) makes reads write; (c) goes stale |
| N3 | Horizon | (a) 30 days (b) 60 (c) 90 | **(b) 60**, configurable | more sessions to cancel when a pattern changes |
| N4 | Timezone helper | (a) `Intl` offset computation (b) add `date-fns-tz` (c) store wall-clock and convert at read | **(b)** if a dependency is acceptable, else (a) | (c) breaks on DST and on reports |
| N5 | Which timezone wins | (a) the schedule's zone (b) the venture's (c) each viewer's | **(a)**, defaulting to the venture's | viewer-time display is a separate presentation choice |
| N6 | Exception storage | (a) exception table (b) mutate the session only (c) delete the session | **(a)**, with the session status still updated | (b) loses the reason and the "was skipped" record |
| N7 | "Modify future" behaviour | (a) version the schedule (b) mutate in place | **(a)** | more rows, but a real history |
| N8 | Who may manage schedules | (a) `calendar.schedule` staff (b) any staff (c) plus founders | **(a)** | founders keep booking individual sessions |
| N9 | Reminder channel | (a) extend `venture_reminders` (b) new session reminder service | **(a)** | (b) duplicates the mailer and the dedupe log |
| N10 | Memo requirement by type | (a) type decides (b) schedule decides (c) both, schedule wins | **(c)** | one more field to explain |

---

## What this assessment does not claim

- It does not measure current usage volumes `[U]`.
- It does not assume Google Calendar removes deleted/cancelled events — that must be verified before P7 `[U]`.
- It does not decide D2/D4/D5/D6/D8/D9; those remain Future Studio's calls.
- It does not touch code, schema, migrations, records or permissions.
