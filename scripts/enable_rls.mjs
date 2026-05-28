/**
 * SECURITY MIGRATION: Enable Row-Level Security on all tables
 *
 * This migration:
 * 1. Enables RLS on every table in the database
 * 2. Creates a "deny all" default policy for the anon/public role
 * 3. Your Next.js backend connects via DATABASE_URL (superuser/owner),
 *    which BYPASSES RLS — so your app keeps working normally.
 *
 * Run: set -a && . .env.local && node scripts/enable_rls.mjs
 */

import db, { initDb } from "../src/lib/db.js";

async function migrate() {
  await initDb();

  const tables = [
    'contacts',
    'families',
    'v2_programs',
    'v2_projects',
    'v2_participants',
    'v2_sessions',
    'v2_deliverables',
    'v2_document_requirements',
    'v2_submissions',
    'v2_submissions_v2',
    'v2_groups',
    'v2_group_members',
    'v2_teams',
    'v2_knowledge_bank',
    'v2_knowledge_attachments',
    'v2_kpis',
    'v2_events',
    'v2_followups',
    'v2_notifications',
    'v2_weekly_reports',
    'v2_program_staff',
    'v2_attendance',
    'v2_progress',
    'v2_feedback',
  ];

  let success = 0;
  let errors = [];

  for (const table of tables) {
    try {
      // Enable RLS
      await db.execute({
        sql: `ALTER TABLE IF EXISTS ${table} ENABLE ROW LEVEL SECURITY`,
        args: [],
      });

      // Drop any existing policies (clean slate)
      await db.execute({
        sql: `DROP POLICY IF EXISTS "deny_all_${table}" ON ${table}`,
        args: [],
      });

      // Create a blanket deny-all policy
      // The anon/public role cannot read/write anything
      // Your backend connects as the table owner, bypassing RLS
      await db.execute({
        sql: `CREATE POLICY "deny_all_${table}" ON ${table}
              FOR ALL
              USING (false)
              WITH CHECK (false)`,
        args: [],
      });

      success++;
      console.log(`  ✅ ${table} — RLS enabled + deny policy`);
    } catch (e) {
      if (e.message.includes('does not exist')) {
        console.log(`  ⚠️  ${table} — table not found, skipping`);
      } else {
        errors.push(`${table}: ${e.message}`);
        console.log(`  ❌ ${table} — ${e.message}`);
      }
    }
  }

  // Revoke permissions from public/anonymized roles on the contacts table
  // (sensitive data — passwords, personal info)
  try {
    await db.execute({
      sql: `REVOKE ALL ON contacts FROM anon, authenticated, public`,
      args: [],
    });
    console.log(`  ✅ contacts — revoked public permissions`);
  } catch (e) {
    console.log(`  ⚠️  Could not revoke public permissions: ${e.message}`);
  }

  console.log(`\n═══════════════════════════════════════════════`);
  console.log(`  RLS MIGRATION COMPLETE`);
  console.log(`  ${success}/${tables.length} tables secured`);
  if (errors.length > 0) {
    console.log(`  ${errors.length} error(s):`);
    errors.forEach(e => console.log(`    ❌ ${e}`));
  }
  console.log(`═══════════════════════════════════════════════\n`);
}

migrate().catch(console.error);
