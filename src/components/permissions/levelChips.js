/**
 * PHASE UI-6 — the LEVEL CHIP vocabulary for PERSON access, in one place.
 *
 * A person's access is edited with the same chips wherever it is edited: the
 * Individual Access panel and the People source matrix. The tokens used to be
 * duplicated per component, which is how two screens showing the same value
 * drifted into different affordances for it — one editable, one read-only.
 * Keep them here so a change lands in both.
 *
 * Pure module: no React, no i18n, no fetch. Safe to unit-test and to import
 * from anywhere (including a server component).
 */

/** Level number → i18n key for its full label ("Edit", "Delete", …). */
export const ACCESS_LEVEL_KEYS = {
  0: "engineering.permissions.accessLevelNone",
  1: "engineering.permissions.accessLevelView",
  2: "engineering.permissions.accessLevelCreate",
  3: "engineering.permissions.accessLevelEdit",
  4: "engineering.permissions.accessLevelDelete",
  5: "engineering.permissions.accessLevelFull",
};

/** Level number → the one-character glyph shown inside the chip. */
export const ACCESS_SHORT = { 0: "—", 1: "V", 2: "C", 3: "E", 4: "D", 5: "All" };

export const LEVELS_ORDER = [0, 1, 2, 3, 4, 5];

/**
 * The levels a person can be granted personally. `None` is not a level here:
 * removing a personal grant is `revoke`, and denying an inherited right is
 * `restrict` — two different intents the UI must never collapse into one.
 */
export const GRANT_LEVELS = LEVELS_ORDER.filter((level) => level > 0);

// Chips share the TEMPLATE matrix's visual language (View / Create / Edit /
// Delete / Full), so both screens read the same way. An active chip is coloured
// by level for a PERSONAL grant and neutral for an inherited right; the origin
// dot carries the same information. `!h-6 !w-6` compacts them for table rows.
export const LEVEL_CHIP_BASE =
  "h-7 w-7 rounded-lg border-2 text-[10px] font-black flex items-center justify-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/60 disabled:cursor-default";

export const LEVEL_CHIP_ACTIVE = {
  1: "bg-blue-500/15 border-blue-500/40 text-blue-400",
  2: "bg-emerald-500/15 border-emerald-500/40 text-emerald-400",
  3: "bg-amber-500/15 border-amber-500/40 text-amber-400",
  4: "bg-red-500/15 border-red-500/40 text-red-400",
  5: "bg-purple-500/15 border-purple-500/40 text-purple-400",
};

export const LEVEL_CHIP_INHERITED =
  "bg-slate-500/20 border-slate-500/40 text-slate-300";

export const LEVEL_CHIP_IDLE =
  "border-dashed border-[var(--border-primary)] text-[var(--text-secondary)] opacity-50 hover:opacity-100 hover:border-brand-orange/50 hover:text-[var(--brand-orange)]";

/**
 * The level a person holds PERSONALLY for one capability (0 = none).
 * Reads `sources.grants`, i.e. `user_capabilities` — never the effective
 * result, which mixes in the profile and groups.
 */
export function personalGrantLevel(sources, module, capability) {
  return Number(sources?.grants?.[module]?.[capability] ?? 0);
}
