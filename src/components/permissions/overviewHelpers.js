/**
 * PHASE UI-1 — Overview helper (pure, unit-tested).
 * Kept free of React/Next imports so the governance math can be tested
 * directly and reused by future screens.
 */

/**
 * Coverage summary of the context-role registry.
 * A row is "mapped" when it carries a profile_id; unmapped rows are the
 * VISIBLE gaps (never hidden) that the Overview surfaces.
 */
export function summarizeContextRoles(roles = []) {
  const list = Array.isArray(roles) ? roles : [];
  const gaps = list.filter(
    (r) => r.profile_id === null || r.profile_id === undefined,
  );
  return {
    total: list.length,
    mapped: list.length - gaps.length,
    gaps: gaps.map((g) => ({ context: g.context, role_key: g.role_key })),
  };
}
