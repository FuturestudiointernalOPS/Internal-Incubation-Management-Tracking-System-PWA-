/**
 * Phase 3 — Staff/Participant default profile alignment (configuration data only).
 * PROD + STAGE. Captures a before-image first, then applies:
 *  - Staff Default: REMOVE knowledge.*, programs.edit, reports.export, ventures.create
 *                   ADD projects.view/create/edit (matrix Projects=4)
 *                   KEEP reports.create (Weekly Operations dependency — verified)
 *                   KEEP tasks.*, internal_comms.*, investor.*, messaging.* (not in matrix)
 *  - Participant Default: REMOVE projects.view (matrix Projects=0)
 * Rollback: restore from the before-image file.
 */
import { readFileSync, writeFileSync } from "node:fs";
import pg from "pg";

const readDatabaseUrl = (file) =>
  readFileSync(file, "utf-8")
    .split("\n")
    .find((envLine) => envLine.startsWith("DATABASE_URL="))
    ?.substring("DATABASE_URL=".length)
    .trim();

const ENVS = [
  { label: "PROD", url: readDatabaseUrl(".env.local") },
  { label: "STAGE", url: readDatabaseUrl(".env.audit-staging") },
];

const STAFF_REMOVE = [
  ["knowledge", "view"],
  ["knowledge", "create"],
  ["knowledge", "edit"],
  ["knowledge", "delete"],
  ["programs", "edit"],
  ["reports", "export"],
  ["ventures", "create"],
];
const STAFF_ADD = [
  ["projects", "view", 1],
  ["projects", "create", 2],
  ["projects", "edit", 3],
];
const PARTICIPANT_REMOVE = [["projects", "view"]];

const beforeImage = {};

for (const env of ENVS) {
  const pool = new pg.Pool({ connectionString: env.url, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 10000 });
  console.log(`\n=== ${env.label} ===`);

  const lookupProfileId = async (name) => {
    const profileResult = await pool.query("SELECT id FROM access_profiles WHERE name = $1", [name]);
    if (profileResult.rows.length === 0) throw new Error(`profile not found: ${name}`);
    return profileResult.rows[0].id;
  };

  const staffProfileId = await lookupProfileId("Staff Default");
  const participantProfileId = await lookupProfileId("Participant Default");

  // 1. Before-image
  const snapshot = await pool.query(
    "SELECT profile_id, module, capability, access_level FROM access_profile_capabilities WHERE profile_id IN ($1,$2) ORDER BY profile_id, module, capability",
    [staffProfileId, participantProfileId],
  );
  beforeImage[env.label] = snapshot.rows;
  console.log(`  before-image: ${snapshot.rows.length} rows captured`);

  // 2. Staff Default — remove
  for (const [module, capability] of STAFF_REMOVE) {
    const deleteResult = await pool.query("DELETE FROM access_profile_capabilities WHERE profile_id = $1 AND module = $2 AND capability = $3", [staffProfileId, module, capability]);
    console.log(`  staff remove ${module}.${capability}: ${deleteResult.rowCount}`);
  }
  // 3. Staff Default — add (upsert)
  for (const [module, capability, accessLevel] of STAFF_ADD) {
    await pool.query(
      `INSERT INTO access_profile_capabilities (profile_id, module, capability, access_level)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (profile_id, module, capability) DO UPDATE SET access_level = EXCLUDED.access_level`,
      [staffProfileId, module, capability, accessLevel],
    );
    console.log(`  staff upsert ${module}.${capability} = L${accessLevel}: ok`);
  }
  // 4. Participant Default — remove
  for (const [module, capability] of PARTICIPANT_REMOVE) {
    const deleteResult = await pool.query("DELETE FROM access_profile_capabilities WHERE profile_id = $1 AND module = $2 AND capability = $3", [participantProfileId, module, capability]);
    console.log(`  participant remove ${module}.${capability}: ${deleteResult.rowCount}`);
  }

  if (env.label === "PROD") {
    await pool.query(
      `INSERT INTO permission_audit_log (actor_cid, actor_name, target_cid, target_name, action, details)
       VALUES ('system','system','system','system','profile_updated',
               'Phase 3: Staff Default aligned to matrix (removed knowledge.*, programs.edit, reports.export, ventures.create; added projects.view/create/edit; kept reports.create for Weekly Operations). Participant Default removed projects.view.')`,
    );
    console.log("  audit entry recorded");
  }

  // 5. Final state
  const finalRows = await pool.query(
    "SELECT a.name, c.module, c.capability, c.access_level FROM access_profile_capabilities c JOIN access_profiles a ON a.id = c.profile_id WHERE c.profile_id IN ($1,$2) ORDER BY a.name, c.module, c.capability",
    [staffProfileId, participantProfileId],
  );
  console.log("  final rows:");
  for (const row of finalRows.rows) console.log(`    ${row.name} :: ${row.module}.${row.capability} = L${row.access_level}`);

  await pool.end();
}

writeFileSync("scratch/phase3-before-image.json", JSON.stringify(beforeImage, null, 2));
console.log("\n[done] before-image saved to scratch/phase3-before-image.json");
