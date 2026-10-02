/**
 * The Permission Center SOURCE SURFACE, for the text-contract suites.
 *
 * `PermissionCenter.js` used to be one 4 884-line file, and several suites pin
 * its TEXT — that the screens contain no hardcoded hex, that no legacy tab bar
 * survived, that exactly two table-heavy surfaces still have their `md:` twin.
 * Those guards are about the WHOLE SCREEN, not about one component.
 *
 * So when the monolith is split across `permission-center/`, a guard that still
 * reads only the shim would go vacuously green: the offending code would move
 * into a new file and the assertion would still pass, because the shim no
 * longer contains it. A guard that quietly stops guarding is worse than no guard.
 *
 * This helper is the fix, and it is the reason the split can be reviewed:
 *
 *   readPermissionCenterSurface()  the shim PLUS every module under
 *                                  `permission-center/`, concatenated verbatim.
 *                                  Global invariants read THIS, so they cover
 *                                  exactly the same bytes they covered before
 *                                  the split — nothing weaker.
 *
 *   readPermissionCenterFile(rel) one module's own text. Behaviour-specific
 *                                  assertions read THIS, which makes them
 *                                  STRONGER than before: the assertion is
 *                                  attached to the file that owns the code, so
 *                                  duplicating the behaviour elsewhere no
 *                                  longer passes.
 *
 * Concatenation, not a bundle: the suites assert with multi-line regexes
 * (`/const allSections = groupModulesByFeature\(/` and friends), so the bytes
 * have to stay contiguous exactly as prettier left them. Each file is included
 * verbatim and separated by a newline; nothing is reformatted, reordered
 * internally, or stripped.
 */

const fs = require("node:fs");
const path = require("node:path");

const SRC = path.join(__dirname, "..", "..");
const PERMISSIONS = path.join(SRC, "components", "permissions");
const SHIM = path.join(PERMISSIONS, "PermissionCenter.js");
const EXTRACTED = path.join(PERMISSIONS, "permission-center");

/** Every `.js` under `permission-center/`, sorted so the order is stable. */
function extractedFiles() {
  if (!fs.existsSync(EXTRACTED)) return [];
  const out = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(".js")) out.push(full);
    }
  };
  walk(EXTRACTED);
  return out.sort();
}

/**
 * The shim + every extracted module, as one string.
 *
 * @param {{skipShim?: boolean}} [options] skip the shim, to assert on the
 *   extracted modules alone
 * @returns {string}
 */
function readPermissionCenterSurface({ skipShim = false } = {}) {
  const parts = skipShim ? [] : [fs.readFileSync(SHIM, "utf8")];
  for (const file of extractedFiles()) parts.push(fs.readFileSync(file, "utf8"));
  return parts.join("\n");
}

/**
 * One module's own text, addressed relative to `src/components/permissions/`.
 *
 * @param {string} rel e.g. `"permission-center/EligibilityView.js"`
 * @returns {string}
 */
function readPermissionCenterFile(rel) {
  return fs.readFileSync(path.join(PERMISSIONS, rel), "utf8");
}

/** Occurrences of a needle in a blob — the counting helper the guards use. */
function count(haystack, needle) {
  return haystack.split(needle).length - 1;
}

module.exports = {
  SHIM,
  EXTRACTED,
  extractedFiles,
  readPermissionCenterSurface,
  readPermissionCenterFile,
  count,
};