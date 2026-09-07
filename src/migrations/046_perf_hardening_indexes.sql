-- =============================================================================
-- PERFORMANCE & SCALABILITY HARDENING — ADDITIVE INDEXES
-- -----------------------------------------------------------------------------
-- Phase 11. Purely additive. Never drops or alters existing indexes. Safe to
-- re-run. Each index targets a high-frequency filter/order column identified
-- during the scalability audit. No table restructuring, no data changes.
-- =============================================================================

BEGIN;

-- contacts: the two flag columns every contact list filters on, plus the
-- ORDER BY name ASC used by the two largest CRM scans. A composite on
-- (deleted_at, archived_at, name) satisfies filter+sort in one pass.
CREATE INDEX IF NOT EXISTS idx_contacts_deleted_archived_name
    ON contacts (deleted_at, archived_at, name);

-- contacts: the role/status filter used by the pending-approvals list and
-- role-scoped CRM views.
CREATE INDEX IF NOT EXISTS idx_contacts_role_status
    ON contacts (role, status);

-- tasks: the grouped batched counts filter by status within an intent
-- (active/completed). Complements the existing idx_tasks_intent.
CREATE INDEX IF NOT EXISTS idx_tasks_intent_status
    ON tasks (intent_id, status);

-- families/groups list: the group selector and segments view ORDER BY name
-- over the full families table.
CREATE INDEX IF NOT EXISTS idx_families_name
    ON families (name);

-- blockers: the admin/projects/[id] and admin/tasks batched queries join on
-- task_id and order by created_at DESC. Complements idx_blockers_task_status.
CREATE INDEX IF NOT EXISTS idx_blockers_task_created
    ON blockers (task_id, created_at DESC);

COMMIT;
