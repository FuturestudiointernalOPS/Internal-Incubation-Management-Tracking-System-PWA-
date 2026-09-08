import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");

// Load .env.local
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
  console.log("✅ .env.local loaded");
} catch (e) { console.error("env load err:", e.message); }

import { initDb } from "../src/lib/db.js";

const db = await initDb();

await db.execute({ sql: `CREATE TABLE IF NOT EXISTS fundraising_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    venture_id UUID NOT NULL,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'closed')),
    target_raise DECIMAL(15,2), current_raised DECIMAL(15,2) DEFAULT 0,
    min_investment DECIMAL(15,2), max_investment DECIMAL(15,2),
    currency TEXT DEFAULT 'USD',
    visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'invite_only', 'private')),
    opening_date DATE, closing_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
)`, args: [] });

await db.execute({ sql: "CREATE INDEX IF NOT EXISTS idx_fc_venture ON fundraising_campaigns(venture_id)", args: [] });
await db.execute({ sql: "CREATE INDEX IF NOT EXISTS idx_fc_status ON fundraising_campaigns(status)", args: [] });

const check = await db.execute({ sql: "SELECT table_name FROM information_schema.tables WHERE table_name = 'fundraising_campaigns'", args: [] });
console.log(check.rows.length > 0 ? "✅ fundraising_campaigns table created" : "❌ Failed");
process.exit(0);
