import db, { initDb } from "../src/lib/db.js";
import fs from 'fs';
import path from 'path';

// Manual env load for scratch script
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envConfig = fs.readFileSync(envPath, 'utf-8');
  envConfig.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) process.env[key.trim()] = value.trim().replace(/^["']|["']$/g, '');
  });
}

async function runMigrations() {
  try {
    console.log("🚀 Starting V2 Reports Migration...");
    await initDb();

    // 1. Create reports_v2 table
    console.log("📝 Creating reports_v2 table...");
    await db.execute(`
      CREATE TABLE IF NOT EXISTS reports_v2 (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id TEXT NOT NULL,
        week_start DATE NOT NULL,
        week_end DATE NOT NULL,
        type TEXT CHECK (type IN ('standup', 'retro')),
        status TEXT CHECK (status IN ('draft', 'submitted')) DEFAULT 'draft',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // 2. Create report_blocks_v2 table
    console.log("📝 Creating report_blocks_v2 table...");
    await db.execute(`
      CREATE TABLE IF NOT EXISTS report_blocks_v2 (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        report_id UUID REFERENCES reports_v2(id) ON DELETE CASCADE,
        context_type TEXT CHECK (context_type IN ('personal', 'program')),
        program_id TEXT,
        current_state TEXT,
        challenge TEXT,
        todo JSONB DEFAULT '[]',
        retro_status JSONB DEFAULT '[]',
        what_worked TEXT,
        what_failed TEXT,
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // 3. Add Indexes
    console.log("⚡ Adding indexes for performance...");
    await db.execute("CREATE INDEX IF NOT EXISTS idx_reports_v2_user_week ON reports_v2(user_id, week_start)");
    await db.execute("CREATE INDEX IF NOT EXISTS idx_report_blocks_v2_report_id ON report_blocks_v2(report_id)");

    console.log("✅ Migration Successful: Enhanced Reporting Schema V2 is active.");
    process.exit(0);
  } catch (error) {
    console.error("❌ Migration Failed:", error.message);
    process.exit(1);
  }
}

runMigrations();
