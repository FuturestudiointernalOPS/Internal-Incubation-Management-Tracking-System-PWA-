import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
const envPath = resolve(projectRoot, ".env.local");
try {
  const envContent = readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const equalsIndex = line.indexOf("=");
    if (equalsIndex > 0 && !line.startsWith("#")) {
      const key = line.substring(0, equalsIndex).trim();
      const value = line.substring(equalsIndex + 1).trim();
      if (!process.env[key]) process.env[key] = value;
    }
  }
} catch (_) {}

import { initDb } from "../src/lib/db.js";
const db = await initDb();

// 1. Sarah's investor profile id
const profileResult = await db.execute({sql: "SELECT id, user_id FROM investor_profiles WHERE user_id = $1", args: ["USR-MS6ALOU8THH1K"]});
console.log("Sarah profile:", JSON.stringify(profileResult.rows));

// 2. All workspaces
const workspacesResult = await db.execute({sql: "SELECT * FROM relationship_workspaces", args: []});
console.log("\nWorkspaces:", JSON.stringify(workspacesResult.rows, null, 2));

// 3. All meetings
const meetingsResult = await db.execute({sql: "SELECT * FROM relationship_meetings", args: []});
console.log("\nMeetings:", JSON.stringify(meetingsResult.rows, null, 2));

// 4. Simulate the dashboard query for Sarah
const profileId = profileResult.rows[0]?.id;
if (profileId) {
  const relationshipsResult = await db.execute({
    sql: `SELECT rw.* FROM relationship_workspaces rw WHERE rw.investor_id = $1 AND rw.status = 'active'`,
    args: [profileId],
  });
  console.log("\nRelationships for Sarah:", JSON.stringify(relationshipsResult.rows, null, 2));

  // Try the full query
  try {
    const fullQueryResult = await db.execute({
      sql: `SELECT rw.*, p.name as venture_name, p.industry,
                   rm.name as relationship_manager_name,
                   (SELECT COUNT(*) FROM relationship_meetings WHERE workspace_id = rw.id AND status = 'scheduled')::int as upcoming_meetings,
                   (SELECT json_agg(json_build_object('id', rm2.id, 'meeting_type', rm2.meeting_type, 'scheduled_date', rm2.scheduled_date, 'scheduled_time', rm2.scheduled_time, 'status', rm2.status, 'location', rm2.location))
                    FROM relationship_meetings rm2 WHERE rm2.workspace_id = rw.id AND rm2.status = 'scheduled'
                    ORDER BY rm2.scheduled_date ASC LIMIT 3) as next_meetings
            FROM relationship_workspaces rw
            LEFT JOIN v2_programs p ON rw.venture_id = p.id
            LEFT JOIN contacts rm ON rw.relationship_manager_id = rm.cid
            WHERE rw.investor_id = $1 AND rw.status = 'active'
            ORDER BY rw.updated_at DESC`,
      args: [profileId],
    });
    console.log("\nFull dashboard query:", JSON.stringify(fullQueryResult.rows, null, 2));
  } catch (error) { console.error("Full query error:", error.message); }
}

process.exit(0);
