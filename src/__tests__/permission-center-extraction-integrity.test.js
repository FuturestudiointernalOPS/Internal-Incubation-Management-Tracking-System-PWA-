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

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const readShim = () => read(SHIM_REL);

// Reuse the helper rather than rebuilding the surface here. My first version
// walked `permission-center/` with a flat readdirSync, which silently EXCLUDED
// `shared/` once the first shared module landed — a second, private definition
// of "the surface" that disagreed with the one the behavioural guards use. A
// guard that inspects a different region than the code it guards is worse than
// no guard, so there is now exactly one definition of the surface.
const { readPermissionCenterSurface } = require("./helpers/permissionCenterSource");

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
  const surface = readPermissionCenterSurface();

  const vacuous = [];

  for (const file of fs.readdirSync(path.join(ROOT, "src/__tests__"))) {
    if (!file.endsWith(".test.js")) continue;
    const rel = `src/__tests__/${file}`;
    const lines = read(rel).split("\n");
    const roots = shimBackedVariables(lines);

    lines.forEach((line, index) => {
      const lineNo = index + 1;
      // Only pins made against the shim are in scope. Two shapes qualify: a
      // variable we resolved to the shim's text, and an inline path literal
      // (e.g. read(`${PERMS}PermissionCenter.js`)), which binds no variable at
      // all. Missing the second shape is how this guard stayed silent on
      // ui3-followups while its pin was already broken.
      // The argument of `expect` is not always a bare identifier: it is often a
      // call — `expect(read(center))` — and taking the first word after the paren
      // yields `read`, the name of the helper, which is not a shim-backed root.
      // So the line was skipped entirely and `ui3-governance-audit`'s StatCard
      // pin was invisible to this guard after GovernanceView moved. I had
      // written in the previous commit that the guard "will catch it the moment
      // it is" — that was wrong, and it was wrong because I checked the
      // mechanism I had written rather than the shape the test file uses.
      // Resolve against the whole argument instead: if it mentions ANY root.
      const arg = (line.match(/expect\(\s*([^)]*)\)/) || [])[1];
      const pinnedAgainstShim =
        line.includes("PermissionCenter.js") ||
        (roots.size > 0 && arg != null && [...roots].some((r) => arg.includes(r)));
      if (!pinnedAgainstShim) return;

      // Named groups, not positional ones: a group added here silently shifted
      // every index below and the guard went quiet instead of failing.
      const contains = line.match(
        /expect\([\s\S]*?\)\.(?:not\.)?toContain\(\s*[`"'](?<lit>[^`"']{4,})/,
      );
      if (contains) {
        const literal = contains.groups.lit;
        // Vacuous exactly when the shim lost it and the surface still has it.
        if (!shim.includes(literal) && surface.includes(literal)) {
          vacuous.push(`${file}:${lineNo} toContain(${JSON.stringify(literal.slice(0, 60))})`);
        }
        return;
      }

      const matches = line.match(
        /expect\([\s\S]*?\)\.(?:not\.)?toMatch\(\s*\n?\s*\/(?<re>(?:[^/\\]|\\.)+)\/[a-z]*\s*,?\s*\)/,
      );
      if (matches) {
        let re;
        try {
          re = new RegExp(matches.groups.re);
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
    expect(surface).toContain("buildEditableModules");
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

  test("the shim ends on code, never on a section marker or prose", () => {
    const lastMeaningful = [...lines].reverse().find((l) => l.trim());
    // Since GovernanceView moved out, the tail may legitimately be the
    // `export { default as GovernanceView }` re-export that keeps
    // ContextScopeView.js working. What must never happen is the shim ending on
    // a marker or on prose: that is exactly what an extraction leaves behind
    // when it cuts at the wrong line, and it is how GovernanceView's own JSDoc
    // could have ended up filed inside AuditView.js.
    expect(isComment(lastMeaningful)).toBe(false);
    expect(lastMeaningful.trim()).toMatch(/^\}|^\);|^export\b/);
  });
});