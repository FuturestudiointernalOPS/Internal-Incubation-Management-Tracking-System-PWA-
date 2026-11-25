/**
 * THE ADDRESS CONTRACT — invariants of the one table every address comes from.
 *
 * These checks are the safety net for the migration documented in
 * docs/ADDRESS_CONTRACT.md:
 *
 *   - one screen, one address (no two screens share a canonical address, and a
 *     legacy address never becomes another screen's canonical one);
 *   - a move is only finished when its target exists as a real page;
 *   - a move that is still pending still serves its old address, so nothing may
 *     redirect yet;
 *   - every page in the four role trees is catalogued — no screen is orphaned;
 *   - every address the menu advertises is one of these (or a known alias).
 */

const fs = require("node:fs");
const path = require("node:path");

const {
  SCREENS,
  SCREENS_BY_ID,
  path: screenPath,
  addressOf,
  isPending,
  toNextPattern,
  redirectsFor,
  screenRedirects,
} = require("@/lib/routes");
const { MASTER_NAVIGATION } = require("@/lib/masterNavigation/nodes");

const APP = path.join(process.cwd(), "src", "app");
const ROLE_ROOTS = ["member", "staff", "admin", "platform"];

/** Addresses served by something other than a page folder (a rewrite). */
const SERVED_ALIASES = new Set(["/dashboard"]);

const ROLE_CONTEXTS = {
  member: ["participant", "founder", "investor", "facilitator", "team"],
  staff: ["lead-manager", "program-manager", "venture-admin", "crm", "finance", "create"],
  admin: [
    "ventures", "investors", "programs", "crm", "communication", "operations",
    "reports", "knowledge", "lms", "security", "settings", "finance", "intelligence",
  ],
};

/** Every route that has a page file, route groups collapsed. */
function pageRoutes() {
  const routes = new Set();
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.name === "page.js") {
        const segments = path
          .relative(APP, path.dirname(full))
          .split(path.sep)
          .filter((segment) => segment && !/^\(.*\)$/.test(segment));
        routes.add("/" + segments.join("/"));
      }
    }
  };
  for (const root of ROLE_ROOTS) walk(path.join(APP, root));
  return routes;
}

const PAGES = pageRoutes();

const addressOfRow = (row) => addressOf(row);
const targetKey = (row) => `${row.path}?${row.tab || ""}&${row.query || ""}`;

