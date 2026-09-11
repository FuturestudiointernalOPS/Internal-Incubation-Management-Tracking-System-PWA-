/**
 * PHASE UI-4a — sidebar usability contracts.
 *
 * Locks the two defects the intern report surfaced:
 *   1. The mobile drawer could not scroll: the aside was a plain block, so the
 *      nav's `flex-1 overflow-y-auto` was inert and everything below the fold
 *      was unreachable.
 *   2. Sections could not be collapsed: an explicit close was overridden by the
 *      hover intent (and taps fire mouseenter on touch).
 *
 * The pure rules live in src/components/layout/sidebarMenu.js; this file also
 * asserts the layout actually uses them, so a refactor cannot quietly drop the
 * behaviour (the source-contract style the UI-1 shell tests established).
 */

const fs = require("fs");
const path = require("path");

const {
  canUseHoverIntent,
  resolveSectionExpanded,
  nextExplicitState,
} = require("@/components/layout/sidebarMenu");

const read = (rel) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");
const LAYOUT = "src/components/layout/DashboardLayout.js";

describe("UI-4a — hover intent vs explicit close", () => {
  test("an explicit close wins over hover until the pointer leaves", () => {
    expect(
      resolveSectionExpanded({ open: true, hovered: false, closedByClick: false }),
    ).toBe(true);
    expect(
      resolveSectionExpanded({ open: false, hovered: true, closedByClick: false }),
    ).toBe(true);
    // The whole point: a click-close must not be undone by the hover.
    expect(
      resolveSectionExpanded({ open: false, hovered: true, closedByClick: true }),
    ).toBe(false);
    expect(
      resolveSectionExpanded({ open: false, hovered: false, closedByClick: true }),
    ).toBe(false);
  });

  test("an explicit open still shows the section", () => {
    expect(
      resolveSectionExpanded({ open: true, hovered: true, closedByClick: false }),
    ).toBe(true);
  });

  test("a click inverts the current state", () => {
    expect(nextExplicitState(false)).toBe(true);
    expect(nextExplicitState(true)).toBe(false);
    expect(nextExplicitState(undefined)).toBe(true);
  });

  test("hover intent is disabled on touch, never disabled when unknown", () => {
    expect(canUseHoverIntent(true)).toBe(true);
    expect(canUseHoverIntent(false)).toBe(false);
    expect(canUseHoverIntent(undefined)).toBe(true);
  });
});

describe("UI-4a — the layout actually applies the rules", () => {
  const src = read(LAYOUT);

  test("the mobile drawer is a scrollable column", () => {
    // The drawer must be a flex column with hidden overflow, otherwise the
    // inner `flex-1 overflow-y-auto` nav cannot scroll.
    const drawer = src.match(/absolute inset-y-0 left-0 w-64[^"]*"/);
    expect(drawer).not.toBeNull();
    expect(drawer[0]).toContain("flex flex-col");
    expect(drawer[0]).toContain("overflow-hidden");
  });

  test("the section header uses the shared collapse rule", () => {
    expect(src).toContain("resolveSectionExpanded");
    expect(src).toContain("canUseHoverIntent");
    expect(src).toContain("aria-expanded={expanded}");
  });

  test("hover-open is guarded by the pointer check", () => {
    const enter = src.indexOf("onMouseEnter={");
    expect(enter).toBeGreaterThan(-1);
    const leave = src.indexOf("onMouseLeave={", enter);
    const handler = src.slice(enter, leave === -1 ? enter + 700 : leave);
    expect(handler).toContain("pointerCanHover()");
    expect(handler).toContain("scheduleHoverOpen(item.id)");
  });
});
