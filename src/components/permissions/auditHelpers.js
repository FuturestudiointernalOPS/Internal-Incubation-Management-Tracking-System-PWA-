/**
 * PHASE UI-3 — Audit presentation helpers (pure, unit-tested).
 *
 * Audit entries store free-text `details`; permission changes append
 * " Reason: …" (Phase 3d). The UI shows the reason as its own highlighted
 * field instead of burying it in the sentence — without ever inventing one.
 */
export function splitAuditReason(details) {
  const text = String(details || "");
  const marker = " Reason: ";
  const markerIndex = text.indexOf(marker);
  if (markerIndex === -1) return { text, reason: "" };
  return {
    text: text.slice(0, markerIndex),
    reason: text.slice(markerIndex + marker.length).trim(),
  };
}
