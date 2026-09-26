import db, { initDb } from "@/lib/db";

/**
 * INVESTOR INTAKE GOVERNANCE
 *
 * Single-active Investor intake enforcement — the exact mirror of the Venture
 * intake (see `src/models/ventureIntake.js`).
 *
 * The Investor intake stays on the existing Forms/Runs architecture: a form is
 * designated the Investor Application via settings.investor_application = true.
 * What this module enforces is that AT MOST ONE form can hold that flag:
 *   - API guard  : assertSingleInvestorForm() before any write that would set
 *                  the flag to true (forms API, seed).
 *   - DB backstop: ensureSingleInvestorFormIndex() creates a partial unique
 *                  index so the database itself rejects a second flagged row.
 *
 * No data cleanup happens here. If legacy data already contains multiple
 * flagged forms, the index creation is skipped with a warning and the API
 * guard still prevents NEW duplicates.
 */

export async function getActiveInvestorForms() {
  await initDb();
  try {
    const result = await db.execute({
      sql: `SELECT id, name, status, settings FROM platform_forms
            WHERE settings->>'investor_application' = 'true'
            ORDER BY id ASC`,
      args: [],
    });
    return result.rows || [];
  } catch (_) {
    return [];
  }
}

/**
 * Returns { ok: true } if no OTHER form currently holds the Investor flag,
 * otherwise { ok: false, owner: { id, name } }.
 */
export async function assertSingleInvestorForm(excludeFormId = null) {
  const rows = await getActiveInvestorForms();
  const owner = rows.find((row) => String(row.id) !== String(excludeFormId));
  if (owner) {
    return { ok: false, owner: { id: owner.id, name: owner.name || `#${owner.id}` } };
  }
  return { ok: true };
}

/**
 * DB-level backstop: at most one row may hold settings->>'investor_application'
 * = 'true'. The index expression is constant for every included row, so
 * uniqueness on it allows only one row.
 */
export async function ensureSingleInvestorFormIndex() {
  await initDb();
  try {
    await db.execute({
      sql: `CREATE UNIQUE INDEX IF NOT EXISTS idx_platform_forms_single_investor_flag
            ON platform_forms ((settings->>'investor_application'))
            WHERE settings->>'investor_application' = 'true'`,
      args: [],
    });
    return true;
  } catch (error) {
    console.warn(
      "[Investor Intake] Single-flag unique index NOT created. Multiple forms may currently hold the Investor flag — clear the extra flags, then re-run. Reason:",
      error.message,
    );
    return false;
  }
}

export default {
  getActiveInvestorForms,
  assertSingleInvestorForm,
  ensureSingleInvestorFormIndex,
};
