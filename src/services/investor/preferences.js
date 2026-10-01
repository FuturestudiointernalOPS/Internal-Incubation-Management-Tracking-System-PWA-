/**
 * Investor service — the investment preferences.
 *
 * Layer (see docs/LAYER_SPLIT.md): the DECISION lives here — a caller with no
 * investor profile must create one first (a 404), otherwise the preferences are
 * upserted with the same defaults the controller used. Every statement lives in
 * `@/models/investorRelations`. No SQL, no HTTP: a refusal is a value
 * ({ ok: false, status, error }) the HTTP boundary turns into a response.
 */

import {
  getInvestorProfileIdForPreferences,
  upsertInvestorPreferencesWithPhilosophy,
} from "@/models/investorRelations";

/** Save (or replace) the caller's investment preferences. */
export async function saveInvestorPreferences({ body, session }) {
  const profileResult = await getInvestorProfileIdForPreferences(session.cid || session.id);
  if (profileResult.rows.length === 0) {
    return {
      ok: false,
      status: 404,
      error: "Investor profile not found. Create profile first.",
    };
  }

  const {
    industries,
    countries,
    startup_stages,
    ticket_size_min,
    ticket_size_max,
    investment_philosophy,
  } = body;

  await upsertInvestorPreferencesWithPhilosophy(
    profileResult.rows[0].id,
    industries || [],
    countries || [],
    startup_stages || [],
    ticket_size_min || null,
    ticket_size_max || null,
    investment_philosophy || null,
  );

  return { ok: true };
}
