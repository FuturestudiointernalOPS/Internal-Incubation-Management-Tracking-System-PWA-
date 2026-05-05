const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://postgres.yakxdxdzuojafzdkqhjd:G8%26bM%3F!KujZwXDe@aws-0-eu-west-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

async function migrate() {
  try {
    // 1. Get distinct groups from contacts
    const res = await pool.query("SELECT DISTINCT group_name FROM contacts WHERE group_name IS NOT NULL AND group_name != ''");
    const groups = res.rows.map(r => r.group_name);
    console.log("Found groups in contacts:", groups);

    // 2. Insert into families if not exists
    for (const group of groups) {
      const check = await pool.query("SELECT id FROM families WHERE name = $1", [group]);
      if (check.rows.length === 0) {
        const registration_id = "R-" + Math.random().toString(36).substring(2, 10).toUpperCase();
        await pool.query("INSERT INTO families (name, registration_id) VALUES ($1, $2)", [group, registration_id]);
        console.log(`Migrated group: ${group} -> ${registration_id}`);
      }
    }
  } catch (e) {
    console.error(e);
  } finally {
    await pool.end();
  }
}

migrate();
