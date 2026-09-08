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

async function run() {
  const client = await pool.connect();
  try {
    // 1. Check venture_milestones columns
    const cols = await client.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'venture_milestones'
      ORDER BY ordinal_position
    `);
    console.log("✅ Colonnes venture_milestones:");
    cols.rows.forEach(r => console.log(`   ${r.column_name}`));

    // 2. Add project_id if missing
    const hasProjectId = cols.rows.find(r => r.column_name === 'project_id');
    if (!hasProjectId) {
      await client.query("ALTER TABLE venture_milestones ADD COLUMN project_id TEXT");
      console.log("   ✅ project_id ajoutée");
    } else {
      console.log("   ✅ project_id déjà présente");
    }

    // 3. Create remaining tables
    console.log("\n🚀 Création des tables restantes...");
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS venture_deliverables (
          id SERIAL PRIMARY KEY,
          milestone_id INTEGER NOT NULL REFERENCES venture_milestones(id) ON DELETE CASCADE,
          venture_id TEXT NOT NULL REFERENCES ventures(venture_id) ON DELETE CASCADE,
          title TEXT NOT NULL,
          description TEXT,
          deliverable_type TEXT NOT NULL DEFAULT 'document',
          status TEXT NOT NULL DEFAULT 'pending',
          due_date TIMESTAMP,
          assigned_cid TEXT,
          attachment_url TEXT,
          attachment_name TEXT,
          approval_status TEXT DEFAULT 'pending',
          reviewer_cid TEXT,
          reviewer_name TEXT,
          reviewed_at TIMESTAMP,
          rejection_reason TEXT,
          created_by TEXT,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log("   ✅ venture_deliverables");

    await client.query(`
      CREATE TABLE IF NOT EXISTS venture_deliverable_reviews (
          id SERIAL PRIMARY KEY,
          deliverable_id INTEGER NOT NULL REFERENCES venture_deliverables(id) ON DELETE CASCADE,
          reviewer_cid TEXT NOT NULL,
          reviewer_name TEXT,
          decision TEXT NOT NULL,
          comments TEXT,
          created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log("   ✅ venture_deliverable_reviews");

    await client.query(`
      CREATE TABLE IF NOT EXISTS venture_milestone_activity (
          id SERIAL PRIMARY KEY,
          venture_id TEXT NOT NULL REFERENCES ventures(venture_id) ON DELETE CASCADE,
          milestone_id INTEGER REFERENCES venture_milestones(id) ON DELETE SET NULL,
          deliverable_id INTEGER REFERENCES venture_deliverables(id) ON DELETE SET NULL,
          action TEXT NOT NULL,
          actor_cid TEXT,
          actor_name TEXT,
          details JSONB DEFAULT '{}'::jsonb,
          created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log("   ✅ venture_milestone_activity");

    // 4. Create indexes
    console.log("\n📌 Création des index...");
    
    const indexes = [
      "CREATE INDEX IF NOT EXISTS idx_venture_milestones_venture_id ON venture_milestones(venture_id)",
      "CREATE INDEX IF NOT EXISTS idx_venture_milestones_status ON venture_milestones(status)",
      "CREATE INDEX IF NOT EXISTS idx_venture_milestones_project_id ON venture_milestones(project_id)",
      "CREATE INDEX IF NOT EXISTS idx_venture_deliverables_milestone_id ON venture_deliverables(milestone_id)",
      "CREATE INDEX IF NOT EXISTS idx_venture_deliverables_status ON venture_deliverables(status)",
      "CREATE INDEX IF NOT EXISTS idx_venture_deliverables_venture_id ON venture_deliverables(venture_id)",
      "CREATE INDEX IF NOT EXISTS idx_deliverable_reviews_deliverable_id ON venture_deliverable_reviews(deliverable_id)",
      "CREATE INDEX IF NOT EXISTS idx_milestone_activity_venture_id ON venture_milestone_activity(venture_id)",
      "CREATE INDEX IF NOT EXISTS idx_milestone_activity_milestone_id ON venture_milestone_activity(milestone_id)",
    ];

    for (const idx of indexes) {
      try {
        await client.query(idx);
        console.log(`   ✅ ${idx.substring(0, 80)}`);
      } catch (err) {
        if (err.message.includes("already exists")) {
          console.log(`   ⏭️  ${idx.substring(0, 60)}`);
        } else {
          console.error(`   ❌ ${err.message.substring(0, 120)}`);
        }
      }
    }

    console.log("\n✅ Migration Milestones & Deliverables terminée avec succès !");
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(console.error);
