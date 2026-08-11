const fs = require("fs");
const path = require("path");

const envPath = path.resolve(__dirname, "../../.env.local");
const envContent = fs.readFileSync(envPath, "utf-8");
const dbUrlMatch = envContent.match(/DATABASE_URL=(.+)/);
const DATABASE_URL = dbUrlMatch[1].trim();
console.log("✅ DATABASE_URL found");

const { Pool } = require("pg");
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const sql = fs.readFileSync(
  path.resolve(__dirname, "venture_os_notifications_admin_data_room.sql"),
  "utf-8"
);

async function run() {
  const client = await pool.connect();
  try {
    await client.query(sql);
    console.log("✅ Migration complete!\n");

    const tables = [
      "venture_notifications", "venture_notification_templates", "venture_notification_preferences", "venture_notification_delivery_logs",
      "system_settings", "feature_flags", "system_roles", "admin_activity_logs",
      "fundraising_opportunities", "fundraising_stage_history", "fundraising_activities", "fundraising_notes",
      "venture_documents", "venture_document_versions", "venture_document_shares", "venture_document_access_logs"
    ];

    let count = 0;
    for (const t of tables) {
      try {
        const res = await client.query(
          `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1)`,
          [t]
        );
        if (res.rows[0]?.exists) {
          console.log(`   ✅ ${t}`);
          count++;
        } else {
          console.log(`   ❌ ${t} — MISSING`);
        }
      } catch { console.log(`   ⚠️  ${t} — error checking`); }
    }

    // Check seeded data
    const settings = await client.query("SELECT COUNT(*) FROM system_settings");
    const flags = await client.query("SELECT COUNT(*) FROM feature_flags");
    const templates = await client.query("SELECT COUNT(*) FROM venture_notification_templates");
    console.log(`\n📊 ${count}/${tables.length} tables created`);
    console.log(`⚙️  ${settings.rows[0].count} system settings`);
    console.log(`🚩 ${flags.rows[0].count} feature flags`);
    console.log(`📝 ${templates.rows[0].count} notification templates`);
  } catch (err) {
    console.error(`❌ Error: ${err.message}`);
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(console.error);
