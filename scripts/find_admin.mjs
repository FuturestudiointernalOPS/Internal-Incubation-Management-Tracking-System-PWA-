import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
const envPath = resolve(projectRoot, ".env.local");
try { const envContent = readFileSync(envPath, "utf-8"); for (const line of envContent.split("\n")) { const equalsIndex = line.indexOf("="); if (equalsIndex > 0 && !line.startsWith("#")) { const key = line.substring(0, equalsIndex).trim(); const value = line.substring(equalsIndex + 1).trim(); if (!process.env[key]) process.env[key] = value; } } } catch (_) {}
import { initDb } from "../src/lib/db.js";
const db = await initDb();
const adminsResult = await db.execute({sql: "SELECT cid, name, email, role FROM contacts WHERE role = 'super_admin' AND deleted_at IS NULL LIMIT 3", args: []});
console.log("Admins:", JSON.stringify(adminsResult.rows));
process.exit(0);
