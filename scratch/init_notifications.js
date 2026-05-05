const { Pool } = require('pg');

// FINALIZED POOLER CONFIG (Direct from .env.local)
const pool = new Pool({
  connectionString: "postgresql://postgres.yakxdxdzuojafzdkqhjd:G8%26bM%3F!KujZwXDe@aws-0-eu-west-1.pooler.supabase.com:6543/postgres",
  ssl: { rejectUnauthorized: false }
});

async function initNotifications() {
  console.log("--- INITIALIZING NOTIFICATION ENGINE ---");
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS v2_notifications (
        id SERIAL PRIMARY KEY,
        recipient_id TEXT,
        title TEXT,
        message TEXT,
        type TEXT,
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("Success: Notification table is active.");
  } catch (e) {
    console.error("Initialization Failed:", e.message);
  } finally {
    await pool.end();
  }
}

initNotifications();
