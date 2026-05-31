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
 * MIGRATION: Create password_setup_tokens table for secure onboarding.
 *
 * Used by the Mandatory Approval System (Ticket 4 & 5):
 *   - SuperAdmin approves pending user
 *   - System generates time-limited token
 *   - Email sent to user with setup link
 *   - User sets password -> becomes ACTIVE
 *
 * Token rules:
 *   - Single-use (used = true after consumed)
 *   - Expires (configurable, default 24h)
 *   - Cryptographically random
 *
 * Run: node scripts/add_password_setup_tokens_table.mjs
 */

async function migrate() {
  await initDb();
  console.log("Setting up password_setup_tokens table...\n");

  try {
    await db.execute({
      sql: `CREATE TABLE IF NOT EXISTS password_setup_tokens (
          id SERIAL PRIMARY KEY,
          user_cid TEXT NOT NULL,
          user_email TEXT NOT NULL,
          token TEXT NOT NULL UNIQUE,
          expires_at TIMESTAMP NOT NULL,
          used BOOLEAN DEFAULT false,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      args: [],
    });
    console.log("  ✅ password_setup_tokens table created");

    await db.execute({
      sql: `CREATE INDEX IF NOT EXISTS idx_pst_token ON password_setup_tokens(token)`,
      args: [],
    });
    console.log("  ✅ idx_pst_token index created");

    await db.execute({
      sql: `CREATE INDEX IF NOT EXISTS idx_pst_user ON password_setup_tokens(user_cid)`,
      args: [],
    });
    console.log("  ✅ idx_pst_user index created");

    console.log("\n✅ Migration complete.");
  } catch (e) {
    console.error("❌ Migration failed:", e.message);
    process.exit(1);
  }
}

migrate().then(() => process.exit(0));
