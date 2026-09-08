// READ-ONLY Phase 10 production data safety audit (§13). Never modifies.
// Usage: node scripts/audit-phase10-safety.mjs [envfile]
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";

const file = process.argv[2] || ".env.local";
const readUrl = (f) => {
  try {
    for (const line of readFileSync(resolve(process.cwd(), f), "utf-8").split("\n")) {
      if (line.startsWith("DATABASE_URL=")) return line.substring("DATABASE_URL=".length).trim();
    }
  } catch {}
  return null;
};

let pool = null;
for (const f of [file, ".env.local", ".env.prod-verify", ".env.audit-staging"]) {
  const url = readUrl(f);
  if (!url) continue;
  try {
    const p = new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 12000 });
    await p.query("SELECT 1");
    console.log(`[phase10] connected via ${f}`);
    pool = p;
    break;
  } catch {}
}
if (!pool) {
  console.error("No working connection");
  process.exit(2);
}

const q = async (label, sql, args = []) => {
  try {
    const { rows } = await pool.query(sql, args);
    console.log(`[phase10] ${label}: ${JSON.stringify(rows)}`);
    return rows;
  } catch (e) {
    console.log(`[phase10] ${label}: ERROR (${e.message.split("\n")[0]})`);
    return [];
  }
};

// module → feature (mirrors MODULE_TO_FEATURE in eligibility.js)
const MODULE_TO_FEATURE = {
  contacts: "crm",
  programs: "program_management",
  reports: "reporting",
  messaging: "messaging",
  internal_comms: "internal_comms",
  projects: "project_ownership",
  tasks: "tasks",
  knowledge: "knowledge_base",
  ventures: "ventures",
  investor: "investor",
  facilitator: "program_management",
  finance: "finance",
  org_membership: "org_membership",
  permissions: "permissions",
  settings: "settings",
  engineering: "engineering",
};

try {
  console.log("\n=== STRUCTURAL ===\n");
  await q("contacts total", "SELECT count(*) AS n FROM contacts");
  await q(
    "duplicate memberships",
    "SELECT user_cid, group_name, count(*) AS n FROM group_memberships GROUP BY user_cid, group_name HAVING count(*) > 1",
  );
  await q(
    "orphan memberships (no contact)",
    `SELECT gm.user_cid, gm.group_name FROM group_memberships gm
     LEFT JOIN contacts c ON c.cid = gm.user_cid WHERE c.cid IS NULL`,
  );
  await q(
    "memberships without contact — count",
    `SELECT count(*) AS n FROM group_memberships gm
     LEFT JOIN contacts c ON c.cid = gm.user_cid WHERE c.cid IS NULL`,
  );
  await q(
    "contacts with group_name but no membership record",
    `SELECT count(*) AS n FROM contacts c
     WHERE c.group_name IS NOT NULL AND c.group_name != ''
       AND NOT EXISTS (SELECT 1 FROM group_memberships gm
                       WHERE gm.user_cid = c.cid AND UPPER(TRIM(gm.group_name)) = UPPER(TRIM(c.group_name)))`,
  );
  await q("expired/ended memberships", "SELECT status, count(*) AS n FROM group_memberships WHERE status != 'active' GROUP BY status");
  await q("FUTURE STUDIO protected", "SELECT name, is_protected FROM groups WHERE name = 'FUTURE STUDIO'");
  await q(
    "inactive profiles still bound as role default",
    `SELECT rpd.role_name, ap.name FROM role_access_profile_defaults rpd
     JOIN access_profiles ap ON ap.id = rpd.access_profile_id WHERE ap.is_active = 0`,
  );
  await q(
    "invalid role defaults (missing profile)",
    `SELECT rpd.role_name, rpd.access_profile_id FROM role_access_profile_defaults rpd
     LEFT JOIN access_profiles ap ON ap.id = rpd.access_profile_id WHERE ap.id IS NULL`,
  );
  await q(
    "contacts with invalid access_profile_id",
    `SELECT c.cid FROM contacts c LEFT JOIN access_profiles ap ON ap.id = c.access_profile_id
     WHERE c.access_profile_id IS NOT NULL AND ap.id IS NULL`,
  );
  await q("project memberships", "SELECT count(*) AS n FROM project_members");
  await q("venture memberships", "SELECT count(*) AS n FROM venture_members");
  await q("v2_program_staff rows", "SELECT role, count(*) AS n FROM v2_program_staff GROUP BY role");
  await q("membership events by action", "SELECT action, count(*) AS n FROM group_membership_events GROUP BY action ORDER BY action");

  console.log("\n=== GRANTS vs ELIGIBILITY (in-JS) ===\n");
  const grants = await q("grants (active)", "SELECT user_cid, module, capability, access_level FROM user_capabilities WHERE expires_at IS NULL OR expires_at > NOW()");
  const restrictions = await q("restrictions (active)", "SELECT user_cid, module, capability FROM user_capability_restrictions WHERE expires_at IS NULL OR expires_at > NOW()");
  const contacts = await q("contacts (cid, role)", "SELECT cid, role FROM contacts");
  const eligRows = await q("eligibility rows", "SELECT feature_key, identity_type, identity_value, eligible FROM feature_eligibility");
  const roleOf = new Map(contacts.map((c) => [String(c.cid), c.role]));

  const eligibleFor = (role, groups, feature) => {
    const rows = eligRows.filter(
      (r) =>
        (r.identity_type === "role" && r.identity_value === role) ||
        (r.identity_type === "group" && groups.includes(r.identity_value)),
    );
    const explicitDeny = rows.some((r) => r.feature_key === feature && Number(r.eligible) === 0);
    if (explicitDeny) return false;
    return rows.some((r) => r.feature_key === feature && Number(r.eligible) === 1);
  };

  const ineligibleGrants = [];
  for (const g of grants) {
    const role = roleOf.get(String(g.user_cid));
    const feature = MODULE_TO_FEATURE[g.module];
    if (!feature) continue; // infra modules without a feature are capability-only
    if (!role) {
      ineligibleGrants.push({ user_cid: g.user_cid, module: g.module, capability: g.capability, reason: "no contact row" });
      continue;
    }
    if (role === "super_admin") continue; // SA bypass
    if (!eligibleFor(role, [], feature)) {
      ineligibleGrants.push({ user_cid: g.user_cid, role, module: g.module, capability: g.capability, feature });
    }
  }
  console.log(`[phase10] grants to ineligible targets: ${ineligibleGrants.length}`);
  for (const g of ineligibleGrants) console.log("  " + JSON.stringify(g));

  console.log("\n=== UNEXPECTED ACCESS SUMMARY ===\n");
  const byRole = {};
  for (const g of grants) {
    const role = roleOf.get(String(g.user_cid)) || "unknown";
    byRole[role] = (byRole[role] || 0) + 1;
  }
  console.log("[phase10] active grants by target role: " + JSON.stringify(byRole));
  const restrByRole = {};
  for (const r of restrictions) {
    const role = roleOf.get(String(r.user_cid)) || "unknown";
    restrByRole[role] = (restrByRole[role] || 0) + 1;
  }
  console.log("[phase10] active restrictions by target role: " + JSON.stringify(restrByRole));
} finally {
  await pool.end();
}
