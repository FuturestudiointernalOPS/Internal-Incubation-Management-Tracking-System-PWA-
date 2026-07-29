const fs = require("fs");
const path = require("path");

const envPath = path.resolve(__dirname, "../.env.local");
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
    // Search for the project by name pattern
    const result = await client.query(`
      SELECT id, name, status, meta, start_date, end_date, 
             owner_id, program_id::text, priority, created_at
      FROM v2_projects 
      WHERE name ILIKE '%entrepreneurship%' 
         OR name ILIKE '%entreprenruship%'
         OR name ILIKE '%FS <%'
         OR name ILIKE '%FS <>%'
      ORDER BY created_at DESC
    `);

    if (result.rows.length === 0) {
      // Try a broader search
      const broader = await client.query(`
        SELECT id, name, status, created_at 
        FROM v2_projects 
        WHERE name ILIKE '%FS%' AND name ILIKE '%DV%'
        ORDER BY created_at DESC
      `);
      
      if (broader.rows.length === 0) {
        console.log("❌ No project found with that name in v2_projects");
        
        // Check v2_programs
        const progResult = await client.query(`
          SELECT id, name, status, description, start_date, end_date,
                 assigned_pm_id, visibility, created_at
          FROM v2_programs 
          WHERE name ILIKE '%entrepreneurship%' 
             OR name ILIKE '%entreprenruship%'
             OR name ILIKE '%FS%'
          ORDER BY created_at DESC
        `);
        
        if (progResult.rows.length > 0) {
          console.log("\n✅ Found in v2_programs instead:");
          progResult.rows.forEach(r => {
            console.log(`\n   ID: ${r.id}`);
            console.log(`   Name: ${r.name}`);
            console.log(`   Status: ${r.status}`);
            console.log(`   Description: ${(r.description || '').substring(0, 200)}`);
            console.log(`   Start: ${r.start_date}`);
            console.log(`   End: ${r.end_date}`);
            console.log(`   Assigned PM: ${r.assigned_pm_id}`);
            console.log(`   Visibility: ${r.visibility}`);
            console.log(`   Created: ${r.created_at}`);
          });
        } else {
          console.log("❌ Also not found in v2_programs");
        }
        return;
      }
      
      result.rows = broader.rows;
    }

    console.log("✅ Project(s) found:\n");
    result.rows.forEach(r => {
      console.log(`   ID: ${r.id}`);
      console.log(`   Name: ${r.name}`);
      console.log(`   Status: ${r.status}`);
      console.log(`   Description: ${(r.description || '').substring(0, 300)}`);
      console.log(`   Start: ${r.start_date}`);
      console.log(`   End: ${r.end_date}`);
      console.log(`   Owner: ${r.owner_id}`);
      console.log(`   Program ID: ${r.program_id}`);
      console.log(`   Priority: ${r.priority}`);
      console.log(`   Meta: ${r.meta || '{}'}`);
      console.log(`   Created: ${r.created_at}`);
      console.log(`\n   ---\n`);
    });
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(console.error);
