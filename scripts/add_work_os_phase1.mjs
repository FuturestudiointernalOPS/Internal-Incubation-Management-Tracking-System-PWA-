import db, { initDb } from "../src/lib/db.js";
import fs from "fs";
import path from "path";

// Auto-load .env.local
const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

/**
 * MIGRATION: Add project ownership, staff assignments, and task assignments
 *
 * v2_projects:      + owner_id (TEXT) — references contacts.cid
 * v2_project_staff: new table for project-level staff assignments
 * tasks:            + assigned_to (TEXT) — references contacts.cid
 *
 * Run: set -a && . .env.local && node scripts/add_work_os_phase1.mjs
 */

async function migrate() {
  await initDb();
  console.log("Work OS Phase 1 — Core Entities\n");

  // 1. Add owner_id to v2_projects
  try {
    await db.execute({
      sql: "ALTER TABLE v2_projects ADD COLUMN owner_id TEXT DEFAULT NULL",
      args: [],
    });
    console.log("  ✅ v2_projects.owner_id added");
  } catch (e) {
    if (e.message.includes("already exists"))
      console.log("  ⚠️  v2_projects.owner_id already exists");
    else console.error("  ❌ v2_projects.owner_id:", e.message);
  }

  // 2. Create v2_project_staff table
  try {
    await db.execute({
      sql: `CREATE TABLE IF NOT EXISTS v2_project_staff (
        id SERIAL PRIMARY KEY,
        project_id UUID NOT NULL REFERENCES v2_projects(id) ON DELETE CASCADE,
        staff_id TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('lead', 'member', 'reviewer')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(project_id, staff_id)
      )`,
      args: [],
    });
    console.log("  ✅ v2_project_staff table created");
  } catch (e) {
    console.error("  ❌ v2_project_staff:", e.message);
  }

  // 3. Add assigned_to to tasks
  try {
    await db.execute({
      sql: "ALTER TABLE tasks ADD COLUMN assigned_to TEXT DEFAULT NULL",
      args: [],
    });
    console.log("  ✅ tasks.assigned_to added");
  } catch (e) {
    if (e.message.includes("already exists"))
      console.log("  ⚠️  tasks.assigned_to already exists");
    else console.error("  ❌ tasks.assigned_to:", e.message);
  }

  console.log("\n✅ Phase 1 migration complete.");
}

migrate().then(() => process.exit(0));
