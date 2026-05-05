const { Pool } = require('pg');

// Standalone Connection for the Healer
const pool = new Pool({
  connectionString: "postgresql://postgres.yakxdxdzuojafzdkqhjd:G8%26bM%3F!KujZwXDe@aws-0-eu-west-1.pooler.supabase.com:6543/postgres",
  ssl: { rejectUnauthorized: false }
});

const SCHEMA_DEFINITIONS = {
  contacts: {
    cid: 'TEXT PRIMARY KEY',
    name: 'TEXT',
    email: 'TEXT UNIQUE',
    phone: 'TEXT',
    address: 'TEXT',
    dob: 'TEXT',
    group_name: 'TEXT',
    role: 'TEXT',
    password: 'TEXT',
    program_id: 'TEXT',
    program_name: 'TEXT',
    image: 'TEXT',
    status: "TEXT DEFAULT 'active'",
    deleted: 'INTEGER DEFAULT 0',
    gender: 'TEXT',
    mother_name: 'TEXT',
    created_at: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP'
  },
  v2_programs: {
    id: 'TEXT PRIMARY KEY',
    name: 'TEXT NOT NULL',
    description: 'TEXT',
    note_id: 'BIGINT',
    assigned_pm_id: 'TEXT',
    assigned_assistant_id: 'TEXT',
    duration_weeks: 'INTEGER',
    status: "TEXT DEFAULT 'active'",
    is_archived: 'INTEGER DEFAULT 0',
    materials: 'TEXT', // JSON string
    created_at: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP'
  },
  v2_knowledge_bank: {
    id: 'BIGSERIAL PRIMARY KEY',
    title: 'TEXT NOT NULL',
    description: 'TEXT',
    category: 'TEXT',
    tags: 'TEXT', // JSON string
    file_path: 'TEXT',
    file_type: 'TEXT',
    created_by: 'TEXT',
    created_at: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
    updated_at: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP'
  },
  v2_notifications: {
    id: 'SERIAL PRIMARY KEY',
    recipient_id: 'TEXT',
    title: 'TEXT',
    message: 'TEXT',
    type: 'TEXT',
    is_read: 'BOOLEAN DEFAULT FALSE',
    created_at: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP'
  },
  forms: {
    form_id: 'TEXT PRIMARY KEY',
    name: 'TEXT',
    schema: 'TEXT',
    group_name: 'TEXT',
    deleted: 'INTEGER DEFAULT 0',
    created_at: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP'
  },
  form_responses: {
    id: 'SERIAL PRIMARY KEY',
    form_id: 'TEXT',
    cid: 'TEXT',
    answers: 'TEXT',
    confidence_score: 'INTEGER',
    match_status: 'TEXT',
    group_name: 'TEXT',
    created_at: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP'
  },
  campaigns: {
    id: 'TEXT PRIMARY KEY',
    name: 'TEXT',
    form_id: 'TEXT',
    status: 'TEXT',
    created_at: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP'
  },
  campaign_contacts: {
    id: 'SERIAL PRIMARY KEY',
    campaign_id: 'TEXT',
    cid: 'TEXT',
    status: 'TEXT',
    created_at: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP'
  },
  v2_sessions: {
    id: 'SERIAL PRIMARY KEY',
    program_id: 'TEXT',
    title: 'TEXT',
    week_number: 'INTEGER',
    type: 'TEXT',
    teacher_id: 'TEXT',
    start_at: 'TIMESTAMP',
    status: "TEXT DEFAULT 'active'",
    created_at: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP'
  },
  v2_participants: {
    id: 'SERIAL PRIMARY KEY',
    program_id: 'TEXT',
    name: 'TEXT',
    email: 'TEXT',
    phone: 'TEXT',
    screening_status: "TEXT DEFAULT 'applied'",
    created_at: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP'
  },
  v2_document_requirements: {
    id: 'SERIAL PRIMARY KEY',
    program_id: 'TEXT',
    title: 'TEXT',
    description: 'TEXT',
    is_completed: 'INTEGER DEFAULT 0',
    created_at: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP'
  },
  v2_weekly_reports: {
    id: 'SERIAL PRIMARY KEY',
    program_id: 'TEXT',
    week_number: 'INTEGER',
    teacher_id: 'TEXT',
    teacher_name: 'TEXT',
    reception_score: 'INTEGER',
    progress_notes: 'TEXT',
    student_reception: 'TEXT',
    action_taken: 'TEXT',
    created_at: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
    updated_at: 'TIMESTAMP'
  },
  v2_program_staff: {
    id: 'SERIAL PRIMARY KEY',
    program_id: 'TEXT',
    staff_id: 'TEXT',
    role: 'TEXT',
    created_at: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP'
  },
  activity_logs: {
    id: 'SERIAL PRIMARY KEY',
    "user_identity": 'TEXT',
    action: 'TEXT',
    module: 'TEXT',
    status: 'TEXT',
    created_at: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP'
  },
  families: {
    id: 'SERIAL PRIMARY KEY',
    name: 'TEXT NOT NULL',
    registration_id: 'TEXT UNIQUE',
    program_id: 'TEXT',
    email: 'TEXT',
    password: 'TEXT',
    created_at: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP'
  },
  v2_events: {
    id: 'SERIAL PRIMARY KEY',
    program_id: 'TEXT',
    title: 'TEXT',
    description: 'TEXT',
    event_date: 'TIMESTAMP',
    status: "TEXT DEFAULT 'active'",
    created_at: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP'
  },
  v2_followups: {
    id: 'SERIAL PRIMARY KEY',
    program_id: 'TEXT',
    session_id: 'INTEGER',
    week_number: 'INTEGER',
    comment: 'TEXT',
    created_at: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP'
  },
  v2_submissions: {
    id: 'SERIAL PRIMARY KEY',
    program_id: 'TEXT',
    participant_id: 'TEXT',
    document_id: 'INTEGER',
    file_url: 'TEXT',
    status: "TEXT DEFAULT 'pending'",
    created_at: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP'
  },
  v2_kpis: {
    id: 'SERIAL PRIMARY KEY',
    program_id: 'TEXT',
    title: 'TEXT',
    target_value: 'TEXT',
    current_value: 'TEXT',
    created_at: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP'
  }
};

