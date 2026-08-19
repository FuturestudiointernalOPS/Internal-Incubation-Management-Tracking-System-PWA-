# ADR — Assignment & Access Model

**Status:** Proposed (analysis complete — not yet implemented beyond the schema migration)

**Scope:** How a person gets contextual responsibilities (program roles, titles, capabilities, scope, status) without turning every responsibility into a global `contacts.role`.

---

## 1. Context

Future Studio needs to assign a person to a context with a title and a capability set:

```text
John → Program A → "Coach" → { participants.view, sessions.conduct, … } → Groups 1+2 → Active
```

A person must be able to exist and log in with **no** assignment (neutral `member`), then later be assigned to a program, group, or other context. The assignment must not change their global role.

Today the data model already has the right pieces, but they are split across tables and partially wired:

| Table | Role today |
|-------|-----------|
| `contacts` | identity + global role (`contacts.role`) |
| `participant_programs` | membership: person ↔ program (authoritative) |
| `v2_program_staff` | program-scoped staff: `role` (title) + `permissions` (capabilities) |
| `contact_roles` | contextual assignment (generalized; currently mirroring `v2_program_staff`) |
| `access_profiles` / `access_profile_capabilities` | permission templates (not yet wired to assignments) |
| `families` | groups, with `program_id` (group → program link) |
| `contact_group_members` | many-to-many group membership |

### Known gaps

1. **Title is hardcoded.** The assignment UI (`src/app/admin/programs/page.js`) only offers `role: "facilitator"` with facilitator-specific capabilities. The data model supports "Coach"/"Mentor"/any title, but no UI exposes it.
2. **Group → program is read-time only.** Adding a person to a group does **not** write `participant_programs`; the program link is derived via a legacy `group_name` fallback in `src/lib/participant-membership.js`. It works for display but is not durable/authoritative.
3. **`access_profiles` is not connected.** Templates exist, but assignments don't reference them.
4. **Two assignment sources.** `v2_program_staff` and `contact_roles` both hold assignment state; they are mirrored manually in `src/app/api/program-staff/route.js`.

---

## 2. Decision

**Converge on `contact_roles` as the single source of truth for contextual assignments.**

- `contacts` = identity + global role only.
- `participant_programs` = membership ("is this person in this program?").
- `contact_roles` = assignment ("what title, capabilities, scope, and status in this context?").
- `access_profiles` = reusable capability templates referenced by assignments.
- `v2_program_staff` = legacy mirror, kept for backward compatibility during transition.

No new "assignments" table. No new permission engine.

---

## 3. Target data model

### `contact_roles` (already migrated)

The schema is already in place via `supabase/migrations/20260819_participant_cleanup_all.sql`:

```sql
CREATE TABLE IF NOT EXISTS contact_roles (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_cid         TEXT NOT NULL REFERENCES contacts(cid) ON DELETE CASCADE,
    role                TEXT NOT NULL,               -- canonical type (legacy: 'facilitator')
    context_type        TEXT,                        -- 'program' | 'group' | 'finance' | 'crm' | 'global' …
    context_id          TEXT,                        -- program_id / group_id / module key
    is_current          BOOLEAN DEFAULT true,
    started_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at            TIMESTAMPTZ,
    assigned_by         TEXT,                        -- contacts.cid of who assigned
    notes               TEXT,
    created_at          TIMESTAMPTZ DEFAULT NOW(),

    -- Generalized assignment columns (added by the cleanup migration)
    title               TEXT,                        -- display title: Facilitator / Coach / Mentor / Auditor
    scope               JSONB NOT NULL DEFAULT '{}', -- {"type":"program","groups":[...]} etc.
    status              TEXT NOT NULL DEFAULT 'active',  -- active / suspended / removed
    access_profile_id   INTEGER REFERENCES access_profiles(id) ON DELETE SET NULL,
    capability_overrides JSONB NOT NULL DEFAULT '{}'  -- { capability: level }
);
```

Relevant index (already in the migration):

```sql
CREATE INDEX IF NOT EXISTS idx_contact_roles_assignment
  ON contact_roles (contact_cid, context_type, context_id)
  WHERE is_current = true;
```

### `access_profiles` = templates

- `access_profiles` (name, description, is_active)
- `access_profile_capabilities` (profile_id, module, capability, access_level)

An assignment can either reference a profile (`access_profile_id`) or carry its own `capability_overrides` (or both: profile + overrides).

### `participant_programs` = membership (unchanged)

Membership stays separate from assignment. A "Coach" can also be a `participant_programs` member; the two answers are orthogonal.

---

## 4. API surface (target)

Extend the existing routes rather than create parallel ones.

