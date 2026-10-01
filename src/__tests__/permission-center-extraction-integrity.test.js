/**
 * Why this suite exists
 * --------------------
 * Splitting PermissionCenter.js removes code from the shim. Two things rot
 * silently when that happens, and neither is caught by the tests that describe
 * behaviour:
 *
 * 1. A test that pins a string against the shim keeps PASSING once the string
 *    moves to `permission-center/`, because "the shim does not contain this"
 *    is trivially true. The suite goes green while guarding nothing. A guard
 *    that cannot fail is worse than no guard: it looks like coverage.
 *
 * 2. A comment block that documented a moved component stays behind in the
 *    shim, describing code that is no longer there. Three of these accumulated
 *    during the P3 split before this file existed.
 *
 * Both are mechanical, so both are checked mechanically here. `readSurface()`
 * concatenates the shim with every extracted module, which is the same surface
 * the behavioural guards use.
 */
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..", "..");
const PERMS = "src/components/permissions/";
const SHIM_REL = `${PERMS}PermissionCenter.js`;
const EXTRACTED_REL = `${PERMS}permission-center`;

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");

const readShim = () => read(SHIM_REL);

function readSurface() {
  const dir = path.join(ROOT, EXTRACTED_REL);
  const files = fs.existsSync(dir)
    ? fs
        .readdirSync(dir)
        .filter((f) => f.endsWith(".js"))
        .sort()
    : [];
  return files.map((f) => read(`${EXTRACTED_REL}/${f}`)).join("\n");
}

// ── 1. No test may pin a string against a file that no longer holds it ──────

/**
 * Collect the variable names in `lines` that end up holding the shim's text:
 * a direct path constant, `read(ROOT)`, or `fs.readFileSync(..., ROOT, ...)`.
 */
function shimBackedVariables(lines) {
  const roots = new Set();
  for (const line of lines) {
    const direct = line.match(
      /(?:const|let)\s+(\w+)\s*=\s*[`"'][^`"']*PermissionCenter\.js/,
    );
    if (direct) roots.add(direct[1]);
  }
  // Aliases can chain (`const src = read(screen)`), so iterate to a fixed point.
  for (let pass = 0; pass < 4; pass += 1) {
    for (const line of lines) {
      for (const root of [...roots]) {
        const viaRead = line.match(
          new RegExp(
            `(?:const|let)\\s+(\\w+)\\s*=\\s*(?:read\\(\\s*${root}\\b|fs\\.readFileSync\\([^;]*${root})`,
          ),
        );
        if (viaRead) roots.add(viaRead[1]);
      }
    }
  }
  return roots;
}

describe("P3 — the split did not leave a guard guarding nothing", () => {
  const shim = readShim();
  const surface = readSurface();

  const vacuous = [];

  for (const file of fs.readdirSync(path.join(ROOT, "src/__tests__"))) {
    if (!file.endsWith(".test.js")) continue;
    const rel = `src/__tests__/${file}`;
    const lines = read(rel).split("\n");
    const roots = shimBackedVariables(lines);

    lines.forEach((line, index) => {
      const lineNo = index + 1;
      // Only pins made against the shim are in scope.
      const pinnedAgainstShim =
        roots.size > 0 &&
        (roots.has((line.match(/expect\(\s*(\w+)/) || [])[1]) ||
          line.includes("PermissionCenter.js"));
      if (!pinnedAgainstShim) return;

      const contains = line.match(
        /expect\(\s*\w+\s*\)\.(not\.)?toContain\(\s*[`"']([^`"']{4,})/,
      );
      if (contains) {
        const literal = contains[3];
        // Vacuous exactly when the shim lost it and the surface still has it.
        if (!shim.includes(literal) && surface.includes(literal)) {
          vacuous.push(`${file}:${lineNo} toContain(${JSON.stringify(literal.slice(0, 60))})`);
        }
        return;
      }

      const matches = line.match(
        /expect\(\s*\w+\s*\)\.(not\.)?toMatch\(\s*\n?\s*\/((?:[^/\\]|\\.)+)\/[a-z]*\s*,?\s*\)/,
      );
      if (matches) {
        let re;
        try {
          re = new RegExp(matches[2]);
        } catch {
          return; // a dynamic or non-portable pattern; not this guard's business
        }
        if (!re.test(shim) && re.test(surface)) {
          vacuous.push(
            `${file}:${lineNo} toMatch(/${re.source.slice(0, 60)}/)`,
          );
        }
      }
    });
  }

  test("every string pinned against the shim still lives in the shim", () => {
    expect(vacuous).toEqual([]);
  });

  test("the surface is non-empty, so the check above is actually looking", () => {
    // If `permission-center/` were missing or empty, every pin would read
    // "absent from the shim, absent from the surface" and the guard above would
    // pass while covering nothing. This pins the premise, not the behaviour.
    expect(surface.length).toBeGreaterThan(1000);
  });
});

// ── 2. No comment block left behind describing moved code ───────────────────

describe("P3 — the shim carries no orphaned comment", () => {
  const lines = readShim().split("\n");

  const isComment = (line) =>
    ["//", "/*", "*", "*/"].some((p) => line.trim().startsWith(p));
  // A section marker legitimately introduces a documented block, so a marker may
  // be followed by a comment. Prose may not: prose annotates code directly.
  const isMarker = (line) => line.includes("───");

  const runs = [];
  for (let i = 0; i < lines.length; ) {
    if (!isComment(lines[i])) {
      i += 1;
      continue;
    }
    let end = i;
    while (end < lines.length && isComment(lines[end])) end += 1;
    runs.push({ from: i + 1, to: end, text: lines[i] });
    i = end;
  }

  const nextNonBlank = (from) => {
    let k = from;
    while (k < lines.length && !lines[k].trim()) k += 1;
    return k < lines.length ? k : null;
  };

  const orphans = runs.filter((run) => {
    const next = nextNonBlank(run.to);
    if (next === null) return true; // nothing at all after it: dangling
    return isComment(lines[next]) && !isMarker(run.text);
  });

  test("every comment block in the shim is immediately followed by code", () => {
    expect(orphans.map((r) => `line ${r.from}: ${r.text.trim().slice(0, 70)}`)).toEqual([]);
  });

  test("the shim ends on a component, not on a section marker", () => {
    const lastMeaningful = [...lines].reverse().find((l) => l.trim());
    expect(lastMeaningful.trim()).toMatch(/^\}|^\);/);
  });
});