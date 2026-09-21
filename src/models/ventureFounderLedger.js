/**
 * THE FOUNDER LEDGER BACKFILL — recording the founders a Venture already has.
 *
 * A Venture's people live in the membership list; its founder screen reads the
 * founder ledger. Creation now writes both (see the pipeline), but Ventures
 * created earlier have their founders only in the membership list — so their
 * founder screen reads "no founders" for a Venture that plainly has one.
 *
 * This is the one-off reconciliation: it walks every Venture that HAS a founder
 * membership and records the missing ledger rows, as ACCEPTED (those people are
 * already in — nobody invited them), exactly as creation does today.
 *
 * Idempotent and additive by construction:
 *   - a founder already recorded (same email) is left untouched;
 *   - nothing is ever updated or deleted;
 *   - with `dryRun`, nothing is written at all — the report is the preview.
 *
 * Kept apart from the membership reader on purpose: the reader must never touch
 * the ledger (a head count read from it is the defect this whole change fixes),
 * so only this maintenance job does.
 */

function rowsOf(result) {
  return (result && result.rows) || [];
}

const FOUNDER_MEMBERSHIP = "vm.member_type = 'founder' OR vm.lead_founder = TRUE OR vm.is_owner = TRUE";

/**
 * Returns a report, including the exact rows it wrote, so a run can be read back
 * instead of trusted.
 */
export async function reconcileFounderLedger(db, { dryRun = false } = {}) {
  const report = {
    dry_run: Boolean(dryRun),
    ventures: 0,
    examined: 0,
    added: 0,
    already_recorded: 0,
    without_email: 0,
    added_rows: [],
  };

  // Only the Ventures that actually have a founder member — a Venture with
  // nobody in it is not a gap, it is a Venture with nobody in it yet.
  const venturesRes = await db.execute({
    sql: `SELECT DISTINCT vm.venture_id
          FROM venture_members vm
          WHERE vm.removed_at IS NULL AND (${FOUNDER_MEMBERSHIP})
          ORDER BY vm.venture_id`,
    args: [],
  });

  for (const row of rowsOf(venturesRes)) {
    const ventureId = row.venture_id;
    report.ventures += 1;

    const foundersRes = await db.execute({
      sql: `SELECT vm.contact_id, vm.user_cid, vm.member_type, vm.role,
                   vm.lead_founder, vm.is_owner, c.name, c.email
            FROM venture_members vm
            LEFT JOIN contacts c ON c.cid = COALESCE(vm.contact_id, vm.user_cid)
            WHERE vm.venture_id = ?
              AND vm.removed_at IS NULL
              AND (${FOUNDER_MEMBERSHIP})
            ORDER BY COALESCE(vm.lead_founder, FALSE) DESC, vm.id ASC`,
      args: [ventureId],
    });

    for (const founder of rowsOf(foundersRes)) {
      report.examined += 1;

      // The ledger is matched by email — without one there is nothing to record
      // that would not be a guess.
      const email = String(founder.email || "").trim().toLowerCase();
      if (!email || !email.includes("@")) {
        report.without_email += 1;
        continue;
      }

      const existing = await db.execute({
        sql: "SELECT id FROM venture_founders WHERE venture_id = ? AND LOWER(email) = ?",
        args: [ventureId, email],
      });
      if (rowsOf(existing).length > 0) {
        report.already_recorded += 1;
        continue;
      }

      const isOwner =
        founder.is_owner === true || founder.is_owner === 1 ||
        founder.lead_founder === true || founder.lead_founder === 1;
      // The owner is THE founder; a founder row that is not the owner is a
      // co-founder.
      const role = isOwner ? "founder" : founder.member_type === "founder" ? "co-founder" : "founder";

      report.added += 1;
      report.added_rows.push({ venture_id: ventureId, email, name: founder.name || null, role });
      if (dryRun) continue;

      await db.execute({
        sql: `INSERT INTO venture_founders
                (venture_id, contact_id, email, name, role, is_owner, status, invitation_accepted_at)
              SELECT ?, ?, ?, ?, ?, ?, 'accepted', NOW()
              WHERE NOT EXISTS (
                SELECT 1 FROM venture_founders WHERE venture_id = ? AND LOWER(email) = ?
              )`,
        args: [
          ventureId,
          founder.contact_id || founder.user_cid || null,
          email,
          founder.name || null,
          role,
          isOwner,
          ventureId,
          email,
        ],
      });
    }
  }

  return report;
}

export default { reconcileFounderLedger };