describe("the catalogue", () => {
  test("every screen id is unique", () => {
    const ids = SCREENS.map((row) => row.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(SCREENS_BY_ID.size).toBe(SCREENS.length);
  });

  test("every role is one of the three spaces and its address starts with it", () => {
    for (const row of SCREENS) {
      expect(["member", "staff", "admin"]).toContain(row.role);
      expect(row.path === `/${row.role}` || row.path.startsWith(`/${row.role}/`)).toBe(true);
    }
  });

  test("a context is either absent or one the role really has", () => {
    for (const row of SCREENS) {
      if (row.context === null) continue;
      expect(ROLE_CONTEXTS[row.role]).toContain(row.context);
    }
  });

  test("no two screens share a canonical address", () => {
    const keys = SCREENS.map(targetKey);
    expect(new Set(keys).size).toBe(keys.length);
  });

  test("a retired address never becomes some other screen's canonical one", () => {
    const targets = new Set(SCREENS.map((row) => row.path));
    for (const row of SCREENS) {
      for (const legacy of row.legacy || []) {
        expect(targets.has(legacy)).toBe(false);
      }
    }
  });

  test("a retired address is listed by exactly one screen", () => {
    const seen = new Map();
    for (const row of SCREENS) {
      for (const legacy of row.legacy || []) {
        expect(seen.has(legacy)).toBe(false);
        seen.set(legacy, row.id);
      }
    }
  });
});

describe("the page tree", () => {
  test("a pending move still serves its legacy address", () => {
    for (const row of SCREENS) {
      if (!isPending(row)) continue;
      const served = row.legacy?.[0];
      expect(served).toBeDefined();
      if (SERVED_ALIASES.has(served)) continue;
      expect(PAGES.has(served)).toBe(true);
    }
  });

  test("a finished move has its target as a real page", () => {
    for (const row of SCREENS) {
      if (isPending(row)) continue;
      expect(PAGES.has(row.path)).toBe(true);
    }
  });

  test("every role page is catalogued — as a target or a retired address", () => {
    const known = new Set();
    for (const row of SCREENS) {
      known.add(row.path);
      for (const legacy of row.legacy || []) known.add(legacy);
    }
    const orphans = [...PAGES].filter((route) => !known.has(route));
    expect(orphans).toEqual([]);
  });
});

describe("the redirects", () => {
  test("a finished move turns every retired address into a redirect", () => {
    const row = {
      id: "synthetic.venture.view",
      role: "staff",
      path: "/staff/lead-manager/ventures/[id]",
      tab: "journey",
      legacy: ["/staff/ventures/[id]/journey", "/staff/ventures/[id]/plan"],
    };
    expect(redirectsFor(row)).toEqual([
      {
        source: "/staff/ventures/:id/journey",
        destination: "/staff/lead-manager/ventures/:id?tab=journey",
        permanent: false,
      },
      {
        source: "/staff/ventures/:id/plan",
        destination: "/staff/lead-manager/ventures/:id?tab=journey",
        permanent: false,
      },
    ]);
  });

  test("a pending move emits nothing", () => {
    const row = {
      id: "synthetic.pending",
      path: "/admin/operations/tasks",
      legacy: ["/admin/tasks"],
      pending: true,
    };
    expect(redirectsFor(row)).toEqual([]);
  });

  test("a pending move redirects nothing yet", () => {
    const pendingSources = new Set(
      SCREENS.filter(isPending).flatMap((row) => row.legacy || []),
    );
    for (const entry of screenRedirects()) {
      expect(pendingSources.has(entry.source)).toBe(false);
    }
  });

  test("every emitted redirect comes from a retired address and lands on its target", () => {
    const emitted = screenRedirects();
    const sources = emitted.map((entry) => entry.source);
    expect(new Set(sources).size).toBe(sources.length);
    for (const entry of emitted) {
      const owner = SCREENS.find((row) =>
        (row.legacy || []).some((legacy) => toNextPattern(legacy) === entry.source),
      );
      expect(owner).toBeDefined();
      expect(isPending(owner)).toBe(false);
      expect(entry.destination).toBe(toNextPattern(addressOfRow(owner)));
      expect(["member", "staff", "admin"]).toContain(
        entry.destination.split("/").filter(Boolean)[0],
      );
    }
  });

  test("the permanence flag is passed through, never fixed", () => {
    for (const entry of screenRedirects({ permanent: true })) {
      expect(entry.permanent).toBe(true);
    }
  });

  test("the Next config consumes the generated list instead of restating it", () => {
    const config = fs.readFileSync(path.join(process.cwd(), "next.config.mjs"), "utf8");
    expect(config).toContain("screenRedirectsForNext()");
  });
});

describe("the navigation", () => {
  const hrefs = [];
  const visit = (nodes) => {
    for (const node of nodes) {
      if (node.href) hrefs.push(node.href);
      if (Array.isArray(node.children)) visit(node.children);
    }
  };
  visit(MASTER_NAVIGATION);

  const addressOfHref = (href) => href.split("#")[0].split("?")[0];

  test("every advertised address is a catalogued target or a retired address", () => {
    const known = new Set();
    for (const row of SCREENS) {
      known.add(row.path);
      for (const legacy of row.legacy || []) known.add(legacy);
    }
    const unknown = [...new Set(hrefs.map(addressOfHref))].filter(
      (href) => !known.has(href) && !SERVED_ALIASES.has(href),
    );
    expect(unknown).toEqual([]);
  });

  test("the builder substitutes the record id and keeps the view", () => {
    expect(screenPath("admin.ventures.detail", { id: "VNT-1" })).toBe("/admin/ventures/VNT-1");
    expect(screenPath("admin.ventures.detail.journey", { id: "VNT-1" })).toBe(
      "/admin/ventures/VNT-1?tab=journey",
    );
    expect(() => screenPath("no.such.screen")).toThrow();
  });
});
