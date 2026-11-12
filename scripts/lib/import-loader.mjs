/**
 * Minimal Node resolve hook so the real authorization modules can run inside
 * plain Node scripts (no Next.js runtime available):
 *
 *   - `@/...`          → <project>/src/...
 *   - `next/headers`   → local stub (scripts/lib/stubs/next-headers.mjs)
 *   - `next/server`    → local stub (scripts/lib/stubs/next-server.mjs)
 *   - extensionless relative imports (Next-style) → append `.js`
 *
 * Used by scripts/dryrun-eligibility-policy.mjs via module.register().
 */
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "next/headers" || specifier === "next/server") {
    return {
      url: new URL(`./stubs/${specifier.replace("/", "-")}.mjs`, import.meta.url)
        .href,
      shortCircuit: true,
    };
  }
  if (specifier.startsWith("@/")) {
    // Next-style alias: prefer the exact file, fall back to directory
    // resolution (src/<path>/index.js), mirroring Next's resolver.
    const srcBase = fileURLToPath(new URL("../../src/", import.meta.url));
    const relativePath = specifier.slice(2);
    const asFile = `${srcBase}${relativePath}.js`;
    const url = new URL(
      existsSync(asFile) ? `${relativePath}.js` : `${relativePath}/index.js`,
      new URL("../../src/", import.meta.url)
    ).href;
    return { url, shortCircuit: true };
  }
  if (
    (specifier.startsWith("./") || specifier.startsWith("../")) &&
    !/\.(js|jsx|mjs|cjs|json)$/.test(specifier)
  ) {
    // Next-style relative resolution: a file first, then a directory index.
    const base = new URL(specifier, context.parentURL);
    const asFile = new URL(`${base.href}.js`);
    if (existsSync(fileURLToPath(asFile))) {
      return { url: asFile.href, shortCircuit: true };
    }
    const asIndex = new URL(`${base.href.replace(/\/$/, "")}/index.js`);
    if (existsSync(fileURLToPath(asIndex))) {
      return { url: asIndex.href, shortCircuit: true };
    }
    return nextResolve(`${specifier}.js`, context);
  }
  return nextResolve(specifier, context);
}
