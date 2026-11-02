import db from "@/lib/db";

let schemaEnsured = false;

/**
 * Ensure the venture_broadcasts table exists (idempotent).
 */
export async function ensureVentureBroadcastsTable() {
  if (schemaEnsured) return;
  await db.execute(`
    CREATE TABLE IF NOT EXISTS venture_broadcasts (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      form_run_slug TEXT NOT NULL,
      form_run_id INTEGER,
      target_scope TEXT NOT NULL DEFAULT 'all', -- 'all', 'segment', 'custom'
      target_segment TEXT, -- e.g. 'incubation', 'acceleration', 'soft_landing'
      target_venture_ids JSONB DEFAULT '[]'::jsonb,
      message TEXT,
      button_text TEXT DEFAULT 'Complete Census',
      is_active BOOLEAN DEFAULT TRUE,
      created_by TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_venture_broadcasts_active ON venture_broadcasts(is_active);
  `);
  // Also ensure venture_id column on platform_form_submissions
  await db.execute(`
    ALTER TABLE platform_form_submissions ADD COLUMN IF NOT EXISTS venture_id TEXT;
  `);
  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_form_submissions_venture ON platform_form_submissions(venture_id);
  `);
  schemaEnsured = true;
}

/**
 * Get active broadcasts.
 */
export async function selectActiveBroadcasts() {
  await ensureVentureBroadcastsTable();
  return db.execute({
    sql: "SELECT * FROM venture_broadcasts WHERE is_active = TRUE ORDER BY created_at DESC",
    args: [],
  });
}

/**
 * Get all broadcasts (for Super Admin management).
 */
export async function selectAllBroadcasts() {
  await ensureVentureBroadcastsTable();
  return db.execute({
    sql: "SELECT * FROM venture_broadcasts ORDER BY created_at DESC",
    args: [],
  });
}

/**
 * Insert a new venture broadcast.
 */
export async function insertVentureBroadcast({
  title,
  form_run_slug,
  form_run_id,
  target_scope = "all",
  target_segment = null,
  target_venture_ids = [],
  message = null,
  button_text = "Complete Census",
  created_by = "admin",
}) {
  await ensureVentureBroadcastsTable();
  return db.execute({
    sql: `INSERT INTO venture_broadcasts 
            (title, form_run_slug, form_run_id, target_scope, target_segment, target_venture_ids, message, button_text, is_active, created_by)
          VALUES (?, ?, ?, ?, ?, ?::jsonb, ?, ?, TRUE, ?) RETURNING *`,
    args: [
      title,
      form_run_slug,
      form_run_id || null,
      target_scope,
      target_segment,
      JSON.stringify(target_venture_ids || []),
      message,
      button_text,
      created_by,
    ],
  });
}

/**
 * Update broadcast status (activate/deactivate).
 */
export async function updateBroadcastStatus(id, isActive) {
  await ensureVentureBroadcastsTable();
  return db.execute({
    sql: "UPDATE venture_broadcasts SET is_active = ?, updated_at = NOW() WHERE id = ? RETURNING *",
    args: [isActive, id],
  });
}

/**
 * Check if a venture has already submitted for a specific run.
 */
export async function checkVentureSubmissionForRun(runId, runSlug, ventureId) {
  await ensureVentureBroadcastsTable();
  let sql = `
    SELECT id, status, submitted_at, data
    FROM platform_form_submissions
    WHERE (
      (venture_id = ? OR data->>'venture_id' = ? OR data->>'Startup Name' ILIKE ? OR data->>'startup_name' ILIKE ?)
      AND (run_id = ? OR run_id IN (SELECT id FROM platform_form_runs WHERE public_slug = ?))
      AND status != 'draft'
    )
    LIMIT 1
  `;
  return db.execute({
    sql,
    args: [String(ventureId), String(ventureId), `%${ventureId}%`, `%${ventureId}%`, parseInt(runId) || -1, String(runSlug)],
  });
}
