const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');

const pool = new Pool({
  connectionString: "postgresql://postgres.yakxdxdzuojafzdkqhjd:G8%26bM%3F!KujZwXDe@aws-0-eu-west-1.pooler.supabase.com:6543/postgres",
  ssl: { rejectUnauthorized: false }
});

async function seed() {
    console.log("--- INJECTING UAT CREDENTIAL MATRIX ---");
    try {
        // 1. CLEAR EXISTING TEST DATA (Optional, we'll use ON CONFLICT)
        
        // 2. SUPERADMIN & STAFF
        const staff = [
          [uuidv4(), "Master Admin", "admin@impactos.com", "+2348000000001", "super_admin", "active", "FUTURE STUDIO", "AdminPass2026!"],
          [uuidv4(), "Alex Rivera (PM)", "pm.alex@impactos.com", "+2348000000002", "program_manager", "active", "FUTURE STUDIO", "PMPass2026!"],
          [uuidv4(), "Sarah Chen", "staff.sarah@impactos.com", "+2348000000003", "staff", "active", "FUTURE STUDIO", "StaffPass2026!"],
          [uuidv4(), "Mike Okoro", "staff.mike@impactos.com", "+2348000000004", "staff", "active", "FUTURE STUDIO", "StaffPass2026!"],
        ];

        for (const s of staff) {
          await pool.query(
            "INSERT INTO contacts (cid, name, email, phone, role, status, group_name, password) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (email) DO UPDATE SET password = $8, role = $5, status = $6",
            s
          );
        }

        // 3. PROGRAM & SEGMENT
        const progId = "P-2026-MASTER-UAT";
        await pool.query("INSERT INTO v2_programs (id, name, status, is_archived) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING", 
            [progId, "Master UAT Accelerator", "active", 0]);
        
        await pool.query("INSERT INTO families (name, registration_id, program_id, type, shared_email, shared_password_read, shared_password_edit) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING",
            ["SolarEdge Ventures", "REG-CORP-UAT", progId, "company", "ventures@solaredge.com", "ReadKey2026", "EditKey2026"]);

        // 4. PARTICIPANTS (Users 1-5)
        for (let i = 1; i <= 5; i++) {
          await pool.query(
            "INSERT INTO contacts (cid, name, email, phone, role, status, group_name, password) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (email) DO UPDATE SET password = $8",
            [uuidv4(), `Demo User ${i}`, `user.${i}@demo.com`, `+234700000000${i}`, "participant", "active", "UAT Students", "UserPass2026!"]
          );
        }

        console.log("✅ ALL UAT CREDENTIALS INJECTED SUCCESSFULLY.");
    } catch (e) {
        console.error("❌ Injection Error:", e.message);
    } finally {
        await pool.end();
    }
}

seed();
