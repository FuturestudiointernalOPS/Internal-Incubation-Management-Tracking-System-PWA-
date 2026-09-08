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
 * MIGRATION: Add start_date and end_date columns to tasks table
 *
 * Enforces timeline on tasks for standup workflow.
 *
 * Run: set -a && . .env.local && node scripts/add_task_dates.mjs
 */

async function migrate() {
  await initDb();
  console.log("Adding date columns to tasks...\n");

  const columns = [
    ["start_date", "DATE DEFAULT NULL"],
    ["end_date", "DATE DEFAULT NULL"],
  ];

  for (const [col, def] of columns) {
    try {
      await db.execute({
        sql: `ALTER TABLE tasks ADD COLUMN ${col} ${def}`,
        args: [],
      });
      console.log(`  ✅ ${col} column added`);
    } catch (e) {
      if (e.message.includes("already exists")) {
        console.log(`  ⚠️  ${col} already exists`);
      } else {
        console.error(`  ❌ ${col}: ${e.message}`);
      }
    }
  }

  console.log("\n✅ Migration complete.");
}

migrate().then(() => process.exit(0));
