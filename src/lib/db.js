import { Pool } from 'pg';

/**
 * IMPACTOS DATA ARCHITECTURE — UNIFIED DB ENGINE (SUPABASE EDITION)
 * Optimized exclusively for Supabase/PostgreSQL.
 */

// SECURE PARAMETER EXTRACTION
let pgConfig = null;
const dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
  console.warn("CRITICAL: DATABASE_URL is missing. The system will fail to connect to Supabase.");
} else {
  try {
    // We use a simplified configuration for Supabase
    pgConfig = {
      connectionString: dbUrl,
      ssl: { rejectUnauthorized: false },
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    };
  } catch (e) {
    console.error("DB Configuration Error:", e.message);
  }
}

const pgPool = pgConfig ? new Pool(pgConfig) : null;

export const initDb = async () => {
  if (!pgPool) throw new Error("Database not initialized. Check DATABASE_URL.");
  return true;
};

const db = {
  execute: async (queryObj) => {
    if (!pgPool) throw new Error("Database connection pool is offline.");

    const sql = typeof queryObj === 'string' ? queryObj : queryObj.sql;
    const args = queryObj.args || [];

    try {
      // Standardize parameter markers from ? (SQLite) to $1, $2 (PostgreSQL)
      let count = 0;
      const pgSql = sql.replace(/\?/g, () => {
        count++;
        return `$${count}`;
      });
      
      const result = await pgPool.query(pgSql, args);
      
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

