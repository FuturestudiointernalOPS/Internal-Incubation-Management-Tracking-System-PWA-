/**
 * Direct DB E2E test for Permissions system.
 * Reads .env.local manually and tests the database layer directly.
 */
const fs = require("fs");
const path = require("path");

// Read DATABASE_URL from .env.local
const envPath = path.resolve(__dirname, "../.env.local");
const envContent = fs.readFileSync(envPath, "utf-8");
const match = envContent.match(/DATABASE_URL=(.+)/);
if (!match) {
  console.error("❌ DATABASE_URL not found");
  process.exit(1);
}

const { Pool } = require("pg");
const pool = new Pool({
  connectionString: match[1].trim(),
  ssl: { rejectUnauthorized: false },
});

const RESULTS = { passed: 0, failed: 0 };
function test(name, condition, detail) {
  if (condition) {
    RESULTS.passed++;
  } else {
    RESULTS.failed++;
  }
  console.log(
    `  ${condition ? "✅" : "❌"} ${name}${detail ? " — " + detail : ""}`,
  );
}

async function run() {
  console.log("═══════════════════════════════════════════");
  console.log("  PERMISSIONS — BACKEND E2E TEST");
  console.log("═══════════════════════════════════════════\n");

  const client = await pool.connect();
  try {
    // 1. Schema
    console.log("─── 1. Schema ───");
    const tables = [
      "role_capabilities",
      "user_capabilities",
      "user_capability_restrictions",
      "permission_audit_log",
    ];
    for (const t of tables) {
      const r = await client.query(
        `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = '${t}')`,
      );
      test(`Table: ${t}`, r.rows[0].exists);
    }

    // 2. Seed
    console.log("\n─── 2. Seed ───");
    await client.query(`INSERT INTO role_capabilities (role, module, capability, access_level) VALUES
      ('super_admin', 'projects', 'view', 5), ('super_admin', 'projects', 'create', 5),
      ('super_admin', 'users', 'view', 5), ('super_admin', 'permissions', 'grant', 5),
      ('super_admin', 'engineering', 'view', 5), ('super_admin', 'engineering', 'manage_tasks', 5),
      ('staff', 'projects', 'view', 1), ('staff', 'messaging', 'send', 2)
      ON CONFLICT (role, module, capability) DO UPDATE SET access_level = EXCLUDED.access_level`);
    const sc = await client.query(
      "SELECT COUNT(*) as c FROM role_capabilities",
    );
    test(
      "Defaults seeded",
      parseInt(sc.rows[0].c) >= 8,
      `${sc.rows[0].c} total rows`,
    );

    // 3. Grant
    console.log("\n─── 3. Grant ───");
    await client.query(`INSERT INTO user_capabilities (user_cid, module, capability, access_level, granted_by)
      VALUES ('sa', 'settings', 'edit', 3, 'sa')
      ON CONFLICT (user_cid, module, capability) DO UPDATE SET access_level = 3`);
    const gc = await client.query(
      "SELECT * FROM user_capabilities WHERE user_cid='sa' AND module='settings'",
    );
    test(
      "Grant stored",
      gc.rows.length > 0,
      `level=${gc.rows[0].access_level}`,
    );

    // 4. Temporary grant
    console.log("\n─── 4. Temporary Grant ───");
    await client.query(`INSERT INTO user_capabilities (user_cid, module, capability, access_level, granted_by, expires_at)
      VALUES ('sa', 'reports', 'export', 2, 'sa', NOW()+INTERVAL '7 days')
      ON CONFLICT (user_cid, module, capability) DO UPDATE SET access_level=2, expires_at=NOW()+INTERVAL '7 days'`);
    const tc = await client.query(
      "SELECT expires_at FROM user_capabilities WHERE user_cid='sa' AND module='reports'",
    );
    test("Temporary grant has expiry", tc.rows[0]?.expires_at != null);

    // 5. Restriction
    console.log("\n─── 5. Restriction ───");
    await client.query(`INSERT INTO user_capability_restrictions (user_cid, module, capability, restricted_by)
      VALUES ('sa', 'users', 'delete', 'sa') ON CONFLICT DO NOTHING`);
    const rc = await client.query(
      "SELECT COUNT(*) as c FROM user_capability_restrictions WHERE user_cid='sa'",
    );
    test("Restriction stored", parseInt(rc.rows[0].c) > 0);

    // 6. Resolution check (simulating hasCapability logic)
    console.log("\n─── 6. Resolution ───");
    // SA should have projects:view (not restricted) -> allowed
    const r1 = await client.query(
      "SELECT 1 FROM user_capability_restrictions WHERE user_cid='sa' AND module='projects' AND capability='view' AND (expires_at IS NULL OR expires_at > NOW())",
    );
    test("SA: projects:view NOT restricted", r1.rows.length === 0);
    // SA should have users:delete restricted -> denied
    const r2 = await client.query(
      "SELECT 1 FROM user_capability_restrictions WHERE user_cid='sa' AND module='users' AND capability='delete' AND (expires_at IS NULL OR expires_at > NOW())",
    );
    test("SA: users:delete IS restricted", r2.rows.length > 0);

    // 7. Group cap
    console.log("\n─── 7. Group Capabilities ───");
    await client.query(`INSERT INTO group_capabilities (group_name, module, capability, access_level)
      VALUES ('DEVELOPMENT', 'engineering', 'manage_tasks', 3) ON CONFLICT DO UPDATE SET access_level = 3`);
    const grc = await client.query(
      "SELECT * FROM group_capabilities WHERE group_name='DEVELOPMENT'",
    );
    test(
      "Group cap stored",
      grc.rows.length > 0,
      `level=${grc.rows[0].access_level}`,
    );

    // 8. Audit
    console.log("\n─── 8. Audit ───");
    await client.query(`INSERT INTO permission_audit_log (actor_cid, actor_name, target_cid, target_name, action, module, capability, previous_value, new_value)
      VALUES ('sa','E2E Test','sa','Super Admin','granted','settings','edit','0','3')`);
    const ac = await client.query(
      "SELECT * FROM permission_audit_log ORDER BY created_at DESC LIMIT 1",
    );
    test("Audit entry stored", ac.rows.length > 0);
    test("Audit: actor", ac.rows[0]?.actor_cid === "sa");
    test("Audit: prev_value", ac.rows[0]?.previous_value === "0");
    test("Audit: new_value", ac.rows[0]?.new_value === "3");
    test("Audit: action", ac.rows[0]?.action === "granted");

    // 9. Expired grant test
    console.log("\n─── 9. Expired Grant ───");
    await client.query(`INSERT INTO user_capabilities (user_cid, module, capability, access_level, granted_by, expires_at)
      VALUES ('sa', 'test_module', 'test_cap', 5, 'sa', NOW()-INTERVAL '1 hour')
      ON CONFLICT (user_cid, module, capability) DO UPDATE SET expires_at=NOW()-INTERVAL '1 hour'`);
    const ec = await client.query(
      "SELECT 1 FROM user_capabilities WHERE user_cid='sa' AND module='test_module' AND expires_at > NOW()",
    );
    test("Expired grant NOT active", ec.rows.length === 0);

    // 10. Cleanup
    console.log("\n─── 10. Cleanup ───");
    await client.query(
      "DELETE FROM user_capabilities WHERE user_cid='sa' AND module IN ('settings','reports','test_module')",
    );
    await client.query(
      "DELETE FROM user_capability_restrictions WHERE user_cid='sa' AND module='users'",
    );
    await client.query(
      "DELETE FROM group_capabilities WHERE group_name='DEVELOPMENT'",
    );
    await client.query(
      "DELETE FROM permission_audit_log WHERE actor_cid='sa' AND action='granted' AND module='settings'",
    );
    test("Cleanup complete", true);

    // Summary
    const total = RESULTS.passed + RESULTS.failed;
    console.log("\n═══════════════════════════════════════════");
    console.log(
      `  ${RESULTS.passed}/${total} tests passed  ${RESULTS.failed === 0 ? "🎉 ALL GOOD" : "❌ " + RESULTS.failed + " FAILED"}`,
    );
    console.log("═══════════════════════════════════════════\n");
  } catch (err) {
    console.error("\n❌ FATAL:", err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
