// Venture Phase 1 — Foundation backfill
// Run once: node scripts/backfill_venture_foundation.mjs
// Dry run (no writes): node scripts/backfill_venture_foundation.mjs --dry-run
// Uses the app's existing DATABASE_URL connection.
//
// What it does (all idempotent, additive, safe to re-run):
//   1. Normalizes ventures.venture_id to VNT- codes (fixes pre-fix promoted
//      ventures that stored a raw UUID as the business key) and propagates the
//      code to v2_teams.venture_id / v2_programs.venture_id.
//   2. Backfills venture_members.member_type so every row is counted as
//      founder or team_member (rows without member_type are invisible to
//      founder/member counts and workspace role logic).
//   3. Inserts venture_origins rows (source_type='legacy') for existing
//      ventures that have no provenance row yet.

import { initDb } from "../src/lib/db.js";
import { createHash } from "node:crypto";

const DRY_RUN = process.argv.includes("--dry-run");

const db = await initDb();
console.log("Connected. Running Venture Phase 1 foundation backfill...\n");

function vntFromId(id) {
  const hash = createHash("md5").update(String(id)).digest("hex").substring(0, 8).toUpperCase();
  return `VNT-${hash}`;
}

// ─── 1. Normalize venture_id to VNT codes ───────────────────────────────────
const badRes = await db.execute({
  sql: `SELECT id, venture_id FROM ventures
        WHERE venture_id IS NOT NULL AND venture_id <> '' AND venture_id !~ '^VNT-'`,
  args: [],
});
console.log(`1) Non-VNT venture_id rows found: ${badRes.rows.length}`);
for (const row of badRes.rows) {
  const code = vntFromId(row.id);
  console.log(`   - ${row.id} → ${row.venture_id} → ${code}`);
  if (DRY_RUN) continue;
  // Avoid collision with an existing VNT row (shouldn't happen; guard anyway)
  const clash = await db.execute({
    sql: "SELECT id FROM ventures WHERE venture_id = ? AND id::text <> ?::text",
    args: [code, row.id],
  });
  if (clash.rows.length > 0) {
    console.log(`     ⚠ collision with ${clash.rows[0].id} — skipped`);
    continue;
  }
  await db.execute({
    sql: "UPDATE ventures SET venture_id = ? WHERE id = ?",
    args: [code, row.id],
  });
  await db.execute({
    sql: "UPDATE v2_teams SET venture_id = ? WHERE venture_id = ?",
    args: [code, row.venture_id],
  });
  await db.execute({
    sql: "UPDATE v2_programs SET venture_id = ? WHERE venture_id = ?",
    args: [code, row.venture_id],
  });
  // Fix any child rows still keyed on the old value where safe (VNT-keyed tables)
  await db.execute({
    sql: "UPDATE venture_origins SET venture_id = ? WHERE venture_id = ?",
    args: [code, row.venture_id],
  });
}
if (DRY_RUN) console.log("   (dry run — no writes)");

// ─── 2. Backfill venture_members.member_type ────────────────────────────────
const noType = await db.execute({
  sql: `SELECT COUNT(*) AS n FROM venture_members
        WHERE member_type IS NULL OR member_type = ''`,
  args: [],
});
const noTypeCount = Number(noType.rows[0]?.n || 0);
console.log(`2) venture_members rows missing member_type: ${noTypeCount}`);
if (!DRY_RUN && noTypeCount > 0) {
  // Rows created by legacy paths use role='founder' for founders
  await db.execute({
    sql: `UPDATE venture_members
          SET member_type = CASE WHEN LOWER(COALESCE(role,'')) = 'founder' THEN 'founder' ELSE 'team_member' END
          WHERE member_type IS NULL OR member_type = ''`,
    args: [],
  });
  console.log("   - backfilled");
} else if (DRY_RUN) {
  console.log("   (dry run — no writes)");
}

// ─── 3. Insert legacy provenance rows ───────────────────────────────────────
const missing = await db.execute({
  sql: `SELECT v.id, v.venture_id, v.program_id
        FROM ventures v
        LEFT JOIN venture_origins o ON o.venture_id = v.venture_id
        WHERE o.id IS NULL`,
  args: [],
});
console.log(`3) Ventures without provenance: ${missing.rows.length}`);
for (const row of missing.rows) {
  console.log(`   - ${row.venture_id}${row.program_id ? ` (program ${row.program_id})` : ""}`);
  if (DRY_RUN) continue;
  await db.execute({
    sql: `INSERT INTO venture_origins (venture_id, source_type, program_id, created_at)
          VALUES (?, 'legacy', ?, NOW())
          ON CONFLICT (venture_id) DO NOTHING`,
    args: [row.venture_id, row.program_id ? String(row.program_id) : null],
  });
}
if (DRY_RUN) console.log("   (dry run — no writes)");

console.log("\nVenture Phase 1 foundation backfill complete.");
process.exit(0);
