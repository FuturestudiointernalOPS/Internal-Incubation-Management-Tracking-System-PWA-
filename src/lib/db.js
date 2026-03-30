import { createClient } from "@libsql/client";

const db = createClient({
  url: process.env.TURSO_DATABASE_URL || "file:local.db",
  authToken: process.env.TURSO_AUTH_TOKEN,
});

export async function initDb() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cid TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      phone TEXT,
      address TEXT,
      dob TEXT,
      group_name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS families (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS campaigns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      form_id TEXT,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS campaign_contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER,
      cid TEXT,
      status TEXT DEFAULT 'pending',
      sequence_step INTEGER DEFAULT 0,
      next_send_at DATETIME,
      unsubscribed BOOLEAN DEFAULT 0
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS forms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      form_id TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      schema TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS campaign_steps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER,
      step_order INTEGER NOT NULL,
      subject TEXT NOT NULL,
      body TEXT NOT NULL,
      delay_days INTEGER DEFAULT 3,
      delay_minutes INTEGER DEFAULT 0,
      delay_hours INTEGER DEFAULT 0,
      wait_type TEXT DEFAULT 'days',
      scheduled_date TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS form_responses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      form_id TEXT NOT NULL,
      cid TEXT,
      answers TEXT NOT NULL,
      confidence_score INTEGER DEFAULT 100,
      match_status TEXT DEFAULT 'auto',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS segments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      filters TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  try {
    await db.execute("ALTER TABLE form_responses ADD COLUMN confidence_score INTEGER DEFAULT 100");
    await db.execute("ALTER TABLE form_responses ADD COLUMN match_status TEXT DEFAULT 'auto'");
  } catch(e) {}

  try {
    await db.execute("ALTER TABLE campaigns ADD COLUMN segment_id INTEGER");
  } catch(e) {}

  try {
    await db.execute("ALTER TABLE contacts ADD COLUMN group_name TEXT");
  } catch(e) {}

  try {
    await db.execute("ALTER TABLE contacts ADD COLUMN address TEXT");
  } catch(e) {}

  try {
    await db.execute("ALTER TABLE contacts ADD COLUMN dob TEXT");
  } catch(e) {}

  try {
    await db.execute("ALTER TABLE campaign_steps ADD COLUMN delay_minutes INTEGER DEFAULT 0");
  } catch(e) {}

  try {
    await db.execute("ALTER TABLE campaign_steps ADD COLUMN delay_hours INTEGER DEFAULT 0");
  } catch(e) {}

  try {
    await db.execute("ALTER TABLE campaign_steps ADD COLUMN specific_time TEXT");
  } catch(e) {}

  try {
    await db.execute("ALTER TABLE campaign_steps ADD COLUMN wait_type TEXT DEFAULT 'days'");
  } catch(e) {}

  // SPEED OPTIMIZATION
  await db.execute("CREATE INDEX IF NOT EXISTS idx_campaign_contacts_id ON campaign_contacts(campaign_id)");
  await db.execute("CREATE INDEX IF NOT EXISTS idx_campaign_contacts_cid ON campaign_contacts(cid)");
  await db.execute("CREATE INDEX IF NOT EXISTS idx_campaign_steps_id ON campaign_steps(campaign_id)");
  await db.execute("CREATE INDEX IF NOT EXISTS idx_form_responses_fid ON form_responses(form_id)");

  // VERSION 2 — INCUBATION INFRASTRUCTURE
  await db.execute(`
    CREATE TABLE IF NOT EXISTS v2_programs (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      duration_weeks INTEGER DEFAULT 13,
      duration_days INTEGER DEFAULT 0,
      topics TEXT, -- JSON
      outcomes TEXT, -- JSON
      deliverables TEXT, -- JSON schemas
      resources TEXT, -- JSON
      assigned_pm_id TEXT,
      feedback_enabled BOOLEAN DEFAULT 1,
      status TEXT DEFAULT 'Active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS v2_projects (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       program_id TEXT NOT NULL,
       name TEXT NOT NULL,
       status TEXT DEFAULT 'Active',
       meta TEXT, -- JSON
       created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS v2_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      program_id TEXT NOT NULL,
      title TEXT NOT NULL,
      week_number INTEGER NOT NULL,
      type TEXT NOT NULL,
      start_at DATETIME,
      teacher_id TEXT,
      meta TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS v2_participants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      program_id TEXT NOT NULL,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT,
      screening_status TEXT DEFAULT 'applied',
      status TEXT DEFAULT 'Active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS v2_groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      program_id TEXT NOT NULL,
      name TEXT NOT NULL,
      project_description TEXT,
      submission_stats TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS v2_deliverables (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      program_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      week_number INTEGER NOT NULL,
      type TEXT NOT NULL, -- Group/Individual
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS v2_submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      program_id TEXT NOT NULL,
      deliverable_id INTEGER NOT NULL,
      group_id INTEGER,
      participant_id INTEGER,
      submission_link TEXT,
      file_path TEXT,
      status TEXT DEFAULT 'pending', -- pending/approved/rejected
      feedback TEXT,
      reviewed_at DATETIME,
      reviewed_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS v2_feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      program_id TEXT NOT NULL,
      group_id INTEGER,
      participant_id INTEGER,
      learnings TEXT,
      challenges TEXT,
      suggestions TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

export default db;
