// Diagnostic script — check ventures table state
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
    // Check if ventures table exists and its columns
    const tables = await client.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name IN ('ventures', 'venture_founders', 'venture_members')
      ORDER BY table_name
    `);
    console.log("✅ Tables existantes:");
    tables.rows.forEach(r => console.log(`   - ${r.table_name}`));

    // Check ventures columns
    const cols = await client.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'ventures'
      ORDER BY ordinal_position
    `);
    console.log("\n✅ Colonnes de ventures:");
    cols.rows.forEach(r => console.log(`   ${r.column_name.padEnd(25)} ${r.data_type.padEnd(15)} ${r.is_nullable}`));

    // Check constraints on ventures
    const constraints = await client.query(`
      SELECT conname, contype, pg_get_constraintdef(oid) as def
      FROM pg_constraint 
      WHERE conrelid = 'ventures'::regclass
    `);
    console.log("\n✅ Contraintes sur ventures:");
    constraints.rows.forEach(r => console.log(`   ${r.conname} (${r.contype}): ${r.def}`));

    // Check if venture_id has unique values
    const dupes = await client.query(`
      SELECT venture_id, COUNT(*) FROM ventures 
      WHERE venture_id IS NOT NULL 
      GROUP BY venture_id 
      HAVING COUNT(*) > 1
    `);
    console.log(`\n✅ Doublons venture_id: ${dupes.rows.length}`);
    
    // Check null venture_ids
    const nulls = await client.query(`SELECT COUNT(*) FROM ventures WHERE venture_id IS NULL`);
    console.log(`✅ venture_id NULL: ${nulls.rows[0].count}`);

    // Try adding constraint with diagnostic
    try {
      await client.query(`ALTER TABLE ventures ADD CONSTRAINT ventures_venture_id_key UNIQUE (venture_id)`);
      console.log("\n✅ Contrainte UNIQUE ajoutée avec succès !");
    } catch (err) {
      console.log(`\n❌ Erreur contrainte: ${err.message}`);
    }

  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(console.error);