| Endpoint | Purpose |
|----------|---------|
| `POST /api/contact-roles` | create a contextual assignment (`contact_cid`, `context_type`, `context_id`, `title`, `scope`, `status`, `access_profile_id?`, `capability_overrides?`) |
| `PUT /api/contact-roles` | update title / capabilities / scope / status (flip `is_current`, set `ended_at` when removed) |
| `GET /api/contact-roles?contact_cid=&context_type=&context_id=` | read current assignments |
| `POST /api/program-staff` | **keep** as the program-scoped facade; write `v2_program_staff` + mirror to `contact_roles` (already done), but accept arbitrary `title` + `capability_overrides` |
| `PUT /api/program-staff` | same — accept title/permissions, mirror to `contact_roles` |
| `DELETE /api/program-staff` | remove from `v2_program_staff` and mark `contact_roles` `is_current=false, status='removed', ended_at=NOW()` (already done) |
| `POST /api/contact-groups` | add person to group; if `families.program_id` is set, also write `participant_programs` |

The `/api/workspaces` reader already returns `v2_program_staff` + `participant_programs`; it should be extended to also read `contact_roles` (so titles/capabilities/status drive the workspace list and gating).

---

## 5. Implementation phases (additive, reversible)

### Phase 1 — `contact_roles` as the write path
- Generalize `POST/PUT /api/program-staff` to accept `title` (Facilitator/Coach/Mentor/custom) and `capability_overrides` (falling back to `buildFullFacilitatorPermissions()` for "facilitator").
- Add a small `POST/PUT /api/contact-roles` endpoint (thin wrapper over the same `contact_roles` writes).
- Keep writing `v2_program_staff` for backward compatibility.

### Phase 2 — Title + capability UI
- In `src/app/admin/programs/page.js`, replace the hardcoded `role: "facilitator"` with a title dropdown.
- Drive the capability matrix from `access_profiles` templates (with per-assignment overrides) instead of the hardcoded `FACILITATOR_CAPS`.

### Phase 3 — Close the group → program gap
- In `src/lib/contact-groups.js` (`addContactToGroup`), when the group's `families.program_id` is set, also `INSERT INTO participant_programs … ON CONFLICT DO NOTHING`.
- Centralize in `src/lib/contact-group-sync.js` so "add to group" = "group membership + program membership" idempotently.

### Phase 4 — Wire `access_profiles`
- `access_profiles` becomes the template store; an assignment references a profile and can override specific capabilities.

### Phase 5 — Retire `v2_program_staff` (only when safe)
- Move all readers (workspaces, calendar, facilitator routing, reports) to `contact_roles`.
- `v2_program_staff` becomes a legacy mirror that can be removed.

---

## 6. Consequences

**Positive**
- One assignment source of truth, scope-agnostic (`context_type`), so Finance/CRM/Marketing/auditors can be added later without a rebuild.
- Global `contacts.role` stays clean (Super Admin / Staff / Member), while responsibilities stay contextual.
- History preserved (`is_current`, `started_at`, `ended_at`).
- Reuses existing `contact_roles`, `access_profiles`, and the already-written migration.

**Negative / trade-offs**
- A transition period where `v2_program_staff` and `contact_roles` must stay in sync (mitigated by keeping the mirror in `/api/program-staff`).
- Migration/backfill risk if existing `v2_program_staff` data is inconsistent (mitigated by the idempotent backfill already in the migration).
- Reader migration (workspaces, calendar, etc.) must be done carefully to avoid regressions.

---

## 7. What must NOT change

- `contacts.role` — keep as global role; do not add "Coach"/"Mentor"/"Facilitator" as global roles.
- `participant_programs` — keep as membership; do not fold titles/capabilities into it.
- `access_profiles` + `access_profile_capabilities` — keep as templates; do not build a second permission engine.
- Existing facilitator records and history — do not delete/recreate; the migration is additive/idempotent.

---

## 8. Acceptance criteria (for the "John as Coach" flow)

1. Admin can find John, assign him to Program A with title "Coach".
2. Admin can select Coach capabilities (from a template) and optionally override them.
3. `contacts.role` remains `member`.
4. John's workspace shows Program A → Coach, with only the granted capabilities.
5. Adding John to Group B (linked to Program B) automatically writes `participant_programs` so Program B appears.
6. Removing the assignment marks it `is_current=false, status='removed'` without deleting John or his account.
7. Super Admin can manage all of the above; Engineering does not become a blanket role.

---

## 9. Open questions

- Is `role` (canonical) vs `title` (display) both needed, or should `title` become the single label?
- Should membership (`participant_programs`) also be represented as a `contact_roles` row of `context_type='program'`, `title='participant'` — or stay a dedicated table? (Recommendation: stay a dedicated table for performance/simplicity.)
- What is the canonical capability catalog (`module.capability`) and access levels, so templates and overrides share one vocabulary?
