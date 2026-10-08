/**
 * One date formatter for the Projects view.
 *
 * A date-only value ("2026-10-12") is rendered at LOCAL midnight, so the day a
 * person reads is the day the database holds. Handing a bare date-only string
 * to `new Date()` would read it as UTC midnight and, west of Greenwich, show
 * the day before — which is exactly how a finish date ends up disagreeing with
 * the milestone above it.
 *
 * Defined once so every surface of this feature agrees.
 */
export function formatDay(iso, lang) {
  if (!iso) return "";
  return new Date(`${String(iso).slice(0, 10)}T00:00:00`).toLocaleDateString(lang);
}
