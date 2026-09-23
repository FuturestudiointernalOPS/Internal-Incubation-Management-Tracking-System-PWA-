// READ-ONLY Phase 10 production data safety audit (§13). Never modifies.
// Usage: node scripts/audit-phase10-safety.mjs [envfile]
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";

const file = process.argv[2] || ".env.local";
const readUrl = (file) => {
  try {
    for (const line of readFileSync(resolve(process.cwd(), file), "utf-8").split("\n")) {
      if (line.startsWith("DATABASE_URL=")) return line.substring("DATABASE_URL=".length).trim();
    }
  } catch {}
  return null;
};

let pool = null;
for (const envFile of [file, ".env.local", ".env.prod-verify", ".env.audit-staging"]) {
  const url = readUrl(envFile);
  if (!url) continue;
  try {
    const candidatePool = new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 12000 });
    await candidatePool.query("SELECT 1");
    console.log(`[phase10] connected via ${envFile}`);
    pool = candidatePool;
    break;
  } catch {}
}
if (!pool) {
  console.error("No working connection");
  process.exit(2);
}

const runQuery = async (label, sql, args = []) => {
  try {
    const { rows } = await pool.query(sql, args);
    console.log(`[phase10] ${label}: ${JSON.stringify(rows)}`);
    return rows;
  } catch (error) {
    console.log(`[phase10] ${label}: ERROR (${error.message.split("\n")[0]})`);
    return [];
  }
};

// module → feature (mirrors MODULE_TO_FEATURE in eligibility.js)
const MODULE_TO_FEATURE = {
  contacts: "crm",
  duplicates: "crm",
  bulk_upload: "crm",
  messaging: "communication",
  internal_comms: "communication",
  programs: "programs",
  facilitator: "programs",
  projects: "operations",
  tasks: "operations",
  reports: "reports",
  knowledge: "knowledge",
  ventures: "ventures",
  investor: "investors",
  finance: "finance",
  users: "security",
  permissions: "security",
  settings: "settings",
  engineering: "settings",
};

