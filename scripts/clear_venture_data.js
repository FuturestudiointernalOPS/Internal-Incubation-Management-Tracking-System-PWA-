/**
 * Script to delete all venture-related data from the database.
 * Run: node scripts/clear_venture_data.js
 */
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// Manually load .env.local
const envPath = path.resolve(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#')) {
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx > -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      process.env[key] = val;
    }
  }
}

const VENTURE_TABLES = [
  'session_action_items',
  'session_attendance',
  'session_notes',
  'session_activity_logs',
  'mentoring_sessions',
  'coach_availability',
  'coach_activity_logs',
  'venture_assignments',
  'advisors',
  'coaches',
  'feedback_activity_logs',
  'mentor_statistics',
  'mentor_analytics',
  'mentor_ratings',
  'mentor_feedback',
  'knowledge_activity_logs',
  'knowledge_progress',
  'knowledge_bookmarks',
  'knowledge_categories',
  'knowledge_resources',
  'learning_history',
  'learning_progress',
  'learning_paths',
  'recommendation_logs',
  'task_activity_logs',
  'task_attachments',
  'task_comments',
  'task_checklists',
  'tasks',
  'deliverable_reviews',
  'deliverables',
  'milestone_activity_logs',
  'milestones',
  'project_dependencies',
  'project_progress',
  'timeline_events',
  'gantt_cache',
  'projects',
  'report_cache',
  'analytics_snapshots',
  'export_history',
  'scheduled_reports',
  'verification_comments',
  'verification_reviews',
  'verification_history',
  'verification_documents',
  'venture_verifications',
  'document_access_logs',
  'document_shares',
  'document_versions',
  'data_room_documents',
  'pitch_decks',
  'fundraising_stage_history',
  'fundraising_notes',
  'fundraising_activities',
  'fundraising_opportunities',
  'investor_matches',
  'match_history',
  'investor_preferences',
  'investors',
  'investment_history',
  'investment_recommendations',
  'investment_scores',
  'investment_assessments',
  'investment_report_cache',
  'investment_snapshots',
  'investment_exports',
  'analytics_history',
  'startup_profile_documents',
  'startup_profile_progress',
  'startup_profile',
  'notification_delivery_logs',
  'notification_preferences',
  'notification_templates',
  'notifications',
  'admin_activity_logs',
  'role_permissions',
  'feature_flags',
  'system_settings',
  'ownership_history',
  'invitation_tokens',
  'venture_activity_log',
  'venture_history',
  'venture_members',
  'venture_founders',
  'program_participants',
];

async function clearVentureData() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('DATABASE_URL not found in .env.local');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false },
  });

  const client = await pool.connect();

  try {
    // First, get existing tables
    const tablesResult = await client.query(
      "SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public'"
    );
    const existingTables = new Set(tablesResult.rows.map(r => r.tablename));

    let totalDeleted = 0;

    // Delete from child tables first, then parent tables
    for (const table of VENTURE_TABLES) {
      if (!existingTables.has(table)) {
        console.log(`  - ${table}: TABLE DOES NOT EXIST`);
        continue;
      }
      try {
        const result = await client.query(`DELETE FROM "${table}"`);
        console.log(`  ✓ ${table}: ${result.rowCount} rows deleted`);
        totalDeleted += result.rowCount;
      } catch (err) {
        console.log(`  ✗ ${table}: ERROR - ${err.message.slice(0, 120)}`);
      }
    }

    // Finally delete from ventures
    if (existingTables.has('ventures')) {
      try {
        const result = await client.query('DELETE FROM ventures');
        console.log(`  ✓ ventures: ${result.rowCount} rows deleted`);
        totalDeleted += result.rowCount;
      } catch (err) {
        console.log(`  ✗ ventures: ERROR - ${err.message.slice(0, 120)}`);
      }
    } else {
      console.log('  - ventures: TABLE DOES NOT EXIST');
    }

    console.log(`\n✅ Done! Total rows deleted: ${totalDeleted}`);
  } catch (err) {
    console.error('\n❌ Error:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

clearVentureData();
