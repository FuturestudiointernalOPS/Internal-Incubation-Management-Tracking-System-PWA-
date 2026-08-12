/**
 * Create 2 test staff users for Developer Tools impersonation.
 * Run: node scripts/create-test-staff.js
 */
const { Pool } = require("pg");
const bcrypt = require("bcrypt");

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  const password = "@belimpactos";
  const hash = await bcrypt.hash(password, 10);

  const users = [
    { cid: "staff-test-1", name: "Test Staff Alpha", email: "test.alpha@futurestudio.bj" },
    { cid: "staff-test-2", name: "Test Staff Beta",  email: "test.beta@futurestudio.bj" },
  ];

  for (const u of users) {
    await pool.query(
      `INSERT INTO contacts (cid, name, email, group_name, role, password, status, deleted, language)
       VALUES ($1, $2, $3, 'FUTURE STUDIO', 'staff', $4, 'active', 0, 'en')
       ON CONFLICT (cid) DO UPDATE SET status = 'active', password = $4`,
      [u.cid, u.name, u.email, hash]
    );
    console.log(`Created: ${u.name} (${u.email})`);
  }

  await pool.end();
  console.log("Done. Both staff now visible in Developer Tools.");
}

main().catch(e => { console.error(e); process.exit(1); });
