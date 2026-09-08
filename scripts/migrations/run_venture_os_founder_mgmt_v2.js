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
  path.resolve(__dirname, "venture_os_founder_mgmt.sql"),
  "utf-8",
);

async function run() {
  const client = await pool.connect();
  try {
    // Run the entire SQL as a multi-statement query
    // PostgreSQL supports multiple statements in a single query() call
    await client.query(sql);
    console.log("✅ Migration terminée avec succès !");
    
    // Verify tables
    const tables = await client.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('ownership_history', 'venture_invitations')
      ORDER BY table_name
    `);
    tables.rows.forEach(r => console.log(`   ✅ ${r.table_name}`));
    
    if (tables.rows.length === 2) {
      console.log("\n✅ Toutes les tables créées avec succès !");
    }
  } catch (err) {
    console.error(`❌ Erreur: ${err.message}`);
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(console.error);
