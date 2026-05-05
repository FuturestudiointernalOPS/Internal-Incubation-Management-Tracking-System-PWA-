import { createClient } from "@libsql/client";
import { Pool } from 'pg';

/**
 * IMPACTOS DATA ARCHITECTURE — UNIFIED DB ENGINE
 * Hardened for Supabase/PostgreSQL with explicit parameter mapping.
 */

const isPostgres = !!process.env.DATABASE_URL;

// SECURE PARAMETER EXTRACTION
// We manually parse the URL to extract parts, bypassing the sensitive URL parser that crashes on special characters.
let pgConfig = null;
if (isPostgres) {
  try {
    const dbUrl = process.env.DATABASE_URL;
    
    // Regex to extract: user, password, host, port, database
    // postgresql://user:password@host:port/database
    const regex = /postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/;
    const match = dbUrl.match(regex);

    if (match) {
      pgConfig = {
        user: match[1],
        password: decodeURIComponent(match[2]), // Handle both encoded and raw
        host: match[3],
        port: parseInt(match[4]),
        database: match[5],
        ssl: { rejectUnauthorized: false },
        max: 20,
      };
    } else {
      // Fallback to connection string if regex fails (should not happen with standard Supabase URLs)
      pgConfig = {
        connectionString: dbUrl,
        ssl: { rejectUnauthorized: false },
      };
    }
  } catch (e) {
    console.error("DB Initialization Error:", e.message);
  }
}

const pgPool = pgConfig ? new Pool(pgConfig) : null;

const libsqlClient = !isPostgres ? createClient({
  url: process.env.TURSO_DATABASE_URL || "file:local.db",
  authToken: process.env.TURSO_AUTH_TOKEN
}) : null;

export const initDb = async () => {
  return true;
};

const db = {
  execute: async (queryObj) => {
    const sql = typeof queryObj === 'string' ? queryObj : queryObj.sql;
    const args = queryObj.args || [];

    if (isPostgres && pgPool) {
      try {
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
        console.error("Supabase PG Error:", err.message);
        throw err;
      }
    } else {
      const res = await libsqlClient.execute({ sql, args });
      return {
        ...res,
        lastInsertRowid: res.lastInsertRowid
      };
    }
  }
};

export default db;
