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
    // Fix corrupted materials by resetting to empty array
    // where they are deeply nested strings that can't be parsed as arrays
    const all = await client.query("SELECT id, materials FROM v2_programs WHERE materials IS NOT NULL AND materials != '' AND materials != '[]'");
    console.log(`Found ${all.rows.length} programs with non-empty materials`);
    for (const p of all.rows) {
      try {
        let val = p.materials;
        for (let i = 0; i < 4; i++) {
          try {
            const parsed = JSON.parse(val);
            if (Array.isArray(parsed)) { val = parsed; break; }
            val = parsed;
          } catch { break; }
        }
        if (Array.isArray(val)) {
          console.log(`  ${p.id.substring(0,8)}... OK — is array with ${val.length} items`);
        } else {
          console.log(`  ${p.id.substring(0,8)}... CORRUPTED — resetting to []`);
          await client.query("UPDATE v2_programs SET materials = '[]' WHERE id = $1", [p.id]);
        }
      } catch (e) {
        console.log(`  ${p.id.substring(0,8)}... ERROR — resetting to []`);
        await client.query("UPDATE v2_programs SET materials = '[]' WHERE id = $1", [p.id]);
      }
    }
    console.log("\nCleanup complete");
  } finally { client.release(); await pool.end(); }
}
run().catch(console.error);
