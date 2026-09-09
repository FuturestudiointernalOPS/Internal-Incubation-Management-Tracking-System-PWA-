/**
 * PHASE 2 — Context-aware eligibility seam for investor SELF-SERVICE.
 *
 * The capability resolver stays role-scoped (unchanged — no resolver edit).
 * This composition admits exactly one additional case: a baseline Member who
 * holds an investor profile row (the canonical investor context,
 * investor_profiles.user_id = session cid) may operate their OWN investor
 * surfaces. Management and legacy investor-role holders pass through the
 * capability exactly as before; everyone else is denied.
 *
 * Routes using this helper MUST be own-scoped (the operation is keyed to the
 * session's own investor profile) — never cross-user operations.
 */
export async function requireInvestorSelfServiceAuthorization(capability) {
  const { requireAuthorization } = await import("@/lib/authorization");
  const capError = await requireAuthorization("investor", capability);
  if (!capError) return null; // capability path unchanged (eligible roles)

  // Interim context fallback: member + investor_profiles row = investor context.
  try {
    const { getSession } = await import("@/lib/auth");
    const session = await getSession();
    if (!session) return capError;
    const { getInvestorProfileIdByUserId } = await import("@/models/investor");
    const prof = await getInvestorProfileIdByUserId(session.cid);
    if (prof.rows.length > 0) return null;
  } catch (_) {
    // Fall through to the capability denial on any lookup failure.
  }
  return capError;
}
