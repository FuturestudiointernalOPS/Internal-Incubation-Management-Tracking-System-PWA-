import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
const envPath = resolve(projectRoot, ".env.local");
try { const envContent = readFileSync(envPath, "utf-8"); for (const line of envContent.split("\n")) { const eqIdx = line.indexOf("="); if (eqIdx > 0 && !line.startsWith("#")) { const key = line.substring(0, eqIdx).trim(); const value = line.substring(eqIdx + 1).trim(); if (!process.env[key]) process.env[key] = value; } } } catch (_) {}
import { initDb } from "../src/lib/db.js";
const db = await initDb();

const deletes = [
  "DELETE FROM dd_documents",
  "DELETE FROM dd_information_requests",
  "DELETE FROM due_diligence_workspaces",
  "DELETE FROM relationship_timeline",
  "DELETE FROM relationship_meetings",
  "DELETE FROM relationship_workspaces",
  "DELETE FROM investment_decisions",
];
for (const sql of deletes) {
  const r = await db.execute({ sql, args: [] });
  console.log(`✅ ${sql.split(" ")[1]} ${sql.split(" ")[2]}: ${r.rowsAffected} rows`);
}

await db.execute({ sql: "UPDATE investment_pipeline SET stage = 'meeting_requested', stage_changed_at = NOW() WHERE stage = 'invested'", args: [] });
await db.execute({ sql: "UPDATE investment_pipeline SET stage = 'meeting_requested', stage_changed_at = NOW() WHERE stage = 'due_diligence'", args: [] });

console.log("\n✅ DB clean. Ready for proper multi-user DD test.");
process.exit(0);
