/**
 * The address migration — invariants of the redirect table.
 *
 * The table is the only record of where a legacy address now lives. These
 * checks are what makes flipping it to permanent safe: no duplicate source, no
 * self-reference, no destination outside the spaces, no legacy destination
 * (which would be a loop), and a specific alias ordered before its parent.
 */

const fs = require("node:fs");
const path = require("node:path");

const {
  SPACE_REDIRECTS,
  SPACE_REDIRECTS_PERMANENT,
  spaceRedirects,
  RETIRED_DASHBOARD_REDIRECTS,
  retiredDashboardRedirects,
} = require("@/spaces/redirects");

const LEGACY_PREFIXES = [
  "/participant",
  "/founder",
  "/investor",
  "/facilitator",
  "/team",
  "/workspaces",
  "/pm",
  "/finance",
  "/crm",
  "/create",
];

const startsWithSegment = (value, prefix) =>
  value === prefix || value.startsWith(`${prefix}/`);

describe("the redirect table", () => {
  test("every source is unique", () => {
    const sources = SPACE_REDIRECTS.map((entry) => entry.source);
    expect(new Set(sources).size).toBe(sources.length);
  });

  test("a source is never already in a space", () => {
    for (const entry of SPACE_REDIRECTS) {
      expect(entry.source.startsWith("/member")).toBe(false);
      expect(entry.source.startsWith("/staff")).toBe(false);
      expect(entry.source.startsWith("/admin")).toBe(false);
    }
  });

  test("every destination lands in a space that exists", () => {
    for (const entry of SPACE_REDIRECTS) {
      const inSpace =
        entry.destination.startsWith("/member") ||
        entry.destination.startsWith("/staff");
      expect(inSpace).toBe(true);
      const firstSegment = entry.destination.split("/").filter(Boolean)[0];
      expect(
        fs.existsSync(path.join(process.cwd(), "src", "app", firstSegment)),
      ).toBe(true);
    }
  });

  test("no destination points back at a legacy address", () => {
    for (const entry of SPACE_REDIRECTS) {
      for (const legacy of LEGACY_PREFIXES) {
        expect(startsWithSegment(entry.destination, legacy)).toBe(false);
      }
    }
  });

  test("a deep, dynamic source keeps its deep destination", () => {
    for (const entry of SPACE_REDIRECTS) {
      if (entry.source.includes(":path*")) {
        expect(entry.destination).toContain(":path*");
      }
    }
  });

  test("the founder venture alias is resolved before the founder parent", () => {
    const indexOf = (source) =>
      SPACE_REDIRECTS.findIndex((entry) => entry.source === source);
    expect(indexOf("/founder/ventures/:path*")).toBeLessThan(
      indexOf("/founder/:path*"),
    );
    expect(indexOf("/founder/ventures")).toBeLessThan(indexOf("/founder"));
  });
});

describe("the retired dashboards", () => {
  test("every source is a member address and unique", () => {
    const sources = RETIRED_DASHBOARD_REDIRECTS.map((entry) => entry.source);
    expect(new Set(sources).size).toBe(sources.length);
    for (const source of sources) {
      expect(source.startsWith("/member/")).toBe(true);
    }
  });

  test("they all lead to the ONE dashboard, never to another dashboard", () => {
    for (const entry of RETIRED_DASHBOARD_REDIRECTS) {
      expect(entry.destination).toBe("/dashboard");
    }
  });

  test("the permanence flag applies to them too", () => {
    for (const entry of retiredDashboardRedirects()) {
      expect(entry.permanent).toBe(SPACE_REDIRECTS_PERMANENT);
    }
    expect(retiredDashboardRedirects({ permanent: true }).every((e) => e.permanent)).toBe(true);
  });

  test("the Next config consumes the list instead of restating it", () => {
    const config = fs.readFileSync(path.join(process.cwd(), "next.config.mjs"), "utf8");
    expect(config).toContain("retiredDashboardRedirects()");
  });
});

describe("temporary or permanent", () => {
  test("the default follows the environment flag", () => {
    for (const entry of spaceRedirects()) {
      expect(entry.permanent).toBe(SPACE_REDIRECTS_PERMANENT);
    }
  });

  test("the whole set can be flipped without editing the table", () => {
    expect(spaceRedirects({ permanent: true }).every((e) => e.permanent)).toBe(true);
    expect(spaceRedirects({ permanent: false }).some((e) => e.permanent)).toBe(false);
  });

  test("the Next config consumes the table instead of restating it", () => {
    const config = fs.readFileSync(
      path.join(process.cwd(), "next.config.mjs"),
      "utf8",
    );
    expect(config).toContain("spaceRedirects()");
    expect(config).not.toContain('source: "/pm/:path*"');
    expect(config).not.toContain('source: "/participant/:path*"');
  });
});
