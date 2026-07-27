import { Pool } from "pg";

/**
 * IMPACTOS DATA ARCHITECTURE — UNIFIED DB ENGINE (SUPABASE EDITION)
 * Version: 2.2.0 (Forensic Enhanced + Pool Resilience)
 * Optimized for Supabase/PostgreSQL with serverless lazy-loading,
 * execution tracing, and connection error recovery.
 */

let pgPool = null;
let poolErrorCount = 0;
const MAX_POOL_ERRORS = 5;

/**
 * Reset the pool entirely, forcing creation of fresh connections.
 */
const resetPool = () => {
  if (pgPool) {
    try {
      pgPool.end().catch(() => {});
    } catch (_) {}
    pgPool = null;
  }
  poolErrorCount = 0;
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
    pgPool = new Pool({
      connectionString: dbUrl,
      ssl: { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 60000, // Recycle idle connections after 60s instead of 300s
      connectionTimeoutMillis: 10000, // More time for initial connection
      query_timeout: 30000, // Kill queries running longer than 30s (client-side)
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000,
    });

    // Set statement timeout at the session level for all pooled connections
    pgPool.on("connect", (client) => {
      client.query("SET statement_timeout = '30s'", (err) => {
        if (err)
          console.error(
            " forensics | Failed to set statement_timeout:",
            err.message,
          );
      });
    });

    // Prevent uncaughtException when idle connections fail (e.g. read ETIMEDOUT)
    pgPool.on("error", (err) => {
      poolErrorCount++;
      if (poolErrorCount <= 3) {
        console.error(
          ` forensics | Pool connection dropped: ${err.message}. ` +
          `Auto-recovery active (${poolErrorCount}/${MAX_POOL_ERRORS}).`,
        );
      }
      if (poolErrorCount >= MAX_POOL_ERRORS) {
        console.warn(
          " forensics | Too many pool errors. Recycling connection pool.",
        );
        resetPool();
      }
    });

    // Remove idle connections more aggressively to avoid stale sockets
    pgPool.on("remove", (client) => {
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

  try {
    // Forensic Parameter Translation: ? -> $1, $2, etc.
    let count = 0;
    let pgSql = sql.replace(/\?/g, () => {
      count++;
      return `$${count}`;
    });

    // Forensic Dialect Translation: SQLite-isms to Postgres
    // Handle datetime('now') -> NOW()
    pgSql = pgSql.replace(/datetime\(['"]now['"]\)/gi, "NOW()");

    const result = await pool.query(pgSql, args);
    const duration = Date.now() - start;

    if (duration > 1000) {
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
        ` forensics | Connection error detected, recycling pool and retrying...`,
      );
      resetPool();
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
 * Initializes the database and returns the db instance.
 * Returns the db object to prevent breakage in routes using: const db = await initDb();
 */
export const initDb = async () => {
  const pool = getPool();
  if (!pool)
    throw new Error(
      "Database initialization failed. Check environment variables.",
    );
  return db;
};

export default db;
