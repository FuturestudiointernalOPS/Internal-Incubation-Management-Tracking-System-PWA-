/**
 * PHASE UI-9 — capability risk, as a decision rather than a decoration.
 *
 * AdvancedCapabilities already COLOUR-CODES every capability's catalog risk
 * (`low | medium | high | critical`). This module turns that same catalog value
 * into the one thing a reader could not do before: STOP and be asked. A change
 * that touches a `critical` (or `high`) capability is the kind of write where
 * "which capability am I actually granting?" is the whole question, so the
 * answer has to be named before the write, not discovered in the audit log.
 *
 * Pure module (no React, no fetch) so both the person screen and the template
 * editor share ONE definition of "needs confirming" — a second copy is how the
 * two screens would drift apart on the level that matters most.
 */

import { capabilityRisk } from "@/lib/authorization/capability-catalog";

// The catalog lookup lives in the model layer (shared with the enforcement
// code); re-exported here so a caller needs one import for "how risky is this".
export { capabilityRisk };

// The repo's established status palette, identical to the one AdvancedCapabilities
// renders (no hex, no dark: variants — these classes are the shared language for
// a risk level across the whole Permission Center).
export const RISK_BADGE_CLASS = {
  low: "text-emerald-400 border-emerald-400/30 bg-emerald-400/10",
  medium: "text-amber-400 border-amber-400/30 bg-amber-400/10",
  high: "text-red-400 border-red-400/30 bg-red-400/10",
  critical: "text-red-500 border-red-500/40 bg-red-500/15",
};

export const RISK_UNKNOWN_BADGE_CLASS =
  "text-[var(--text-secondary)] border-[var(--border-primary)] bg-secondary/40";

/** Locale key of a risk level's label (reuses the labels already shipped). */
export function riskLabelKey(risk) {
  return `engineering.permissions.advancedRisk.${risk}`;
}

/**
 * Locale key of a capability's short label. The catalog ships English labels;
 * the locale file overrides the few that need a translation (same convention as
 * AdvancedCapabilities, so one capability reads the same everywhere).
 */
export function capabilityLabelKey(capability) {
  return `engineering.permissions.capabilityLabels.${String(capability).replace(/\./g, "_")}`;
}

/**
 * Does this risk level require an explicit confirmation?
 *
 * `critical` is the obvious case. `high` is included because the difference
 * between "delete every contact" and "moderate announcements" is invisible at
 * the moment of a click — both are named, so the confirm reads naturally as
 * "what am I about to do?" rather than as a nag. `low`/`medium` never interrupt:
 * confirming everything is how a confirmation stops being read.
 */
export function requiresRiskConfirmation(risk) {
  return risk === "high" || risk === "critical";
}

/**
 * The subset of a change list that must be confirmed, each entry carrying the
 * risk it was classified with so the dialog never re-derives it.
 *
 * @param {Array<{module: string, capability: string, risk?: string}>} changes
 * @returns {Array<{module: string, capability: string, risk: string}>}
 */
export function riskyChanges(changes, riskOf = capabilityRisk) {
  if (!Array.isArray(changes)) return [];
  const out = [];
  for (const change of changes) {
    if (!change?.module || !change?.capability) continue;
    const risk = change.risk || riskOf(change.module, change.capability);
    if (requiresRiskConfirmation(risk)) {
      out.push({ module: change.module, capability: change.capability, risk });
    }
  }
  return out;
}
