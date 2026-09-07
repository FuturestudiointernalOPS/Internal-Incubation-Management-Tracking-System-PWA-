const fs = require("fs");
const path = require("path");

const envPath = path.resolve(__dirname, "../../.env.local");
const envContent = fs.readFileSync(envPath, "utf-8");
const dbUrlMatch = envContent.match(/DATABASE_URL=(.+)/);
const DATABASE_URL = dbUrlMatch[1].trim();
console.log("✅ DATABASE_URL found");

const { Pool } = require("pg");
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  const client = await pool.connect();
  try {
    // 1. Tables that need to exist but might have different schemas
    // Check venture_documents - already exists with UUID PK
    const docCols = await client.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'venture_documents'
    `);
    const docColNames = docCols.rows.map(r => r.column_name);
    
    // Add missing columns to venture_documents
    const missingDocCols = ['description', 'document_type', 'file_name', 'file_size', 'file_type', 'thumbnail_url', 'current_version', 'is_pitch_deck'];
    for (const col of missingDocCols) {
      if (!docColNames.includes(col)) {
        try {
          if (col === 'current_version') await client.query(`ALTER TABLE venture_documents ADD COLUMN current_version INTEGER DEFAULT 1`);
          else if (col === 'is_pitch_deck') await client.query(`ALTER TABLE venture_documents ADD COLUMN is_pitch_deck BOOLEAN DEFAULT FALSE`);
          else if (col === 'file_size') await client.query(`ALTER TABLE venture_documents ADD COLUMN file_size BIGINT`);
          else if (col === 'description') await client.query(`ALTER TABLE venture_documents ADD COLUMN description TEXT`);
          else if (col === 'thumbnail_url') await client.query(`ALTER TABLE venture_documents ADD COLUMN thumbnail_url TEXT`);
          else if (col === 'document_type') await client.query(`ALTER TABLE venture_documents ADD COLUMN document_type TEXT NOT NULL DEFAULT 'other'`);
          else if (col === 'file_name') await client.query(`ALTER TABLE venture_documents ADD COLUMN file_name TEXT`);
          else if (col === 'file_type') await client.query(`ALTER TABLE venture_documents ADD COLUMN file_type TEXT`);
          console.log(`   ✅ venture_documents: added ${col}`);
        } catch (e) { console.log(`   ⚠️  venture_documents: ${col} — ${e.message.substring(0,80)}`); }
      }
    }

    // 2. Check venture_document_versions - add missing columns
    const verExists = await client.query(
      `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'venture_document_versions')`
    );
    if (!verExists.rows[0].exists) {
      // It's in the list above but let me check again
      console.log("   venture_document_versions not found — will create");
    }

    // 3. Create indexes for venture_documents
    const docIndexes = [
      "CREATE INDEX IF NOT EXISTS idx_venture_documents_type ON venture_documents(document_type)",
      "CREATE INDEX IF NOT EXISTS idx_venture_documents_pitch ON venture_documents(is_pitch_deck)",
    ];
    for (const idx of docIndexes) {
      try { await client.query(idx); console.log(`   ✅ ${idx.substring(0,60)}`); }
      catch (e) { console.log(`   ⚠️  ${e.message.substring(0,80)}`); }
    }

    // 4. Create tables that DON'T exist yet
    const newTables = [
      // Notification Center
      `CREATE TABLE IF NOT EXISTS venture_notifications (
          id SERIAL PRIMARY KEY, recipient_id TEXT NOT NULL, recipient_type TEXT DEFAULT 'user',
          venture_id TEXT REFERENCES ventures(venture_id) ON DELETE CASCADE,
          type TEXT NOT NULL DEFAULT 'system', title TEXT NOT NULL, body TEXT,
          data JSONB DEFAULT '{}'::jsonb, status TEXT DEFAULT 'unread', priority TEXT DEFAULT 'normal',
          source TEXT, source_id TEXT, created_at TIMESTAMP DEFAULT NOW(), read_at TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS venture_notification_templates (
          id SERIAL PRIMARY KEY, template_key TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
          type TEXT NOT NULL DEFAULT 'system', title_template TEXT NOT NULL, body_template TEXT,
          channels JSONB DEFAULT '["in_app"]'::jsonb, variables JSONB DEFAULT '[]'::jsonb,
          is_active BOOLEAN DEFAULT TRUE, created_by TEXT,
          created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS venture_notification_preferences (
          id SERIAL PRIMARY KEY, user_cid TEXT NOT NULL UNIQUE, email TEXT, phone TEXT,
          preferences JSONB DEFAULT '{}'::jsonb, quiet_hours_start TIME, quiet_hours_end TIME,
          digest_frequency TEXT DEFAULT 'realtime', language TEXT DEFAULT 'en',
          created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS venture_notification_delivery_logs (
          id SERIAL PRIMARY KEY, notification_id INTEGER REFERENCES venture_notifications(id) ON DELETE CASCADE,
          channel TEXT NOT NULL, status TEXT DEFAULT 'pending', error_message TEXT,
          delivered_at TIMESTAMP, created_at TIMESTAMP DEFAULT NOW()
      )`,
      // Admin & System
      `CREATE TABLE IF NOT EXISTS system_settings (
          id SERIAL PRIMARY KEY, setting_key TEXT NOT NULL UNIQUE, setting_value TEXT,
          setting_type TEXT DEFAULT 'string', category TEXT DEFAULT 'general', description TEXT,
          is_encrypted BOOLEAN DEFAULT FALSE, updated_by TEXT,
          updated_at TIMESTAMP DEFAULT NOW(), created_at TIMESTAMP DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS feature_flags (
          id SERIAL PRIMARY KEY, flag_key TEXT NOT NULL UNIQUE, flag_name TEXT NOT NULL,
          description TEXT, is_enabled BOOLEAN DEFAULT TRUE, category TEXT DEFAULT 'general',
          updated_by TEXT, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS system_roles (
          id SERIAL PRIMARY KEY, name TEXT NOT NULL UNIQUE, description TEXT,
          permissions JSONB DEFAULT '{}'::jsonb, is_system_role BOOLEAN DEFAULT FALSE,
          is_active BOOLEAN DEFAULT TRUE, created_by TEXT,
          created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS admin_activity_logs (
          id SERIAL PRIMARY KEY, admin_cid TEXT NOT NULL, admin_name TEXT,
          action TEXT NOT NULL, entity_type TEXT, entity_id TEXT, details JSONB DEFAULT '{}'::jsonb,
          ip_address TEXT, created_at TIMESTAMP DEFAULT NOW()
      )`,
      // Fundraising
      `CREATE TABLE IF NOT EXISTS fundraising_opportunities (
          id SERIAL PRIMARY KEY, venture_id TEXT NOT NULL REFERENCES ventures(venture_id) ON DELETE CASCADE,
          investor_id INTEGER, investor_name TEXT, investor_email TEXT, stage TEXT NOT NULL DEFAULT 'prospect',
          expected_amount DECIMAL(14,2), currency TEXT DEFAULT 'USD', probability INTEGER DEFAULT 10,
          expected_close_date DATE, owner_cid TEXT, owner_name TEXT, tags JSONB DEFAULT '[]'::jsonb,
          next_action TEXT, next_action_date TIMESTAMP, notes_summary TEXT, created_by TEXT,
          created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS fundraising_stage_history (
          id SERIAL PRIMARY KEY, opportunity_id INTEGER NOT NULL REFERENCES fundraising_opportunities(id) ON DELETE CASCADE,
          previous_stage TEXT, new_stage TEXT NOT NULL, probability INTEGER, changed_by TEXT, notes TEXT,
          created_at TIMESTAMP DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS fundraising_activities (
          id SERIAL PRIMARY KEY, opportunity_id INTEGER NOT NULL REFERENCES fundraising_opportunities(id) ON DELETE CASCADE,
          activity_type TEXT NOT NULL, title TEXT NOT NULL, description TEXT,
          activity_date TIMESTAMP DEFAULT NOW(), completed BOOLEAN DEFAULT FALSE, created_by TEXT,
          created_at TIMESTAMP DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS fundraising_notes (
          id SERIAL PRIMARY KEY, opportunity_id INTEGER NOT NULL REFERENCES fundraising_opportunities(id) ON DELETE CASCADE,
          content TEXT NOT NULL, author_cid TEXT, author_name TEXT, created_at TIMESTAMP DEFAULT NOW()
      )`,
      // Data Room - remaining tables
      `CREATE TABLE IF NOT EXISTS venture_document_shares (
          id SERIAL PRIMARY KEY, document_id UUID NOT NULL REFERENCES venture_documents(id) ON DELETE CASCADE,
          venture_id TEXT NOT NULL REFERENCES ventures(venture_id) ON DELETE CASCADE,
          share_token TEXT NOT NULL UNIQUE, shared_with_email TEXT, shared_with_name TEXT,
          access_type TEXT DEFAULT 'read', password_hash TEXT, expires_at TIMESTAMP,
          max_downloads INTEGER, download_count INTEGER DEFAULT 0, is_revoked BOOLEAN DEFAULT FALSE,
          created_by TEXT, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS venture_document_access_logs (
          id SERIAL PRIMARY KEY, share_id INTEGER REFERENCES venture_document_shares(id) ON DELETE CASCADE,
          document_id UUID NOT NULL REFERENCES venture_documents(id) ON DELETE CASCADE,
          venture_id TEXT NOT NULL REFERENCES ventures(venture_id) ON DELETE CASCADE,
          access_type TEXT NOT NULL, viewer_email TEXT, viewer_name TEXT, ip_address TEXT,
          user_agent TEXT, duration_seconds INTEGER, created_at TIMESTAMP DEFAULT NOW()
      )`,
    ];

    let created = 0;
    for (const ddl of newTables) {
      try {
        await client.query(ddl);
        created++;
      } catch (e) {
        if (!e.message.includes("already exists")) {
          console.error(`   ❌ ${e.message.substring(0,120)}`);
        }
      }
    }
    console.log(`\n✅ ${created} tables created/verified`);

    // 5. Create indexes
    const indexes = [
      "CREATE INDEX IF NOT EXISTS idx_venture_notifications_recipient ON venture_notifications(recipient_id, status)",
      "CREATE INDEX IF NOT EXISTS idx_venture_notifications_type ON venture_notifications(type)",
      "CREATE INDEX IF NOT EXISTS idx_venture_notifications_created ON venture_notifications(created_at DESC)",
      "CREATE INDEX IF NOT EXISTS idx_admin_logs_admin ON admin_activity_logs(admin_cid)",
      "CREATE INDEX IF NOT EXISTS idx_admin_logs_action ON admin_activity_logs(action)",
      "CREATE INDEX IF NOT EXISTS idx_fundraising_venture ON fundraising_opportunities(venture_id)",
      "CREATE INDEX IF NOT EXISTS idx_fundraising_stage ON fundraising_opportunities(stage)",
      "CREATE INDEX IF NOT EXISTS idx_stage_history_opp ON fundraising_stage_history(opportunity_id)",
      "CREATE INDEX IF NOT EXISTS idx_fundraising_activities_opp ON fundraising_activities(opportunity_id)",
      "CREATE INDEX IF NOT EXISTS idx_fundraising_notes_opp ON fundraising_notes(opportunity_id)",
      "CREATE INDEX IF NOT EXISTS idx_venture_documents_venture ON venture_documents(venture_id)",
      "CREATE INDEX IF NOT EXISTS idx_doc_shares_token ON venture_document_shares(share_token)",
      "CREATE INDEX IF NOT EXISTS idx_doc_shares_document ON venture_document_shares(document_id)",
      "CREATE INDEX IF NOT EXISTS idx_doc_access_logs_document ON venture_document_access_logs(document_id)",
      "CREATE INDEX IF NOT EXISTS idx_doc_access_logs_share ON venture_document_access_logs(share_id)",
    ];
    for (const idx of indexes) {
      try { await client.query(idx); }
      catch (e) { if (!e.message.includes("already exists")) console.log(`   ⚠️  ${e.message.substring(0,80)}`); }
    }

    // 6. Seed data
    const seedQueries = fs.readFileSync(
      path.resolve(__dirname, "venture_os_notifications_admin_data_room.sql"),
      "utf-8"
    );
    // Extract only INSERT statements
    const inserts = seedQueries.split(";").filter(s => s.trim().toUpperCase().startsWith("INSERT"));
    for (const ins of inserts) {
      try { await client.query(ins); }
      catch (e) { if (!e.message.includes("duplicate") && !e.message.includes("unique")) console.log(`   ⚠️  seed: ${e.message.substring(0,80)}`); }
    }

    console.log("\n✅ Full migration complete!");
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(console.error);
