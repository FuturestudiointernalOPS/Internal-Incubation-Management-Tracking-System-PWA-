/**
 * W3 — the Venture record views are tabs of ONE address.
 *
 * Every former path segment (`/journey`, `/reports`, `/verification`, …) is now
 * a `?tab=` value of `/admin/ventures/[id]`. This suite pins the mapping in both
 * directions: each catalogue tab is dispatched by the hub, and each retired
 * address is generated as a redirect onto its tab.
 */
const fs = require("node:fs");
const path = require("node:path");

const {
  SCREENS,
  screenRedirects,
  toNextPattern,
  addressOf,
  path: screenPath,
} = require("@/lib/routes");
const { ADMIN_VENTURE_SCREENS } = require("@/lib/routes/screens/adminVentures");

const read = (rel) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");

const HUB = read("src/spaces/admin/components/ventures/VentureDetailView.js");
const NAV = read("src/spaces/admin/components/ventures/VentureHubNav.js");

const RECORD_PREFIX = "/admin/ventures/[id]";

/** The record views (the hub address, with a tab or a tab+query). */
const recordViews = ADMIN_VENTURE_SCREENS.filter(
  (row) => row.path === RECORD_PREFIX && row.tab,
);

const distinctTabs = [...new Set(recordViews.map((row) => row.tab))];

describe("the catalogue finishes the move", () => {
  test("no record view is pending any more", () => {
    const pending = ADMIN_VENTURE_SCREENS.filter((row) => row.pending);
    expect(pending.map((row) => row.id)).toEqual([]);
  });

  test("every record view is a tab of the hub address", () => {
    for (const row of recordViews) {
      expect(row.path).toBe(RECORD_PREFIX);
      expect(typeof row.tab).toBe("string");
      expect(row.legacy?.length).toBeGreaterThan(0);
    }
  });

  test("the retired addresses are the former path segments", () => {
    for (const row of recordViews) {
      for (const legacy of row.legacy || []) {
        expect(legacy.startsWith(`${RECORD_PREFIX}/`)).toBe(true);
      }
    }
  });

  test("milestones and timeline are retired addresses of the views that absorbed them", () => {
    const journey = ADMIN_VENTURE_SCREENS.find((row) => row.id === "admin.ventures.detail.journey");
    const timeline = ADMIN_VENTURE_SCREENS.find((row) => row.id === "admin.ventures.detail.projects.timeline");
    expect(journey.legacy).toContain(`${RECORD_PREFIX}/milestones`);
    expect(timeline.tab).toBe("projects");
    expect(timeline.query).toBe("view=timeline");
  });
});

describe("the hub dispatches every tab", () => {
  test.each(distinctTabs)("?tab=%s is rendered by the hub", (tab) => {
    expect(HUB).toContain(`tab === "${tab}"`);
  });

  test("the former path segments are not links any more", () => {
    expect(NAV).not.toMatch(/\/admin\/ventures\/\$\{id\}\/[a-z-]+/);
  });

  test("every tab the bar advertises is dispatched", () => {
    const advertised = [...NAV.matchAll(/key: "([^"]+)"/g)].map((match) => match[1]);
    expect(advertised).toEqual(expect.arrayContaining(["journey", "reports", "verification", "dataRoom"]));
    for (const key of advertised) {
      expect(HUB).toContain(`tab === "${key}"`);
    }
  });
});

describe("the generated redirects land on the tab", () => {
  const emitted = new Map(screenRedirects().map((entry) => [entry.source, entry.destination]));

  test("every retired record address redirects to its tab", () => {
    for (const row of recordViews) {
      for (const legacy of row.legacy || []) {
        expect(emitted.get(toNextPattern(legacy))).toBe(toNextPattern(addressOf(row)));
      }
    }
  });

  test("a retired address never keeps its own page", () => {
    for (const row of recordViews) {
      for (const legacy of row.legacy || []) {
        const folder = path.join(process.cwd(), "src", "app", ...legacy.split("/").filter(Boolean));
        expect(fs.existsSync(folder)).toBe(false);
      }
    }
  });

  test("the builder keeps the view in the address", () => {
    expect(screenPath("admin.ventures.detail.journey", { id: "VNT-1" })).toBe("/admin/ventures/VNT-1?tab=journey");
    expect(screenPath("admin.ventures.detail.documents", { id: "VNT-1" })).toBe("/admin/ventures/VNT-1?tab=dataRoom");
    expect(screenPath("admin.ventures.detail.reporting.quarterly", { id: "VNT-1" }))
      .toBe("/admin/ventures/VNT-1?tab=reporting&period=quarterly");
    expect(screenPath("admin.ventures.detail.projects.emails", { id: "VNT-1" }))
      .toBe("/admin/ventures/VNT-1?tab=projects&view=emails");
  });
});

test("the catalogue still holds the hub's own screens", () => {
  const screens = SCREENS.filter((row) => row.path.startsWith("/admin/ventures") && !row.tab);
  expect(screens.length).toBeGreaterThan(0);
});
