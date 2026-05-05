import { Pool } from 'pg';

/**
 * IMPACTOS DATA ARCHITECTURE — UNIFIED DB ENGINE (SUPABASE EDITION)
 * Optimized exclusively for Supabase/PostgreSQL with serverless lazy-loading.
 */

let pgPool = null;

const getPool = () => {
  if (pgPool) return pgPool;

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("CRITICAL: DATABASE_URL is missing in this environment.");
    return null;
  }

  try {
    pgPool = new Pool({
      connectionString: dbUrl,
      ssl: { rejectUnauthorized: false },
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
    return pgPool;
  } catch (e) {
    console.error("DB Pool Creation Error:", e.message);
    return null;
  }
};

export const initDb = async () => {
  const pool = getPool();
  if (!pool) throw new Error("Database initialization failed. Check environment variables.");
  return true;
};

const db = {
  execute: async (queryObj) => {
    const pool = getPool();
    if (!pool) throw new Error("Database connection pool is offline.");

    const sql = typeof queryObj === 'string' ? queryObj : queryObj.sql;
    const args = queryObj.args || [];

    try {
      // Standardize parameter markers from ? (SQLite) to $1, $2 (PostgreSQL)
      let count = 0;
      const pgSql = sql.replace(/\?/g, () => {
        count++;
        return `$${count}`;
      });
      
      const result = await pool.query(pgSql, args);
      
      return {
        rows: result.rows,
        columns: result.fields ? result.fields.map(f => f.name) : [],
        rowsAffected: result.rowCount,
        lastInsertRowid: result.rows[0]?.id || null
      };
    } catch (err) {
      console.error("Supabase DB Error:", err.message);
      throw err;
    }
  }
};

export default db;


