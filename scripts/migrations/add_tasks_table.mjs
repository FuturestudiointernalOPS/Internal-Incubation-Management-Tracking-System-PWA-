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
 * MIGRATION: Create tasks table for first-class task management.
 *
 * This migration introduces the `tasks` table as a first-class entity
 * in the reporting ecosystem. Tasks are owned by users, optionally
 * associated with projects, and track lifecycle across weeks.
 *
 * Status lifecycle:
 *   pending → in_progress → completed
 *                      ↘ blocked    → completed
 *                      ↘ carried_over (auto on new week if not completed)
 *
 * Run: set -a && . .env.local && node scripts/add_tasks_table.mjs
 */

async function migrate() {
  await initDb();
  console.log("Setting up tasks table...\n");

  try {
    await db.execute({
      sql: `CREATE TABLE IF NOT EXISTS tasks (
          id SERIAL PRIMARY KEY,
          user_id TEXT NOT NULL,
          user_name TEXT NOT NULL DEFAULT '',
          title TEXT NOT NULL,
          description TEXT DEFAULT NULL,
          status TEXT NOT NULL DEFAULT 'pending'
            CHECK (status IN ('pending', 'in_progress', 'blocked', 'completed', 'carried_over')),
          project_id UUID DEFAULT NULL,
          created_week INTEGER NOT NULL,
          created_year INTEGER NOT NULL,
          completed_at TIMESTAMP DEFAULT NULL,
          carried_over_from_task_id INTEGER DEFAULT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,
      args: [],
    });
    console.log("  ✅ tasks table created");

    // Add indexes
    await db.execute({
      sql: `CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id)`,
      args: [],
    });
    console.log("  ✅ idx_tasks_user_id index created");

    await db.execute({
      sql: `CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status)`,
      args: [],
    });
    console.log("  ✅ idx_tasks_status index created");

    await db.execute({
      sql: `CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id)`,
      args: [],
    });
    console.log("  ✅ idx_tasks_project_id index created");

    console.log("\n✅ Migration complete.");
  } catch (e) {
    console.error("❌ Migration failed:", e.message);
    process.exit(1);
  }
}

migrate().then(() => process.exit(0));
