const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

async function simulateLogin(email, password) {
  const pool = new Pool({
    connectionString: "postgresql://postgres.yakxdxdzuojafzdkqhjd:G8%26bM%3F!KujZwXDe@aws-0-eu-west-1.pooler.supabase.com:6543/postgres",
    ssl: { rejectUnauthorized: false }
  });

  try {
    const cleanEmail = email.trim().toLowerCase();
    
    // 1. Super Admin Hardcoded
    if ((cleanEmail === 'superadmin' || cleanEmail === 'superadmin@impactos.com' || cleanEmail === 'gwyn.ukoha@gmail.com') && password === 'access-2026') {
        console.log("MATCH: Hardcoded Super Admin");
        return;
    }

    // 2. DB Search
    const result = await pool.query("SELECT * FROM contacts WHERE (email = $1 OR id = $1) AND deleted = 0 LIMIT 1", [cleanEmail]);
    let user = result.rows[0];

    if (!user) {
        console.log("FAIL: User not found");
        return;
    }

    // 3. Verification
    const isHashed = user.password && user.password.startsWith('$2');
    let isMatch = false;
    if (isHashed) {
      isMatch = await bcrypt.compare(password, user.password);
    } else {
      isMatch = (password === user.password);
    }

    if (!isMatch) {
        console.log("FAIL: Password mismatch");
        return;
    }

    // 4. Assignments
    const pmAssignment = await pool.query("SELECT id FROM v2_programs WHERE assigned_pm_id = $1 LIMIT 1", [user.id || user.cid]);

    // 5. Role resolution
    let finalRole = 'participant';
    if (user.email?.toLowerCase() === 'gwyn.ukoha@gmail.com' || user.id === 'sa') {
      finalRole = 'super_admin';
    } 
    else if (pmAssignment.rows.length > 0) {
      finalRole = 'program_manager';
    } 
    else if (user.role === 'project_manager' || user.group_name?.toUpperCase() === 'STAFF' || user.group_name?.toUpperCase() === 'FUTURE STUDIO') {
      finalRole = 'staff';
    }

    console.log("SUCCESS: Logged in as", user.name);
    console.log("ROLE:", finalRole);

  } catch (e) {
    console.error(e);
  } finally {
    await pool.end();
  }
}

simulateLogin('april@gmail.com', '123456'); // I don't know her password, but I'll check the logic
