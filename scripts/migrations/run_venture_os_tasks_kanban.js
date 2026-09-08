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

const sql = fs.readFileSync(path.resolve(__dirname, "venture_os_tasks_kanban.sql"), "utf-8");

async function run() {
  const client = await pool.connect();
  try {
    await client.query(sql);
    console.log("✅ Migration Tasks & Kanban terminée !");

    const tables = ['venture_tasks', 'venture_task_comments', 'venture_task_attachments', 'venture_task_activity'];
    for (const t of tables) {
      const res = await client.query(
        `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1)`,
        [t]
      );
      console.log(`   ${res.rows[0].exists ? '✅' : '❌'} ${t}`);
    }

    // Show column counts
    console.log("\n📊 Détail des colonnes:");
    for (const t of tables) {
      const cols = await client.query(
        `SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1`,
        [t]
      );
      console.log(`   ${t}: ${cols.rows[0].count} colonnes`);
    }
  } catch (err) {
    console.error(`❌ Erreur: ${err.message}`);
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(console.error);
