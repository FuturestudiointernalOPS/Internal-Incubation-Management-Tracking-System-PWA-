import db from "@/lib/db";

/**
 * Returns the next available position for an ordered child row.
 * `table` and `parentColumn` are internal constants (never user input).
 */
export async function nextPosition(table, parentColumn, parentId) {
  const res = await db.execute({
    sql: `SELECT COALESCE(MAX(position), -1) + 1 AS next
          FROM ${table} WHERE ${parentColumn} = ?`,
    args: [parentId],
  });
  return res.rows[0]?.next ?? 0;
}

/** Group rows by a column value (string keys). */
export function groupBy(rows, column) {
  const map = new Map();
  for (const row of rows || []) {
    const key = String(row[column]);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(row);
  }
  return map;
}
