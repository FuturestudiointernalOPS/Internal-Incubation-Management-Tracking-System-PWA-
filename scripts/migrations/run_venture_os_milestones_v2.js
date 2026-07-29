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
    const statements = sql
      .split(";")
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith("--") && !s.startsWith("/*"));

    let success = 0, errors = 0;
    for (const stmt of statements) {
      try {
        await client.query(stmt);
        console.log(`✅ ${stmt.substring(0, 100).replace(/\n/g, " ")}`);
        success++;
      } catch (err) {
        if (err.message.includes("already exists")) {
          console.log(`⏭️  ${stmt.substring(0, 80).replace(/\n/g, " ")}`);
          success++;
        } else {
          console.error(`❌ ${err.message.substring(0, 150)}`);
          errors++;
        }
      }
    }
    console.log(`\n📊 ${success} OK, ${errors} erreurs`);

    // Verify
    const tables = await client.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND (table_name LIKE 'venture_milestone%' OR table_name LIKE 'venture_deliverable%')
      ORDER BY table_name
    `);
    tables.rows.forEach(r => console.log(`   ✅ ${r.table_name}`));
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(console.error);
