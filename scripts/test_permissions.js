/**
 * End-to-end test for Engineering Permissions API.
 *
 * Run: node scripts/test_permissions.js
 *
 * Tests:
 *   1. GET /api/engineering/permissions — modules, role defaults, group defaults
 *   2. GET /api/engineering/permissions?user_cid=sa — full matrix for super admin
 *   3. POST /api/engineering/permissions/seed — seed defaults (safe, upserts)
 *   4. PUT /api/engineering/permissions — grant, restrict, revoke
 *   5. GET /api/engineering/permissions/audit — audit log
 */

async function run() {
  const BASE = process.env.BASE_URL || "http://localhost:3000";

  // Helper to fetch with session cookie
  async function api(path, options = {}) {
    const url = `${BASE}${path}`;
    const res = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    });
    const body = await res.text();
    let data;
    try { data = JSON.parse(body); } catch { data = body; }
    return { status: res.status, ok: res.ok, data };
  }

  console.log("═══════════════════════════════════════════");
  console.log("  PERMISSIONS API — END TO END TEST");
  console.log("═══════════════════════════════════════════\n");

  // ─── Test 1: GET modules ───
  console.log("─── Test 1: GET /api/engineering/permissions ───");
  const r1 = await api("/api/engineering/permissions");
  console.log(`  Status: ${r1.status} ${r1.ok ? "✅" : "❌"}`);
  if (r1.ok) {
    const modCount = Object.keys(r1.data.modules || {}).length;
    const roleCount = (r1.data.roleDefaults || []).length;
    console.log(`  Modules defined: ${modCount}`);
    console.log(`  Role defaults: ${roleCount}`);
    if (modCount > 0) console.log(`  Modules: ${Object.keys(r1.data.modules).join(", ")}`);
  } else {
    console.log(`  Error: ${r1.data?.error || "Unknown"}`);
  }
  console.log("");

  // ─── Test 2: GET user matrix (super admin "sa") ───
  console.log("─── Test 2: GET /api/engineering/permissions?user_cid=sa ───");
  const r2 = await api("/api/engineering/permissions?user_cid=sa");
  console.log(`  Status: ${r2.status} ${r2.ok ? "✅" : "❌"}`);
  if (r2.ok) {
    const modCount = Object.keys(r2.data.effectivePermissions || {}).length;
    const grantCount = (r2.data.individualGrants || []).length;
    const restrictCount = (r2.data.individualRestrictions || []).length;
    console.log(`  User: ${r2.data.user?.name || "N/A"} (${r2.data.user?.role || "N/A"})`);
    console.log(`  Groups: ${(r2.data.groups || []).join(", ") || "none"}`);
    console.log(`  Modules with permissions: ${modCount}`);
    console.log(`  Individual grants: ${grantCount}`);
    console.log(`  Individual restrictions: ${restrictCount}`);

    // Show summary of first module
    const firstMod = Object.keys(r2.data.effectivePermissions || {})[0];
    if (firstMod) {
      const caps = r2.data.effectivePermissions[firstMod];
      console.log(`  Sample (${firstMod}): ${Object.entries(caps).map(([k, v]) => `${k}=${v}`).join(", ")}`);
    }
  } else {
    console.log(`  Error: ${r2.data?.error || JSON.stringify(r2.data).substring(0, 200)}`);
  }
  console.log("");

  // ─── Test 3: Seed defaults ───
  console.log("─── Test 3: POST /api/engineering/permissions/seed ───");
  const r3 = await api("/api/engineering/permissions/seed", { method: "POST" });
  console.log(`  Status: ${r3.status} ${r3.ok ? "✅" : "❌"}`);
  console.log(`  Result: ${r3.data?.success ? "Defaults seeded" : r3.data?.error || "Unknown"}`);
  console.log("");

  // ─── Test 4: Grant a permission to "sa" ───
  console.log("─── Test 4: PUT grant permissions:settings:edit=3 to sa ───");
  const r4 = await api("/api/engineering/permissions", {
    method: "PUT",
    body: JSON.stringify({
      action: "grant",
      user_cid: "sa",
      module: "settings",
      capability: "edit",
      access_level: 3,
    }),
  });
  console.log(`  Status: ${r4.status} ${r4.ok ? "✅" : "❌"}`);
  console.log(`  Result: ${r4.data?.success ? "Granted" : r4.data?.error || "Unknown"}`);
  console.log("");

  // ─── Test 5: Verify grant appears ───
  console.log("─── Test 5: Verify grant in user matrix ───");
  const r5 = await api("/api/engineering/permissions?user_cid=sa");
  if (r5.ok) {
    const grantFound = (r5.data.individualGrants || []).some(
      (g) => g.module === "settings" && g.capability === "edit"
    );
    console.log(`  Grant visible: ${grantFound ? "✅" : "❌"}`);
    const effectiveLevel = r5.data.effectivePermissions?.settings?.edit;
    console.log(`  Effective level for settings:edit: ${effectiveLevel ?? "N/A"}`);
  }
  console.log("");

  // ─── Test 6: Restrict a permission ───
  console.log("─── Test 6: PUT restrict permissions:users:delete from sa ───");
  const r6 = await api("/api/engineering/permissions", {
    method: "PUT",
    body: JSON.stringify({
      action: "restrict",
      user_cid: "sa",
      module: "users",
      capability: "delete",
    }),
  });
  console.log(`  Status: ${r6.status} ${r6.ok ? "✅" : "❌"}`);
  console.log(`  Result: ${r6.data?.success ? "Restricted" : r6.data?.error || "Unknown"}`);
  console.log("");

  // ─── Test 7: Verify restriction appears ───
  console.log("─── Test 7: Verify restriction in user matrix ───");
  const r7 = await api("/api/engineering/permissions?user_cid=sa");
  if (r7.ok) {
    const restrFound = (r7.data.individualRestrictions || []).some(
      (r) => r.module === "users" && r.capability === "delete"
    );
    console.log(`  Restriction visible: ${restrFound ? "✅" : "❌"}`);
    console.log(`  users:delete level: ${r7.data.effectivePermissions?.users?.delete ?? "N/A"} (should be 0 or undefined)`);
  }
  console.log("");

  // ─── Test 8: Audit log ───
  console.log("─── Test 8: GET /api/engineering/permissions/audit?target_cid=sa ───");
  const r8 = await api("/api/engineering/permissions/audit?target_cid=sa&limit=10");
  console.log(`  Status: ${r8.status} ${r8.ok ? "✅" : "❌"}`);
  if (r8.ok) {
    const entries = r8.data.entries || [];
    console.log(`  Audit entries: ${entries.length}`);
    entries.slice(0, 3).forEach((e, i) => {
      console.log(`  [${i + 1}] ${e.action}: ${e.module}/${e.capability} by ${e.actor_name} — ${e.details || "no details"}`);
    });
  }
  console.log("");

  // ─── Test 9: Cleanup — revoke grant and unrestrict ───
  console.log("─── Test 9: Cleanup ───");
  const r9a = await api("/api/engineering/permissions", {
    method: "PUT",
    body: JSON.stringify({ action: "revoke", user_cid: "sa", module: "settings", capability: "edit" }),
  });
  const r9b = await api("/api/engineering/permissions", {
    method: "PUT",
    body: JSON.stringify({ action: "unrestrict", user_cid: "sa", module: "users", capability: "delete" }),
  });
  console.log(`  Revoke grant: ${r9a.ok ? "✅" : "❌"}`);
  console.log(`  Unrestrict: ${r9b.ok ? "✅" : "❌"}`);
  console.log("");

  // ─── Summary ───
  const passed = [r1, r2, r3, r4, r5, r6, r7, r8, r9a, r9b].filter((r) => r.ok).length;
  const total = 10;
  console.log("═══════════════════════════════════════════");
  console.log(`  RESULTS: ${passed}/${total} tests passed`);
  console.log("═══════════════════════════════════════════\n");
}

run().catch(console.error);
