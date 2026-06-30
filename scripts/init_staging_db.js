/**
 * INIT STAGING DATABASE
 * Runs the full schema and seeds users.
 * node scripts/init_staging_db.js
 */
const { Pool } = require("pg");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

// Read DATABASE_URL from .env.local
const envPath = path.resolve(__dirname, "../.env.local");
const envContent = fs.readFileSync(envPath, "utf-8");
const match = envContent.match(/DATABASE_URL=(.+)/);
if (!match) {
  console.error("❌ DATABASE_URL not found in .env.local");
  process.exit(1);
}
const DATABASE_URL = match[1].trim();

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function runSqlFile(filePath, label) {
  console.log(`\n📄 ${label}...`);
  const sql = fs.readFileSync(filePath, "utf-8");
  const client = await pool.connect();
  try {
    await client.query(sql);
    console.log("   ✅ Done");
  } catch (err) {
    console.error(`   ❌ ${err.message.substring(0, 200)}`);
    throw err;
  } finally {
    client.release();
  }
}

async function seedUsers() {
  console.log("\n👥 Seeding users...");
  const defaultPassword = "ImpactOS2026!";
  const hashedPassword = await bcrypt.hash(defaultPassword, 10);

  const users = [
    {
      name: "Super Admin",
      email: "superadmin@impactos.staging",
      role: "super_admin",
      group: "FUTURE STUDIO",
      status: "active",
    },
    {
      name: "Staff One",
      email: "staff1@impactos.staging",
      role: "staff",
      group: "FUTURE STUDIO",
      status: "active",
    },
    {
      name: "Staff Two",
      email: "staff2@impactos.staging",
      role: "staff",
      group: "FUTURE STUDIO",
      status: "active",
    },
    {
      name: "Participant",
      email: "participant@impactos.staging",
      role: "participant",
      group: "FUTURE STUDIO INTERNS",
      status: "active",
    },
    {
      name: "Developer",
      email: "developer@impactos.staging",
      role: "developer",
      group: "FUTURE STUDIO INTERNS",
      status: "active",
    },
    {
      name: "Program Manager",
      email: "pm@impactos.staging",
      role: "program_manager",
      group: "FUTURE STUDIO",
      status: "active",
    },
    {
      name: "Teacher",
      email: "teacher@impactos.staging",
      role: "teacher",
      group: "FUTURE STUDIO",
      status: "active",
    },
    {
      name: "Admin",
      email: "admin@impactos.staging",
      role: "admin",
      group: "FUTURE STUDIO",
      status: "active",
    },
    {
      name: "Investor",
      email: "investor@impactos.staging",
      role: "investor",
      group: "FUTURE STUDIO",
      status: "active",
    },
    {
      name: "Mentor",
      email: "mentor@impactos.staging",
      role: "mentor",
      group: "FUTURE STUDIO",
      status: "active",
    },
  ];

  console.log(`   🔑 Default password: ${defaultPassword}\n`);

  for (const u of users) {
    const cid = `USR-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
    try {
      await pool.query(
        `INSERT INTO contacts (cid, name, email, role, group_name, password, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (email) DO UPDATE SET password = $6, role = $4, status = $7`,
        [cid, u.name, u.email, u.role, u.group, hashedPassword, u.status],
      );
      console.log(`   ✅ ${u.role.padEnd(18)} | ${u.email}`);
    } catch (err) {
      console.error(`   ❌ ${u.role.padEnd(18)} | ${u.email} | ${err.message}`);
    }
  }

  const count = await pool.query(
    "SELECT role, COUNT(*)::int FROM contacts WHERE deleted = 0 GROUP BY role ORDER BY role",
  );
  console.log("\n📊 Users by role:");
  count.rows.forEach((r) =>
    console.log(`   ${r.role.padEnd(18)} : ${r.count}`),
  );
}

async function init() {
  try {
    // Step 1: Base schema
    await runSqlFile(
      path.resolve(__dirname, "../supabase/v2_schema_init.sql"),
      "Running v2_schema_init.sql (base tables)",
    );

    // Step 2: Auth + access profiles + groups
    await runSqlFile(
      path.resolve(__dirname, "../src/migrations/complete_setup.sql"),
      "Running complete_setup.sql (auth, profiles, groups)",
    );

    // Step 3: Seed access profiles
    await runSqlFile(
      path.resolve(__dirname, "../src/migrations/seed_access_profiles.sql"),
      "Running seed_access_profiles.sql",
    );

    // Step 4: Seed responsibilities
    await runSqlFile(
      path.resolve(__dirname, "../src/migrations/seed_responsibilities.sql"),
      "Running seed_responsibilities.sql",
    );

    // Step 5: Seed users
    await seedUsers();

    // Step 6: Fixup — missing tables/columns not in schema SQL
    console.log("\n🔧 Applying fixups...");
    await pool.query("CREATE TABLE IF NOT EXISTS families (id SERIAL PRIMARY KEY, name TEXT NOT NULL, registration_id TEXT, program_id TEXT, type TEXT DEFAULT 'individual', shared_email TEXT, shared_password_read TEXT, shared_password_edit TEXT, description TEXT, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW())");
    console.log("   ✅ families table");
    await pool.query("ALTER TABLE v2_programs ADD COLUMN IF NOT EXISTS assigned_assistant_id TEXT");
    console.log("   ✅ v2_programs.assigned_assistant_id");
    await pool.query("ALTER TABLE v2_programs ADD COLUMN IF NOT EXISTS is_archived INTEGER DEFAULT 0");
    console.log("   ✅ v2_programs.is_archived");
    await pool.query("ALTER TABLE v2_programs ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active'");
    console.log("   ✅ v2_programs.status");
    await pool.query("ALTER TABLE v2_programs ADD COLUMN IF NOT EXISTS note_id TEXT");
    console.log("   ✅ v2_programs.note_id");
    await pool.query("CREATE TABLE IF NOT EXISTS participant_programs (id SERIAL PRIMARY KEY, participant_id TEXT NOT NULL, program_id TEXT NOT NULL, enrolled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), UNIQUE(participant_id, program_id))");
    console.log("   ✅ participant_programs table");

    console.log("\n🎉 Staging database initialized!");
  } catch (err) {
    console.error("\n❌ Fatal:", err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

init();
