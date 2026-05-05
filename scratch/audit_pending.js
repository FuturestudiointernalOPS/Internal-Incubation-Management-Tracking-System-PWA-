const { Pool } = require('pg');

const pool = new Pool({
  connectionString: "postgresql://postgres.yakxdxdzuojafzdkqhjd:G8%26bM%3F!KujZwXDe@aws-0-eu-west-1.pooler.supabase.com:6543/postgres",
  ssl: { rejectUnauthorized: false }
});

async function auditPendingUsers() {
  console.log("--- AUDITING PENDING REGISTRATIONS ---");
  try {
    const res = await pool.query("SELECT cid, name, email, group_name, status FROM contacts WHERE status = 'pending'");
    console.log(`Found ${res.rows.length} pending users.`);
    res.rows.forEach(user => {
      console.log(`- ${user.name} (${user.email}) | Group: ${user.group_name}`);
    });

    const notifRes = await pool.query("SELECT * FROM v2_notifications WHERE is_read = FALSE");
    console.log(`Found ${notifRes.rows.length} unread notifications.`);
  } catch (e) {
    console.error("Audit Failed:", e.message);
  } finally {
    await pool.end();
  }
}

auditPendingUsers();
