# Program Participants — Source of Truth, Fix Proposal & Write-Side Strategy

> Status: **Audit + proposal only.** No code or database changes have been applied.
> Scope: Program → Participants view, Facilitator/participant separation, and account-status rules.

---

## 1. Executive Summary

The Program → Participants list is currently built from **three different tables merged together**, and two of those tables are intake/history tables — not actual membership. This causes two bugs:

1. **Facilitators appear as participants** (because a facilitator's contact gets a `contacts.program_id` backfilled, and the broad contact query then matches it).
2. **Form respondents appear as participants** (because intake tables are treated as membership).

The fix has two layers:

- **Temporary (read-side) fix** — change the Participants query to read only `participant_programs` + `contacts.status = 'active'` + exclude facilitators. This is a single, safe, no-migration change that corrects the UI immediately.
- **Sustainable (write-side) fix** — converge every "make this person a participant/facilitator" path onto the canonical tables and enforce the participant↔facilitator conflict at write time, so the bug cannot recur.

---

## 2. The Problem

```
Form submission
     ↓
Submission approved
     ↓
Contact exists / is created
     ↓
Activation invitation
     ↓
User activates account  →  status = ACTIVE
     ↓
Program participant becomes visible
```

Key rules:

- `pending` = not approved
- `approved` = approved but not activated
- `active` = activated, can use the platform
- `inactive` = disabled
- `archived` / `deleted` = no longer active

**Program Participants** must only include people who have:

1. A valid participant relationship with that program (`participant_programs`).
2. An `active` Contact account.
3. Not been assigned as a facilitator for that same program.
4. Not been deleted/archived.

Form submission alone is **not** participation. `v2_participants` alone is **not** participation. Password/email existence is **not** proof.

---

## 3. Current Architecture (Audit)

### 3.1 Trace

```
PM Program workspace ("Participants" tab)
   src/app/pm/programs/[id]/page.js
        ↓
GET /api/pm/full-state?id=<programId>&metrics=true
   src/app/api/pm/full-state/route.js
        ↓
Three queries merged into one list
```

### 3.2 The three current sources

| Source name | Table | Purpose today | Problem |
|---|---|---|---|
| `participants_v2` | `v2_participants` | Legacy intake registry | Not actual membership |
| `participants_contacts` | `contacts` (by `program_id` / `group_name`) | Broad contact match | Catches facilitators + any form submitter |
| `participants_enrolled` | `participant_programs` | Actual membership | Correct — but currently polluted by the other two |

### 3.3 Why a facilitator appears as a participant

`src/lib/contact-group-sync.js` — `reconcileProgramGroups()` (step 3) backfills `contacts.program_id` for facilitators:

```sql
UPDATE contacts c SET program_id = v.program_id
FROM (SELECT DISTINCT staff_id, program_id
      FROM v2_program_staff WHERE role = 'facilitator') v
WHERE c.cid = v.staff_id ...
```

Then `participants_contacts` matches `contacts.program_id = <program>` → the facilitator is returned as a participant.

### 3.4 Why form respondents appear as participants

- `participants_contacts` matches any contact whose `program_id` or `group_name` points at the program. `contact-group-sync` fills those fields for **any** form submitter.
- `participants_v2` contains intake rows regardless of real membership.

---

## 4. The Two Fix Strategies

### 4.1 TEMPORARY (Read-side) fix — correct the UI now

Change the Participants source in `GET /api/pm/full-state` to a **single** query:

```sql
SELECT
  CAST(c.cid AS TEXT) AS id,
  pp.program_id,
  c.name, c.email, c.phone,
  'approved' AS screening_status,
  c.status,
  c.created_at,
  c.group_name,
  'enrolled' AS source,
  c.v2_team_id
FROM participant_programs pp
JOIN contacts c ON pp.participant_id = c.cid
WHERE CAST(pp.program_id AS TEXT) = ?
  AND c.deleted = 0
  AND c.deleted_at IS NULL
  AND c.archived_at IS NULL
  AND LOWER(COALESCE(c.status, '')) = 'active'
  AND NOT EXISTS (
      SELECT 1 FROM v2_program_staff ps
      WHERE CAST(ps.program_id AS TEXT) = ?
        AND ps.role = 'facilitator'
        AND (ps.staff_id = c.cid
             OR LOWER(TRIM(ps.staff_id)) = LOWER(TRIM(c.email)))
  )
```

Align the participant **count** metric in `GET /api/pm/programs` to the same rule.

**Characteristics:**
- No migration, no data deletion.
- Fixes display immediately on deploy.
- History remains intact.
- Still leaves the underlying write-side inconsistency in place (the next regression can re-introduce the bug if a future flow writes to the wrong table).

### 4.2 SUSTAINABLE (Write-side) fix — prevent recurrence

Make the system converge on **one source of truth per relationship**:

```text
Participant  →  participant_programs   (participant_id, program_id)
Facilitator  →  v2_program_staff       (staff_id, program_id, role='facilitator')
Operational  →  contacts.status        (active / inactive / approved / pending / archived / deleted)
```

Concrete write-side changes:

1. **Every "enroll as participant" path writes `participant_programs`** (and stops relying on `v2_participants` / `contacts.program_id` as membership):
   - Form approval automation ✅ already writes it.
   - `contact-group-sync.fillGroupAndProgram` ✅ already writes it.
   - `pm/programs` PUT ✅ already writes it.
   - `public/register` (group link) ❌ currently writes `v2_participants` only → must also write `participant_programs` (or route through the form).
   - Legacy invite/registration flows ❌ write `v2_participants` → must converge.

2. **Every "assign as facilitator" path writes `v2_program_staff`** and enforces the conflict:
   - `facilitators/invite-bulk` must reject if the person already has a `participant_programs` row for the same program.

3. **One contextual-role resolver** used by all readers (CRM contact detail, program tree, facilitator panel), so display never re-implements membership logic.

4. **Deprecate as membership sources (keep as intake/history/primary-label only):**
   - `v2_participants`
   - `contacts.program_id`
   - `contacts.group_name`

5. **`contacts.role` / `group_name` / `program_id` remain "primary display" fields only** — never the source of truth for program membership.

**Characteristics:**
- Durable: the bug cannot recur because there is only one place to look.
- Larger: touches multiple entry points, needs careful regression testing.

---

## 5. Recommended Phased Plan

| Phase | What | Risk | When |
|---|---|---|---|
| **1 — Read-side fix** | Single participant query + count alignment + total count label | Low | Now |
| **2 — Conflict guard** | Reject participant↔facilitator in `invite-bulk` (symmetric to existing participant-side guard) | Low | Now |
| **3 — Manual reconciliation** | Idempotent SQL to remove conflicting `participant_programs` rows (kept for you to run) | None (manual) | After Phase 1 |
| **4 — Write-side convergence** | All participant entry paths write `participant_programs`; deprecate `v2_participants` as membership | Medium | Next sprint |
| **5 — Single resolver** | One role/membership resolver used by all UI | Low | After Phase 4 |

---

## 6. Data Reconciliation (manual SQL — NOT executed)

Read-side filtering hides wrong rows without deleting anything. The following clean up **physically conflicting** membership rows. Run manually, in order, idempotent.

```sql
-- 1. Inspect conflicts (person is BOTH participant and facilitator in same program)
SELECT ps.program_id, ps.staff_id, c.name, c.email
FROM v2_program_staff ps
JOIN contacts c
  ON (ps.staff_id = c.cid OR LOWER(TRIM(ps.staff_id)) = LOWER(TRIM(c.email)))
JOIN participant_programs pp
  ON pp.participant_id = c.cid
 AND pp.program_id::text = ps.program_id::text
WHERE ps.role = 'facilitator';

-- 2. Remove the participant membership where the person is a facilitator
--    (keeps facilitator role; idempotent)
DELETE FROM participant_programs pp
USING v2_program_staff ps, contacts c
WHERE ps.role = 'facilitator'
  AND pp.program_id::text = ps.program_id::text
  AND c.cid = pp.participant_id
  AND (ps.staff_id = c.cid OR LOWER(TRIM(ps.staff_id)) = LOWER(TRIM(c.email)));
```

> Do **not** run this against production automatically. Review first.

---

## 7. Acceptance Criteria

- [ ] Facilitators never appear as Participants in the same program.
- [ ] Form respondents are not automatically active participants.
- [ ] Only `active` Contact accounts appear in operational Participants.
- [ ] `approved` (waiting activation) does not appear as active participant.
- [ ] `inactive` users disappear from operational participant lists.
- [ ] `archived` / `deleted` users excluded.
- [ ] Participant and Facilitator membership remain program-specific.
- [ ] A person can be Facilitator in Program A and Participant in Program B.
- [ ] A person cannot be Participant and Facilitator in Program A simultaneously.
- [ ] Disabling a Contact does not delete historical data.
- [ ] Completed programs retain historical records (View Only model).
- [ ] No duplicate participant system is introduced.
- [ ] No destructive database changes are made automatically.
- [ ] Manual SQL is provided and idempotent, not auto-executed.

---

## 8. Risks

| Risk | Mitigation |
|---|---|
| Legacy flows still write `v2_participants` and drift | Phase 4 write-side convergence |
| Read-side fix hides but does not clean conflicts | Phase 3 manual SQL |
| `contacts.program_id` / `group_name` still treated as membership by other pages | Phase 5 single resolver |
| Facilitator conflict only enforced one-way | Phase 2 symmetric guard |
