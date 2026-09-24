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
  "lms_section_resources",
  "lms_coaching_requests",
  "lms_registrations",
  "lms_payment_events",
  "password_setup_tokens",
  "platform_form_runs",
  "platform_form_submissions",
  "platform_forms",
  "platform_form_sections",
  "platform_form_fields",
  "v2_programs",
  "v2_sessions",
  "v2_program_staff",
  "v2_notifications",
  "participant_programs",
  "contacts",
  "participant_program_audit",
];

// Column defaults applied when an INSERT omits a column (mirrors the real
// schema's DEFAULT clauses so inserted rows look like real-DB rows).
const TABLE_DEFAULTS = {
  lms_certificates: { status: "valid" },
  lms_coaching_requests: { status: "pending", timing: "during" },
  lms_registrations: {
    status: "pending",
    access_status: "pending",
    email_status: "pending",
    currency: "XOF",
    language: "fr",
  },
  lms_payment_events: { status: "received" },
  password_setup_tokens: { used: 0 },
};

/**
 * Split one VALUES tuple ("a, 'b', c") on the commas that SEPARATE values,
 * not the ones inside a quoted literal.
 */
function splitValueTokens(tuple) {
  const tokens = [];
  let current = "";
  let inQuote = false;
  for (const char of tuple) {
    if (char === "'") inQuote = !inQuote;
    if (char === "," && !inQuote) {
      tokens.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  tokens.push(current.trim());
  return tokens;
}

/**
 * The tuples of a VALUES clause, in order: "(a, b), (c, d)" → ["a, b", "c, d"].
 * A single-tuple INSERT yields one entry, which is what the interpreter handled
 * before multi-row writes existed; the caller no longer has to care which it is.
 */
function valueTuples(sql) {
  const match = /VALUES\s*(.+?)(?:\s+ON CONFLICT|\s+RETURNING|;|$)/is.exec(sql);
  if (!match) return [];
  const tuples = [];
  let depth = 0;
  let current = "";
  for (const char of match[1]) {
    if (char === "(") {
      depth += 1;
      if (depth === 1) continue;
    }
    if (char === ")") {
      depth -= 1;
      if (depth === 0) {
        tuples.push(current);
        current = "";
        continue;
      }
    }
    if (depth >= 1) current += char;
  }
  return tuples;
}

export function createFakeDb() {
  let state = Object.fromEntries(TABLES.map((table) => [table, []]));
  let nextId = 1;
  const executed = [];
  let handler = interpreter;

  function seed(table, rows) {
    state[table].push(...rows);
  }

  function reset() {
    state = Object.fromEntries(TABLES.map((table) => [table, []]));
    nextId = 1;
    executed.length = 0;
    handler = interpreter;
  }

  function setHandler(newHandler) {
    handler = newHandler;
  }

  function rowFor(table) {
    const row = { id: `${table.replace(/^lms_/, "LMS-").replace(/_/g, "-")}-${nextId++}` };
    row.created_at = "2026-08-27T00:00:00Z";
    row.updated_at = "2026-08-27T00:00:00Z";
    return row;
  }

  function insert(sql, args) {
    const table = /insert into (\w+)/i.exec(sql)[1];
    const columns = /\(([^)]+)\)\s*VALUES/i.exec(sql)[1]
      .split(",")
      .map((column) => column.trim());
    const tuples = valueTuples(sql);
    const conflictCols = /on conflict/i.test(sql)
      ? (/on conflict \(([^)]+)\)/i.exec(sql)?.[1] || "")
          .split(",")
          .map((column) => column.trim())
      : null;

    const written = [];
    // ONE cursor across every tuple: the placeholders are bound in the order
    // they appear in the statement, so a second tuple continues where the first
    // stopped - exactly what the driver does.
    let argIndex = 0;

    for (const tuple of tuples) {
      const valueTokens = splitValueTokens(tuple);
      const row = rowFor(table);
      columns.forEach((column, i) => {
        const token = valueTokens[i] || "?";
        if (token === "?" || token.startsWith("?")) {
          row[column] = args[argIndex++];
        } else {
          row[column] = token.replace(/^'|'$/g, "");
        }
      });
      // Apply schema defaults for omitted columns (e.g. certificate status).
      for (const [column, value] of Object.entries(TABLE_DEFAULTS[table] || {})) {
        if (row[column] === undefined) row[column] = value;
      }

      if (conflictCols) {
        const existing = state[table].find((candidate) =>
          conflictCols.every((column) => String(candidate[column]) === String(row[column])),
        );
        if (existing) {
          written.push(existing); // DO NOTHING — the row that is already there
          continue;
        }
      }

      state[table].push(row);
      written.push(row);
    }

    return { rows: written };
  }

  function update(sql, args) {
    const table = /^update (\w+)/i.exec(sql)[1];
    const id = args[args.length - 1];
    const row = state[table].find((existingRow) => String(existingRow.id) === String(id));
    if (!row) return { rows: [], rowsAffected: 0 };

    // Immutable snapshot: never mutate the object a service may still hold.
    const updated = { ...row };
    const setMatch = /set (.+?) where/i.exec(sql);
    const parts = setMatch ? setMatch[1].split(",").map((part) => part.trim()) : [];
    let argIndex = 0;
    for (const part of parts) {
      const assignmentMatch = /^(\w+)\s*=\s*\?/.exec(part);
      if (assignmentMatch) {
        updated[assignmentMatch[1]] = args[argIndex++];
        continue;
      }
      const literalMatch = /^(\w+)\s*=\s*'([^']+)'/.exec(part);
      if (literalMatch) updated[literalMatch[1]] = literalMatch[2];
      else if (/updated_at\s*=\s*now\(\)/i.test(part)) updated.updated_at = "2026-08-27T01:00:00Z";
      else if (/position\s*=\s*-1/.test(part)) updated.position = -1;
      else if (/completed_at\s*=\s*coalesce/i.test(part))
        updated.completed_at = "2026-08-27T02:00:00Z";
      else if (/revoked_at\s*=\s*now\(\)/i.test(part))
        updated.revoked_at = "2026-08-27T03:00:00Z";
      else if (/^(\w+)\s*=\s*now\(\)/i.test(part))
        // Generic `<col> = NOW()` (e.g. handled_at on a coaching decision).
        updated[/^(\w+)\s*=\s*now\(\)/i.exec(part)[1]] = "2026-08-27T04:00:00Z";
    }
    state[table] = state[table].map((existingRow) => (existingRow === row ? updated : existingRow));
    return { rows: [updated], rowsAffected: 1 };
  }

  function remove(sql, args) {
    const table = /delete from (\w+)/i.exec(sql)[1];
    // The WHERE decides which rows go: one id, or a whole chunk of them.
    const doomed = state[table].filter((row) => evalWhere(sql, args, row));
    const gone = new Set(doomed.map((row) => String(row.id)));
    state[table] = state[table].filter((row) => !gone.has(String(row.id)));

    if (table === "lms_course_sections") {
      const lessonIds = state.lms_lessons
        .filter((lesson) => gone.has(String(lesson.section_id)))
        .map((lesson) => String(lesson.id));
      state.lms_lessons = state.lms_lessons.filter((lesson) => lessonIds.includes(String(lesson.id)) === false);
      state.lms_assessments = state.lms_assessments.filter(
        (assessment) => !gone.has(String(assessment.section_id)),
      );
      // Mirrors the real FK: a section's material dies with the section.
      state.lms_section_resources = state.lms_section_resources.filter(
        (resource) => !gone.has(String(resource.section_id)),
      );
    }
    if (table === "lms_assessments") {
      state.lms_assessment_questions = state.lms_assessment_questions.filter(
        (question) => !gone.has(String(question.assessment_id)),
      );
    }
    if (table === "lms_lessons") {
      state.lms_lesson_progress = state.lms_lesson_progress.filter(
        (progress) => !gone.has(String(progress.lesson_id)),
      );
    }
    return { rows: [], rowsAffected: 1 };
  }

  function evalWhere(sql, args, row) {
    const whereMatch = /where (.+?)(?:\s+order by|\s+limit|$)/is.exec(sql);
    if (!whereMatch) return true;
    const condition = whereMatch[1];
    let argIndex = 0;

    // Conditions are evaluated in SQL order because placeholders consume args
    // positionally: `user_cid = ? AND assessment_id IN (?, ?)` binds user_cid
    // first. A single pass that processed IN clauses before `=` clauses would
    // bind the IN list to the wrong args whenever an `=` clause precedes it.
    // An optional `::type` cast is tolerated (production code casts TEXT/UUID
    // id columns to compare across the two id spaces).
    const conditionPattern =
      /(\w+)(?:::\w+)?\s+in\s*\(([^)]*)\)|(\w+)(?:::\w+)?\s*(?:<>|!=)\s*'([^']+)'|(\w+)(?:::\w+)?\s*=\s*\?|(\w+)(?:::\w+)?\s+like\s*\?/gi;
    let conditionMatch;
    while ((conditionMatch = conditionPattern.exec(condition))) {
      if (conditionMatch[1]) {
        const count = (conditionMatch[2].match(/\?/g) || []).length;
        const ids = args.slice(argIndex, argIndex + count).map((argValue) => String(argValue));
        argIndex += count;
        if (!ids.includes(String(row[conditionMatch[1]]))) return false;
      } else if (conditionMatch[3]) {
        // col <> 'literal' / col != 'literal' (negation; consumes no args)
        if (String(row[conditionMatch[3]]) === conditionMatch[4]) return false;
      } else if (conditionMatch[5]) {
        if (String(row[conditionMatch[5]]) !== String(args[argIndex])) return false;
        argIndex++;
      } else {
        // LIKE ? — converts the SQL pattern (CERT-2026-%) into a regex.
        const likeRegex = likeToRegExp(String(args[argIndex]));
        argIndex++;
        if (!likeRegex.test(String(row[conditionMatch[6]]))) return false;
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
    const tableMatch = /from (\w+)/i.exec(sql);
    const table = tableMatch[1];
    // The floor comes from the SQL itself: section/lesson positions start at
    // -1 (COALESCE(MAX(position), -1) + 1 → first position 0) while assessment
    // attempt numbers start at 0 (COALESCE(MAX(attempt_number), 0) + 1 → first
    // attempt 1).
    const floorMatch = /coalesce\(max\(\w+\),\s*(-?\d+)\)\s*\+\s*1/i.exec(sql);
    const floor = floorMatch ? parseInt(floorMatch[1], 10) : -1;
    const siblings = state[table].filter((row) => evalWhere(sql, args, row));
    const highestValue = siblings.reduce(
      (highest, row) => Math.max(highest, row.attempt_number ?? row.position ?? -1),
      floor,
    );
    return { rows: [{ next: highestValue + 1 }] };
  }

  function neighbor(sql, args) {
    const table = /from (\w+)/i.exec(sql)[1];
    const columnsMatch = /(\w+) = \? and (\w+) ([<>]) \?/i.exec(sql);
    const parentColumn = columnsMatch[1];
    const operator = columnsMatch[3];
    const parentId = args[0];
    const position = args[1];
    const rows = state[table]
      .filter((row) => String(row[parentColumn]) === String(parentId))
      .filter((row) => (operator === "<" ? row.position < position : row.position > position))
      .sort((left, right) => (operator === "<" ? right.position - left.position : left.position - right.position));
    return { rows: rows.slice(0, 1).map((row) => ({ ...row })) };
  }

  function guard(sql, args) {
    const table = /from (\w+)/i.exec(sql)[1];
    const found = state[table].some((row) => evalWhere(sql, args, row));
    return { rows: found ? [{ ok: 1 }] : [] };
  }

  function selectAll(sql, args) {
    const table = /from (\w+)/i.exec(sql)[1];
    let rows = state[table].filter((row) => evalWhere(sql, args, row));

    const orderMatch = /order by (\w+)(?: asc)?/i.exec(sql);
    if (orderMatch) {
      const column = orderMatch[1];
      rows = [...rows].sort((left, right) => {
        const leftValue = left[column] ?? 0;
        const rightValue = right[column] ?? 0;
        return leftValue > rightValue ? 1 : leftValue < rightValue ? -1 : 0;
      });
    }
    return { rows: rows.map((row) => ({ ...row })) };
  }

  function interpreter(sql, args) {
    const statement = sql.replace(/\s+/g, " ").trim();
    if (/^insert into/i.test(statement)) return insert(statement, args);
    if (/^update/i.test(statement)) return update(statement, args);
    if (/^delete from/i.test(statement)) return remove(statement, args);
    if (/coalesce\(max\(/i.test(statement)) return nextValue(statement, args);
    if (/select id, position from/i.test(statement)) return neighbor(statement, args);
    if (/^select 1 from/i.test(statement)) return guard(statement, args);
    if (/^select count\(\*\)/i.test(statement)) return countRows(statement, args);
    return selectAll(statement, args);
  }

  function countRows(sql, args) {
    const table = /from (\w+)/i.exec(sql)[1];
    const rows = state[table].filter((row) => evalWhere(sql, args, row));
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
    transaction: async (transactionBody) =>
      transactionBody(async (sql, args = []) => {
        executed.push({ sql, args });
        return handler(sql, args);
      }),
  };
}
