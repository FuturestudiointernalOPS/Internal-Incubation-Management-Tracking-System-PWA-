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

const sql = fs.readFileSync(path.resolve(__dirname, "venture_os_milestones.sql"), "utf-8");

async function run() {
  const client = await pool.connect();
  try {
    await client.query(sql);
    console.log("✅ Migration Milestones & Deliverables terminée !");

    const tables = await client.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name LIKE 'venture_milestone%' OR table_name LIKE 'venture_deliverable%'
      ORDER BY table_name
    `);
    tables.rows.forEach(r => console.log(`   ✅ ${r.table_name}`));
    console.log(`\n📊 ${tables.rows.length} tables créées`);
  } catch (err) {
    console.error(`❌ Erreur: ${err.message}`);
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(console.error);
