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

/**
 * A course's PUBLIC NAME, built from its title: lowercased, accents folded to
 * their plain letters, and anything that is not a letter or a digit collapsed
 * to a single dash. This is the name the outside world addresses a course by
 * (the public URLs the site follows), so it must read like the title while
 * staying safe inside a web address.
 */
export function courseSlugFrom(title) {
  const slug = String(title || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
  // A title made only of symbols still needs a usable name.
  return slug || "course";
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
