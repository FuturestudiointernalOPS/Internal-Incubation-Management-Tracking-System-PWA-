import db from "@/lib/db";

/** Read only the requested switches from the existing platform flag store. */
export function selectInvestorFeatureFlags(keys) {
  if (!keys.length) return Promise.resolve({ rows: [] });
  return db.execute({
    sql: `SELECT flag_key, is_enabled FROM feature_flags
          WHERE flag_key IN (${keys.map(() => "?").join(", ")})`,
    args: keys,
  });
}
