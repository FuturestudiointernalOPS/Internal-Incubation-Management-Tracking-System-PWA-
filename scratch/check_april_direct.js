const { Pool } = require('pg');

async function checkApril() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    const res = await pool.query("SELECT id, name, email, role, group_name, status FROM contacts WHERE name ILIKE '%April%' OR email ILIKE '%april%'");
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (e) {
    console.error(e);
  } finally {
    await pool.end();
  }
}

checkApril();
