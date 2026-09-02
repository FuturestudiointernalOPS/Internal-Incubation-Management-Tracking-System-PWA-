// READ-ONLY post-deploy verification — run AFTER the new build is live.
// Checks that the one-time migrations applied and that no authorization
// configuration drifted. Prints only facts; never writes.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";

const readUrl = (file) => {
  try {
    for (const line of readFileSync(resolve(process.cwd(), file), "utf-8").split("\n")) {
      if (line.startsWith("DATABASE_URL=")) {
        return line.substring("DATABASE_URL=".length).trim();
      }
    }
  } catch {}
  return null;
};

let used = null;
for (const file of [".env.local", ".env.prod-verify", ".env.audit-staging"]) {
  const url = readUrl(file);
  if (!url) continue;
  try {
    const pool = new pg.Pool({
      connectionString: url,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 12000,
    });
    await pool.query("SELECT 1");
    console.log(`[verify-deploy] connected via ${file}`);
    used = { file, pool };
    break;
  } catch {}
}
if (!used) {
  console.error("No working connection");
  process.exit(2);
}
const { pool } = used;
const q = async (label, sql, expect = null) => {
  try {
    const rows = (await pool.query(sql)).rows;
    const ok = expect === null || JSON.stringify(rows) === JSON.stringify(expect);
    console.log(`${ok ? "PASS" : "FAIL"}  ${label}${!ok ? ` — expected ${JSON.stringify(expect)}, got ${JSON.stringify(rows)}` : ""}`);
    return ok;
  } catch (e) {
    console.log(`FAIL  ${label} — ${e.message.split("\n")[0]}`);
    return false;
  }
};

let failures = 0;
const check = async (label, sql, expect) => {
  if (!(await q(label, sql, expect))) failures++;
};

// 1. Membership schema present
await check("groups table + FUTURE STUDIO protected",
  "SELECT is_protected::int AS p FROM groups WHERE name = 'FUTURE STUDIO'", [{ p: 1 }]);
await check("group_memberships table exists",
  "SELECT COUNT(*)::int AS n FROM group_memberships", null);
await check("group_membership_events table exists",
  "SELECT COUNT(*)::int AS n FROM group_membership_events", null);

// 2. One-time migrations recorded
await check("authz_migrations: eligibility-bootstrap-seed",
  "SELECT COUNT(*)::int AS n FROM authz_migrations WHERE name = 'eligibility-bootstrap-seed'", [{ n: 1 }]);
await check("authz_migrations: messaging-mvp-internal-only",
  "SELECT COUNT(*)::int AS n FROM authz_migrations WHERE name = 'messaging-mvp-internal-only'", [{ n: 1 }]);
await check("authz_migrations: eligibility-policy-3",
  "SELECT COUNT(*)::int AS n FROM authz_migrations WHERE name = 'eligibility-policy-3'", [{ n: 1 }]);
await check("authz_migrations: membership-bootstrap-v1",
  "SELECT COUNT(*)::int AS n FROM authz_migrations WHERE name = 'membership-bootstrap-v1'", [{ n: 1 }]);

// 2b. Phase 3 — the nine previously every-boot capability backfills are now
// one-time migrations (recorded so configuration survives restarts/deploys).
await check("authz_migrations: 9 capability backfills recorded",
  `SELECT COUNT(*)::int AS n FROM authz_migrations WHERE name IN
   ('cap-backfill-knowledge','cap-backfill-reports','cap-backfill-announcements',
    'cap-backfill-projects','cap-backfill-tasks','cap-backfill-engineering',
    'cap-backfill-programs','cap-backfill-ventures','cap-backfill-investor')`, [{ n: 9 }]);

// 3. Policy #3 applied — stale rows gone
await check("no admin@internal_comms eligibility row",
  "SELECT COUNT(*)::int AS n FROM feature_eligibility WHERE feature_key='internal_comms' AND identity_value='admin'", [{ n: 0 }]);
await check("no admin@reporting eligibility row",
  "SELECT COUNT(*)::int AS n FROM feature_eligibility WHERE feature_key='reporting' AND identity_value='admin'", [{ n: 0 }]);
await check("no participant@crm eligibility row",
  "SELECT COUNT(*)::int AS n FROM feature_eligibility WHERE feature_key='crm' AND identity_value='participant'", [{ n: 0 }]);
await check("no founder@crm eligibility row",
  "SELECT COUNT(*)::int AS n FROM feature_eligibility WHERE feature_key='crm' AND identity_value='founder'", [{ n: 0 }]);

// 4. Staff eligibility intact (the Phase 3 boundary)
await check("staff eligible: programs",
  "SELECT COUNT(*)::int AS n FROM feature_eligibility WHERE feature_key='program_management' AND identity_value='staff' AND eligible=1", [{ n: 1 }]);
await check("staff eligible: finance",
  "SELECT COUNT(*)::int AS n FROM feature_eligibility WHERE feature_key='finance' AND identity_value='staff' AND eligible=1", [{ n: 1 }]);
await check("staff eligible: projects",
  "SELECT COUNT(*)::int AS n FROM feature_eligibility WHERE feature_key='project_ownership' AND identity_value='staff' AND eligible=1", [{ n: 1 }]);
await check("staff eligible: reports",
  "SELECT COUNT(*)::int AS n FROM feature_eligibility WHERE feature_key='reporting' AND identity_value='staff' AND eligible=1", [{ n: 1 }]);

// 5. Staff Default profile still bound + intact (Phase 3 Option B: 11 caps)
await check("staff role default = Staff Default profile",
  `SELECT COUNT(*)::int AS n FROM role_access_profile_defaults rpd
   JOIN access_profiles ap ON ap.id = rpd.access_profile_id
   WHERE rpd.role_name='staff' AND ap.name='Staff Default' AND ap.is_active=1`, [{ n: 1 }]);
await check("Staff Default profile capability count = 11 (Option B)",
  "SELECT COUNT(*)::int AS n FROM access_profile_capabilities apc JOIN access_profiles ap ON ap.id=apc.profile_id WHERE ap.name='Staff Default'", [{ n: 11 }]);
const profCaps = await q("Staff Default profile capabilities (informational)",
  "SELECT apc.module, apc.capability, apc.access_level FROM access_profile_capabilities apc JOIN access_profiles ap ON ap.id=apc.profile_id WHERE ap.name='Staff Default' ORDER BY apc.module, apc.capability");

console.log(`\n${failures === 0 ? "VERDICT: ALL CHECKS PASSED — deployment is healthy." : `VERDICT: ${failures} CHECK(S) FAILED — investigate.`}`);
await pool.end();
process.exit(failures === 0 ? 0 : 1);
