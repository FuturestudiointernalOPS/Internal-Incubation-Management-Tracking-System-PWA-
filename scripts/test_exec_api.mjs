import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
const envPath = resolve(projectRoot, ".env.local");
try { const envContent = readFileSync(envPath, "utf-8"); for (const line of envContent.split("\n")) { const eqIdx = line.indexOf("="); if (eqIdx > 0 && !line.startsWith("#")) { const key = line.substring(0, eqIdx).trim(); const value = line.substring(eqIdx + 1).trim(); if (!process.env[key]) process.env[key] = value; } } } catch (_) {}
import { initDb } from "../src/lib/db.js";
const db = await initDb();

try {
  const r = await db.execute({ sql: "SELECT COALESCE(SUM(target_raise),0)::float as total_sought, COALESCE(SUM(current_raised),0)::float as total_raised FROM fundraising_campaigns", args: [] });
  console.log("Fundraising:", JSON.stringify(r.rows));
} catch(e) { console.error("Error:", e.message); }

try {
  const r = await db.execute({ sql: "SELECT (SELECT COUNT(*) FROM investor_profiles WHERE approval_status='approved')::int as total_verified", args: [] });
  console.log("Investors:", JSON.stringify(r.rows));
} catch(e) { console.error("Error:", e.message); }

try {
  const r = await db.execute({ sql: "SELECT stage, COUNT(*)::int as count FROM investment_pipeline GROUP BY stage ORDER BY count DESC", args: [] });
  console.log("Pipeline:", JSON.stringify(r.rows));
} catch(e) { console.error("Error:", e.message); }

try {
  const r = await db.execute({ sql: "SELECT (SELECT COALESCE(SUM(investment_amount),0)::float FROM investment_decisions WHERE decision_type='invest') as total_committed", args: [] });
  console.log("Committed:", JSON.stringify(r.rows));
} catch(e) { console.error("Error:", e.message); }

process.exit(0);
