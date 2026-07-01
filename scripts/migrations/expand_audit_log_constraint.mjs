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
 * MIGRATION: Expand audit_log CHECK constraint to include 'user' entity_type.
 *
 * The current constraint only allows 'task' and 'blocker'.
 * This migration adds 'user' so approval/setup lifecycle events can be tracked.
 *
 * Run: node scripts/expand_audit_log_constraint.mjs
 */

async function migrate() {
  await initDb();
  console.log("Expanding audit_log entity_type constraint...\n");

  try {
    // Drop existing CHECK constraint and recreate with 'user' added
    await db.execute({
      sql: `ALTER TABLE audit_log DROP CONSTRAINT IF EXISTS audit_log_entity_type_check`,
      args: [],
    });
    console.log("  ✅ Dropped old constraint");

    await db.execute({
      sql: `ALTER TABLE audit_log ADD CONSTRAINT audit_log_entity_type_check
            CHECK (entity_type IN ('task', 'blocker', 'user'))`,
      args: [],
    });
    console.log("  ✅ Added expanded constraint (task, blocker, user)");

    console.log("\n✅ Migration complete. audit_log now accepts 'user' events.");
  } catch (e) {
    console.error("❌ Migration failed:", e.message);
    process.exit(1);
  }
}

migrate().then(() => process.exit(0));
