/**
 * Participant service — the self timeline.
 *
 * Layer (see docs/LAYER_SPLIT.md): the one DECISION is how many events a caller
 * may request. The read itself is a plain repository call. No SQL, no HTTP.
 */

/**
 * The timeline page size: defaults to 100 when absent or unparseable, and is
 * capped at 200 so one request can never ask for the whole table.
 */
export function clampTimelineLimit(raw) {
  return Math.min(parseInt(raw || "100") || 100, 200);
}
