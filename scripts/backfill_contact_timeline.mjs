// Phase 1: Backfill contact_timeline from existing audit_log and participant_program_audit
// Run once after phase1_crm_foundation.sql migration
// Idempotent — safe to run multiple times (skips if event already exists)

import { initDb } from "../src/lib/db.js";

const db = await initDb();
console.log("Connected. Backfilling contact_timeline...\n");

let totalInserted = 0;

// ─── Source 1: audit_log ───
try {
  const auditRows = await db.execute({
    sql: `SELECT * FROM audit_log WHERE user_id IS NOT NULL AND user_id != ''
          ORDER BY created_at ASC`,
    args: [],
  });

  let count = 0;
  for (const row of auditRows.rows) {
    // Check if this audit event was already imported
    const exists = await db.execute({
      sql: `SELECT id FROM contact_timeline
            WHERE contact_cid = ? AND event_type = 'audit_event'
            AND context_id = ?`,
      args: [row.user_id, String(row.id)],
    });
    if (exists.rows.length > 0) continue;

    await db.execute({
      sql: `INSERT INTO contact_timeline (contact_cid, event_type, description, context_module, context_id, actor_id, metadata, created_at)
            VALUES (?, 'audit_event', ?, 'system', ?, ?, ?::jsonb, ?)`,
      args: [
        row.user_id,
        `${row.action}: ${row.details || ''}`.substring(0, 500),
        String(row.id),
        row.user_id,
        JSON.stringify({ entity_type: row.entity_type, entity_id: row.entity_id, action: row.action }),
        row.created_at || new Date().toISOString(),
      ],
    });
    count++;
  }
  console.log(`  ✓ ${count} events backfilled from audit_log`);
  totalInserted += count;
} catch (e) {
  console.log(`  ⚠ audit_log backfill skipped: ${e.message}`);
}

// ─── Source 2: participant_program_audit ───
try {
  const ppaRows = await db.execute({
    sql: `SELECT * FROM participant_program_audit ORDER BY created_at ASC`,
    args: [],
  });

  let count = 0;
  for (const row of ppaRows.rows) {
    const exists = await db.execute({
      sql: `SELECT id FROM contact_timeline
            WHERE contact_cid = ? AND event_type = 'participant_enrolled'
            AND context_id = ?`,
      args: [row.participant_id, row.program_id || ''],
    });
    if (exists.rows.length > 0) continue;

    await db.execute({
      sql: `INSERT INTO contact_timeline (contact_cid, event_type, description, context_module, context_id, actor_id, metadata, created_at)
            VALUES (?, ?, ?, 'programs', ?, ?, ?::jsonb, ?)`,
      args: [
        row.participant_id,
        row.action === 'assigned' ? 'participant_enrolled' : row.action,
        `${row.action} to program ${row.program_id || ''}`.substring(0, 500),
        row.program_id || '',
        row.performed_by || 'system',
        JSON.stringify({ action: row.action, source: row.source }),
        row.created_at || new Date().toISOString(),
      ],
    });
    count++;
  }
  console.log(`  ✓ ${count} events backfilled from participant_program_audit`);
  totalInserted += count;
} catch (e) {
  console.log(`  ⚠ participant_program_audit backfill skipped: ${e.message}`);
}

// ─── Source 3: participant_programs (current enrollments) ───
try {
  const ppRows = await db.execute({
    sql: `SELECT * FROM participant_programs WHERE participant_id IS NOT NULL ORDER BY assigned_at ASC`,
    args: [],
  });

  let count = 0;
  for (const row of ppRows.rows) {
    const exists = await db.execute({
      sql: `SELECT id FROM contact_timeline
            WHERE contact_cid = ? AND event_type = 'participant_enrolled'
            AND context_id = ?`,
      args: [row.participant_id, row.program_id || ''],
    });
    if (exists.rows.length > 0) continue;

    await db.execute({
      sql: `INSERT INTO contact_timeline (contact_cid, event_type, description, context_module, context_id, actor_id, metadata, created_at)
            VALUES (?, 'participant_enrolled', ?, 'programs', ?, ?, ?::jsonb, ?)`,
      args: [
        row.participant_id,
        `Enrolled in program ${row.program_id || ''}`.substring(0, 500),
        row.program_id || '',
        row.assigned_by || 'system',
        JSON.stringify({ source: row.source }),
        row.assigned_at || new Date().toISOString(),
      ],
    });
    count++;
  }
  console.log(`  ✓ ${count} events backfilled from participant_programs`);
  totalInserted += count;
} catch (e) {
  console.log(`  ⚠ participant_programs backfill skipped: ${e.message}`);
}

console.log(`\n  Total events backfilled: ${totalInserted}`);
console.log("contact_timeline backfill complete.");
process.exit(0);
