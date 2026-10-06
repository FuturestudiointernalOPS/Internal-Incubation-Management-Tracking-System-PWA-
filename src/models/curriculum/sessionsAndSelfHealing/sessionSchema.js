import db from "@/lib/db";

// ── Schema self-healing (idempotent DDL guards) ──────────────────────────────

/** Session versioning — `version` column on v2_sessions. */
export async function addSessionVersionColumn() {
  return db.execute({
    sql: "ALTER TABLE v2_sessions ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1",
    args: [],
  });
}

/** Session versioning — `timezone` column on v2_sessions. */
export async function addSessionTimezoneColumn() {
  return db.execute({
    sql: "ALTER TABLE v2_sessions ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'UTC'",
    args: [],
  });
}

/** Session versioning — snapshot table for pre-update session rows. */
export async function createSessionVersionsTable() {
  return db.execute({
    sql: `CREATE TABLE IF NOT EXISTS v2_session_versions (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        session_id UUID NOT NULL,
        version INTEGER NOT NULL,
        snapshot JSONB NOT NULL,
        changed_by TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`,
    args: [],
  });
}

/** Requirements — optional PM-provided resource-link `resource_url` column. */
export async function addRequirementResourceUrlColumn() {
  return db.execute({
    sql: "ALTER TABLE v2_document_requirements ADD COLUMN IF NOT EXISTS resource_url TEXT",
    args: [],
  });
}

/** Requirements — optional PM-provided resource-link `resource_label` column. */
export async function addRequirementResourceLabelColumn() {
  return db.execute({
    sql: "ALTER TABLE v2_document_requirements ADD COLUMN IF NOT EXISTS resource_label TEXT",
    args: [],
  });
}

/** Requirements — `assignee_type` column (attendance/system requirements). */
export async function addRequirementAssigneeTypeColumn() {
  return db.execute({
    sql: "ALTER TABLE v2_document_requirements ADD COLUMN IF NOT EXISTS assignee_type TEXT",
    args: [],
  });
}

/** Requirements — `assignee_id` column (attendance/system requirements). */
export async function addRequirementAssigneeIdColumn() {
  return db.execute({
    sql: "ALTER TABLE v2_document_requirements ADD COLUMN IF NOT EXISTS assignee_id TEXT",
    args: [],
  });
}