try {
  console.log("\n=== STRUCTURAL ===\n");
  await runQuery("contacts total", "SELECT count(*) AS n FROM contacts");
  await runQuery(
    "duplicate memberships",
    "SELECT user_cid, group_name, count(*) AS n FROM group_memberships GROUP BY user_cid, group_name HAVING count(*) > 1",
  );
  await runQuery(
    "orphan memberships (no contact)",
    `SELECT gm.user_cid, gm.group_name FROM group_memberships gm
     LEFT JOIN contacts c ON c.cid = gm.user_cid WHERE c.cid IS NULL`,
  );
  await runQuery(
    "memberships without contact — count",
    `SELECT count(*) AS n FROM group_memberships gm
     LEFT JOIN contacts c ON c.cid = gm.user_cid WHERE c.cid IS NULL`,
  );
  await runQuery(
    "contacts with group_name but no membership record",
    `SELECT count(*) AS n FROM contacts c
     WHERE c.group_name IS NOT NULL AND c.group_name != ''
       AND NOT EXISTS (SELECT 1 FROM group_memberships gm
                       WHERE gm.user_cid = c.cid AND UPPER(TRIM(gm.group_name)) = UPPER(TRIM(c.group_name)))`,
  );
  await runQuery("expired/ended memberships", "SELECT status, count(*) AS n FROM group_memberships WHERE status != 'active' GROUP BY status");
  await runQuery("FUTURE STUDIO protected", "SELECT name, is_protected FROM groups WHERE name = 'FUTURE STUDIO'");
  await runQuery(
    "inactive profiles still bound as role default",
    `SELECT rpd.role_name, ap.name FROM role_access_profile_defaults rpd
     JOIN access_profiles ap ON ap.id = rpd.access_profile_id WHERE ap.is_active = 0`,
  );
  await runQuery(
    "invalid role defaults (missing profile)",
    `SELECT rpd.role_name, rpd.access_profile_id FROM role_access_profile_defaults rpd
     LEFT JOIN access_profiles ap ON ap.id = rpd.access_profile_id WHERE ap.id IS NULL`,
  );
  await runQuery(
    "contacts with invalid access_profile_id",
    `SELECT c.cid FROM contacts c LEFT JOIN access_profiles ap ON ap.id = c.access_profile_id
     WHERE c.access_profile_id IS NOT NULL AND ap.id IS NULL`,
  );
  await runQuery("project memberships", "SELECT count(*) AS n FROM project_members");
  await runQuery("venture memberships", "SELECT count(*) AS n FROM venture_members");
  await runQuery("v2_program_staff rows", "SELECT role, count(*) AS n FROM v2_program_staff GROUP BY role");
  await runQuery("membership events by action", "SELECT action, count(*) AS n FROM group_membership_events GROUP BY action ORDER BY action");

  console.log("\n=== GRANTS vs ELIGIBILITY (in-JS) ===\n");
  const grants = await runQuery("grants (active)", "SELECT user_cid, module, capability, access_level FROM user_capabilities WHERE expires_at IS NULL OR expires_at > NOW()");
  const restrictions = await runQuery("restrictions (active)", "SELECT user_cid, module, capability FROM user_capability_restrictions WHERE expires_at IS NULL OR expires_at > NOW()");
  const contacts = await runQuery("contacts (cid, role)", "SELECT cid, role FROM contacts");
  const eligRows = await runQuery("eligibility rows", "SELECT feature_key, identity_type, identity_value, eligible FROM feature_eligibility");
  const roleOf = new Map(contacts.map((contact) => [String(contact.cid), contact.role]));

  const eligibleFor = (role, groups, feature) => {
    const rows = eligRows.filter(
      (eligibilityRow) =>
        (eligibilityRow.identity_type === "role" && eligibilityRow.identity_value === role) ||
        (eligibilityRow.identity_type === "group" && groups.includes(eligibilityRow.identity_value)),
    );
    const explicitDeny = rows.some((eligibilityRow) => eligibilityRow.feature_key === feature && Number(eligibilityRow.eligible) === 0);
    if (explicitDeny) return false;
    return rows.some((eligibilityRow) => eligibilityRow.feature_key === feature && Number(eligibilityRow.eligible) === 1);
  };

  const ineligibleGrants = [];
  for (const grant of grants) {
    const role = roleOf.get(String(grant.user_cid));
    const feature = MODULE_TO_FEATURE[grant.module];
    if (!feature) continue; // infra modules without a feature are capability-only
    if (!role) {
      ineligibleGrants.push({ user_cid: grant.user_cid, module: grant.module, capability: grant.capability, reason: "no contact row" });
      continue;
    }
    if (role === "super_admin") continue; // SA bypass
    if (!eligibleFor(role, [], feature)) {
      ineligibleGrants.push({ user_cid: grant.user_cid, role, module: grant.module, capability: grant.capability, feature });
    }
  }
  console.log(`[phase10] grants to ineligible targets: ${ineligibleGrants.length}`);
  for (const ineligibleGrant of ineligibleGrants) console.log("  " + JSON.stringify(ineligibleGrant));

  console.log("\n=== UNEXPECTED ACCESS SUMMARY ===\n");
  const byRole = {};
  for (const grant of grants) {
    const role = roleOf.get(String(grant.user_cid)) || "unknown";
    byRole[role] = (byRole[role] || 0) + 1;
  }
  console.log("[phase10] active grants by target role: " + JSON.stringify(byRole));
  const restrByRole = {};
  for (const restriction of restrictions) {
    const role = roleOf.get(String(restriction.user_cid)) || "unknown";
    restrByRole[role] = (restrByRole[role] || 0) + 1;
  }
  console.log("[phase10] active restrictions by target role: " + JSON.stringify(restrByRole));
} finally {
  await pool.end();
}
