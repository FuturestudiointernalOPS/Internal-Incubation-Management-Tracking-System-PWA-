/**
 * PROGRAM SCOPE COVERAGE CENSUS
 *
 * The census of which program WRITE surfaces consult the record-scope rule, per
 * domain, and which are deliberately exempt with a reason.
 *
 * The rule is enforced UNCONDITIONALLY — there is no switch — so the only thing
 * left to hold to account is COVERAGE. Two failure modes this locks:
 *
 *   1. SILENT DRIFT — a wired surface loses its guard, or a new write surface is
 *      added to a domain without one. The lists below are explicit, so either
 *      move fails this test until it is updated deliberately.
 *
 *   2. A FALSE CLAIM OF COVERAGE — the domains whose surfaces are NOT fully
 *      covered must keep saying so. Three legacy V2 route files carry a project
 *      banner reserving them for V1 pages and forbidding agent changes, so their
 *      endpoints stay open. Asserting the banner is still there (and that no
 *      guard was bolted on) is what keeps the "partial" flag honest instead of
 *      letting it rot into a claim of full coverage.
 */
const fs = require("node:fs");
const path = require("node:path");

const {
  PROGRAM_SCOPE_WAVES,
  PROGRAM_SCOPE_WAVE_INFO,
} = require("@/models/authorization/programScopeWaves");

const ROOT = path.join(__dirname, "..", "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");

/** Program WRITE surfaces that must consult the guard, per wave. */
const COVERAGE = {
  content: ["src/app/api/pm/programs/route.js"],
  enrollment: [
    "src/app/api/participant-programs/route.js",
    "src/app/api/participant-programs/bulk/route.js",
    "src/app/api/invites/route.js",
  ],
  groups: [
    "src/app/api/groups/route.js",
    "src/app/api/kpis/route.js",
  ],
};

/**
 * Files that are part of a domain's SURFACE but deliberately not wired, because a
 * project instruction reserves them. Asserted to still carry that instruction
 * and to NOT contain a guard. Only the routes a human still has to convert
 * appear here — an exemption that is intentional by DESIGN (accepting an
 * invitation, side-effect enrolments) lives in the catalogue's exempt list but
 * names no file, because there is nothing to convert.
 */
const EXEMPT = {
  groups: [
    "src/app/api/v2/groups/route.js",
    "src/app/api/v2/kpis/route.js",
  ],
};

/**
 * Legacy routes that were verified unused and REMOVED. Kept here so a
 * reintroduction fails loudly instead of quietly reopening a bypass.
 */
const RETIRED = [
  "src/app/api/v2/invites/route.js",
  "src/app/api/v2/invites/[token]/route.js",
];

describe("every declared wave is wired somewhere", () => {
  test("the census covers exactly the declared waves", () => {
    expect(Object.keys(COVERAGE).sort()).toEqual([...PROGRAM_SCOPE_WAVES].sort());
  });

  test("each wave documents what it covers", () => {
    for (const wave of PROGRAM_SCOPE_WAVES) {
      const info = PROGRAM_SCOPE_WAVE_INFO[wave];
      expect(info).toBeTruthy();
      expect(info.label).toBeTruthy();
      expect(info.covers).toBeTruthy();
    }
  });
});

describe("wired surfaces consult the record-scope guard", () => {
  for (const [wave, files] of Object.entries(COVERAGE)) {
    test.each(files)(`${wave}: %s imports and calls requireProgramScope`, (file) => {
      const src = read(file);
      expect(src).toContain("@/lib/programScopedAccess");
      expect(src).toMatch(/requireProgramScope(ForAll)?\(/);
      // The wave name must appear, so a file cannot be wired for the wrong one.
      expect(src).toContain(`wave: "${wave}"`);
    });
  }
});

describe("deliberately exempt surfaces say so", () => {
  for (const [wave, files] of Object.entries(EXEMPT)) {
    test.each(files)(`${wave}: %s is left alone AND still banner-protected`, (file) => {
      const src = read(file);
      // Still reserved by the project instruction...
      expect(src).toContain("READ-ONLY here");
      expect(src).toContain("V2 API - ACTIVELY USED BY V1 PAGES");
      // ...and genuinely untouched, so the "partial" claim is not a fiction.
      expect(src).not.toContain("programScopedAccess");
    });

    test(`${wave} is flagged partial and names its exemptions`, () => {
      const info = PROGRAM_SCOPE_WAVE_INFO[wave];
      expect(info.partial).toBe(true);
      expect(info.exempt.length).toBe(files.length);
    });
  }

  test("a fully covered wave is not flagged partial", () => {
    // The content wave has no unwired surface, so it must not claim otherwise.
    expect(PROGRAM_SCOPE_WAVE_INFO.content.partial).toBe(false);
    expect(PROGRAM_SCOPE_WAVE_INFO.content.exempt).toEqual([]);
  });
});

describe("removed legacy routes stay removed", () => {
  test.each(RETIRED)("%s no longer exists", (file) => {
    expect(fs.existsSync(path.join(ROOT, file))).toBe(false);
  });

  test("nothing references the removed invite endpoints", () => {
    const offenders = [];
    (function walk(dir) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.[cm]?js$/.test(entry.name)) {
          const src = fs.readFileSync(full, "utf8");
          // "api/v2/invites" may still appear in a PROSE comment explaining why
          // it was removed; a fetch or an import is what must not come back.
          if (/fetch\(\s*["'`]\/api\/v2\/invites/.test(src)) {
            offenders.push(path.relative(ROOT, full));
          }
        }
      }
    })(path.join(ROOT, "src"));
    expect(offenders).toEqual([]);
  });
});

describe("the vocabulary is pure and complete", () => {
  test("every declared wave has a coverage entry", () => {
    expect(Object.keys(PROGRAM_SCOPE_WAVE_INFO).sort()).toEqual(
      [...PROGRAM_SCOPE_WAVES].sort(),
    );
  });

  test("a partial wave names the surfaces it cannot cover", () => {
    for (const wave of PROGRAM_SCOPE_WAVES) {
      const info = PROGRAM_SCOPE_WAVE_INFO[wave];
      if (info.partial) expect(info.exempt.length).toBeGreaterThan(0);
      else expect(info.exempt).toEqual([]);
    }
  });
});
