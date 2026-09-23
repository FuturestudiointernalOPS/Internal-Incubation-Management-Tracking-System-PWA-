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
    const programsWithMaterials = await client.query("SELECT id, materials FROM v2_programs WHERE materials IS NOT NULL AND materials != '' AND materials != '[]'");
    console.log(`Found ${programsWithMaterials.rows.length} programs with non-empty materials`);
    for (const program of programsWithMaterials.rows) {
      try {
        let materialsValue = program.materials;
        for (let attempt = 0; attempt < 4; attempt++) {
          try {
            const parsed = JSON.parse(materialsValue);
            if (Array.isArray(parsed)) { materialsValue = parsed; break; }
            materialsValue = parsed;
          } catch { break; }
        }
        if (Array.isArray(materialsValue)) {
          console.log(`  ${program.id.substring(0,8)}... OK — is array with ${materialsValue.length} items`);
        } else {
          console.log(`  ${program.id.substring(0,8)}... CORRUPTED — resetting to []`);
          await client.query("UPDATE v2_programs SET materials = '[]' WHERE id = $1", [program.id]);
        }
      } catch {
        console.log(`  ${program.id.substring(0,8)}... ERROR — resetting to []`);
        await client.query("UPDATE v2_programs SET materials = '[]' WHERE id = $1", [program.id]);
      }
    }
    console.log("\nCleanup complete");
  } finally { client.release(); await pool.end(); }
}
run().catch(console.error);
