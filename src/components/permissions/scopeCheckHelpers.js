/**
 * PHASE UI-2 — Scope check presentation helper (pure, unit-tested).
 *
 * Maps a /api/engineering/permissions/scope-check response to the badge the
 * UI shows. The mapping is deliberately honest:
 *   - unimplemented policy        → "pending" (fail-closed, never green)
 *   - no resource id supplied     → "neutral" (nothing was decided)
 *   - within scope                → "mapped"  (allowed)
 *   - outside scope               → "denied"
 * Never invent a verdict: absence of data is not a deny and not an allow.
 */
export function describeScopeCheck(result) {
  if (!result) {
    return { variant: "neutral", labelKey: "engineering.permissions.liveCheckNoResult" };
  }
  if (!result.implemented) {
    return { variant: "pending", labelKey: "engineering.permissions.liveCheckUnsupported" };
  }
  if (result.within_scope === null || result.within_scope === undefined) {
    return { variant: "neutral", labelKey: "engineering.permissions.liveCheckNoResource" };
  }
  return result.within_scope
    ? { variant: "mapped", labelKey: "engineering.permissions.liveCheckAllowed" }
    : { variant: "denied", labelKey: "engineering.permissions.liveCheckDenied" };
}
