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
    // Get all project names to search broadly
    const r = await client.query(`SELECT id, name, status, created_at FROM v2_projects ORDER BY created_at DESC LIMIT 50`);
    console.log("=== Last 50 projects in staging ===");
    r.rows.forEach(x => console.log(`${x.id}\t${x.status}\t${x.name?.substring(0,80)}`));
    
    // Also check production
  } finally { client.release(); await pool.end(); }
  
  // Check production
  const prodUrl = "postgresql://postgres.yakxdxdzuojafzdkqhjd:G8%26bM%3F!KujZwXDe@aws-0-eu-west-1.pooler.supabase.com:6543/postgres";
  const prodPool = new Pool({ connectionString: prodUrl, ssl: { rejectUnauthorized: false } });
  try {
    const pc = await prodPool.connect();
    const pr = await pc.query(`SELECT id, name, status, created_at FROM v2_projects WHERE name ILIKE '%FS%' OR name ILIKE '%entrepreneurship%' OR name ILIKE '%DV%' ORDER BY created_at DESC LIMIT 20`);
    console.log("\n=== Production search results ===");
    if (pr.rows.length === 0) {
      console.log("Not found in production v2_projects either");
      // Check programs
      const pp = await pc.query(`SELECT id, name, status, created_at FROM v2_programs WHERE name ILIKE '%FS%' OR name ILIKE '%entrepreneurship%' ORDER BY created_at DESC LIMIT 20`);
      console.log("\n=== Programs in production ===");
      pp.rows.forEach(x => console.log(`${x.id}\t${x.status}\t${x.name?.substring(0,80)}`));
    } else {
      pr.rows.forEach(x => console.log(JSON.stringify(x, null, 2)));
    }
  } finally { await prodPool.end(); }
}
run().catch(console.error);
