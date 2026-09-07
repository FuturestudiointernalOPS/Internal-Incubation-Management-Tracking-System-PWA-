// Migration: add supporting_url column to blockers table
// Run: node /tmp/add_supporting_url.js
require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

async function run() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });

  try {
    console.log('Running ALTER TABLE blockers ADD COLUMN supporting_url TEXT...');
    await pool.query('ALTER TABLE blockers ADD COLUMN IF NOT EXISTS supporting_url TEXT');
    console.log('✅ Done — supporting_url column added (or already exists).');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
