/**
 * Investor service — the watchlist.
 *
 * Layer (see docs/LAYER_SPLIT.md): the DECISION lives here — the toggle: a
 * venture already on the caller's watchlist is removed, otherwise it is added.
 * The profile resolution (no profile = a 404) is here too. Every statement
 * lives in `@/models/investorRelations`. No SQL, no HTTP: a refusal is a value
 * ({ ok: false, status, error }) the HTTP boundary turns into a response.
 */

import {
  addWatchlistEntry,
  findWatchlistEntry,
  getInvestorProfileIdForWatchlist,
  removeWatchlistEntry,
} from "@/models/investorRelations";

/**
 * Toggle a venture on the caller's watchlist and report which way it went
 * ("added" or "removed").
 */
export async function toggleWatchlist({ ventureId, personalNotes, session }) {
  if (!ventureId) return { ok: false, status: 400, error: "venture_id required" };

  const profileResult = await getInvestorProfileIdForWatchlist(session.cid || session.id);
  if (profileResult.rows.length === 0) {
    return { ok: false, status: 404, error: "Profile not found" };
  }

  const investorId = profileResult.rows[0].id;
  const existing = await findWatchlistEntry(investorId, ventureId);

  if (existing.rows.length > 0) {
    await removeWatchlistEntry(investorId, ventureId);
    return { ok: true, action: "removed" };
  }

  await addWatchlistEntry(investorId, ventureId, personalNotes || null);
  return { ok: true, action: "added" };
}
