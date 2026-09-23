/**
 * DB SEQUENCER — measures how a request actually talks to the database.
 *
 * Counting statements is not enough: what costs time is the CHAIN. A request
 * that issues 12 statements one after another pays 12 round trips; the same 12
 * issued in three parallel waves pays three.
 *
 * This harness replaces the database engine with a recorder that tracks how
 * many statements are in flight at the same time, so a test can assert:
 *
 *   statements  — total statements the request issues
 *   waves       — sequential steps ("one more round trip of waiting")
 *   maxInFlight — widest parallel burst (compare with the connection pool size)
 *
 * It is deterministic: every statement resolves on a macrotask, so calls made
 * in the same tick overlap and calls made after an await do not.
 */

/** Schema maintenance is measured separately: it is once per process by design. */
const IS_SCHEMA_SQL = (sql) =>
  /^\s*(create\s+table|create\s+(unique\s+)?index|alter\s+table|drop\s+index|drop\s+constraint)/i.test(
    String(sql).replace(/^\s*(--[^\n]*\n|\/\*[\s\S]*?\*\/\s*)*/g, ""),
  );

export function createSequencer({ rows = [], rowsFor = null } = {}) {
  const calls = [];
  let inFlight = 0;
  let waves = 0;
  let maxInFlight = 0;
  // Answers can be replaced between phases of one measurement - e.g. to answer a
  // second run with a database that already has what the first run recorded.
  let respond = rowsFor;

  const execute = (query = {}) => {
    const sql = typeof query === "string" ? query : query.sql || "";
    const args = typeof query === "string" ? [] : query.args || [];

    const schema = IS_SCHEMA_SQL(sql);
    if (!schema) {
      if (inFlight === 0) waves += 1;
      inFlight += 1;
      if (inFlight > maxInFlight) maxInFlight = inFlight;
    }
    calls.push({ sql, args, wave: waves, schema });

    return new Promise((resolve) => {
      setTimeout(() => {
        if (!schema) inFlight -= 1;
        resolve({
          rows: respond ? respond(sql, args) || [] : rows,
          columns: [],
          rowsAffected: 0,
          lastInsertRowid: null,
        });
      }, 0);
    });
  };

  return {
    execute,
    /** Replace the answers given to subsequent statements. */
    setRowsFor(rowsResponder) {
      respond = rowsResponder;
    },
    reset() {
      calls.length = 0;
      waves = 0;
      maxInFlight = 0;
    },
    report() {
      const data = calls.filter((call) => !call.schema);
      const dataWaves = new Set(data.map((call) => call.wave)).size
        ? new Set(data.map((call) => call.wave))
        : new Set();
      return {
        /** Statements the request issues, schema maintenance excluded. */
        statements: data.length,
        /** Sequential steps: a statement started while none other was in flight. */
        waves: dataWaves.size,
        /** Widest parallel burst (compare with the pool size, max 10). */
        maxInFlight,
        schemaStatements: calls.length - data.length,
        calls: data.map((call) => call.sql.replace(/\s+/g, " ").trim().slice(0, 70)),
        /** The full records, for a test that needs the arguments too. */
        records: data.map((call) => ({ ...call })),
      };
    },
  };
}
