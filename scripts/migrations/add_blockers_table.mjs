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
 * MIGRATION: Create blockers table for dedicated blocker management.
 *
 * Blockers are tied to tasks. A blocker cannot exist without a task.
 * Statuses: active, resolved
 *
 * Run: set -a && . .env.local && node scripts/add_blockers_table.mjs
 */

async function migrate() {
  await initDb();
  console.log("Setting up blockers table...\n");

  try {
    await db.execute({
      sql: `CREATE TABLE IF NOT EXISTS blockers (
          id SERIAL PRIMARY KEY,
          task_id INTEGER NOT NULL,
          user_id TEXT NOT NULL,
          user_name TEXT NOT NULL DEFAULT '',
          title TEXT NOT NULL,
          description TEXT DEFAULT NULL,
          severity TEXT DEFAULT 'medium'
            CHECK (severity IN ('low', 'medium', 'high', 'critical')),
          status TEXT NOT NULL DEFAULT 'active'
            CHECK (status IN ('active', 'resolved')),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          resolved_at TIMESTAMP DEFAULT NULL,
          resolved_by TEXT DEFAULT NULL
        )`,
      args: [],
    });
    console.log("  ✅ blockers table created");

    // Add indexes
    await db.execute({
      sql: `CREATE INDEX IF NOT EXISTS idx_blockers_task_id ON blockers(task_id)`,
      args: [],
    });
    console.log("  ✅ idx_blockers_task_id index created");

    await db.execute({
      sql: `CREATE INDEX IF NOT EXISTS idx_blockers_user_id ON blockers(user_id)`,
      args: [],
    });
    console.log("  ✅ idx_blockers_user_id index created");

    await db.execute({
      sql: `CREATE INDEX IF NOT EXISTS idx_blockers_status ON blockers(status)`,
      args: [],
    });
    console.log("  ✅ idx_blockers_status index created");

    console.log("\n✅ Migration complete.");
  } catch (e) {
    console.error("❌ Migration failed:", e.message);
    process.exit(1);
  }
}

migrate().then(() => process.exit(0));
