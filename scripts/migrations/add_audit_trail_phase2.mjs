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
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (!process.env[key]) process.env[key] = value;
  }
}

async function migrate() {
  await initDb();
  console.log("Phase 2 — Audit Trail System\n");

  // Create task_assignment_log table (immutable — no UPDATE/DELETE allowed at app level)
  try {
    await db.execute({
      sql: `CREATE TABLE IF NOT EXISTS task_assignment_log (
        id SERIAL PRIMARY KEY,
        task_id INTEGER NOT NULL,
        project_id TEXT DEFAULT NULL,
        actor_id TEXT NOT NULL,
        target_user_id TEXT DEFAULT NULL,
        action_type TEXT NOT NULL CHECK (action_type IN (
          'TASK_CREATED', 'TASK_ASSIGNED', 'TASK_UPDATED',
          'TASK_ACCEPTED', 'TASK_COMPLETED', 'TASK_CARRIED_OVER',
          'TASK_BLOCKED', 'TASK_UNBLOCKED'
        )),
        previous_state JSONB DEFAULT NULL,
        new_state JSONB DEFAULT NULL,
        description TEXT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      args: [],
    });
    console.log("  ✅ task_assignment_log table created");
  } catch (e) {
    console.error("  ❌ task_assignment_log:", e.message);
  }

  // Index for fast task history queries
  try {
    await db.execute({
      sql: "CREATE INDEX IF NOT EXISTS idx_task_log_task_id ON task_assignment_log(task_id)",
      args: [],
    });
    console.log("  ✅ idx_task_log_task_id index created");
  } catch (e) {
    console.log("  ⚠️  index:", e.message);
  }

  // Index for actor queries
  try {
    await db.execute({
      sql: "CREATE INDEX IF NOT EXISTS idx_task_log_actor ON task_assignment_log(actor_id)",
      args: [],
    });
    console.log("  ✅ idx_task_log_actor index created");
  } catch (e) {
    console.log("  ⚠️  index:", e.message);
  }

  console.log("\n✅ Phase 2 complete.");
}

migrate().then(() => process.exit(0));
