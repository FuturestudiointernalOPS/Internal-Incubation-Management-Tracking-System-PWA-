/**
 * SOURCE SURFACE — read a module together with the files it was split into.
 *
 * Several suites pin the TEXT of one module (a route, a service, a screen): the
 * order of two calls, a guard that must run before a side effect, a string that
 * must never reappear. When that module is split for size — a service into
 * `formRuns/*.js`, a page into `components/platform/runs/*.js` — a guard that
 * still read only the shim would go vacuously green: the pinned code would move
 * into a sibling file and the assertion would pass because the shim no longer
 * contains it. A guard that quietly stops guarding is worse than no guard.
 *
 * `readSurface` fixes that: it concatenates the base file AND every `.js` under
 * a folder of the same name (the split convention: `formRuns.js` + `formRuns/`,
 * `report.js` + `report/`), verbatim, so the exact bytes the guards were written
 * against stay contiguous. Extra folders (e.g. a page's own component folder)
 * can be appended.
 *
 * Concatenation, not a bundle: the suites assert with multi-line regexes, so
 * nothing is reformatted, reordered internally, or stripped.
 */

const fs = require("node:fs");
const path = require("node:path");

const SRC = path.join(__dirname, "..", "..", "..");

/** Every `.js` under `dir` (recursive), sorted so the order is stable. */
function filesUnder(dir) {
  const out = [];
  const walk = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(".js")) out.push(full);
    }
  };
  walk(dir);
  return out.sort();
}

/** A file's text, or a folder's every `.js` file concatenated. */
function readPath(rel) {
  const full = path.isAbsolute(rel) ? rel : path.join(SRC, rel);
  if (!fs.existsSync(full)) return "";
  if (fs.statSync(full).isDirectory()) {
    return filesUnder(full)
      .map((file) => fs.readFileSync(file, "utf8"))
      .join("\n");
  }
  return fs.readFileSync(full, "utf8");
}

/**
 * The base file plus its same-named folder, plus any extra paths.
 *
 * @param {...string} rels e.g. `readSurface("src/services/platform/formRuns.js")`
 *   or `readSurface("src/app/platform/runs/page.js", "src/components/platform/runs")`
 * @returns {string}
 */
function readSurface(...rels) {
  const parts = [];
  for (const rel of rels) {
    parts.push(readPath(rel));
    // The split convention: `formRuns.js` keeps a sibling `formRuns/` folder.
    if (!path.isAbsolute(rel) && rel.endsWith(".js")) {
      parts.push(readPath(rel.slice(0, -3)));
    }
  }
  return parts.filter(Boolean).join("\n");
}

module.exports = { SRC, readPath, readSurface };
