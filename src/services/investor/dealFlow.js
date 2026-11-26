import {
  insertDealFlowEntry,
  listDealFlowEntries,
  listActiveDealFlowEntriesWithVenture,
  getDealFlowEntryById,
  updateDealFlowStatus,
  insertDealFlowDeck,
  publishDealFlowDeck,
  getLatestPublishedDeck,
  listDealFlowDecks,
  getDeckWithEntry,
} from "@/models/investor/dealFlow";
import { emitInvestorEvent, resolveInvestorContext } from "@/services/investor/activity";
import { investorVentureCard } from "@/services/investor/dto";

/**
 * Create a deal-flow entry. An entry becomes visible to investors only once it
 * is `live`, which requires an amount + currency AND a published deck.
 */
export async function createDealFlowEntry({
  ventureId,
  targetAmount,
  currency,
  instrument,
  useOfFunds,
  session,
}) {
  if (!ventureId || targetAmount == null || !currency) {
    return { ok: false, status: 400, error: "venture_id, target_amount and currency are required." };
  }

  const result = await insertDealFlowEntry({
    ventureId,
    targetAmount,
    currency,
    instrument,
    useOfFunds,
    openedBy: session?.cid || session?.id || null,
    status: "draft",
  });

  await emitInvestorEvent({
    session,
    eventType: "deal_flow_opened",
    ventureId: String(ventureId),
    actorType: "studio",
    metadata: { entry_id: result.rows?.[0]?.id ?? null, status: "draft" },
  });

  return { ok: true, entry: result.rows?.[0] || null };
}

export async function addDeck({ dealFlowEntryId, fileRef, fileName, mimeType, session }) {
  const entry = await getDealFlowEntryById(dealFlowEntryId);
  if (entry.rows.length === 0) {
    return { ok: false, status: 404, error: "Deal flow entry not found." };
  }
  const result = await insertDealFlowDeck({
    dealFlowEntryId,
    fileRef,
    fileName,
    mimeType,
    uploadedBy: session?.cid || session?.id || null,
  });
  return { ok: true, deck: result.rows?.[0] || null };
}

export async function publishDeck({ deckId, session }) {
  const result = await publishDealFlowDeck(deckId);
  const deck = result.rows?.[0];
  if (!deck) return { ok: false, status: 404, error: "Deck not found." };

  await emitInvestorEvent({
    session,
    eventType: "deck_published",
    relatedId: deck.deal_flow_entry_id,
    actorType: "studio",
    metadata: { deck_id: deck.id, version: deck.version },
  });

  return { ok: true, deck };
}

export async function changeDealFlowStatus({ id, status, closeReason, session }) {
  if (status === "closed" && !closeReason) {
    return { ok: false, status: 400, error: "A close reason is required." };
  }

  const entry = await getDealFlowEntryById(id);
  if (entry.rows.length === 0) {
    return { ok: false, status: 404, error: "Deal flow entry not found." };
  }

  // An entry may only go live once a deck has been PUBLISHED.
  if (status === "live") {
    const published = await getLatestPublishedDeck(id);
    if (published.rows.length === 0) {
      return { ok: false, status: 400, error: "A published deck is required before going live." };
    }
  }

  const result = await updateDealFlowStatus({ id, status, closeReason });
  const row = result.rows?.[0];

  await emitInvestorEvent({
    session,
    eventType: status === "closed" ? "deal_flow_closed" : "deal_flow_opened",
    ventureId: row?.venture_id ?? null,
    actorType: "studio",
    relatedId: id,
    metadata: { status, reason: closeReason ?? null },
  });

  return { ok: true, entry: row };
}

export async function listDealFlowForStudio({ status } = {}) {
  const entries = (await listDealFlowEntries({ status })).rows;
  for (const entry of entries) {
    entry.decks = (await listDealFlowDecks(entry.id)).rows;
  }
  return { ok: true, entries };
}

/** Investor view: live entries only, DTO-shaped, plus the published deck ref. */
export async function listDealFlowForInvestor({ mode = "deal_flow_only" } = {}) {
  const { rows } = await listActiveDealFlowEntriesWithVenture();
  const entries = [];

  for (const row of rows) {
    const deck = (await getLatestPublishedDeck(row.id)).rows?.[0] || null;
    const card = investorVentureCard(row, {
      mode,
      dealFlow: { target_amount: row.target_amount, currency: row.currency },
    });
    entries.push({
      ...card,
      deal_flow_id: row.id,
      deck: deck ? { id: deck.id, version: deck.version } : null,
    });
  }

  return { ok: true, entries };
}

/**
 * Authorize a published deck for an investor and record `deck_opened`. Only the
 * file reference and the download flag leave the server; the watermark inputs
 * (investor id + timestamp) are returned for the client overlay.
 */
export async function getDeckForViewer({ deckId, session }) {
  const ctx = await resolveInvestorContext(session);
  if (!ctx.investorId) {
    return { ok: false, status: 403, error: "errors.investorProfileRequired" };
  }

  const result = await getDeckWithEntry(deckId);
  const deck = result.rows?.[0];
  if (!deck) return { ok: false, status: 404, error: "Deck not found." };
  if (deck.status !== "published" || deck.entry_status !== "live") {
    return { ok: false, status: 404, error: "Deck not available." };
  }

  await emitInvestorEvent({
    session,
    eventType: "deck_opened",
    ventureId: String(deck.venture_id),
    relatedId: deck.id,
    metadata: { deck_id: deck.id },
  });

  return {
    ok: true,
    deck: { id: deck.id, file_ref: deck.file_ref, download_allowed: deck.download_allowed },
    watermark: { investor_id: ctx.investorId, at: new Date().toISOString() },
  };
}
