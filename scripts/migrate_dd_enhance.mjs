import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
const envPath = resolve(projectRoot, ".env.local");
try {
  const envContent = readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const eqIdx = line.indexOf("=");
    if (eqIdx > 0 && !line.startsWith("#")) {
      const key = line.substring(0, eqIdx).trim();
      const value = line.substring(eqIdx + 1).trim();
      if (!process.env[key]) process.env[key] = value;
    }
  }
} catch (_) {}

import { initDb } from "../src/lib/db.js";
const db = await initDb();

// 1. Update dd_information_requests: add columns + modify checks
const queries = [
  // Add new columns (if not exists)
  `ALTER TABLE dd_information_requests ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'medium'`,
  `ALTER TABLE dd_information_requests ADD COLUMN IF NOT EXISTS due_date DATE`,
  `ALTER TABLE dd_information_requests ADD COLUMN IF NOT EXISTS owner_id TEXT`,
  `ALTER TABLE dd_information_requests ADD COLUMN IF NOT EXISTS version_history JSONB DEFAULT '[]'`,
  
  // Drop old CHECK constraints and add new ones
  `ALTER TABLE dd_information_requests DROP CONSTRAINT IF EXISTS dd_information_requests_category_check`,
  `ALTER TABLE dd_information_requests DROP CONSTRAINT IF EXISTS dd_information_requests_status_check`,
  `ALTER TABLE dd_information_requests ADD CONSTRAINT dd_info_req_category_check CHECK (category IN ('corporate', 'financial', 'commercial', 'technical', 'legal', 'general', 'product', 'team', 'market'))`,
  `ALTER TABLE dd_information_requests ADD CONSTRAINT dd_info_req_status_check CHECK (status IN ('pending', 'under_review', 'documents_uploaded', 'verified', 'completed', 'responded', 'closed'))`,
];

for (const sql of queries) {
  try {
    await db.execute({ sql, args: [] });
    console.log("✅", sql.substring(0, 60) + "...");
  } catch(e) {
    console.log("⚠️", e.message?.substring(0, 100));
  }
}

console.log("✅ DD tables enhanced");
process.exit(0);
