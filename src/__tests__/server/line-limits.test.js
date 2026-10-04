/**
 * Line-limit guardrail.
 *
 * The size pass brought every non-test source file under the 600-line hard
 * ceiling, so this suite keeps it that way: a file that crosses 600 without a
 * debt entry fails, and a debt entry that no longer exceeds it fails too — an
 * allow-list that nobody prunes is an allow-list that stops guarding.
 *
 * Scope matches `scripts/check-line-limits.mjs`: `src/**` only, test files and
 * build config excluded. The soft target (500) is reported, never enforced:
 * `npm run check:lines` prints the same list for the next pass.
 *
 * To grandfather a file deliberately, run `npm run check:lines:update` — it
 * writes the current over-600 set to `scripts/line-limit-debt.json`.
 */

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..", "..", "..");
const SRC = path.join(ROOT, "src");
const DEBT_FILE = path.join(ROOT, "scripts", "line-limit-debt.json");

const HARD_LIMIT = 600;
const SOFT_LIMIT = 500;

const SKIP_DIRS = new Set(["__tests__", "node_modules", "migrations", ".next"]);

/** Every source file under `src/`, excluding tests and build config. */
function sourceFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) out.push(...sourceFiles(full));
    } else if (/\.(js|jsx|ts|tsx)$/.test(entry.name)) {
      if (!entry.name.endsWith(".config.js") && !entry.name.endsWith(".config.mjs")) {
        out.push(full);
      }
    }
  }
  return out;
}

const relative = (file) => path.relative(ROOT, file).split(path.sep).join("/");
const countLines = (file) => fs.readFileSync(file, "utf8").split("\n").length;

const files = sourceFiles(SRC).map((file) => ({
  file: relative(file),
  lines: countLines(file),
}));

const debt = (() => {
  if (!fs.existsSync(DEBT_FILE)) return [];
  return JSON.parse(fs.readFileSync(DEBT_FILE, "utf8"));
})();

describe("line-limit guardrail", () => {
  test(`no source file exceeds ${HARD_LIMIT} lines (outside the debt list)`, () => {
    const allowed = new Set(debt);
    const offenders = files
      .filter((entry) => entry.lines > HARD_LIMIT && !allowed.has(entry.file))
      .sort((a, b) => b.lines - a.lines);
    expect(offenders).toEqual([]);
  });

  test("the debt list holds no entry that is now under the ceiling", () => {
    const overHard = new Set(
      files.filter((entry) => entry.lines > HARD_LIMIT).map((entry) => entry.file),
    );
    const stale = debt.filter((file) => !overHard.has(file)).sort();
    expect(stale).toEqual([]);
  });

  test(`the files over the ${SOFT_LIMIT}-line soft target are surfaced`, () => {
    const over = files
      .filter((entry) => entry.lines > SOFT_LIMIT && entry.lines <= HARD_LIMIT)
      .sort((a, b) => b.lines - a.lines);
    // Non-blocking: the next size pass reads this list.
    if (over.length > 0) {
      console.log(
        `over soft limit (${SOFT_LIMIT}):\n` +
          over.map((entry) => `  ${entry.file}: ${entry.lines}`).join("\n"),
      );
    }
    expect(true).toBe(true);
  });
});
