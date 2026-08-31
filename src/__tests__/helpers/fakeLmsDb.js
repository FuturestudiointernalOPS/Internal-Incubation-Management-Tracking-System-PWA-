/**
 * Fake LMS database for route/service tests.
 *
 * An in-memory interpreter that understands the exact queries the LMS
 * services issue, so the REAL services + routes run end-to-end against it.
 *
 * Supported:
 *   - SELECT (single/multi `col = ?`, `col IN (...)`, optional ORDER BY)
 *   - INSERT ... RETURNING * (literal values + `?` args)
 *   - INSERT ... ON CONFLICT (...) DO NOTHING
 *   - UPDATE (SET `col = ?`, `col = 'literal'`, `col = NOW()`,
 *     `position = -1`, `completed_at = COALESCE(...)`)
 *   - DELETE ... WHERE id = ? (with minimal cascade)
 *   - guard queries (SELECT 1 ... LIMIT 1)
 *   - neighbor lookups (SELECT id, position ... WHERE parent = ? AND position <|> ?)
 *   - next-value queries (SELECT COALESCE(MAX(col), -1) + 1 ...) — used for
 *     section/lesson ordering AND assessment attempt numbering
 *
 * Rows returned to services are immutable snapshots (real-DB semantics):
 * the service may hold references to pre-update rows, and an UPDATE must not
 * mutate those in place (this corrupted the position-swap algorithm once).
 */

const TABLES = [
  "lms_courses",
  "lms_course_sections",
  "lms_lessons",
  "lms_assessments",
  "lms_assessment_questions",
  "lms_enrollments",
  "lms_lesson_progress",
  "lms_assessment_attempts",
  "lms_certificates",
  "lms_program_requirements",
  "v2_programs",
  "participant_programs",
  "contacts",
];

// Column defaults applied when an INSERT omits a column (mirrors the real
// schema's DEFAULT clauses so inserted rows look like real-DB rows).
const TABLE_DEFAULTS = {
  lms_certificates: { status: "valid" },
};

