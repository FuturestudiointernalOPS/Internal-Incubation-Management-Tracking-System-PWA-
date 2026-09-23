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
    // Add weight and auto_weight columns to v2_kpis
    await client.query("ALTER TABLE v2_kpis ADD COLUMN IF NOT EXISTS weight DECIMAL(5,2) DEFAULT 0");
    console.log("✅ v2_kpis.weight added");
    await client.query("ALTER TABLE v2_kpis ADD COLUMN IF NOT EXISTS auto_weight BOOLEAN DEFAULT TRUE");
    console.log("✅ v2_kpis.auto_weight added");

    // Seed weights for existing KPIs — equal distribution per program
    const programs = await client.query("SELECT DISTINCT program_id FROM v2_kpis WHERE program_id IS NOT NULL");
    console.log(`   Found ${programs.rows.length} programs with KPIs`);
    
    for (const program of programs.rows) {
      const kpis = await client.query("SELECT id FROM v2_kpis WHERE program_id::text = $1", [program.program_id]);
      const count = kpis.rows.length;
      if (count === 0) continue;
      const equalWeight = parseFloat((100 / count).toFixed(2));
      let remaining = 100;
      for (let index = 0; index < count; index++) {
        const weight = index === count - 1 ? parseFloat(remaining.toFixed(2)) : equalWeight;
        remaining -= weight;
        await client.query("UPDATE v2_kpis SET weight = $1, auto_weight = TRUE WHERE id = $2", [weight, kpis.rows[index].id]);
      }
      console.log(`   ${program.program_id.substring(0,8)}... : ${count} KPIs → ${equalWeight}% each`);
    }
    console.log("✅ Weights seeded for all existing KPIs\n✅ Phase 1 complete");
  } finally { client.release(); await pool.end(); }
}
run().catch(console.error);
