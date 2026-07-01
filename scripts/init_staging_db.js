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
    // Additional tables referenced by API routes but missing from schema SQL
    const extraTables = [
      'CREATE TABLE IF NOT EXISTS campaigns (id SERIAL PRIMARY KEY, name TEXT NOT NULL, status TEXT DEFAULT \'draft\', form_id TEXT, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW())',
      'CREATE TABLE IF NOT EXISTS campaign_steps (id SERIAL PRIMARY KEY, campaign_id INTEGER NOT NULL, step_order INTEGER NOT NULL, subject TEXT, body TEXT, delay_hours INTEGER DEFAULT 0, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW())',
      'CREATE TABLE IF NOT EXISTS campaign_contacts (id SERIAL PRIMARY KEY, campaign_id INTEGER NOT NULL, contact_cid TEXT NOT NULL, status TEXT DEFAULT \'pending\', sent_at TIMESTAMP WITH TIME ZONE, UNIQUE(campaign_id, contact_cid))',
      'CREATE TABLE IF NOT EXISTS forms (id SERIAL PRIMARY KEY, name TEXT NOT NULL, target_group TEXT, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW())',
      'CREATE TABLE IF NOT EXISTS form_responses (id SERIAL PRIMARY KEY, form_id INTEGER NOT NULL, respondent_cid TEXT, respondent_name TEXT, respondent_group TEXT, data JSONB, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW())',
      'CREATE TABLE IF NOT EXISTS kpi_progress (id SERIAL PRIMARY KEY, program_id TEXT, kpi_name TEXT NOT NULL, target REAL, current REAL, updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW())',
      'CREATE TABLE IF NOT EXISTS participant_program_audit (id SERIAL PRIMARY KEY, participant_id TEXT NOT NULL, program_id TEXT NOT NULL, action TEXT NOT NULL, performed_by TEXT, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW())',
      'CREATE TABLE IF NOT EXISTS password_setup_tokens (id SERIAL PRIMARY KEY, contact_cid TEXT NOT NULL, token TEXT NOT NULL UNIQUE, used INTEGER DEFAULT 0, expires_at TIMESTAMP WITH TIME ZONE NOT NULL, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW())',
      'CREATE TABLE IF NOT EXISTS project_approval_requests (id SERIAL PRIMARY KEY, project_id TEXT NOT NULL, requested_by TEXT, request_type TEXT, status TEXT DEFAULT \'pending\', created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW())',
      'CREATE TABLE IF NOT EXISTS project_members (id SERIAL PRIMARY KEY, project_id TEXT NOT NULL, user_cid TEXT NOT NULL, role TEXT DEFAULT \'collaborator\', UNIQUE(project_id, user_cid))',
      'CREATE TABLE IF NOT EXISTS segments (id SERIAL PRIMARY KEY, name TEXT NOT NULL, criteria JSONB, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW())',
      'CREATE TABLE IF NOT EXISTS task_audit_logs (id SERIAL PRIMARY KEY, task_id INTEGER NOT NULL, user_cid TEXT, action TEXT NOT NULL, old_value TEXT, new_value TEXT, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW())',
      'CREATE TABLE IF NOT EXISTS task_resources (id SERIAL PRIMARY KEY, task_id INTEGER NOT NULL, name TEXT, url TEXT NOT NULL, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW())',
      'CREATE TABLE IF NOT EXISTS v2_attendance (id SERIAL PRIMARY KEY, session_id INTEGER, participant_id TEXT, status TEXT DEFAULT \'present\', created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW())',
      'CREATE TABLE IF NOT EXISTS v2_checkins (id SERIAL PRIMARY KEY, participant_id TEXT NOT NULL, program_id TEXT, checkin_date DATE DEFAULT CURRENT_DATE, status TEXT DEFAULT \'checked_in\', notes TEXT, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW())',
      'CREATE TABLE IF NOT EXISTS v2_invitations (id SERIAL PRIMARY KEY, email TEXT NOT NULL, token TEXT NOT NULL UNIQUE, role TEXT DEFAULT \'participant\', group_name TEXT, program_id TEXT, team_id TEXT, used INTEGER DEFAULT 0, expires_at TIMESTAMP WITH TIME ZONE, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW())',
      'CREATE TABLE IF NOT EXISTS v2_project_staff (id SERIAL PRIMARY KEY, project_id TEXT NOT NULL, staff_cid TEXT NOT NULL, role TEXT DEFAULT \'member\', UNIQUE(project_id, staff_cid))',
      'CREATE TABLE IF NOT EXISTS v2_project_updates (id SERIAL PRIMARY KEY, project_id TEXT NOT NULL, user_cid TEXT, overall_status TEXT, accomplishments TEXT, current_focus TEXT, blockers TEXT, next_steps TEXT, created_week INTEGER, created_year INTEGER, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW())',
      'CREATE TABLE IF NOT EXISTS v2_reflections (id SERIAL PRIMARY KEY, user_id TEXT NOT NULL, user_name TEXT, content TEXT, week_number INTEGER, year INTEGER, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW())',
      'CREATE TABLE IF NOT EXISTS v2_retros (id SERIAL PRIMARY KEY, user_id TEXT NOT NULL, user_name TEXT, week_number INTEGER, year INTEGER, status TEXT, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW())',
      'CREATE TABLE IF NOT EXISTS v2_standups (id SERIAL PRIMARY KEY, user_id TEXT NOT NULL, user_name TEXT, week_number INTEGER, year INTEGER, status TEXT DEFAULT \'submitted\', created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW())',
      'CREATE TABLE IF NOT EXISTS v2_standard_types (id SERIAL PRIMARY KEY, name TEXT NOT NULL UNIQUE, description TEXT, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW())',
      'CREATE TABLE IF NOT EXISTS work_categories (id SERIAL PRIMARY KEY, name TEXT NOT NULL UNIQUE, description TEXT, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW())',
    ];
    for (const sql of extraTables) {
      await pool.query(sql);
    }
    console.log("   ✅ 23 additional tables (campaigns, forms, projects, standups, retros, etc.)");

    console.log("\n🎉 Staging database initialized!");
  } catch (err) {
    console.error("\n❌ Fatal:", err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

init();
