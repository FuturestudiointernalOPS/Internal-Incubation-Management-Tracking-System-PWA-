import db, { initDb } from "../src/lib/db.js";
import fs from "fs";
import path from "path";

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

async function migrate() {
  await initDb();
  console.log("Creating user_sessions table...\n");

  try {
    await db.execute({
      sql: `CREATE TABLE IF NOT EXISTS user_sessions (
          id SERIAL PRIMARY KEY,
          token TEXT NOT NULL UNIQUE,
          user_cid TEXT NOT NULL,
          role TEXT NOT NULL DEFAULT 'participant',
          expires_at TIMESTAMP NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      args: [],
    });
    console.log("  ✅ user_sessions table created");

    await db.execute({
      sql: `CREATE INDEX IF NOT EXISTS idx_us_token ON user_sessions(token)`,
      args: [],
    });
    console.log("  ✅ idx_us_token index created");

    await db.execute({
      sql: `CREATE INDEX IF NOT EXISTS idx_us_user ON user_sessions(user_cid)`,
      args: [],
    });
    console.log("  ✅ idx_us_user index created");

    // Auto-cleanup expired sessions
    await db.execute({
      sql: `CREATE INDEX IF NOT EXISTS idx_us_expires ON user_sessions(expires_at)`,
      args: [],
    });
    console.log("  ✅ idx_us_expires index created");

    console.log("\n✅ Migration complete. Session table ready.");
  } catch (e) {
    console.error("❌ Migration failed:", e.message);
    process.exit(1);
  }
}

migrate().then(() => process.exit(0));
