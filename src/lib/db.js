import { Pool } from 'pg';

/**
 * IMPACTOS DATA ARCHITECTURE — UNIFIED DB ENGINE (SUPABASE EDITION)
 * Version: 2.1.0 (Forensic Enhanced)
 * Optimized for Supabase/PostgreSQL with serverless lazy-loading and execution tracing.
 */

let pgPool = null;

const getPool = () => {
  if (pgPool) return pgPool;

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error(" forensics | CRITICAL: DATABASE_URL is missing. Localhost is disconnected.");
    return null;
  }

  try {
    pgPool = new Pool({
      connectionString: dbUrl,
      ssl: { rejectUnauthorized: false },
      max: 10, 
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 15000,
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

  const sql = typeof queryObj === 'string' ? queryObj : queryObj.sql;
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
    pgSql = pgSql.replace(/datetime\(['"]now['"]\)/gi, 'NOW()');
    
    const result = await pool.query(pgSql, args);
    const duration = Date.now() - start;

    if (duration > 1000) {
      console.warn(` forensics | SLOW QUERY (${duration}ms): ${pgSql.substring(0, 100)}...`);
    }
    
    return {
      rows: result.rows,
      columns: result.fields ? result.fields.map(f => f.name) : [],
      rowsAffected: result.rowCount,
      lastInsertRowid: result.rows[0]?.id || null
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
  if (!pool) throw new Error("Database initialization failed. Check environment variables.");
  return db;
};

export default db;


