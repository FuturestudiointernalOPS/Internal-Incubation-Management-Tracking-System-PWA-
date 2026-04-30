import { createClient } from "@libsql/client";

const db = createClient({
  url: process.env.TURSO_DATABASE_URL || "file:local.db",
  authToken: process.env.TURSO_AUTH_TOKEN,
});

// PERFORMANCE TUNING: Ensure db only initializes once
// PERFORMANCE TUNING: Ensure db only initializes once per execution context
let isInitialized = false;

export async function initDb() {
  if (isInitialized) return db;
  
  try {
    console.log("[DB] Synchronizing Mission Architecture...");
    
    // Core Contacts & Personnel
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
        role TEXT DEFAULT 'unassigned',
        password TEXT,
        program_id TEXT,
        program_name TEXT,
        image TEXT,
        status TEXT DEFAULT 'approved',
        deleted BOOLEAN DEFAULT 0,
        gender TEXT,
        mother_name TEXT,
        team_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS families (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        registration_id TEXT UNIQUE,
        email TEXT,
        password TEXT,
        program_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Version 2 — Incubation Platform
    await db.execute(`
      CREATE TABLE IF NOT EXISTS v2_programs (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        duration_weeks INTEGER DEFAULT 4,
        duration_days INTEGER DEFAULT 0,
        topics TEXT, outcomes TEXT, deliverables TEXT, resources TEXT,
        assigned_pm_id TEXT,
        assigned_assistant_id TEXT,
        note_id TEXT,
        materials TEXT,
        feedback_enabled BOOLEAN DEFAULT 1,
        status TEXT DEFAULT 'Active',
        is_archived BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        manager_name TEXT,
        document_title TEXT,
        document_id TEXT
      )
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS v2_knowledge_bank (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        is_archived BOOLEAN DEFAULT 0,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS v2_knowledge_attachments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        note_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        url TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (note_id) REFERENCES v2_knowledge_bank(id) ON DELETE CASCADE
      )
    `);

    await db.execute(`CREATE TABLE IF NOT EXISTS v2_projects (id INTEGER PRIMARY KEY AUTOINCREMENT, program_id TEXT NOT NULL, name TEXT NOT NULL, status TEXT DEFAULT 'Active', meta TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
    await db.execute(`CREATE TABLE IF NOT EXISTS v2_participants (id INTEGER PRIMARY KEY AUTOINCREMENT, program_id TEXT NOT NULL, name TEXT NOT NULL, email TEXT NOT NULL, phone TEXT, team_id INTEGER, screening_status TEXT DEFAULT 'applied', status TEXT DEFAULT 'Active', created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
    await db.execute(`CREATE TABLE IF NOT EXISTS activity_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, user TEXT, action TEXT, module TEXT, status TEXT, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP)`);

    // 1. Teams & Handlers
    await db.execute(`
      CREATE TABLE IF NOT EXISTS v2_teams (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        program_id TEXT NOT NULL,
        name TEXT NOT NULL,
        handler_id TEXT,
        handler_name TEXT,
        password TEXT,
        group_name TEXT,
        team_username TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 5. Sessions & Topics
    await db.execute(`
      CREATE TABLE IF NOT EXISTS v2_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        program_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        week_number INTEGER NOT NULL,
        status TEXT DEFAULT 'pending',
        resource_links TEXT,
        weight INTEGER DEFAULT 5,
        team_id INTEGER,
        assignment_type TEXT DEFAULT 'Workshop',
        material_url TEXT,
        scheduled_date TEXT,
        end_date TEXT,
        start_time TEXT,
        end_time TEXT,
        task_type TEXT,
        handler_id TEXT,
        handler_name TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 15. Participant Invites & Onboarding
    await db.execute(`
      CREATE TABLE IF NOT EXISTS v2_invitations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        token TEXT UNIQUE NOT NULL,
        program_id TEXT NOT NULL,
        group_name TEXT, 
        role TEXT DEFAULT 'participant',
        team_id INTEGER,
        expires_at DATETIME,
        created_by TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 14. Weekly Operational Reports
    await db.execute(`
      CREATE TABLE IF NOT EXISTS v2_weekly_reports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        program_id TEXT NOT NULL,
        week_number INTEGER NOT NULL,
        teacher_id TEXT NOT NULL,
        teacher_name TEXT,
        reception_score INTEGER DEFAULT 5,
        progress_notes TEXT,
        student_reception TEXT,
        action_taken TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Run migrations silently only if needed (safety net)
    const migrations = [
      "ALTER TABLE v2_programs ADD COLUMN assigned_assistant_id TEXT",
      "ALTER TABLE v2_programs ADD COLUMN note_id TEXT",
      "ALTER TABLE v2_programs ADD COLUMN materials TEXT",
      "ALTER TABLE v2_programs ADD COLUMN is_archived BOOLEAN DEFAULT 0",
      "ALTER TABLE contacts ADD COLUMN team_id INTEGER",
      "ALTER TABLE v2_participants ADD COLUMN team_id INTEGER",
      "ALTER TABLE v2_sessions ADD COLUMN scheduled_date TEXT",
      "ALTER TABLE v2_sessions ADD COLUMN team_id INTEGER",
      "ALTER TABLE v2_teams ADD COLUMN team_username TEXT"
    ];

    for (const m of migrations) {
      await db.execute(m).catch(() => {}); // Ignore if column already exists
    }

    isInitialized = true;
    return db;
  } catch (error) {
    console.error("[DB] Optimization Failure:", error);
    isInitialized = true; // Still mark as initialized to prevent loop on failure
    return db;
  }
}

export default db;
