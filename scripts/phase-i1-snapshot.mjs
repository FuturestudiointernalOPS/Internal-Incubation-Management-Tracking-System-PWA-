/* Phase I1 — before-image snapshot of identity/context tables (STAGING, read-only). */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import pg from "pg";

const files = [".env.audit-staging", ".env.staging"];
let url = null;
for (const f of files) {
  try {
    const u = readFileSync(f, "utf-8").split("\n").find((l) => l.startsWith("DATABASE_URL="))?.substring("DATABASE_URL=".length).trim();
    if (u) { url = u; break; }
  } catch { /* next */ }
}
if (!url) { console.error("NO STAGING URL"); process.exit(1); }
const pool = new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 10000 });
console.log("DB HOST:", new URL(url).host);

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
  const stamp = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 19);
  const out = { host: new URL(url).host, exportedAt: new Date().toISOString(), tables: {} };
  for (const [t, cols] of Object.entries(TABLES)) {
    try {
      const r = await pool.query(`SELECT ${cols} FROM ${t} ORDER BY 1`);
      out.tables[t] = { count: r.rowCount, rows: r.rows };
      console.log(`${t}: ${r.rowCount} rows`);
    } catch (e) {
      console.log(`${t}: (error) ${e.message}`);
    }
  }
  const file = `scratch/phase-i1-before-${stamp}.json`;
  writeFileSync(file, JSON.stringify(out, null, 2));
  console.log("before-image:", file);
} finally {
  await pool.end();
}
