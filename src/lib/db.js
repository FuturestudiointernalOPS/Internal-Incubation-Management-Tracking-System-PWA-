import { Pool } from "pg";

/**
 * IMPACTOS DATA ARCHITECTURE — UNIFIED DB ENGINE (SUPABASE EDITION)
 * Version: 2.2.0 (Forensic Enhanced + Pool Resilience)
 * Optimized for Supabase/PostgreSQL with serverless lazy-loading,
 * execution tracing, and connection error recovery.
 */

let pgPool = null;

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
      console.error(
        ` forensics | Pool error — idle client failed: ${err.message}`,
      );
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
