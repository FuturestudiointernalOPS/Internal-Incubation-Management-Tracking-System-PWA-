/**
 * Authorization — historical access reads (REPOSITORY layer).
 *
 * The single read behind the historical retention policy (Phase 7, D3): the
 * `system_settings` row that carries `historical_access_retention`. The policy
 * itself is pure and lives in `@/services/authorization/historicalAccess`; this
 * module only fetches the stored value.
 *
 * Layer rules (see docs/LAYER_SPLIT.md): no HTTP, one function per statement,
 * no decisions. A missing table/row is reported by an empty result; the caller
 * falls back to the default retention.
 */

import db from "@/lib/db";

/** One system setting's stored value (or no rows when unset). */
export function getSystemSettingValue(settingKey) {
  return db.execute({
    sql: "SELECT setting_value FROM system_settings WHERE setting_key = ?",
    args: [String(settingKey)],
  });
}
