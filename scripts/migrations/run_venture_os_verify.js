const fs = require("fs");
const path = require("path");

const envPath = path.resolve(__dirname, "../../.env.local");
const envContent = fs.readFileSync(envPath, "utf-8");
const dbUrlMatch = envContent.match(/DATABASE_URL=(.+)/);
const DATABASE_URL = dbUrlMatch[1].trim();

const { Pool } = require("pg");
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  const client = await pool.connect();
  try {
    // Check if the new tables exist
    const tables = await client.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('startup_profiles', 'startup_profile_progress', 'startup_profile_documents')
      ORDER BY table_name
    `);
    console.log("✅ Nouvelles tables:");
    tables.rows.forEach(r => console.log(`   ✅ ${r.table_name}`));

    if (tables.rows.length < 3) {
      console.log("\n⚠️  Certaines tables manquent — recréation...");
      
      if (!tables.rows.find(r => r.table_name === 'startup_profiles')) {
        await client.query(`
          CREATE TABLE IF NOT EXISTS startup_profiles (
              id SERIAL PRIMARY KEY,
              venture_id TEXT NOT NULL REFERENCES ventures(venture_id) ON DELETE CASCADE,
              step_1_data JSONB DEFAULT '{}'::jsonb,
              step_2_data JSONB DEFAULT '{}'::jsonb,
              step_3_data JSONB DEFAULT '{}'::jsonb,
              step_4_data JSONB DEFAULT '{}'::jsonb,
              step_5_data JSONB DEFAULT '{}'::jsonb,
              is_submitted BOOLEAN DEFAULT FALSE,
              submitted_at TIMESTAMP,
              created_at TIMESTAMP DEFAULT NOW(),
              updated_at TIMESTAMP DEFAULT NOW()
          )
        `);
        console.log("   ✅ startup_profiles créée");
      }
      
      if (!tables.rows.find(r => r.table_name === 'startup_profile_progress')) {
        await client.query(`
          CREATE TABLE IF NOT EXISTS startup_profile_progress (
              id SERIAL PRIMARY KEY,
              venture_id TEXT NOT NULL REFERENCES ventures(venture_id) ON DELETE CASCADE,
              current_step INTEGER NOT NULL DEFAULT 1,
              completion_percentage INTEGER NOT NULL DEFAULT 0,
              last_completed_step INTEGER DEFAULT 0,
              is_completed BOOLEAN DEFAULT FALSE,
              last_updated TIMESTAMP DEFAULT NOW(),
              created_at TIMESTAMP DEFAULT NOW()
          )
        `);
        console.log("   ✅ startup_profile_progress créée");
      }
      
      if (!tables.rows.find(r => r.table_name === 'startup_profile_documents')) {
        await client.query(`
          CREATE TABLE IF NOT EXISTS startup_profile_documents (
              id SERIAL PRIMARY KEY,
              venture_id TEXT NOT NULL REFERENCES ventures(venture_id) ON DELETE CASCADE,
              document_type TEXT NOT NULL,
              file_name TEXT NOT NULL,
              file_size BIGINT,
              file_type TEXT,
              file_url TEXT NOT NULL,
              uploaded_by TEXT,
              uploaded_at TIMESTAMP DEFAULT NOW(),
              UNIQUE(venture_id, document_type, file_name)
          )
        `);
        console.log("   ✅ startup_profile_documents créée");
      }
    }

    // Add indexes if missing
    await client.query(`CREATE INDEX IF NOT EXISTS idx_startup_profiles_venture_id ON startup_profiles(venture_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_startup_profile_progress_venture_id ON startup_profile_progress(venture_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_startup_profile_docs_venture_id ON startup_profile_documents(venture_id)`);
    console.log("\n✅ Tous les index créés");

    // Show final column counts
    for (const t of ['startup_profiles', 'startup_profile_progress', 'startup_profile_documents']) {
      const cols = await client.query(
        `SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1`,
        [t]
      );
      console.log(`   ${t}: ${cols.rows[0].count} colonnes`);
    }

    console.log("\n✅ Migration Venture OS terminée avec succès !");
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(console.error);
