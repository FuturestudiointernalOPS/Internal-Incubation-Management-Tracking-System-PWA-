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
    // Check venture_milestones columns with types
    const cols = await client.query(`
      SELECT column_name, data_type, udt_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'venture_milestones'
      ORDER BY ordinal_position
    `);
    console.log("✅ venture_milestones:");
    cols.rows.forEach(r => console.log(`   ${r.column_name.padEnd(20)} ${r.data_type.padEnd(15)} ${r.udt_name}`));

    // Check venture_deliverables
    const del = await client.query(`
      SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'venture_deliverables')
    `);
    console.log(`\n✅ venture_deliverables existe: ${del.rows[0].exists}`);

    // Check if other tables from this migration already exist
    const tables = ['venture_deliverables', 'venture_deliverable_reviews', 'venture_milestone_activity'];
    for (const t of tables) {
      const res = await client.query(
        `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1)`,
        [t]
      );
      console.log(`   ${t}: ${res.rows[0].exists}`);
    }

    // Now create with correct types (UUID for milestone_id)
    console.log("\n🚀 Création des tables avec les bons types...");

    if (!del.rows[0].exists) {
      await client.query(`
        CREATE TABLE venture_deliverables (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            milestone_id UUID NOT NULL REFERENCES venture_milestones(id) ON DELETE CASCADE,
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
      console.log("   ✅ venture_deliverables créée");
    } else {
      console.log("   ⏭️  venture_deliverables existe déjà");
    }

    // Check if venture_deliverable_reviews exists
    const reviewsExist = await client.query(
      `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'venture_deliverable_reviews')`
    );
    if (!reviewsExist.rows[0].exists) {
      await client.query(`
        CREATE TABLE venture_deliverable_reviews (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            deliverable_id UUID NOT NULL REFERENCES venture_deliverables(id) ON DELETE CASCADE,
            reviewer_cid TEXT NOT NULL,
            reviewer_name TEXT,
            decision TEXT NOT NULL,
            comments TEXT,
            created_at TIMESTAMP DEFAULT NOW()
        )
      `);
      console.log("   ✅ venture_deliverable_reviews créée");
    } else {
      console.log("   ⏭️  venture_deliverable_reviews existe déjà");
    }

    // Check if venture_milestone_activity exists
    const activityExist = await client.query(
      `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'venture_milestone_activity')`
    );
    if (!activityExist.rows[0].exists) {
      await client.query(`
        CREATE TABLE venture_milestone_activity (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            venture_id TEXT NOT NULL REFERENCES ventures(venture_id) ON DELETE CASCADE,
            milestone_id UUID REFERENCES venture_milestones(id) ON DELETE SET NULL,
            deliverable_id UUID REFERENCES venture_deliverables(id) ON DELETE SET NULL,
            action TEXT NOT NULL,
            actor_cid TEXT,
            actor_name TEXT,
            details JSONB DEFAULT '{}'::jsonb,
            created_at TIMESTAMP DEFAULT NOW()
        )
      `);
      console.log("   ✅ venture_milestone_activity créée");
    } else {
      console.log("   ⏭️  venture_milestone_activity existe déjà");
    }

    // Create indexes
    console.log("\n📌 Création des index...");
    const indexes = [
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
        if (err.message.includes("already exists") || err.message.includes("already")) {
          console.log(`   ⏭️  ${idx.substring(0, 60)}`);
        } else {
          console.error(`   ❌ ${err.message.substring(0, 120)}`);
        }
      }
    }

    console.log("\n✅ Migration Milestones & Deliverables terminée !");
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(console.error);
