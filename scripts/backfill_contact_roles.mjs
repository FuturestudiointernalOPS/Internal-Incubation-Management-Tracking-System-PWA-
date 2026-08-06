// Phase 1: Backfill contact_roles from existing contacts.role values
// Run once after phase1_crm_foundation.sql migration
// Idempotent — safe to run multiple times

import { initDb } from "../src/lib/db.js";

const db = await initDb();
console.log("Connected. Backfilling contact_roles...\n");

// Fetch all contacts with non-null roles
const contacts = await db.execute({
  sql: "SELECT cid, role, created_at FROM contacts WHERE role IS NOT NULL AND role != '' AND role != 'unassigned'",
  args: [],
});

let inserted = 0;
let skipped = 0;

for (const c of contacts.rows) {
  // Check if this role already exists for this contact to avoid duplicates
  const existing = await db.execute({
    sql: "SELECT id FROM contact_roles WHERE contact_cid = ? AND role = ? AND context_type IS NULL",
    args: [c.cid, c.role],
  });

  if (existing.rows.length > 0) {
    skipped++;
    continue;
  }

  await db.execute({
    sql: `INSERT INTO contact_roles (contact_cid, role, is_current, started_at)
          VALUES (?, ?, true, ?)`,
    args: [c.cid, c.role, c.created_at || new Date().toISOString()],
  });
  inserted++;
}

console.log(`  ✓ ${inserted} roles backfilled`);
console.log(`  ⚠ ${skipped} skipped (already exist)`);
console.log("\ncontact_roles backfill complete.");
process.exit(0);
