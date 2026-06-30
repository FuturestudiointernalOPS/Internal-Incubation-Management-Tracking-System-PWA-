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
 * MIGRATION: Add language column to contacts table
 *
 * Stores user language preference at the account level.
 * Enables cross-device language sync.
 *
 * Run: set -a && . .env.local && node scripts/add_language_column.mjs
 */

async function migrate() {
  await initDb();
  console.log("Adding language column to contacts...\n");

  try {
    await db.execute({
      sql: `ALTER TABLE contacts ADD COLUMN IF NOT EXISTS language VARCHAR(5) DEFAULT 'en'`,
      args: [],
    });
    console.log("  ✅ language column added to contacts table");
    console.log("\n✅ Migration complete.");
  } catch (e) {
    // ALTER TABLE ADD COLUMN IF NOT EXISTS may not be supported in all Postgres versions
    try {
      await db.execute({
        sql: `ALTER TABLE contacts ADD COLUMN language VARCHAR(5) DEFAULT 'en'`,
        args: [],
      });
      console.log("  ✅ language column added to contacts table");
      console.log("\n✅ Migration complete.");
    } catch (e2) {
      // Column may already exist
      if (e2.message.includes("already exists")) {
        console.log("  ⚠️  language column already exists");
        console.log("\n✅ Migration complete (no action needed).");
      } else {
        console.error("❌ Migration failed:", e2.message);
        process.exit(1);
      }
    }
  }
}

migrate().then(() => process.exit(0));
