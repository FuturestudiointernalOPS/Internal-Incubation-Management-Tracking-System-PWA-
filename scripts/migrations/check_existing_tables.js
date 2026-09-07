const fs = require("fs");
const path = require("path");

const envPath = path.resolve(__dirname, "../../.env.local");
const envContent = fs.readFileSync(envPath, "utf-8");
const dbUrlMatch = envContent.match(/DATABASE_URL=(.+)/);
const DATABASE_URL = dbUrlMatch[1].trim();
console.log("✅ DATABASE_URL found");

const { Pool } = require("pg");
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  const client = await pool.connect();
  try {
    // Check if venture_documents exists
    const exists = await client.query(`
      SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'venture_documents')
    `);
    console.log(`venture_documents exists: ${exists.rows[0].exists}`);

    if (exists.rows[0].exists) {
      const cols = await client.query(`
        SELECT column_name, data_type FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'venture_documents'
        ORDER BY ordinal_position
      `);
      console.log("\nColumns:");
      cols.rows.forEach(r => console.log(`   ${r.column_name.padEnd(25)} ${r.data_type}`));
    }

    // Also check fundraising_opportunities
    const fExists = await client.query(`
      SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'fundraising_opportunities')
    `);
    console.log(`\nfundraising_opportunities exists: ${fExists.rows[0].exists}`);

    // Check all venture_* tables
    const allVenture = await client.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name LIKE 'venture_%'
      ORDER BY table_name
    `);
    console.log("\nAll venture_* tables:");
    allVenture.rows.forEach(r => console.log(`   ${r.table_name}`));
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(console.error);
