const { Pool } = require('pg');

const pool = new Pool({
  connectionString: "postgresql://postgres.yakxdxdzuojafzdkqhjd:G8%26bM%3F!KujZwXDe@aws-0-eu-west-1.pooler.supabase.com:6543/postgres",
  ssl: { rejectUnauthorized: false }
});

async function fixAllColumns() {
  console.log("--- ADDING MISSING COLUMNS ---");
  const columns = [
    "phone TEXT",
    "address TEXT",
    "dob TEXT",
    "role TEXT",
    "password TEXT",
    "program_id TEXT",
    "program_name TEXT",
    "image TEXT",
    "deleted INTEGER DEFAULT 0",
    "gender TEXT",
    "mother_name TEXT"
  ];
  
  for (const col of columns) {
    try { 
      await pool.query(`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS ${col.split(' ')[0]} ${col.substring(col.indexOf(' ') + 1)};`); 
    } catch (e) { 
      // ignore
    }
  }

  console.log("Done adding columns.");
  await pool.end();
}

fixAllColumns();
