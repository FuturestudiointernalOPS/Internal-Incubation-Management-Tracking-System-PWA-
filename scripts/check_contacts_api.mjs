import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
const envPath = resolve(projectRoot, ".env.local");
try { const envContent = readFileSync(envPath, "utf-8"); for (const line of envContent.split("\n")) { const eqIdx = line.indexOf("="); if (eqIdx > 0 && !line.startsWith("#")) { const key = line.substring(0, eqIdx).trim(); const value = line.substring(eqIdx + 1).trim(); if (!process.env[key]) process.env[key] = value; } } } catch (_) {}
import { initDb } from "../src/lib/db.js";
const db = await initDb();

// Test the contacts query that the API would run
const roles = ["super_admin", "staff", "program_manager"];
let sql = "SELECT cid, name, email, role FROM contacts WHERE archived_at IS NULL AND deleted_at IS NULL";
sql += " AND (" + roles.map(() => "role = ?").join(" OR ") + ")";
sql += " ORDER BY name ASC";

const r = await db.execute({ sql, args: [...roles] });
console.log("Staff list from contacts:", JSON.stringify(r.rows, null, 2));
console.log("\nTotal:", r.rows.length);

// Check a specific team member
const dm = await db.execute({ sql: "SELECT * FROM contacts WHERE name ILIKE $1", args: ["%daniel mensah%"] });
console.log("\nDaniel Mensah:", JSON.stringify(dm.rows, null, 2));
process.exit(0);
