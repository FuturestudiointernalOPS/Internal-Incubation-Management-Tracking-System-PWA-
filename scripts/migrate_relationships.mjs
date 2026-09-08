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

const queries = [
  `CREATE TABLE IF NOT EXISTS relationship_workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pipeline_id UUID NOT NULL REFERENCES investment_pipeline(id) ON DELETE CASCADE,
    investor_id UUID NOT NULL REFERENCES investor_profiles(id) ON DELETE CASCADE,
    venture_id UUID NOT NULL,
    relationship_manager_id TEXT,
    investment_manager_id TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed')),
    current_stage TEXT,
    next_action TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(pipeline_id)
  )`,
  'CREATE INDEX IF NOT EXISTS idx_rw_pipeline ON relationship_workspaces(pipeline_id)',
  'CREATE INDEX IF NOT EXISTS idx_rw_investor ON relationship_workspaces(investor_id)',
  'CREATE INDEX IF NOT EXISTS idx_rw_venture ON relationship_workspaces(venture_id)',
  `CREATE TABLE IF NOT EXISTS relationship_meetings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES relationship_workspaces(id) ON DELETE CASCADE,
    meeting_type TEXT NOT NULL DEFAULT 'introductory' CHECK (meeting_type IN ('introductory', 'follow_up', 'product_demo', 'financial_review', 'dd_session', 'committee', 'closing')),
    scheduled_date DATE,
    scheduled_time TEXT,
    duration_minutes INTEGER DEFAULT 60,
    status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled')),
    location TEXT,
    notes TEXT,
    outcome TEXT,
    action_items TEXT,
    documents_shared TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`,
  'CREATE INDEX IF NOT EXISTS idx_rm_workspace ON relationship_meetings(workspace_id)',
  'CREATE INDEX IF NOT EXISTS idx_rm_status ON relationship_meetings(status)',
  `CREATE TABLE IF NOT EXISTS relationship_timeline (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES relationship_workspaces(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    description TEXT NOT NULL,
    actor_id TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`,
  'CREATE INDEX IF NOT EXISTS idx_rt_workspace ON relationship_timeline(workspace_id)',
  'CREATE INDEX IF NOT EXISTS idx_rt_created ON relationship_timeline(created_at)',
];

for (const sql of queries) {
  await db.execute({ sql, args: [] });
}

console.log("✅ Relationship tables created");
process.exit(0);
