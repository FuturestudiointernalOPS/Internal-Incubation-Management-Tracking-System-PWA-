const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://postgres.yakxdxdzuojafzdkqhjd:G8%26bM%3F!KujZwXDe@aws-0-eu-west-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

pool.query("UPDATE contacts SET role = 'staff' WHERE cid = 'USER_8A2139727359'")
  .then(() => {
    console.log('User fixed');
    pool.end();
  })
  .catch(console.error);
