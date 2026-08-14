/**
 * Stub for the ESM-only `uuid` package (v13).
 *
 * Jest's CJS transform does not parse pure-ESM packages inside
 * node_modules. Tests that load modules importing `uuid` resolve it
 * through this stub instead of the real ESM package.
 */
module.exports = {
  v4: () => "mock-uuid-00000000000000000000000000000000",
  v1: () => "mock-uuid-v1-00000000000000000000000000000000",
  validate: (v) => typeof v === "string",
};
