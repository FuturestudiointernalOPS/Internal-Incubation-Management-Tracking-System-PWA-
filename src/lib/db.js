import { Pool } from "pg";

/**
 * IMPACTOS DATA ARCHITECTURE — UNIFIED DB ENGINE (SUPABASE EDITION)
 * Version: 2.2.0 (Forensic Enhanced + Pool Resilience)
 * Optimized for Supabase/PostgreSQL with serverless lazy-loading,
 * execution tracing, and connection error recovery.
 */

let pgPool = null;

// ── Pool failure tracking: a SLIDING window, not a lifetime tally ───────────
//
// This used to be a plain counter, cleared only by a full teardown, so it
// measured "failures since the last rebuild" rather than "is something wrong
// right now". Five idle connections dying one at a time, hours apart — each
// invisible to users because the failed query is retried once — reached the
// same value as five sockets dropping in the same instant and tore down all ten
// connections for no reason.
//
// The threshold only means something as a BURST detector: several sockets
// failing together is the signature of a pool that is genuinely broken
// (provider restarted, network gone), and rebuilding is then worth the latency
// it costs. So we keep the timestamps of recent failures and count only those
// inside a short window. Older entries are dropped as the window advances — no
// timer is involved, pruning happens when the next failure arrives — so a slow
// drift decays back to zero while a real cascade still reaches the threshold.
const MAX_POOL_ERRORS = 5;
const POOL_ERROR_WINDOW_MS = 30000; // failures further apart than this are unrelated

/** Timestamps of pool failures still inside the window (oldest first). */
let recentPoolErrors = [];

/** Forget failures older than the window, relative to `now`. */
const prunePoolErrors = (now) => {
  const cutoff = now - POOL_ERROR_WINDOW_MS;
  recentPoolErrors = recentPoolErrors.filter((at) => at > cutoff);
};

/** Record one failure; return how many recent ones remain (including it). */
const recordPoolError = (now = Date.now()) => {
  prunePoolErrors(now);
  recentPoolErrors.push(now);
  return recentPoolErrors.length;
};

/**
 * RUNTIME SCHEMA MAINTENANCE — executed at most ONCE per process.
 *
 * The codebase has ~40 `ensure*`/`self-heal` helpers that keep older databases
 * usable: they create a table, add a column, create an index. Each one is a real
 * database round trip (~130ms on the current link), and because most of them
 * were never memoised they ran on EVERY request that touched their read path —
 * a read endpoint paying several schema statements before it could answer.
 *
 * Every statement they issue is written to be a no-op when the object already
 * exists (`CREATE TABLE IF NOT EXISTS`, `ALTER TABLE … ADD COLUMN IF NOT EXISTS`,
 * `CREATE [UNIQUE] INDEX IF NOT EXISTS`, `DROP … IF EXISTS`). This engine-level
 * guard removes the repetition without touching any of those helpers: the first
 * caller in a process performs the statement, every later caller is answered
 * locally. Correctness is unchanged — the statement has the same effect the
 * second time (none), so skipping it cannot alter the schema or the data.
 *
 * Scope is deliberately narrow. A statement is only treated this way when it is
 * provably a no-op when repeated:
 *   - the patterns below, and
 *   - NOT a data statement (INSERT/UPDATE/DELETE/SELECT are never skipped), and
 *   - NOT inside `db.transaction()` (that path never reaches this guard).
 *
 * Deployments that migrate the database themselves (see src/migrations/*.sql)
 * can remove the first-run cost entirely with `SKIP_RUNTIME_SCHEMA_MAINTENANCE=true`
 * — see the note in that branch.
 */
const MAINTENANCE_DDL_PATTERNS = [
  /^\s*create\s+table\s+if\s+not\s+exists\b/i,
  /^\s*create\s+(?:unique\s+)?index\s+if\s+not\s+exists\b/i,
  /^\s*alter\s+table\s+[^\s;]+\s+add\s+column\s+if\s+not\s+exists\b/i,
  /^\s*alter\s+table\s+[^\s;]+\s+drop\s+constraint\s+if\s+exists\b/i,
  /^\s*alter\s+table\s+[^\s;]+\s+alter\s+column\s+[^\s;]+\s+drop\s+not\s+null\b/i,
  /^\s*drop\s+index\s+if\s+exists\b/i,
];

