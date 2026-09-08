import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
const envPath = resolve(projectRoot, ".env.local");
try { const envContent = readFileSync(envPath, "utf-8"); for (const line of envContent.split("\n")) { const eqIdx = line.indexOf("="); if (eqIdx > 0 && !line.startsWith("#")) { const key = line.substring(0, eqIdx).trim(); const value = line.substring(eqIdx + 1).trim(); if (!process.env[key]) process.env[key] = value; } } } catch (_) {}
import { initDb } from "../src/lib/db.js";
const db = await initDb();

// Check all contacts with staff/super_admin roles
const r = await db.execute({ sql: "SELECT cid, name, email, role FROM contacts WHERE role IN ('super_admin','staff','program_manager') AND deleted_at IS NULL ORDER BY name", args: [] });
console.log("Staff contacts:", JSON.stringify(r.rows, null, 2));

// Check for any contacts with names from the case study
const names = ["Grace","Mensah","David","Adebayo","Jean","Claude","Kouassi","Michael","Lawson","Daniel","Alice","Johnson"];
for (const name of names) {
  const m = await db.execute({ sql: "SELECT cid, name, email, role FROM contacts WHERE name ILIKE $1 AND deleted_at IS NULL", args: [`%${name}%`] });
  if (m.rows.length > 0) console.log(`Found ${name}:`, JSON.stringify(m.rows));
}
console.log("\nTotal contacts:", r.rows.length);
process.exit(0);
