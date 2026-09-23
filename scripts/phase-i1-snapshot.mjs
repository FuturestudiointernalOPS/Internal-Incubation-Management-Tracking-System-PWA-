/* Phase I1 — before-image snapshot of identity/context tables (STAGING, read-only). */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import pg from "pg";

const files = [".env.audit-staging", ".env.staging"];
let databaseUrl = null;
for (const envFile of files) {
  try {
    const candidateUrl = readFileSync(envFile, "utf-8").split("\n").find((envLine) => envLine.startsWith("DATABASE_URL="))?.substring("DATABASE_URL=".length).trim();
    if (candidateUrl) { databaseUrl = candidateUrl; break; }
  } catch { /* next */ }
}
if (!databaseUrl) { console.error("NO STAGING URL"); process.exit(1); }
const pool = new pg.Pool({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 10000 });
console.log("DB HOST:", new URL(databaseUrl).host);

const TABLES = {
  contacts: "cid, name, role, status, group_name, access_profile_id, program_id, v2_team_id",
  participant_programs: "*",
  venture_members: "*",
  v2_program_staff: "*",
  v2_teams: "id, program_id, name, handler_id, leader_id, venture_id, team_type, is_venture_ready",
  lms_enrollments: "*",
  user_responsibilities: "*",
  role_capabilities: "*",
  responsibilities: "id, key, name, allowed_roles",
};
try {
  mkdirSync("scratch", { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 19);
  const snapshot = { host: new URL(databaseUrl).host, exportedAt: new Date().toISOString(), tables: {} };
  for (const [tableName, columns] of Object.entries(TABLES)) {
    try {
      const queryResult = await pool.query(`SELECT ${columns} FROM ${tableName} ORDER BY 1`);
      snapshot.tables[tableName] = { count: queryResult.rowCount, rows: queryResult.rows };
      console.log(`${tableName}: ${queryResult.rowCount} rows`);
    } catch (error) {
      console.log(`${tableName}: (error) ${error.message}`);
    }
  }
  const file = `scratch/phase-i1-before-${timestamp}.json`;
  writeFileSync(file, JSON.stringify(snapshot, null, 2));
  console.log("before-image:", file);
} finally {
  await pool.end();
}