/** Strip leading SQL comments so the patterns match the actual statement. */
const stripLeadingComments = (sql) =>
  String(sql).replace(/^\s*(?:--[^\n]*\n|\/\*[\s\S]*?\*\/\s*)*/g, "");

const isMaintenanceDdl = (sql) => {
  const bare = stripLeadingComments(sql);
  return MAINTENANCE_DDL_PATTERNS.some((re) => re.test(bare));
};

const SKIP_RUNTIME_SCHEMA_MAINTENANCE =
  process.env.SKIP_RUNTIME_SCHEMA_MAINTENANCE === "true";

/** Statements already applied by this process (normalised SQL → true). */
const appliedMaintenanceDdl = new Set();

/** The "maintenance disabled" warning is worth printing once, not per query. */
let skipFlagLogged = false;

/**
 * Lightweight process counters, so the cost of a change can be measured
 * instead of guessed (see `scripts/db-roundtrip-report.mjs`):
 *   queries     — statements actually sent to the database
 *   skippedDdl  — maintenance statements answered locally instead of sent
 *   ddl         — maintenance statements that were sent
 *   dbMs        — accumulated time spent inside the database
 *   slow        — statements above the forensic slow threshold
 */
const metrics = {
  queries: 0,
  skippedDdl: 0,
  ddl: 0,
  dbMs: 0,
  slow: 0,
  reset() {
    this.queries = 0;
    this.skippedDdl = 0;
    this.ddl = 0;
    this.dbMs = 0;
    this.slow = 0;
  },
};

export const getDbMetrics = () => ({
  queries: metrics.queries,
  skippedDdl: metrics.skippedDdl,
  ddl: metrics.ddl,
  dbMs: metrics.dbMs,
  slow: metrics.slow,
});

export const resetDbMetrics = () => metrics.reset();

// Minimum elapsed time before a FULL pool teardown is allowed after the
// previous one. Prevents a burst of transient errors from repeatedly dropping
// every socket (a cascade that itself thrashes Supabase). Bounded recovery:
// a single flake triggers a targeted prune; only sustained failure tears down.
let lastFullResetAt = 0;
const FULL_RESET_MIN_INTERVAL_MS = 2000;

/**
 * Reset the pool entirely, forcing creation of fresh connections.
 */
const resetPool = () => {
  const now = Date.now();
  if (now - lastFullResetAt < FULL_RESET_MIN_INTERVAL_MS) {
    return false; // bounded: skip a repeat teardown within the backoff window
  }
  if (pgPool) {
    try {
      pgPool.end().catch(() => {});
    } catch (_) {}
    pgPool = null;
  }
  recentPoolErrors = []; // a rebuild starts from a clean slate
  lastFullResetAt = now;
  return true;
};

