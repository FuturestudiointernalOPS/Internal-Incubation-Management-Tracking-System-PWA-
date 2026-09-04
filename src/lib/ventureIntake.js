import db, { initDb } from "@/lib/db";

/**
 * VENTURE INTAKE GOVERNANCE (Phase 1)
 *
 * Single-active Venture intake enforcement.
 *
 * The Venture intake stays on the existing Forms/Runs architecture:
 * a form is designated the Venture Application via
 * settings.venture_application = true (the flag is KEPT — it is valid).
 * What this module enforces is that AT MOST ONE form can hold that flag:
 *   - API guard  : assertSingleVentureForm() before any write that would
 *                  set the flag to true (forms API, seed, CLI script).
 *   - DB backstop: ensureSingleVentureFormIndex() creates a partial unique
 *                  index so the database itself rejects a second flagged row.
 *
 * No data cleanup happens here. If legacy data already contains multiple
 * flagged forms, the index creation is skipped with a warning and the API
 * guard still prevents NEW duplicates.
 */

export async function getActiveVentureForms() {
  await initDb();
  try {
    const res = await db.execute({
      sql: `SELECT id, name, status, settings FROM platform_forms
            WHERE settings->>'venture_application' = 'true'
            ORDER BY id ASC`,
      args: [],
    });
    return res.rows || [];
  } catch (_) {
    return [];
  }
}

/**
 * Returns { ok: true } if no OTHER form currently holds the Venture flag,
 * otherwise { ok: false, owner: { id, name } }.
 */
export async function assertSingleVentureForm(excludeFormId = null) {
  const rows = await getActiveVentureForms();
  const owner = rows.find((r) => String(r.id) !== String(excludeFormId));
  if (owner) {
    return { ok: false, owner: { id: owner.id, name: owner.name || `#${owner.id}` } };
  }
  return { ok: true };
}

/**
 * DB-level backstop: at most one row may hold settings->>'venture_application'
 * = 'true'. The index expression is constant for every included row, so
 * uniqueness on it allows only one row.
 *
 * If legacy duplicates exist the index cannot be created — we warn loudly
 * (never delete or modify data here) and rely on the API guard.
 */
export async function ensureSingleVentureFormIndex() {
  await initDb();
  try {
    await db.execute({
      sql: `CREATE UNIQUE INDEX IF NOT EXISTS idx_platform_forms_single_venture_flag
            ON platform_forms ((settings->>'venture_application'))
            WHERE settings->>'venture_application' = 'true'`,
      args: [],
    });
    return true;
  } catch (e) {
    console.warn(
      "[Venture Intake] Single-flag unique index NOT created. Multiple forms may currently hold the Venture flag — clear the extra flags, then re-run. Reason:",
      e.message,
    );
    return false;
  }
}

export default {
  getActiveVentureForms,
  assertSingleVentureForm,
  ensureSingleVentureFormIndex,
};