export function createFakeDb() {
  let state = Object.fromEntries(TABLES.map((t) => [t, []]));
  let seq = 1;
  const executed = [];
  let handler = interpreter;

  function seed(table, rows) {
    state[table].push(...rows);
  }

  function reset() {
    state = Object.fromEntries(TABLES.map((t) => [t, []]));
    seq = 1;
    executed.length = 0;
    handler = interpreter;
  }

  function setHandler(fn) {
    handler = fn;
  }

  function rowFor(table) {
    const row = { id: `${table.replace(/^lms_/, "LMS-").replace(/_/g, "-")}-${seq++}` };
    row.created_at = "2026-08-27T00:00:00Z";
    row.updated_at = "2026-08-27T00:00:00Z";
    return row;
  }

  function insert(sql, args) {
    const table = /insert into (\w+)/i.exec(sql)[1];
    const columns = /\(([^)]+)\)\s*VALUES/i.exec(sql)[1]
      .split(",")
      .map((c) => c.trim());
    const valueTokens = /VALUES\s*\(([^)]+)\)/i.exec(sql)[1]
      .split(",")
      .map((t) => t.trim());

    const row = rowFor(table);
    let argIndex = 0;
    columns.forEach((column, i) => {
      const token = valueTokens[i] || "?";
      if (token === "?" || token.startsWith("?")) {
        row[column] = args[argIndex++];
      } else {
        row[column] = token.replace(/^'|'$/g, "");
      }
    });
    // Apply schema defaults for omitted columns (e.g. certificate status).
    for (const [col, val] of Object.entries(TABLE_DEFAULTS[table] || {})) {
      if (row[col] === undefined) row[col] = val;
    }

    if (/on conflict/i.test(sql)) {
      const conflictMatch = /on conflict \(([^)]+)\)/i.exec(sql);
      const conflictCols = conflictMatch
        ? conflictMatch[1].split(",").map((c) => c.trim())
        : [];
      const existing = state[table].find((r) =>
        conflictCols.every((c) => String(r[c]) === String(row[c])),
      );
      if (existing) return { rows: [existing] }; // DO NOTHING
    }

    state[table].push(row);
    return { rows: [row] };
  }

  function update(sql, args) {
    const table = /^update (\w+)/i.exec(sql)[1];
    const id = args[args.length - 1];
    const row = state[table].find((r) => String(r.id) === String(id));
    if (!row) return { rows: [], rowsAffected: 0 };

    // Immutable snapshot: never mutate the object a service may still hold.
    const updated = { ...row };
    const setMatch = /set (.+?) where/i.exec(sql);
    const parts = setMatch ? setMatch[1].split(",").map((p) => p.trim()) : [];
    let argIndex = 0;
    for (const part of parts) {
      const m = /^(\w+)\s*=\s*\?/.exec(part);
      if (m) {
        updated[m[1]] = args[argIndex++];
        continue;
      }
      const lit = /^(\w+)\s*=\s*'([^']+)'/.exec(part);
      if (lit) updated[lit[1]] = lit[2];
      else if (/updated_at\s*=\s*now\(\)/i.test(part)) updated.updated_at = "2026-08-27T01:00:00Z";
      else if (/position\s*=\s*-1/.test(part)) updated.position = -1;
      else if (/completed_at\s*=\s*coalesce/i.test(part))
        updated.completed_at = "2026-08-27T02:00:00Z";
      else if (/revoked_at\s*=\s*now\(\)/i.test(part))
        updated.revoked_at = "2026-08-27T03:00:00Z";
    }
    state[table] = state[table].map((r) => (r === row ? updated : r));
    return { rows: [updated], rowsAffected: 1 };
  }

  function remove(sql, args) {
    const table = /delete from (\w+)/i.exec(sql)[1];
    const id = args[0];
    state[table] = state[table].filter((r) => String(r.id) !== String(id));
    if (table === "lms_course_sections") {
      const lessonIds = state.lms_lessons
        .filter((l) => String(l.section_id) === String(id))
        .map((l) => String(l.id));
      state.lms_lessons = state.lms_lessons.filter((l) => lessonIds.includes(String(l.id)) === false);
      state.lms_assessments = state.lms_assessments.filter(
        (a) => String(a.section_id) !== String(id),
      );
    }
    if (table === "lms_assessments") {
      state.lms_assessment_questions = state.lms_assessment_questions.filter(
        (q) => String(q.assessment_id) !== String(id),
      );
    }
    if (table === "lms_lessons") {
      state.lms_lesson_progress = state.lms_lesson_progress.filter(
        (p) => String(p.lesson_id) !== String(id),
      );
    }
    return { rows: [], rowsAffected: 1 };
  }

  function evalWhere(sql, args, row) {
    const whereMatch = /where (.+?)(?:\s+order by|\s+limit|$)/is.exec(sql);
    if (!whereMatch) return true;
    const cond = whereMatch[1];
    let argIndex = 0;

    // Conditions are evaluated in SQL order because placeholders consume args
    // positionally: `user_cid = ? AND assessment_id IN (?, ?)` binds user_cid
    // first. A single pass that processed IN clauses before `=` clauses would
    // bind the IN list to the wrong args whenever an `=` clause precedes it.
    const condRe = /(\w+)\s+in\s*\(([^)]*)\)|(\w+)\s*=\s*\?|(\w+)\s+like\s*\?/gi;
    let m;
    while ((m = condRe.exec(cond))) {
      if (m[1]) {
        const count = (m[2].match(/\?/g) || []).length;
        const ids = args.slice(argIndex, argIndex + count).map((a) => String(a));
        argIndex += count;
        if (!ids.includes(String(row[m[1]]))) return false;
      } else if (m[3]) {
        if (String(row[m[3]]) !== String(args[argIndex])) return false;
        argIndex++;
      } else {
        // LIKE ? — converts the SQL pattern (CERT-2026-%) into a regex.
        const re = likeToRegExp(String(args[argIndex]));
        argIndex++;
        if (!re.test(String(row[m[4]]))) return false;
      }
    }
    return true;
  }

  /** SQL LIKE pattern (with % wildcards) → case-sensitive RegExp. */
  function likeToRegExp(pattern) {
    const escaped = String(pattern).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`^${escaped.replace(/%/g, ".*")}$`);
  }

  function nextValue(sql, args) {
    const m = /from (\w+)/i.exec(sql);
    const table = m[1];
    // The floor comes from the SQL itself: section/lesson positions start at
    // -1 (COALESCE(MAX(position), -1) + 1 → first position 0) while assessment
    // attempt numbers start at 0 (COALESCE(MAX(attempt_number), 0) + 1 → first
    // attempt 1).
    const floorMatch = /coalesce\(max\(\w+\),\s*(-?\d+)\)\s*\+\s*1/i.exec(sql);
    const floor = floorMatch ? parseInt(floorMatch[1], 10) : -1;
    const siblings = state[table].filter((r) => evalWhere(sql, args, r));
    const max = siblings.reduce(
      (acc, r) => Math.max(acc, r.attempt_number ?? r.position ?? -1),
      floor,
    );
    return { rows: [{ next: max + 1 }] };
  }

  function neighbor(sql, args) {
    const table = /from (\w+)/i.exec(sql)[1];
    const m = /(\w+) = \? and (\w+) ([<>]) \?/i.exec(sql);
    const parentColumn = m[1];
    const op = m[3];
    const parentId = args[0];
    const pos = args[1];
    const rows = state[table]
      .filter((r) => String(r[parentColumn]) === String(parentId))
      .filter((r) => (op === "<" ? r.position < pos : r.position > pos))
      .sort((a, b) => (op === "<" ? b.position - a.position : a.position - b.position));
    return { rows: rows.slice(0, 1).map((r) => ({ ...r })) };
  }

  function guard(sql, args) {
    const table = /from (\w+)/i.exec(sql)[1];
    const found = state[table].some((r) => evalWhere(sql, args, r));
    return { rows: found ? [{ ok: 1 }] : [] };
  }

  function selectAll(sql, args) {
    const table = /from (\w+)/i.exec(sql)[1];
    let rows = state[table].filter((r) => evalWhere(sql, args, r));

    const orderMatch = /order by (\w+)(?: asc)?/i.exec(sql);
    if (orderMatch) {
      const col = orderMatch[1];
      rows = [...rows].sort((a, b) => {
        const av = a[col] ?? 0;
        const bv = b[col] ?? 0;
        return av > bv ? 1 : av < bv ? -1 : 0;
      });
    }
    return { rows: rows.map((r) => ({ ...r })) };
  }

  function interpreter(sql, args) {
    const s = sql.replace(/\s+/g, " ").trim();
    if (/^insert into/i.test(s)) return insert(s, args);
    if (/^update/i.test(s)) return update(s, args);
    if (/^delete from/i.test(s)) return remove(s, args);
    if (/coalesce\(max\(/i.test(s)) return nextValue(s, args);
    if (/select id, position from/i.test(s)) return neighbor(s, args);
    if (/^select 1 from/i.test(s)) return guard(s, args);
    if (/^select count\(\*\)/i.test(s)) return countRows(s, args);
    return selectAll(s, args);
  }

  function countRows(sql, args) {
    const table = /from (\w+)/i.exec(sql)[1];
    const rows = state[table].filter((r) => evalWhere(sql, args, r));
    return { rows: [{ n: rows.length }] };
  }

  return {
    get state() {
      return state;
    },
    executed,
    seed,
    reset,
    setHandler,
    execute: async ({ sql, args }) => {
      executed.push({ sql, args: args || [] });
      return handler(sql, args || []);
    },
    transaction: async (cb) =>
      cb(async (sql, args = []) => {
        executed.push({ sql, args });
        return handler(sql, args);
      }),
  };
}
