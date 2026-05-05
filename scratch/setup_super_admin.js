const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

async function setupSuperAdmin() {
  const pool = new Pool({
    connectionString: "postgresql://postgres.yakxdxdzuojafzdkqhjd:G8%26bM%3F!KujZwXDe@aws-0-eu-west-1.pooler.supabase.com:6543/postgres",
    ssl: { rejectUnauthorized: false }
  });

  try {
    const email = 'gwyn.ukoha@gmail.com';
    const rawPassword = 'access-2026';
    const hashedPassword = await bcrypt.hash(rawPassword, 10);

    // 1. Check if Gwyn exists
    const result = await pool.query("SELECT * FROM contacts WHERE email = $1 LIMIT 1", [email]);
    
    if (result.rows.length > 0) {
      console.log("Found Gwyn. Updating password and role...");
      await pool.query(
        "UPDATE contacts SET password = $1, role = 'super_admin', status = 'active', deleted = 0 WHERE email = $2",
        [hashedPassword, email]
      );
      console.log("Super Admin updated successfully.");
    } else {
      console.log("Gwyn not found. Creating new Super Admin...");
      await pool.query(
        "INSERT INTO contacts (cid, id, name, email, password, role, group_name, status, deleted) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
        ['sa', 'sa', 'Gwyn Ukoha', email, hashedPassword, 'super_admin', 'STAFF', 'active', 0]
      );
      console.log("Super Admin created successfully.");
    }

  } catch (e) {
    console.error(e);
  } finally {
    await pool.end();
  }
}

setupSuperAdmin();
