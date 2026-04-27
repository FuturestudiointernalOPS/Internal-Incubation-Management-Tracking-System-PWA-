import { createClient } from "@libsql/client";

const db = createClient({
  url: process.env.TURSO_DATABASE_URL || "file:local.db",
  authToken: process.env.TURSO_AUTH_TOKEN,
});

// PERFORMANCE TUNING: Ensure db only initializes once
let isInitialized = false;

export async function initDb() {
  if (isInitialized) return db;
  isInitialized = true;
  
  try {
    console.log("[DB] Synchronizing Mission Architecture...");
    
    // Core Contacts & Personnel
    await db.execute(`UPDATE contacts SET group_name = 'Future Studio' WHERE group_name = 'Staff'`);
    await db.execute(`DELETE FROM families WHERE name = 'Staff'`);
    
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
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS families (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        registration_id TEXT UNIQUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.execute("ALTER TABLE families ADD COLUMN registration_id TEXT UNIQUE").catch(() => {});
    await db.execute("ALTER TABLE families ADD COLUMN email TEXT UNIQUE").catch(() => {});
    await db.execute("ALTER TABLE families ADD COLUMN password TEXT").catch(() => {});

    // Campaign & Forms Infrastructure
    await db.execute(`CREATE TABLE IF NOT EXISTS campaigns (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, form_id TEXT, status TEXT DEFAULT 'pending', created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
    await db.execute(`CREATE TABLE IF NOT EXISTS campaign_contacts (id INTEGER PRIMARY KEY AUTOINCREMENT, campaign_id INTEGER, cid TEXT, status TEXT DEFAULT 'pending', sequence_step INTEGER DEFAULT 0, next_send_at DATETIME, unsubscribed BOOLEAN DEFAULT 0)`);
    await db.execute(`CREATE TABLE IF NOT EXISTS forms (id INTEGER PRIMARY KEY AUTOINCREMENT, form_id TEXT UNIQUE NOT NULL, name TEXT NOT NULL, schema TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
    await db.execute(`CREATE TABLE IF NOT EXISTS campaign_steps (id INTEGER PRIMARY KEY AUTOINCREMENT, campaign_id INTEGER, step_order INTEGER NOT NULL, subject TEXT NOT NULL, body TEXT NOT NULL, delay_days INTEGER DEFAULT 3, delay_minutes INTEGER DEFAULT 0, delay_hours INTEGER DEFAULT 0, wait_type TEXT DEFAULT 'days', scheduled_date TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
    await db.execute(`CREATE TABLE IF NOT EXISTS form_responses (id INTEGER PRIMARY KEY AUTOINCREMENT, form_id TEXT NOT NULL, cid TEXT, answers TEXT NOT NULL, confidence_score INTEGER DEFAULT 100, match_status TEXT DEFAULT 'auto', created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
    await db.execute(`CREATE TABLE IF NOT EXISTS segments (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, filters TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);

    // Version 2 — Incubation Platform
    await db.execute(`
      CREATE TABLE IF NOT EXISTS v2_programs (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        duration_weeks INTEGER DEFAULT 13,
        duration_days INTEGER DEFAULT 0,
        topics TEXT, outcomes TEXT, deliverables TEXT, resources TEXT,
        assigned_pm_id TEXT,
        feedback_enabled BOOLEAN DEFAULT 1,
        status TEXT DEFAULT 'Active',
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
        url TEXT NOT NULL,
        fileName TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.execute(`CREATE TABLE IF NOT EXISTS v2_projects (id INTEGER PRIMARY KEY AUTOINCREMENT, program_id TEXT NOT NULL, name TEXT NOT NULL, status TEXT DEFAULT 'Active', meta TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
    await db.execute(`CREATE TABLE IF NOT EXISTS v2_participants (id INTEGER PRIMARY KEY AUTOINCREMENT, program_id TEXT NOT NULL, name TEXT NOT NULL, email TEXT NOT NULL, phone TEXT, screening_status TEXT DEFAULT 'applied', status TEXT DEFAULT 'Active', created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
    await db.execute(`CREATE TABLE IF NOT EXISTS activity_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, user TEXT, action TEXT, module TEXT, status TEXT, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP)`);

    // --- EXTENDED V2 OPERATIONS ---
    
    // 1. Teams & Handlers (Sub-groups within Programs)
    await db.execute(`
      CREATE TABLE IF NOT EXISTS v2_teams (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        program_id TEXT NOT NULL,
        name TEXT NOT NULL,
        handler_id TEXT, -- Staff member assigned as Manager/Handler
        handler_name TEXT,
        password TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 2. Events & Calendar (Meetings, Classes)
    await db.execute(`
      CREATE TABLE IF NOT EXISTS v2_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        program_id TEXT NOT NULL,
        team_id INTEGER, -- Optional: specific to a team or global to program
        title TEXT NOT NULL,
        description TEXT,
        event_type TEXT DEFAULT 'meeting', -- meeting, masterclass, workshop
        start_time DATETIME NOT NULL,
        end_time DATETIME,
        location TEXT,
        created_by TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 3. Configuration: KPIs
    await db.execute(`
      CREATE TABLE IF NOT EXISTS v2_kpis (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        program_id TEXT NOT NULL,
        title TEXT NOT NULL,
        target_value TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 4. Configuration: Required Documents (Checklist)
    await db.execute(`
      CREATE TABLE IF NOT EXISTS v2_document_requirements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        program_id TEXT NOT NULL,
        title TEXT NOT NULL, -- e.g. Pitch Deck, BMC
        description TEXT,
        session_id INTEGER,
        allowed_format TEXT DEFAULT 'pdf',
        weight INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 5. Sessions & Topics (The Core of the Program)
    await db.execute(`
      CREATE TABLE IF NOT EXISTS v2_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        program_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        week_number INTEGER NOT NULL,
        status TEXT DEFAULT 'pending', -- pending, active, completed
        resource_links TEXT, -- JSON array
        weight INTEGER DEFAULT 5,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 6. Submissions (Participants uploading files or links)
    await db.execute(`
      CREATE TABLE IF NOT EXISTS v2_submissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        program_id TEXT NOT NULL,
        participant_id TEXT NOT NULL,
        requirement_id INTEGER NOT NULL,
        submission_type TEXT, -- 'file' or 'link'
        file_url TEXT,
        submission_link TEXT,
        status TEXT DEFAULT 'pending', -- pending, approved, rejected
        submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 6. Notifications Table
    await db.execute(`
      CREATE TABLE IF NOT EXISTS v2_notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        recipient_id TEXT NOT NULL, -- cid
        title TEXT NOT NULL,
        message TEXT,
        read BOOLEAN DEFAULT 0,
        type TEXT DEFAULT 'event',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 7. Weekly Follow-ups & Executive Commentary
    await db.execute(`
      CREATE TABLE IF NOT EXISTS v2_followups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        program_id TEXT NOT NULL,
        week_number INTEGER NOT NULL,
        session_id INTEGER,
        comment TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.execute("ALTER TABLE v2_followups ADD COLUMN session_id INTEGER").catch(() => {});

    // 8. Communication Log (Internal Messaging)
    await db.execute(`
      CREATE TABLE IF NOT EXISTS v2_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        program_id TEXT NOT NULL,
        sender_id TEXT NOT NULL,
        recipient_id TEXT NOT NULL, -- cid or "all"
        subject TEXT,
        body TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 9. Knowledge Bank (Concept Notes)
    await db.execute(`
      CREATE TABLE IF NOT EXISTS v2_knowledge_bank (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        url TEXT NOT NULL,
        fileName TEXT,
        is_archived BOOLEAN DEFAULT 0,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.execute("ALTER TABLE v2_knowledge_bank ADD COLUMN is_archived BOOLEAN DEFAULT 0").catch(() => {});
    
    // Enhance requirements to link to specific sessions/topics
    await db.execute("ALTER TABLE v2_document_requirements ADD COLUMN session_id INTEGER").catch(() => {});
    await db.execute("ALTER TABLE v2_document_requirements ADD COLUMN allowed_format TEXT DEFAULT 'pdf'").catch(() => {});
    await db.execute("ALTER TABLE v2_document_requirements ADD COLUMN weight INTEGER DEFAULT 1").catch(() => {});
    await db.execute("ALTER TABLE v2_document_requirements ADD COLUMN is_completed BOOLEAN DEFAULT 0").catch(() => {});
    await db.execute("ALTER TABLE v2_sessions ADD COLUMN weight INTEGER DEFAULT 5").catch(() => {});
    await db.execute("ALTER TABLE v2_sessions ADD COLUMN status TEXT DEFAULT 'not started'").catch(() => {});
    await db.execute("ALTER TABLE v2_sessions ADD COLUMN team_id INTEGER").catch(() => {});
    await db.execute("ALTER TABLE v2_sessions ADD COLUMN assignment_type TEXT DEFAULT 'Workshop'").catch(() => {});
    await db.execute("ALTER TABLE v2_sessions ADD COLUMN material_url TEXT").catch(() => {});
    await db.execute("ALTER TABLE v2_sessions ADD COLUMN scheduled_date TEXT").catch(() => {});
    await db.execute("ALTER TABLE v2_sessions ADD COLUMN end_date TEXT").catch(() => {});
    await db.execute("ALTER TABLE v2_sessions ADD COLUMN start_time TEXT").catch(() => {});
    await db.execute("ALTER TABLE v2_sessions ADD COLUMN end_time TEXT").catch(() => {});
    await db.execute("ALTER TABLE v2_sessions ADD COLUMN task_type TEXT").catch(() => {});
    await db.execute("ALTER TABLE v2_sessions ADD COLUMN handler_id TEXT").catch(() => {});
    await db.execute("ALTER TABLE v2_sessions ADD COLUMN handler_name TEXT").catch(() => {});

    await db.execute("ALTER TABLE v2_programs ADD COLUMN assigned_assistant_id TEXT").catch(() => {});
    await db.execute("ALTER TABLE v2_programs ADD COLUMN note_id TEXT").catch(() => {});
    await db.execute("ALTER TABLE v2_programs ADD COLUMN materials TEXT").catch(() => {});
    await db.execute("ALTER TABLE forms ADD COLUMN group_name TEXT").catch(() => {});
    await db.execute("ALTER TABLE v2_participants ADD COLUMN team_id INTEGER").catch(() => {});
    
    // Speed Optimization Indices
    await db.execute("CREATE INDEX IF NOT EXISTS idx_v2_projects_pid ON v2_projects(program_id)");
    await db.execute("CREATE INDEX IF NOT EXISTS idx_v2_participants_pid ON v2_participants(program_id)");
    await db.execute("CREATE INDEX IF NOT EXISTS idx_v2_followups_pid ON v2_followups(program_id)");
    await db.execute("CREATE INDEX IF NOT EXISTS idx_v2_submissions_pid ON v2_submissions(program_id)");
    await db.execute("CREATE INDEX IF NOT EXISTS idx_v2_teams_pid ON v2_teams(program_id)");
    await db.execute("CREATE INDEX IF NOT EXISTS idx_contacts_gid ON contacts(group_name)");
    await db.execute("CREATE INDEX IF NOT EXISTS idx_contacts_role ON contacts(role)");
    await db.execute("CREATE INDEX IF NOT EXISTS idx_pm_id ON v2_programs(assigned_pm_id)");

    // 10. Standard Operational Types (Super Admin Defined)
    await db.execute(`
      CREATE TABLE IF NOT EXISTS v2_standard_types (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category TEXT NOT NULL, -- 'assignment' or 'deliverable'
        label TEXT NOT NULL, -- 'Workshop', 'Master Class', 'PDF', etc.
        status TEXT DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 11. Program Staff Assignments (Teachers, Group Leaders)
    await db.execute(`
      CREATE TABLE IF NOT EXISTS v2_program_staff (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        program_id TEXT NOT NULL,
        staff_id TEXT NOT NULL, -- CID from contacts
        role TEXT DEFAULT 'teacher', -- 'teacher', 'group_leader', 'mentor'
        assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 12. Internal Communication Channel (Command Center)
    await db.execute(`
      CREATE TABLE IF NOT EXISTS v2_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sender_id TEXT NOT NULL, -- CID
        recipient_id TEXT, -- CID, or NULL for broadcast
        target_type TEXT DEFAULT 'individual', -- 'individual', 'program', 'role', 'all'
        target_id TEXT, -- CID, ProgramID, or Role name
        subject TEXT,
        body TEXT NOT NULL,
        priority TEXT DEFAULT 'normal', -- 'normal', 'high', 'critical'
        is_read BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 13. Participant Submissions & Reports
    await db.execute(`
      CREATE TABLE IF NOT EXISTS v2_submissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        participant_id TEXT NOT NULL,
        program_id TEXT NOT NULL,
        requirement_id TEXT NOT NULL,
        file_url TEXT,
        report_body TEXT,
        status TEXT DEFAULT 'pending', -- 'pending', 'reviewed', 'rejected'
        grade INTEGER,
        feedback TEXT,
        submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 14. Weekly Operational Reports (Teacher Insights)
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

    // 15. Participant Invites & Onboarding (Ticket 1)
    await db.execute(`
      CREATE TABLE IF NOT EXISTS v2_invitations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        token TEXT UNIQUE NOT NULL,
        program_id TEXT NOT NULL,
        group_name TEXT, 
        role TEXT DEFAULT 'participant',
        expires_at DATETIME,
        created_by TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 16. Task & Action Layer (Ticket 6)
    await db.execute(`
      CREATE TABLE IF NOT EXISTS v2_task_completions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        participant_id TEXT NOT NULL,
        team_id INTEGER,
        session_id INTEGER, -- Course/Module
        requirement_id INTEGER, -- Specific Task/Action
        status TEXT DEFAULT 'completed',
        completed_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 17. Feedback System (Ticket 7)
    await db.execute(`
      CREATE TABLE IF NOT EXISTS v2_participant_feedback (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        participant_id TEXT NOT NULL,
        team_id INTEGER,
        session_id INTEGER,
        requirement_id INTEGER,
        feedback_text TEXT NOT NULL,
        rating INTEGER,
        submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    return db;
  } catch (error) {
    console.error("[DB] Optimization Failure:", error);
    return db;
  }
}

export default db;
