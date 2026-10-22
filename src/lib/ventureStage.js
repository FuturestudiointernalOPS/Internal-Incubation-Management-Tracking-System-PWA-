/**
 * ONE business-stage vocabulary for SCORING.
 *
 * Two vocabularies are stored today — the founder profile form writes `mvp` and
 * `scale`, the admin editors write `early_traction` and `scaling` — and every
 * scoring map only ever knew the second one. A Venture at MVP therefore scored
 * exactly like an Idea in every weighted engine that reads the stage.
 *
 * This maps the aliases BEFORE any lookup, so both spellings score identically.
 * It changes no stored value and needs no migration: the vocabulary is
 * normalised at the point of use, which is the only place it was ever wrong.
 *
 * The Data Room already buckets both spellings (lib/dataRoom.js) — that is the
 * proof the two names mean the same thing.
 */

export const STAGE_SCORING_ALIASES = {
  mvp: "early_traction",
  scale: "scaling",
};

/** A stored stage value, normalised for scoring. Unknown values pass through. */
export function normalizeBusinessStage(stage) {
  const value = String(stage || "").trim().toLowerCase();
  if (!value) return "idea";
  return STAGE_SCORING_ALIASES[value] || value;
}
