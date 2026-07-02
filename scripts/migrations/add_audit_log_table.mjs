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
 * MIGRATION: Create audit_log table for task and blocker lifecycle tracking.
 *
 * Logs all lifecycle events for tasks and blockers:
 *   - Task Created, Updated, Completed, Carried Over
 *   - Blocker Created, Resolved
 *
 * Designed for future Notion sync readiness.
 *
 * Run: set -a && . .env.local && node scripts/add_audit_log_table.mjs
 */

async function migrate() {
  await initDb();
  console.log("Setting up audit_log table...\n");

  try {
    await db.execute({
      sql: `CREATE TABLE IF NOT EXISTS audit_log (
          id SERIAL PRIMARY KEY,
          entity_type TEXT NOT NULL CHECK (entity_type IN ('task', 'blocker')),
          entity_id INTEGER NOT NULL,
          user_id TEXT NOT NULL,
          user_name TEXT NOT NULL DEFAULT '',
          action TEXT NOT NULL,
          details TEXT DEFAULT NULL,
          metadata JSONB DEFAULT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,
      args: [],
    });
    console.log("  ✅ audit_log table created");

    await db.execute({
      sql: `CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity_type, entity_id)`,
      args: [],
    });
    console.log("  ✅ idx_audit_log_entity index created");

    await db.execute({
      sql: `CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_id)`,
      args: [],
    });
    console.log("  ✅ idx_audit_log_user index created");

    await db.execute({
      sql: `CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at)`,
      args: [],
    });
    console.log("  ✅ idx_audit_log_created index created");

    console.log("\n✅ Migration complete.");
  } catch (e) {
    console.error("❌ Migration failed:", e.message);
    process.exit(1);
  }
}

migrate().then(() => process.exit(0));
