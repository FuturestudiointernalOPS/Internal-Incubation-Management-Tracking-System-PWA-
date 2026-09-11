/**
 * PHASE UI-4a — sidebar menu rules (pure, unit-tested).
 *
 * The sidebar has two ways to expand a section: the user clicks it, or the
 * pointer hovers it. They used to fight each other — a click that closed a
 * section was re-opened ~200ms later by the hover intent (and on touch, a tap
 * fires `mouseenter` too), so "collapse" looked broken.
 *
 * Rules encoded here:
 *   • an explicit close wins over hover until the pointer leaves the section;
 *   • hover intent only applies on devices that really have a pointer.
 */

/** `matchMedia` query for "this device can hover". */
export const HOVER_CAPABLE_QUERY = "(hover: hover)";

/**
 * Whether hover intent may be used.
 * `matches` is the value of matchMedia("(hover: hover)").matches, or undefined
 * when the browser cannot answer (SSR, very old browser) — unknown means the
 * pre-existing desktop behaviour, never "disable".
 */
export function canUseHoverIntent(matches) {
  if (typeof matches !== "boolean") return true;
  return matches;
}

/**
 * An explicit close wins over hover-expand. `open` is the stored menu state,
 * `hovered` whether the pointer is on this section (or a descendant), and
 * `closedByClick` whether the user closed it explicitly and has not left since.
 */
export function resolveSectionExpanded({ open, hovered, closedByClick }) {
  return Boolean(open) || (Boolean(hovered) && !closedByClick);
}

/** The state a click on the header produces (true = open). */
export function nextExplicitState(currentlyOpen) {
  return !currentlyOpen;
}