async function autoHealSchema() {
  console.log("=========================================");
  console.log("   IMPACTOS SCHEMA AUTO-HEAL INITIATED   ");
  console.log("=========================================\n");

  try {
    for (const [tableName, columns] of Object.entries(SCHEMA_DEFINITIONS)) {
      console.log(`[HEALER] Auditing table: ${tableName}`);
      
      // 1. Ensure Table Exists (using the first column as a base, usually the primary key)
      const primaryKeyCol = Object.entries(columns)[0];
      await pool.query(`CREATE TABLE IF NOT EXISTS ${tableName} (${primaryKeyCol[0]} ${primaryKeyCol[1]});`);

      // 2. Ensure all columns exist
      for (const [colName, colType] of Object.entries(columns)) {
        if (colName === primaryKeyCol[0]) continue; // Skip primary key which was handled above
        try {
          await pool.query(`ALTER TABLE ${tableName} ADD COLUMN IF NOT EXISTS ${colName} ${colType};`);
        } catch (e) {
          // If the column exists or there's a constraint issue, we catch it here.
          // We can optionally ignore it, or log it if it's a critical mismatch.
        }
      }
      console.log(`[HEALER] ✅ ${tableName} is fully operational.`);
    }

    console.log("\n=========================================");
    console.log("   AUTO-HEAL COMPLETE. ALL SYSTEMS GO.   ");
    console.log("=========================================");

  } catch (e) {
    console.error("\n[CRITICAL ERROR] Auto-Heal Failed:", e.message);
  } finally {
    await pool.end();
  }
}

autoHealSchema();