const getPool = () => {
  if (pgPool) return pgPool;

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error(
      " forensics | CRITICAL: DATABASE_URL is missing. Localhost is disconnected.",
    );
    return null;
  }

  try {
    // Server-side statement_timeout is sent as a STARTUP parameter (`options`)
    // instead of a `pool.on("connect")` query: the old fire-and-forget SET raced
    // the first user query on the same client, triggering pg's "client already
    // executing a query" deprecation warning (removed in pg 9). Supabase's
    // transaction pooler rejects startup `options`, so it is only applied on
    // DIRECT connections — the client-side `query_timeout` stays on everywhere.
    const isPooler = /pooler\.supabase\.com|:6543(\b|\/)/i.test(dbUrl);

    pgPool = new Pool({
      connectionString: dbUrl,
      ssl: { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 60000, // Recycle idle connections after 60s instead of 300s
      connectionTimeoutMillis: 10000, // Time to establish a NEW connection
      query_timeout: 30000, // Kill queries running longer than 30s (client-side)
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000,
      // MAXIMUM time waiting for a free slot from an exhausted pool. Without
      // this, pool.connect() blocks indefinitely once all `max` connections
      // are busy, which under load hangs requests and cascades into the
      // failure cache. 5s lets a slow batch drain without hard-failing normal
      // bursts, and turns true exhaustion into a fast, actionable error.
      acquireTimeoutMillis: 5000,
      ...(isPooler ? {} : { options: "-c statement_timeout=30000" }),
    });

    // Prevent uncaughtException when idle connections fail (e.g. read ETIMEDOUT)
    pgPool.on("error", (err) => {
      const recentErrors = recordPoolError();
      if (recentErrors <= 3) {
        console.error(
          ` forensics | Pool connection dropped: ${err.message}. ` +
          `Auto-recovery active (${recentErrors}/${MAX_POOL_ERRORS} in the last ${
            POOL_ERROR_WINDOW_MS / 1000
          }s).`,
        );
      }
      if (recentErrors >= MAX_POOL_ERRORS) {
        console.warn(
          ` forensics | ${recentErrors} pool errors within ${
            POOL_ERROR_WINDOW_MS / 1000
          }s. Recycling connection pool.`,
        );
        resetPool();
      }
    });

    // Remove idle connections more aggressively to avoid stale sockets
    pgPool.on("remove", (_client) => {
      // Connection was removed from pool — normal lifecycle
    });

    return pgPool;
  } catch (e) {
    console.error(" forensics | DB Pool Creation Error:", e.message);
    return null;
  }
};

/**
 * Executes a query with forensic tracing and SQLite-to-Postgres parameter translation.
 */
