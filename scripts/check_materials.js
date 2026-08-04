const fs = require("fs");
const path = require("path");
const envPath = path.resolve(__dirname, "../.env.local");
const envContent = fs.readFileSync(envPath, "utf-8");
const dbUrlMatch = envContent.match(/DATABASE_URL=(.+)/);
const DATABASE_URL = dbUrlMatch[1].trim();
const { Pool } = require("pg");
const pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
async function run() {
  const client = await pool.connect();
  try {
    const r = await client.query(`SELECT id, name, materials, note_id FROM v2_programs WHERE materials IS NOT NULL AND materials != '[]' AND materials != '' LIMIT 5`);
    console.log("Programs with materials:");
    r.rows.forEach(p => {
      console.log(`  ID: ${p.id}`);
      console.log(`  Name: ${p.name}`);
      console.log(`  Materials: ${(p.materials||'').substring(0,200)}`);
      console.log(`  Note ID: ${p.note_id}`);
      console.log("  ---");
    });
    console.log(`Total programs with materials: ${r.rows.length}`);
  } finally { client.release(); await pool.end(); }
}
run().catch(console.error);
