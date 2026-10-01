import {
  selectVentureScope,
  selectInternalVentureIds,
  selectPersonalVentureSessions,
} from "@/models/workspaceCalendarStore";

/**
 * Workspace service — the personal-calendar Venture session source.
 *
 * Layer (see docs/LAYER_SPLIT.md): the decision lives here; every statement
 * lives in `@/models/workspaceCalendarStore`.
 */

/**
 * Venture sessions for one person's own calendar (Vinance 3, Phase 3).
 *
 *   - the coach's own sessions, whatever their visibility (coach_contact_id)
 *   - venture-facing sessions of the Ventures the person belongs to as a
 *     member (venture_members) or is actively assigned to as staff
 *     (venture_staff_assignments)
 *
 * Cancelled and no-show sessions are never calendar events. Venture ids are
 * stored in both key styles (the VNT code and the internal UUID), so the scope
 * list is expanded to cover both. Returns { rows } like the other getters.
 */
export async function getCalendarVentureSessions(userId) {
  const empty = { rows: [] };
  if (!userId) return empty;

  // 1. The person's Venture scope (membership ∪ active staff assignment).
  const scopeRes = await selectVentureScope(userId).catch(() => empty);
  const ventureCodes = (scopeRes.rows || []).map((row) => row.venture_id).filter(Boolean);

  // 2. Expand to the internal ids too (rows may be keyed either way).
  let internalVentureIds = [];
  if (ventureCodes.length > 0) {
    const idRes = await selectInternalVentureIds(ventureCodes).catch(() => empty);
    internalVentureIds = (idRes.rows || []).map((row) => row.id).filter(Boolean);
  }
  const scope = [...new Set([...ventureCodes, ...internalVentureIds])];
  // Sentinel: a person with no Ventures still gets their own coach sessions,
  // and the IN list can never match a real venture id.
  const scopeList = scope.length > 0 ? scope : ["__no_venture_scope__"];

  return selectPersonalVentureSessions(userId, scopeList);
}
