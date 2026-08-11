const fs = require("fs");
const path = require("path");
const DATABASE_URL = fs.readFileSync(path.resolve(__dirname, "../.env.local"), "utf-8").match(/DATABASE_URL=(.+)/)[1].trim();
const { Pool } = require("pg");
const pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function run() {
  const client = await pool.connect();
  try {
    const programs = await client.query("SELECT id FROM v2_programs ORDER BY created_at DESC");
    let seeded = 0, skipped = 0;
    
    for (const p of programs.rows) {
      const kpis = await client.query("SELECT * FROM v2_kpis WHERE program_id::text = $1", [p.id]);
      if (kpis.rows.length === 0) { skipped++; continue; }

      const pc = await client.query("SELECT COUNT(*) AS c FROM v2_participants WHERE program_id::text = $1 AND (status IS NULL OR status != 'archived')", [p.id]);
      const total = parseInt(pc.rows[0]?.c) || 1;

      for (const kpi of kpis.rows) {
        // Count unique approved participants for deliverables linked to this KPI
        const app = await client.query(
          `SELECT COUNT(DISTINCT s.participant_id) AS c
           FROM v2_submissions s
           WHERE s.program_id::text = $1 AND s.status = 'approved'
           AND s.deliverable_id IN (
             SELECT DISTINCT id::text FROM v2_document_requirements WHERE program_id::text = $1 AND kpi_ids LIKE $2
           )`,
          [p.id, `%${kpi.id}%`]
        );
        const approved = parseInt(app.rows[0]?.c) || 0;
        const rate = total > 0 ? Math.round((approved / total) * 100) : 0;

        await client.query(
          `INSERT INTO kpi_progress (program_id, kpi_id, kpi_name, completion_rate, participant_count, approved_count, calculated_at)
           VALUES ($1, $2, $3, $4, $5, $6, NOW())
           ON CONFLICT (program_id, kpi_id) DO UPDATE SET completion_rate = $4, participant_count = $5, approved_count = $6, kpi_name = $3, calculated_at = NOW()`,
          [String(p.id), String(kpi.id), (kpi.title || "").substring(0, 255), rate, total, approved]
        );
      }
      seeded++;
      if (seeded % 5 === 0) console.log(`   Seeded ${seeded} programs...`);
    }
    console.log(`\n✅ Done: ${seeded} programs seeded, ${skipped} skipped (no KPIs)`);
  } finally { client.release(); await pool.end(); }
}
run().catch(console.error);
