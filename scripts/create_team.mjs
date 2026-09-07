import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
const envPath = resolve(projectRoot, ".env.local");
try { const envContent = readFileSync(envPath, "utf-8"); for (const line of envContent.split("\n")) { const eqIdx = line.indexOf("="); if (eqIdx > 0 && !line.startsWith("#")) { const key = line.substring(0, eqIdx).trim(); const value = line.substring(eqIdx + 1).trim(); if (!process.env[key]) process.env[key] = value; } } } catch (_) {}
import { initDb } from "../src/lib/db.js";
import bcrypt from "bcryptjs";

const db = await initDb();

const PASSWORD = await bcrypt.hash("ImpactOS2026!", 10);

const teamMembers = [
  { name: "Grace Mensah",     email: "grace.mensah@futurestudio.test",    role: "staff", title: "Venture Manager" },
  { name: "David Adebayo",    email: "david.adebayo@futurestudio.test",   role: "staff", title: "Lead Coach" },
  { name: "Jean-Claude Kouassi", email: "jeanclaude.kouassi@futurestudio.test", role: "staff", title: "Strategic Advisor" },
  { name: "Michael Lawson",   email: "michael.lawson@futurestudio.test",  role: "staff", title: "Investment Manager" },
  { name: "Daniel Mensah",    email: "daniel.mensah@futurestudio.test",   role: "staff", title: "Relationship Manager" },
  { name: "Alice Johnson",    email: "alice.johnson@futurestudio.test",   role: "staff", title: "Founder — NovaSpark" },
];

for (const m of teamMembers) {
  // Generate cid like USR-XXXXXXXX
  const cid = "USR-" + Math.random().toString(36).substring(2, 10).toUpperCase();

  // Check if already exists
  const exists = await db.execute({ sql: "SELECT cid FROM contacts WHERE email = ? AND deleted_at IS NULL", args: [m.email] });
  if (exists.rows.length > 0) {
    console.log(`⏭️ ${m.name} already exists: ${exists.rows[0].cid}`);
    continue;
  }

  await db.execute({
    sql: `INSERT INTO contacts (cid, name, email, password, role, created_at, status)
          VALUES (?, ?, ?, ?, ?, NOW(), 'active')`,
    args: [cid, m.name, m.email, PASSWORD, m.role],
  });

  console.log(`✅ ${m.name} (${m.title}) — ${m.email} / ImpactOS2026!`);
}

console.log("\n✅ Team accounts created.");
process.exit(0);
