import db from "@/lib/db";
import { INVESTOR_FOUNDER_FACTS } from "./founderFacts";

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
    sql: `SELECT dfe.*, v.id AS venture_internal_id, v.name, v.company_name, v.logo_url, v.description, v.industry, v.country, v.business_stage,
                 published_deck.id AS deck_id, published_deck.version AS deck_version, ${INVESTOR_FOUNDER_FACTS}
            FROM deal_flow_entries dfe
            JOIN ventures v ON v.id::text = dfe.venture_id OR v.venture_id = dfe.venture_id
            JOIN LATERAL (
              SELECT d.id, d.version
                FROM deal_flow_decks d
               WHERE d.deal_flow_entry_id = dfe.id AND d.status = 'published'
               ORDER BY d.version DESC, d.published_at DESC
               LIMIT 1
            ) published_deck ON TRUE
           WHERE dfe.status = 'live'
             AND dfe.target_amount > 0 AND dfe.currency IS NOT NULL
             AND COALESCE(v.is_archived::text, '0') NOT IN ('1', 't', 'true')
             AND LOWER(COALESCE(v.status, '')) <> 'archived'
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

export async function findLiveDealFlowEntryForVenture(ventureId, dealFlowEntryId = null) {
  const requestedEntry = dealFlowEntryId == null ? "" : "AND e.id = ?";
  return db.execute({
    sql: `SELECT e.id, e.venture_id
            FROM deal_flow_entries e
           WHERE (e.venture_id = ? OR EXISTS (
                    SELECT 1 FROM ventures v
                     WHERE v.id::text = ? AND e.venture_id IN (v.id::text, v.venture_id)
                 ))
             AND e.status = 'live' AND e.target_amount > 0 AND e.currency IS NOT NULL
             ${requestedEntry}
             AND EXISTS (SELECT 1 FROM deal_flow_decks d
                          WHERE d.deal_flow_entry_id = e.id AND d.status = 'published')
           ORDER BY e.opened_at DESC NULLS LAST, e.id DESC
           LIMIT 1`,
    args: [
      String(ventureId),
      String(ventureId),
      ...(dealFlowEntryId == null ? [] : [dealFlowEntryId]),
    ],
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