const execute = async (queryObj) => {
  const start = Date.now();
  const pool = getPool();
  if (!pool) throw new Error("Database connection pool is offline.");

  const sql = typeof queryObj === "string" ? queryObj : queryObj.sql;
  const args = queryObj.args || [];

  let pgSql = sql;

  try {
    // Forensic Parameter Translation: ? -> $1, $2, etc.
    let count = 0;
    pgSql = sql.replace(/\?/g, () => {
      count++;
      return `$${count}`;
    });

    // Forensic Dialect Translation: SQLite-isms to Postgres
    // Handle datetime('now') -> NOW()
    pgSql = pgSql.replace(/datetime\(['"]now['"]\)/gi, "NOW()");

    // ── Runtime schema maintenance: at most once per process ────────────────
    // Must run before the statement is sent: this branch can only answer
    // "already done" for a statement that has already succeeded here.
    if (isMaintenanceDdl(sql)) {
      if (SKIP_RUNTIME_SCHEMA_MAINTENANCE || appliedMaintenanceDdl.has(pgSql)) {
        metrics.skippedDdl++;
        if (SKIP_RUNTIME_SCHEMA_MAINTENANCE && !skipFlagLogged) {
          skipFlagLogged = true;
          console.warn(
            " forensics | SKIP_RUNTIME_SCHEMA_MAINTENANCE=true — runtime schema " +
              "statements are NOT sent. The database must already be migrated " +
              "(see src/migrations and scripts/db-audit/apply-migrations.mjs).",
          );
        }
        return {
          rows: [],
          columns: [],
          rowsAffected: 0,
          lastInsertRowid: null,
        };
      }
      metrics.ddl++;
      console.log(
        ` forensics | schema maintenance (once per process): ${pgSql.substring(0, 80)}...`,
      );
    }

    const result = await pool.query(pgSql, args);
    const duration = Date.now() - start;

    metrics.queries++;
    metrics.dbMs += duration;

    if (isMaintenanceDdl(sql)) appliedMaintenanceDdl.add(pgSql);

    if (duration > 1000) {
      metrics.slow++;
      console.warn(
        ` forensics | SLOW QUERY (${duration}ms): ${pgSql.substring(0, 100)}...`,
      );
    }

    return {
      rows: result.rows,
      columns: result.fields ? result.fields.map((f) => f.name) : [],
      rowsAffected: result.rowCount,
      lastInsertRowid: result.rows[0]?.id || null,
    };
  } catch (err) {
    // Detect connection-level errors and retry once with a fresh pool
    const isConnError =
      err.message?.includes("Connection terminated") ||
      err.message?.includes("read ETIMEDOUT") ||
      err.message?.includes("ECONNRESET") ||
      err.message?.includes("socket hang up") ||
      err.message?.includes("getaddrinfo") ||
      err.code === "ECONNRESET" ||
      err.code === "ETIMEDOUT";

    if (isConnError) {
      console.warn(
        ` forensics | Connection error detected, recovering and retrying...`,
      );
      // Bounded recovery: only tear down the whole pool when allowed by the
      // backoff window; otherwise this is a transient per-connection flake.
      if (!resetPool()) {
        await new Promise((r) => setTimeout(r, 150)); // small jitter before retry
      }
      const freshPool = getPool();
      if (freshPool) {
        try {
          const retryResult = await freshPool.query(pgSql, args);
          const retryDuration = Date.now() - start;
          console.warn(
            ` forensics | Retry succeeded (${retryDuration}ms)`,
          );
          return {
            rows: retryResult.rows,
            columns: retryResult.fields ? retryResult.fields.map((f) => f.name) : [],
            rowsAffected: retryResult.rowCount,
            lastInsertRowid: retryResult.rows[0]?.id || null,
          };
        } catch (retryErr) {
          console.error(
            ` forensics | Retry also failed: ${retryErr.message}`,
          );
        }
      }
    }

    console.error(" forensics | Supabase DB Error:", err.message);
    console.error(" forensics | Failing Query:", sql);
    throw err;
  }
};

const db = { execute };

/**
 * Role-level `statement_timeout`, so pooled connections get it too.
 *
 * Direct connections already receive `statement_timeout` as a startup parameter
 * (`options`, see getPool). Supabase's transaction pooler rejects startup
 * `options`, so the only pooler-safe way is a session default on the ROLE —
 * catalog state that every future backend session picks up.
 *
 * Best-effort and idempotent: a privilege error is logged, never fatal, and the
 * client-side `query_timeout` (30s) still applies regardless. Runs ONCE per
 * process (a failure is not retried, so a persistent privilege error cannot
 * turn into a per-request DDL storm).
 */
let statementTimeoutApplied = null;
const applyStatementTimeout = () => {
  if (statementTimeoutApplied) return;
  statementTimeoutApplied = db
    .execute({
      sql: `DO $$
              BEGIN
                EXECUTE format('ALTER ROLE %I SET statement_timeout = %L', current_user, '30s');
              EXCEPTION WHEN insufficient_privilege THEN
                RAISE NOTICE 'statement_timeout not applied (insufficient privilege)';
              END $$`,
      args: [],
    })
    .catch((e) => {
      console.warn(
        " forensics | statement_timeout not applied:",
        e.message,
      );
      // Deliberately NOT reset: a privilege/DDL failure must not retry on every
      // initDb() call (retry storm). One attempt per process is enough.
    });
};

/**
 * Execute a callback within a database transaction.
 * The callback receives a `query(sql, args)` function.
 * Auto-rollback on error, auto-commit on success.
 *
 * Usage:
 *   await db.transaction(async (query) => {
 *     await query("INSERT INTO ...", [...]);
 *     await query("UPDATE ...", [...]);
 *   });
 */
db.transaction = async (callback) => {
  const pool = getPool();
  if (!pool) throw new Error("Database connection pool is offline.");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await callback(async (sql, args = []) => {
      let count = 0;
      const pgSql = sql.replace(/\?/g, () => {
        count++;
        return `$${count}`;
      });
      const r = await client.query(pgSql, args);
      return {
        rows: r.rows,
        rowsAffected: r.rowCount,
        lastInsertRowid: r.rows[0]?.id || null,
      };
    });
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Initializes the database and returns the db instance.
 * Returns the db object to prevent breakage in routes using: const db = await initDb();
 */
export const initDb = async () => {
  const pool = getPool();
  if (!pool)
    throw new Error(
      "Database initialization failed. Check environment variables.",
    );
  // Best-effort, once per process: role-level statement_timeout covers pooled
  // connections (where startup `options` are rejected). Never awaited — it must
  // not delay the first request.
  applyStatementTimeout();
  return db;
};

export default db;
