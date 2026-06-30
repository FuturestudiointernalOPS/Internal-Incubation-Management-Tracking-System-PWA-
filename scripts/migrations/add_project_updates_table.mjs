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
 * MIGRATION: Create v2_project_updates table for weekly project narratives.
 *
 * Project owners can submit a weekly narrative update for each project,
 * separate from individual standups/retros. This provides the project-level
 * story: what was accomplished, what's in progress, what's blocked.
 *
 * Run: node scripts/add_project_updates_table.mjs
 */

async function migrate() {
  await initDb();
  console.log("Setting up v2_project_updates table...\n");

  try {
    await db.execute({
      sql: `CREATE TABLE IF NOT EXISTS v2_project_updates (
          id SERIAL PRIMARY KEY,
          project_id UUID NOT NULL,
          user_id TEXT NOT NULL,
          user_name TEXT NOT NULL DEFAULT '',
          week_number INTEGER NOT NULL,
          year INTEGER NOT NULL,
          status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted')),
          accomplishments TEXT,
          current_focus TEXT,
          blockers TEXT,
          next_steps TEXT,
          overall_status TEXT DEFAULT 'on_track' CHECK (overall_status IN ('on_track', 'at_risk', 'behind', 'completed')),
          notes TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(project_id, week_number, year)
        )`,
      args: [],
    });
    console.log("  ✅ v2_project_updates table created");

    await db.execute({
      sql: `CREATE INDEX IF NOT EXISTS idx_project_updates_project ON v2_project_updates(project_id)`,
      args: [],
    });
    console.log("  ✅ idx_project_updates_project index created");

    await db.execute({
      sql: `CREATE INDEX IF NOT EXISTS idx_project_updates_week ON v2_project_updates(project_id, week_number, year)`,
      args: [],
    });
    console.log("  ✅ idx_project_updates_week index created");

    console.log("\n✅ Migration complete. v2_project_updates table ready.");
  } catch (e) {
    console.error("❌ Migration failed:", e.message);
    process.exit(1);
  }
}

migrate().then(() => process.exit(0));
