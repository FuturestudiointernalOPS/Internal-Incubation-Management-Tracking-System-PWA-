const { Pool } = require('pg');

const pool = new Pool({
  connectionString: "postgresql://postgres.yakxdxdzuojafzdkqhjd:G8%26bM%3F!KujZwXDe@aws-0-eu-west-1.pooler.supabase.com:6543/postgres",
  ssl: { rejectUnauthorized: false }
});

async function harmonizeSchema() {
  console.log("--- HARMONIZING CONTACTS SCHEMA ---");
  try {
    // 1. Ensure Table Exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS contacts (
        cid TEXT PRIMARY KEY,
        name TEXT,
        email TEXT UNIQUE,
        phone TEXT,
        address TEXT,
        dob TEXT,
        group_name TEXT,
        role TEXT,
        password TEXT,
        program_id TEXT,
        program_name TEXT,
        image TEXT,
        status TEXT DEFAULT 'active',
        deleted INTEGER DEFAULT 0,
        gender TEXT,
        mother_name TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    // 2. Add Missing Columns (just in case it existed but was old)
    const columns = [
      "ALTER TABLE contacts ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';",
      "ALTER TABLE contacts ADD COLUMN IF NOT EXISTS group_name TEXT;",
      "ALTER TABLE contacts ADD COLUMN IF NOT EXISTS cid TEXT;",
      "ALTER TABLE contacts ADD COLUMN IF NOT EXISTS gender TEXT;",
      "ALTER TABLE contacts ADD COLUMN IF NOT EXISTS mother_name TEXT;"
    ];
    
    for (const sql of columns) {
      try { await pool.query(sql); } catch (e) { /* ignore if column exists */ }
    }

    console.log("Success: Database schema is now fully compatible.");
  } catch (e) {
    console.error("Schema Fix Failed:", e.message);
  } finally {
    await pool.end();
  }
}

harmonizeSchema();
