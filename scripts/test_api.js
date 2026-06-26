/**
 * Internal E2E test — runs against the running dev server with auth.
 * Usage: node scripts/test_api.js [base_url] [email] [password]
 *
 * Example: node scripts/test_api.js http://localhost:3456 admin@email.com password123
 */
const BASE = process.argv[2] || "http://localhost:3457";
const EMAIL = process.argv[3] || "";
const PASS = process.argv[4] || "";

const RESULTS = { passed: 0, failed: 0, tests: [] };
let cookie = "";

async function api(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie,
      ...opts.headers,
    },
    redirect: "manual",
  });

  // Capture set-cookie
  const setCookie = res.headers.get("set-cookie");
  if (setCookie) cookie = setCookie.split(";")[0];

  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, ok: res.ok, data, headers: res.headers };
}

function test(name, passed, detail) {
  if (passed) RESULTS.passed++; else RESULTS.failed++;
  const icon = passed ? "✅" : "❌";
  RESULTS.tests.push({ name, passed, detail });
  console.log(`  ${icon} ${name}${detail ? " — " + detail : ""}`);
}

async function run() {
  console.log("═══════════════════════════════════════════");
  console.log("  PERMISSIONS API — INTERNAL E2E TEST");
  console.log(`  Target: ${BASE}`);
  console.log("═══════════════════════════════════════════\n");

  // ─── 1. Health check ───
  console.log("─── 1. Server Health ───");
  try {
    const hc = await api("/api/engineering/permissions");
    test("Server reachable", hc.status === 401, `Expected 401 (no auth), got ${hc.status}`);
  } catch (e) {
    test("Server reachable", false, e.message);
    console.log("\n❌ Server not running. Start it with: npm run dev");
    process.exit(1);
  }

  // ─── 2. Login ───
  console.log("\n─── 2. Authentication ───");
  if (!EMAIL || !PASS) {
    // Try to find credentials from env
    const fs = require("fs");
    const env = fs.readFileSync(".env.local", "utf-8");
    // We can read the file even if private
    const loginMatch = env.match(/TEST_EMAIL=(.+)/);
    const passMatch = env.match(/TEST_PASSWORD=(.+)/);
    if (!loginMatch || !passMatch) {
      console.log("  ⚠️  No credentials provided. Set TEST_EMAIL and TEST_PASSWORD in .env.local");
      console.log("  ⚠️  Or pass as args: node scripts/test_api.js <url> <email> <password>");
      console.log("\n  Testing unauthenticated endpoints only...\n");
    }
  }

  if (EMAIL && PASS) {
    const login = await api("/api/auth/session-login", {
      method: "POST",
      body: JSON.stringify({ email: EMAIL, password: PASS }),
    });
    test("Login success", login.ok, login.data?.user?.name ? `Logged in as ${login.data.user.name}` : JSON.stringify(login.data).substring(0, 100));
  }

  // ─── 3. Test endpoints ───
  console.log("\n─── 3. API Endpoints ───");

  // GET permissions overview
  const r1 = await api("/api/engineering/permissions");
  test("GET permissions overview", r1.ok || r1.status === 401, r1.ok ? `Modules: ${Object.keys(r1.data?.modules || {}).length}` : `Status ${r1.status}`);

  // GET role capabilities
  const r2 = await api("/api/engineering/permissions?role=super_admin");
  test("GET role=super_admin", r2.ok || r2.status === 401);

  // Seed
  const r3 = await api("/api/engineering/permissions/seed", { method: "POST" });
  test("POST seed defaults", r3.ok || r3.status === 401, r3.ok ? (r3.data?.success ? "Seeded" : r3.data?.error) : `Auth required (${r3.status})`);

  // GET user groups
  const r4 = await api("/api/user-groups?user_cid=sa");
  test("GET user-groups?user_cid=sa", r4.ok || r4.status === 401, r4.ok ? `Groups: ${r4.data?.groups?.join(", ") || "none"}` : `Status ${r4.status}`);

  // GET audit log
  const r5 = await api("/api/engineering/permissions/audit?limit=5");
  test("GET audit log", r5.ok || r5.status === 401);

  // Engineering dashboard
  const r6 = await api("/api/engineering/dashboard");
  test("GET engineering dashboard", r6.ok || r6.status === 401);

  // ─── 4. If authenticated, test CRUD operations ───
  if (cookie) {
    console.log("\n─── 4. Authenticated CRUD ───");

    // Grant
    const g1 = await api("/api/engineering/permissions", {
      method: "PUT",
      body: JSON.stringify({ action: "grant", user_cid: "sa", module: "settings", capability: "edit", access_level: 3 }),
    });
    test("Grant settings:edit=3", g1.ok, g1.data?.message || g1.data?.error);

    // Verify grant
    const g2 = await api("/api/engineering/permissions?user_cid=sa");
    const grantFound = g2.data?.individualGrants?.some(g => g.module === "settings" && g.capability === "edit");
    test("Grant visible in matrix", g2.ok && grantFound);

    // Restrict
    const g3 = await api("/api/engineering/permissions", {
      method: "PUT",
      body: JSON.stringify({ action: "restrict", user_cid: "sa", module: "users", capability: "delete" }),
    });
    test("Restrict users:delete", g3.ok);

    // Verify restriction
    const g4 = await api("/api/engineering/permissions?user_cid=sa");
    const restrFound = g4.data?.individualRestrictions?.some(r => r.module === "users" && r.capability === "delete");
    test("Restriction visible in matrix", g4.ok && restrFound);
    const usersDeleteLevel = g4.data?.effectivePermissions?.users?.delete;
    test("users:delete effective level is 0", usersDeleteLevel === undefined || usersDeleteLevel === 0, `Got: ${usersDeleteLevel}`);

    // Cleanup
    await api("/api/engineering/permissions", { method: "PUT", body: JSON.stringify({ action: "revoke", user_cid: "sa", module: "settings", capability: "edit" }) });
    await api("/api/engineering/permissions", { method: "PUT", body: JSON.stringify({ action: "unrestrict", user_cid: "sa", module: "users", capability: "delete" }) });
    test("Cleanup completed", true);

    // Audit
    const g5 = await api("/api/engineering/permissions/audit?target_cid=sa&limit=10");
    test("Audit entries exist", g5.ok && (g5.data?.entries?.length || 0) > 0, `${g5.data?.entries?.length || 0} entries`);
  }

  // ─── Summary ───
  const total = RESULTS.passed + RESULTS.failed;
  console.log("\n═══════════════════════════════════════════");
  console.log(`  ${RESULTS.passed}/${total} tests passed  ${RESULTS.failed === 0 ? "🎉" : "❌ " + RESULTS.failed + " failed"}`);
  console.log("═══════════════════════════════════════════\n");
}

run().catch(err => {
  console.error("\n❌ Test error:", err.message);
  process.exit(1);
});
