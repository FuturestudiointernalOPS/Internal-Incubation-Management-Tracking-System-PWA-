/**
 * COMPATIBILITY RE-EXPORT — guardrail.
 *
 * When a module moves to its proper layer, the old path is kept alive by a file
 * that does nothing but forward symbols. That file is a promise to delete it
 * later, and a promise nobody keeps: the path survives, the next reader cannot
 * tell a facade from a real module, and imports keep accumulating on the wrong
 * layer. This suite makes the promise enforceable — a new facade fails the build
 * of the repo's test suite, today.
 *
 * What counts as a facade, precisely: a module whose entire body is
 * `import`/`export … from` statements, where **every** target lives in another
 * layer (`@/models`, `@/services`, `@/server`). Two neighbours of that shape are
 * deliberately NOT facades, and this suite must not flag them:
 *
 *  - an aggregating barrel — `src/models/workspace.js`, `src/lib/email.js`,
 *    `src/services/lms/checkout.js` — forwards its own layer's folder (or its
 *    own domain's surface) and is the sanctioned shape per docs/LAYER_SPLIT.md
 *    rule 6 and the same-surface-barrel convention. It owns a surface; it does
 *    not merely keep a dead path alive.
 *  - a real module with SQL, HTTP or decisions in it.
 *
 * The remaining facade is `src/lib/auth.js`, listed in
 * `scripts/compat-reexport-debt.json`. Existing suites pin that facade on purpose
 * (`src/__tests__/server/auth-boundaries.test.js`), so it is debt, not a defect:
 * it blocks nothing new, and the list is emptied by repointing its importers, not
 * by deleting the file first. As with `scripts/line-limit-debt.json`, a debt entry
 * that no longer violates the rule FAILS this suite — an allow-list nobody prunes
 * is an allow-list that stopped guarding.
 */

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..", "..", "..");
const SRC = path.join(ROOT, "src");
const DEBT_FILE = path.join(ROOT, "scripts", "compat-reexport-debt.json");

const SKIP_DIRS = new Set(["__tests__", "node_modules", "migrations", ".next"]);

/** Which layer each top-level source directory belongs to. Aliases map to their owner. */
const LAYER_OF_DIR = { models: "models", services: "services", server: "server" };

/** Every source file under `src/`, excluding tests and build config. */
function sourceFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) out.push(...sourceFiles(full));
    } else if (/\.(js|jsx|ts|tsx)$/.test(entry.name) && !entry.name.endsWith(".config.js")) {
      out.push(full);
    }
  }
  return out;
}

const relative = (file) => path.relative(ROOT, file).split(path.sep).join("/");

/** `import … from "x"`, `import "x"`, `export … from "x"`, `export * from "x"`. */
const REEXPORT_STATEMENT =
  /import\s+(?:[\s\S]*?)\s*from\s*["'][^"']+["'];?|import\s*["'][^"']+["'];?|export\s+(?:\*(?:\s+as\s+\w+)?|\{[\s\S]*?\})\s*from\s*["'][^"']+["'];?/g;

/** `"use client";` / `"use server";` — a directive prologue, not a body. */
const DIRECTIVE = /^\s*(["'])(use client|use server)\1\s*;?/;

/** Comments removed, then statements removed — what is left is the real body. */
function body(file) {
  return fs
    .readFileSync(file, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1 ")
    .replace(REEXPORT_STATEMENT, "")
    .replace(DIRECTIVE, "")
    .replace(/\s+/g, "");
}

/** Every module specifier the file forwards to. */
function targets(file) {
  const source = fs.readFileSync(file, "utf8");
  return [...new Set([...source.matchAll(/\bfrom\s*["']([^"']+)["']/g)].map((match) => match[1]))];
}

/**
 * True when `specifier` resolves outside the layer that `file` belongs to.
 * `src/services/lms/checkout.js` importing `./checkout/runCourse` stays inside
 * `src/services`; importing `@/models/lms/registrations` does not.
 *
 * A relative specifier is judged by where it lands on disk — `./email/send` from
 * `src/lib/email.js` is its own folder, `../models/tasks` is not. An alias is
 * judged against the file's own layer, so a model barrel re-exporting from
 * `@/services` counts as crossing a layer while `src/lib`, which owns no layer of
 * its own, crosses one on any `@/models|services|server` import.
 */
function leavesLayer(file, specifier) {
  const home = relative(file).split("/")[1];
  const layer = LAYER_OF_DIR[home];
  if (specifier.startsWith("@/")) {
    return !layer || (specifier !== `@/${layer}` && !specifier.startsWith(`@/${layer}/`));
  }
  if (!specifier.startsWith(".")) return false; // a third-party package
  const resolved = path.normalize(path.join(path.dirname(file), specifier));
  return !resolved.startsWith(path.join(SRC, home));
}

/** A pure pass-through whose every target lives in another layer. */
function isCompatReexport(file) {
  const remaining = body(file);
  if (remaining !== "" && remaining !== ";") return false;
  const forwarded = targets(file);
  if (forwarded.length === 0) return false;
  return forwarded.every((specifier) => leavesLayer(file, specifier));
}

const facades = sourceFiles(SRC)
  .filter(isCompatReexport)
  .map((file) => ({ file: relative(file), lines: fs.readFileSync(file, "utf8").split("\n").length }))
  .sort((a, b) => b.lines - a.lines);

const debt = fs.existsSync(DEBT_FILE) ? JSON.parse(fs.readFileSync(DEBT_FILE, "utf8")) : [];

describe("no new compatibility re-export", () => {
  test("the scan reaches the source tree", () => {
    expect(sourceFiles(SRC).length).toBeGreaterThan(0);
  });

  test("every facade is either absent or on the debt list", () => {
    const allowed = new Set(debt);
    const offenders = facades.filter((entry) => !allowed.has(entry.file)).map((entry) => entry.file);
    expect(offenders).toEqual([]);
  });

  test("the debt list holds no entry that is no longer a facade", () => {
    const actual = new Set(facades.map((entry) => entry.file));
    expect(debt.filter((file) => !actual.has(file)).sort()).toEqual([]);
  });
});

describe("the shapes that look like a facade but are not", () => {
  // Pinned so a future "simplification" cannot quietly turn a barrel into a
  // tracked facade, and so this suite's definition stays honest.
  test.each([
    ["models/workspace.js", "aggregates its own domain folder"],
    ["services/lms/checkout.js", "aggregates its own domain folder"],
    ["lib/email.js", "aggregates its own folder, sanctioned by LAYER_SPLIT rule 6"],
    ["lib/ventureOwnership.js", "owns a predicate and an HTTP refusal"],
    ["models/authorization/accessQueries.js", "owns its SQL"],
  ])("%s is not a facade (%s)", (rel) => {
    expect(isCompatReexport(path.join(SRC, rel))).toBe(false);
  });
});