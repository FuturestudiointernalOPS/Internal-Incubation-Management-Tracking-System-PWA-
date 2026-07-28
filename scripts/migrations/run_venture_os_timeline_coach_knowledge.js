const fs = require("fs");
const path = require("path");

const envPath = path.resolve(__dirname, "../../.env.local");
const envContent = fs.readFileSync(envPath, "utf-8");
const dbUrlMatch = envContent.match(/DATABASE_URL=(.+)/);
const DATABASE_URL = dbUrlMatch[1].trim();
console.log("✅ DATABASE_URL trouvée");

const { Pool } = require("pg");
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const sql = fs.readFileSync(
  path.resolve(__dirname, "venture_os_timeline_coach_knowledge.sql"),
  "utf-8"
);

async function run() {
  const client = await pool.connect();
  try {
    await client.query(sql);
    console.log("✅ Migration massive terminée !\n");

    const expectedTables = [
      "venture_dependencies", "venture_timeline_events",
      "venture_coaches", "venture_coach_assignments", "venture_coach_availability", "venture_coach_activity",
      "venture_sessions", "venture_session_notes", "venture_session_attendance", "venture_session_action_items", "venture_session_activity",
      "knowledge_categories", "knowledge_resources", "knowledge_bookmarks", "knowledge_progress", "knowledge_activity",
      "venture_mentor_feedback", "venture_mentor_analytics", "venture_feedback_activity"
    ];

    let count = 0;
    for (const t of expectedTables) {
      const res = await client.query(
        `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1)`,
        [t]
      );
      if (res.rows[0].exists) {
        console.log(`   ✅ ${t}`);
        count++;
      } else {
        console.log(`   ❌ ${t} — MANQUANTE`);
      }
    }

    // Check knowledge categories seeded
    const cats = await client.query("SELECT COUNT(*) FROM knowledge_categories");
    console.log(`\n📊 ${count}/${expectedTables.length} tables créées`);
    console.log(`📚 ${cats.rows[0].count} catégories de connaissance initialisées`);
  } catch (err) {
    console.error(`❌ Erreur: ${err.message}`);
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(console.error);
