/**
 * DATA LAYER — boundaries.
 *
 * The rule this suite enforces is the one the whole MVC split rests on: a query
 * runs only in `src/models/**`. Everywhere else — routes, pages, components,
 * services, `src/lib`, `src/server` — code asks a model for data and decides on
 * the answer. When a route runs the SQL itself, the decision can no longer be
 * tested without a database, which is exactly what the split was for.
 *
 * `src/lib/db.js` is the pool itself: it *is* the data layer's transport, so it
 * is the one non-model allowed to execute.
 *
 * A route may still import the handle to hand it to a model that takes it as a
 * parameter (`src/models/ventureMemberAccess.js` and its four callers, for
 * dependency injection in tests). That is forwarding, not querying, and the
 * execution still happens inside the model — so the check below is on the
 * *call*, not on the import.
 *
 * Two detection details matter, both learned the hard way (docs/LAYER_SPLIT.md
 * §"the controller frontier audit"): comments are stripped first, so a doc block
 * that merely *names* `db.execute` is not a violation; and whitespace is
 * collapsed before matching, so the split call
 *
 *     await db
 *       .execute({ … })
 *
 * cannot slip through. A `db\.execute` grep alone once produced a false "no route
 * runs SQL" verdict on this codebase.
 */

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..", "..", "..");
const SRC = path.join(ROOT, "src");

/** The data layer, and the transport it runs on. */
const ALLOWED = [path.join(SRC, "models"), path.join(SRC, "lib", "db.js")];

const SKIP_DIRS = new Set(["__tests__", "node_modules", "migrations", ".next"]);

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

/**
 * Source with comments removed and whitespace collapsed to single spaces, so a
 * pattern match cannot be defeated by a line break or by prose.
 */
function normalized(file) {
  return fs
    .readFileSync(file, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1 ")
    .replace(/\s+/g, " ");
}

/** A handle name we would refuse to see a query method called on. */
const HANDLES = "db|pool|client|conn|connection|pgClient";

const EXECUTES = new RegExp(`\\b(?:${HANDLES})\\s*\\.\\s*(?:execute|query|transaction|batch)\\b`);
const POOL_ACCESS = new RegExp(`\\b(?:getPool|acquireClient|getClient)\\s*\\(`);
const DESTRUCTURED = new RegExp(
  `\\{[^}]*\\b(?:execute|query|transaction|batch)\\b[^}]*\\}\\s*=\\s*(?:${HANDLES})\\b`,
);

const guarded = sourceFiles(SRC).filter((file) => !ALLOWED.some((ok) => file.startsWith(ok)));

describe("no query runs outside the data layer", () => {
  test("the data layer is found (a wrong path would pass everything)", () => {
    const models = sourceFiles(path.join(SRC, "models"));
    expect(models.length).toBeGreaterThan(0);
    expect(guarded.length).toBeGreaterThan(0);
  });

  test.each(guarded.map(relative))("%s runs no query", (rel) => {
    const source = normalized(path.join(ROOT, rel));
    expect(source).not.toMatch(EXECUTES);
    expect(source).not.toMatch(POOL_ACCESS);
    expect(source).not.toMatch(DESTRUCTURED);
  });
});

describe("the surfaces that legitimately hold SQL", () => {
  test("the model layer executes queries", () => {
    const models = sourceFiles(path.join(SRC, "models"));
    const executing = models.filter((file) => EXECUTES.test(normalized(file)));
    expect(executing.length).toBeGreaterThan(0);
  });

  test("the pool is the only non-model allowed to execute", () => {
    const pool = normalized(path.join(SRC, "lib", "db.js"));
    expect(pool).toMatch(EXECUTES);
  });
});

describe("SQL text outside the data layer is surfaced", () => {
  // Non-blocking. Some of what shows up here is legitimate and should stay: the
  // schema-bootstrap DDL arrays the services hand to the pool, a health probe,
  // and doc comments that name a query. The next pass reads this list and
  // decides case by case; nothing here is enforced yet.
  const holders = guarded
    .filter((file) => /\b(SELECT |INSERT INTO|UPDATE \w+ SET|DELETE FROM)/.test(normalized(file)))
    .map((file) => ({ file: relative(file), lines: fs.readFileSync(file, "utf8").split("\n").length }))
    .sort((a, b) => a.file.localeCompare(b.file));

  test("the list is reported", () => {
    if (holders.length > 0) {
      console.log(
        "SQL text outside src/models (not enforced):\n" +
          holders.map((entry) => `  ${entry.file}: ${entry.lines}`).join("\n"),
      );
    }
    expect(true).toBe(true);
  });
});