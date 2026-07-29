// Quick script to add score column to v2_submissions
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/impactos'
});

async function run() {
  const client = await pool.connect();
  try {
    // Check if column exists first
    const check = await client.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'v2_submissions' AND column_name = 'score'
    `);
    
    if (check.rows.length === 0) {
      await client.query('ALTER TABLE v2_submissions ADD COLUMN score INTEGER DEFAULT NULL');
      console.log('✓ score column added');
    } else {
      console.log('✓ score column already exists');
    }

    // Also check updated_at
    const check2 = await client.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'v2_submissions' AND column_name = 'updated_at'
    `);
    
    if (check2.rows.length === 0) {
      await client.query('ALTER TABLE v2_submissions ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()');
      console.log('✓ updated_at column added');
    } else {
      console.log('✓ updated_at column already exists');
    }

    console.log('Done!');
  } catch(e) {
    console.error('Error:', e.message);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
