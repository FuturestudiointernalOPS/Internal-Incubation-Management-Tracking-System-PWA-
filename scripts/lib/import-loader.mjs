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
export async function resolve(specifier, context, nextResolve) {
  if (specifier === "next/headers" || specifier === "next/server") {
    return {
      url: new URL(`./stubs/${specifier.replace("/", "-")}.mjs`, import.meta.url)
        .href,
      shortCircuit: true,
    };
  }
  if (specifier.startsWith("@/")) {
    return {
      url: new URL(`${specifier.slice(2)}.js`, new URL("../../src/", import.meta.url))
        .href,
      shortCircuit: true,
    };
  }
  if (
    (specifier.startsWith("./") || specifier.startsWith("../")) &&
    !/\.(js|jsx|mjs|cjs|json)$/.test(specifier)
  ) {
    return nextResolve(`${specifier}.js`, context);
  }
  return nextResolve(specifier, context);
}
