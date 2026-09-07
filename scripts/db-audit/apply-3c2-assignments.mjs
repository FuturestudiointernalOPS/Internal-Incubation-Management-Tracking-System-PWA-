/**
 * PHASE 3C-2 — APPLY FACILITATOR + JOSIAS ASSIGNMENTS (Option B)
 *
 * Replicates EXACTLY what the existing Super Admin frontend workflow writes,
 * using the DATABASE_URL from .env.audit-readonly. No other changes.
 *
 *   Facilitators (x4):
 *     - v2_program_staff row (role 'facilitator', full facilitator permissions)
 *     - contact_roles mirror row (context_type 'program', current)
 *     - contact_timeline audit entry (facilitator_assigned)
 *   Josias:
 *     - contacts.access_profile_id = Program Manager profile
 *     - permission_audit_log entry (profile_assigned)
 *
 * Idempotent (guarded with WHERE NOT EXISTS / value checks) and wrapped in a
 * single transaction. Prints before/after verification only — never the URL.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..", "..");
const ENV_FILE = path.join(PROJECT_ROOT, ".env.audit-readonly");

let dbUrl = null;
for (const line of readFileSync(ENV_FILE, "utf8").split(/\r?\n/)) {
  const m = line.match(/^DATABASE_URL=(.*)$/);
  if (m) { dbUrl = m[1].trim().replace(/^["']|["']$/g, ""); break; }
}
if (!dbUrl) { console.error("Missing DATABASE_URL in .env.audit-readonly"); process.exit(1); }

const PROGRAM_ID = "a988c6cd-1587-446b-9761-9262e543796a"; // Bootcamp pré-entrepreneurial
const ACTOR = "sa";            // Gwyn (authorized this run)
const ACTOR_NAME = "Gwyn Ukoha";

const FACILITATORS = [
  { cid: "USR_27C27C00379B", name: "Didier ADDI",       email: "dkaddi01@gmail.com" },
  { cid: "USR_EDD56CB0DBA6", name: "Dinepartners",      email: "dinepartners8@gmail.com" },
  { cid: "USR_CF9AAD183C6C", name: "Morgane Chrisnaud", email: "morganechrisnaud2005@gmail.com" },
  { cid: "USR_E971591D0D3F", name: "Sessou berenger",   email: "sessouberenger@gmail.com" },
];
const JOSIAS_CID = "USER_6B8031C5115";

// Matches buildFullFacilitatorPermissions() exactly.
const FULL_FACILITATOR_PERMS = {
  "participants.view": 1, "participants.manage": 2,
  "attendance.view": 1,   "attendance.record": 2,
  "assignments.view": 1,  "assignments.review": 2, "assignments.grade": 2,
  "sessions.conduct": 2,  "sessions.record": 2,
  "progress.view": 1,     "groups.view": 1,         "groups.manage": 2,
};

const client = new pg.Client({
  connectionString: dbUrl,
  ssl: /sslmode=/.test(dbUrl) ? undefined : { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
});
await client.connect();
const who = await client.query("SELECT current_database() AS db, current_user AS usr");
console.log(`\n=== CONNECTED: ${who.rows[0].db} as ${who.rows[0].usr} ===`);

// Resolve Program Manager profile id (must exist + active).
const pm = await client.query(
  "SELECT id, name FROM access_profiles WHERE name = 'Program Manager' AND is_active = 1",
);
if (pm.rows.length === 0) { console.error("Program Manager profile not found/inactive"); await client.end(); process.exit(1); }
const pmId = pm.rows[0].id;

await client.query("BEGIN");
try {
  let created = 0;
  for (const f of FACILITATORS) {
    // 1) v2_program_staff (idempotent)
    const staff = await client.query(
      `INSERT INTO v2_program_staff (program_id, staff_id, role, permissions)
       SELECT $1, $2, 'facilitator', $3::jsonb
       WHERE NOT EXISTS (
         SELECT 1 FROM v2_program_staff
         WHERE program_id = $1 AND staff_id = $2
       )`,
      [PROGRAM_ID, f.cid, JSON.stringify(FULL_FACILITATOR_PERMS)],
    );

    // 2) contact_roles mirror (idempotent, matching the API's NOT EXISTS guard)
    const mirror = await client.query(
      `INSERT INTO contact_roles
         (contact_cid, role, context_type, context_id, is_current, title, scope, status, capability_overrides, assigned_by)
       SELECT c.cid, 'facilitator', 'program', $2, true, 'facilitator', '{"type":"program"}'::jsonb, 'active', $3::jsonb, $4
       FROM contacts c
       WHERE (c.cid = $1 OR LOWER(c.email) = LOWER($5))
         AND c.deleted = 0
         AND NOT EXISTS (
           SELECT 1 FROM contact_roles cr
           WHERE cr.contact_cid = c.cid AND cr.role = 'facilitator'
             AND cr.context_type = 'program' AND cr.context_id = $2 AND cr.is_current = true
         )`,
      [f.cid, PROGRAM_ID, JSON.stringify(FULL_FACILITATOR_PERMS), ACTOR, f.email],
    );

    // 3) timeline audit (only when a row was actually created)
    if (staff.rowCount > 0) {
      await client.query(
        `INSERT INTO contact_timeline
           (contact_cid, event_type, description, context_module, context_id, actor_id, metadata)
         VALUES ($1, 'facilitator_assigned', 'Assigned as facilitator to program', 'programs', $2, $3, $4::jsonb)`,
        [f.cid, PROGRAM_ID, ACTOR, JSON.stringify({ role: "facilitator" })],
      );
      created++;
      console.log(`  + facilitator: ${f.name} (${f.cid})`);
    } else {
      console.log(`  = already assigned (skipped): ${f.name}`);
    }
  }

  // 4) Josias -> Program Manager profile (idempotent)
  const j = await client.query(
    "SELECT access_profile_id FROM contacts WHERE cid = $1",
    [JOSIAS_CID],
  );
  if (j.rows.length === 0) { throw new Error("Josias contact not found: " + JOSIAS_CID); }
  const prevProfile = j.rows[0].access_profile_id;
  if (prevProfile !== pmId) {
    await client.query("UPDATE contacts SET access_profile_id = $1 WHERE cid = $2", [pmId, JOSIAS_CID]);
    await client.query(
      `INSERT INTO permission_audit_log
         (actor_cid, actor_name, target_cid, target_name, action, details)
       VALUES ($1, $2, $3, $4, 'profile_assigned', $5)`,
      [ACTOR, ACTOR_NAME, JOSIAS_CID, "Josias Hinnakou", `Assigned access profile: ${pm.rows[0].name}`],
    );
    console.log(`  + Josias -> profile "${pm.rows[0].name}" (id ${pmId})`);
  } else {
    console.log("  = Josias already on Program Manager profile (skipped)");
  }

  await client.query("COMMIT");
  console.log(`\n=== COMMITTED: ${created} facilitator assignments + Josias profile ===`);
} catch (err) {
  await client.query("ROLLBACK");
  console.error("\n=== ROLLED BACK — no changes applied ===");
  console.error(err.message);
  await client.end();
  process.exit(1);
}

// ── VERIFICATION (read-only) ────────────────────────────────────────────────
const staffRes = await client.query(
  "SELECT staff_id, role, permissions FROM v2_program_staff WHERE program_id = $1 ORDER BY staff_id",
  [PROGRAM_ID],
);
console.log(`\nv2_program_staff (${staffRes.rows.length}):`);
for (const r of staffRes.rows) console.log(`  ${r.staff_id}  role=${r.role}  caps=${Object.keys(r.permissions).length}`);

const rolesRes = await client.query(
  "SELECT contact_cid, role, context_type, context_id, is_current FROM contact_roles WHERE context_type = 'program' ORDER BY contact_cid",
);
console.log(`\ncontact_roles (${rolesRes.rows.length}):`);
for (const r of rolesRes.rows) console.log(`  ${r.contact_cid}  ${r.role}@${r.context_id}  current=${r.is_current}`);

const josias = await client.query(
  `SELECT c.cid, c.role, c.access_profile_id, ap.name AS profile
   FROM contacts c LEFT JOIN access_profiles ap ON ap.id = c.access_profile_id
   WHERE c.cid = $1`,
  [JOSIAS_CID],
);
console.log("\nJosias:", JSON.stringify(josias.rows[0]));

const timeline = await client.query(
  "SELECT contact_cid, event_type, created_at FROM contact_timeline WHERE context_id = $1 AND event_type = 'facilitator_assigned' ORDER BY created_at DESC",
  [PROGRAM_ID],
);
console.log(`\ncontact_timeline (${timeline.rows.length} facilitator_assigned entries)`);

await client.end();
console.log("\n=== DONE ===");
