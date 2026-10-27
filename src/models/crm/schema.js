import db from "@/lib/db";

/**
 * CRM record schema — the additive columns the next action rides on.
 *
 * The house pattern (see `createContactTimelineEvent`'s neighbours and
 * `src/lib/db.js`): a multi-line migration file is the promotion record, and the
 * application also applies the same additive DDL on first use so an environment
 * that has not run the migration yet does not fail a write. Every statement is
 * `ADD COLUMN IF NOT EXISTS`, so re-running is free; the engine already dedupes
 * maintenance DDL once per process.
 *
 * Nothing here is destructive, and no existing column is touched.
 */

const STATEMENTS = [
  "ALTER TABLE crm_leads ADD COLUMN IF NOT EXISTS next_action TEXT",
  "ALTER TABLE crm_leads ADD COLUMN IF NOT EXISTS next_action_due TIMESTAMPTZ",
  "ALTER TABLE crm_leads ADD COLUMN IF NOT EXISTS next_action_set_by TEXT",
  "ALTER TABLE crm_leads ADD COLUMN IF NOT EXISTS next_action_set_at TIMESTAMPTZ",
  "ALTER TABLE crm_opportunities ADD COLUMN IF NOT EXISTS next_action TEXT",
  "ALTER TABLE crm_opportunities ADD COLUMN IF NOT EXISTS next_action_due TIMESTAMPTZ",
  "ALTER TABLE crm_opportunities ADD COLUMN IF NOT EXISTS next_action_set_by TEXT",
  "ALTER TABLE crm_opportunities ADD COLUMN IF NOT EXISTS next_action_set_at TIMESTAMPTZ",
];

let ensured = null;

/**
 * Apply the next-action columns once per process. A failed attempt is forgotten
 * so the next write retries instead of caching the failure forever.
 */
export function ensureCrmNextActionColumns() {
  if (!ensured) {
    ensured = (async () => {
      for (const statement of STATEMENTS) {
        await db.execute(statement);
      }
    })().catch((error) => {
      ensured = null;
      throw error;
    });
  }
  return ensured;
}
