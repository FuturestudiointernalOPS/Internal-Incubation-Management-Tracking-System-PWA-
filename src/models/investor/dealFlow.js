import db from "@/lib/db";

// ── Phase 3 — deal flow entries + fundraising decks ──────────────────────────

export async function insertDealFlowEntry({
  ventureId,
  targetAmount,
  currency,
  instrument = null,
  useOfFunds = null,
  openedBy = null,
  status = "draft",
}) {
  return db.execute({
    sql: `INSERT INTO deal_flow_entries
            (venture_id, status, target_amount, currency, instrument, use_of_funds, opened_at, opened_by)
          VALUES (?, ?, ?, ?, ?, ?, CASE WHEN ? = 'live' THEN NOW() ELSE NULL END, ?)
          RETURNING *`,
    args: [
      String(ventureId),
      status,
      targetAmount ?? null,
      currency ?? null,
      instrument,
      useOfFunds,
      status,
      openedBy,
    ],
  });
}

export async function listDealFlowEntries({ status = null } = {}) {
  const args = [];
  let sql = "SELECT * FROM deal_flow_entries";
  if (status) {
    sql += " WHERE status = ?";
    args.push(status);
  }
  sql += " ORDER BY created_at DESC";
  return db.execute({ sql, args });
}

/**
 * Live entries joined to the venture directory. `venture_id` is TEXT, so the
 * join casts the venture id — safe whichever id type that table uses.
 */
export async function listActiveDealFlowEntriesWithVenture() {
  return db.execute({
    sql: `SELECT dfe.*, v.name, v.company_name, v.description, v.industry, v.country, v.business_stage
            FROM deal_flow_entries dfe
            JOIN ventures v ON v.id::text = dfe.venture_id
           WHERE dfe.status = 'live'
           ORDER BY dfe.opened_at DESC NULLS LAST`,
    args: [],
  });
}

export async function getDealFlowEntryById(id) {
  return db.execute({
    sql: "SELECT * FROM deal_flow_entries WHERE id = ?",
    args: [id],
  });
}

export async function updateDealFlowStatus({ id, status, closeReason = null }) {
  return db.execute({
    sql: `UPDATE deal_flow_entries
             SET status = ?,
                 close_reason = ?,
                 closed_at = CASE WHEN ? = 'closed' THEN NOW() ELSE closed_at END,
                 opened_at = CASE WHEN ? = 'live' AND opened_at IS NULL THEN NOW() ELSE opened_at END,
                 updated_at = NOW()
           WHERE id = ? RETURNING *`,
    args: [status, closeReason, status, status, id],
  });
}

export async function insertDealFlowDeck({
  dealFlowEntryId,
  fileRef = null,
  fileName = null,
  mimeType = null,
  uploadedBy = null,
}) {
  return db.execute({
    sql: `INSERT INTO deal_flow_decks
            (deal_flow_entry_id, file_ref, file_name, mime_type, uploaded_by)
          VALUES (?, ?, ?, ?, ?) RETURNING *`,
    args: [dealFlowEntryId, fileRef, fileName, mimeType, uploadedBy],
  });
}

export async function publishDealFlowDeck(deckId) {
  return db.execute({
    sql: `UPDATE deal_flow_decks
             SET status = 'published', published_at = NOW()
           WHERE id = ? RETURNING *`,
    args: [deckId],
  });
}

export async function getLatestPublishedDeck(dealFlowEntryId) {
  return db.execute({
    sql: `SELECT * FROM deal_flow_decks
           WHERE deal_flow_entry_id = ? AND status = 'published'
           ORDER BY version DESC, published_at DESC LIMIT 1`,
    args: [dealFlowEntryId],
  });
}

export async function listDealFlowDecks(dealFlowEntryId) {
  return db.execute({
    sql: "SELECT * FROM deal_flow_decks WHERE deal_flow_entry_id = ? ORDER BY version DESC, uploaded_at DESC",
    args: [dealFlowEntryId],
  });
}

/** One deck with the entry facts the viewer needs (mode, liveness, currency). */
export async function getDeckWithEntry(deckId) {
  return db.execute({
    sql: `SELECT d.*, e.venture_id, e.status AS entry_status, e.target_amount, e.currency
            FROM deal_flow_decks d
            JOIN deal_flow_entries e ON e.id = d.deal_flow_entry_id
           WHERE d.id = ?`,
    args: [deckId],
  });
}
