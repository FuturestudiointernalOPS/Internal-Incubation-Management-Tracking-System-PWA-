# Venture OS — Canonical Spine vs Legacy Map (Vinance 3, Phase 1)

Status: **Phase 1 — canonical path frozen; legacy systems quarantined.**

This document is the single reference for what is canonical in the Venture OS
and what is legacy. New feature work MUST use the canonical path. Legacy
systems remain readable/functional where existing pages use them — nothing is
deleted. Deprecation/removal is a later-phase decision and requires this map
to be updated first.

## Canonical spine (use for all new work)

```
venture_journey_stages          Journey roadmap (locked | active | completed)
        ↓ journey_stage_id (UUID, soft ref)
venture_milestones              Milestone units of progress
        ↓ milestone_id (UUID)
venture_tasks                   Task work (board statuses + review outcomes)
        ↓ task_id
venture_task_submissions        Append-only versions; staff review
        (approved | changes_requested)
```

- Journey authoring: `src/lib/ventureJourneys.js`, journey API under
  `/api/ventures/[id]/journey` (+ `/journey/apply-template`,
  `/journey/duplicate`).
- Duplication: `src/lib/ventureDuplication.js` + `/journey/duplicate`,
  `/milestones/duplicate`, `/tasks/duplicate` (structure-only copies;
  submissions/reviews/history stay with the source).
- Status vocabulary (single source of truth):
  `src/lib/ventureStatuses.js` — read layers/guards import from here.
- Schema evolution: additive, idempotent ALTERs ONLY, inside
  `ensureVentureSchema()` (`src/lib/ventures.js`). No drops/renames/type
  conversions. Soft refs (TEXT/UUID without FKs) keep both milestone DDL
  generations compatible.
- Task reviews: `venture_task_reviews` (decision: accepted | rejected |
  revision_requested) — review *record*, complementing submissions.
- Permissions: global matrix `venture_permission_matrix` + per-Venture
  `venture_staff_assignments`; journey writes gate on the `operating_plan`
  capability area.

## Quarantined (legacy — no new feature work)

| System | Tables | Notes / disposition |
|---|---|---|
| Playbook template snapshots | `venture_playbook_templates`, `venture_playbook_template_stages`, `venture_playbook_stage_milestones`, `venture_milestone_templates`, `venture_task_templates`, `venture_playbook_instances`, `venture_playbook_instance_stages` | Older snapshot-style template system (`src/lib/ventureTemplates.js`). Superseded by operating-plan templates + journey templates. Reads preserved; do not extend. |
| Milestone-level deliverables | `venture_deliverables`, `venture_deliverable_reviews`, `venture_milestone_activity` | Legacy (milestone-level) deliverable flow. Canonical task-level flow is `venture_task_submissions`. Existing screens that read these keep working. |
| Venture timeline events | `venture_timeline_events`, `venture_dependencies` | Older Gantt/event source; journey GET + calendar drive the current timeline surfaces. Do not extend. |
| Coach catalog (standalone) | `venture_coaches`, `venture_coach_assignments`, `venture_coach_availability`, `venture_coach_activity`, `venture_mentor_feedback`, `venture_mentor_analytics` | Track-era coaching tables. Current operating surfaces use staff assignments + facilitator reviews. Reads preserved. |
| Standups / retros / blockers (venture copies) | `venture_standups`, `venture_retros`, `venture_blockers` | Track 3 rituals ported onto ventures; kept for existing pages. |
| Old activity log | `venture_activity_log` | Superseded by `venture_history` for journey/operating events. |

## Notes

- Statuses across legacy tables are NOT normalized by `ventureStatuses.js` —
  the canonical vocabulary only governs the canonical spine tables above.
- If a screen must read both a canonical table and a quarantined table, treat
  the canonical table as authoritative and reconcile in the read layer.
- Delete any table only after confirming zero readers (grep `src/`, check
  `scripts/`, `supabase/`) and record the removal here.

## Vinance 3 additions (Phases 2–3)

- `venture_sessions` context columns (`journey_stage_id`, `milestone_ref`,
  `task_id`, `preparation_notes`, `venture_facing`) are canonical — sessions
  are Journey-connected by design.
- Readiness/reporting read layers: `src/lib/ventureReadiness.js` and the
  `/journey-report` + `/venture-history` endpoints read ONLY canonical spine
  tables (plus `venture_history` / `venture_notes` / session records, which
  are append-only sources of institutional memory).
- `venture_timeline_events` stays quarantined: roadmap visualizations should
  derive from journey stages → milestones → tasks (see `journey-report`),
  not from the legacy event table.
