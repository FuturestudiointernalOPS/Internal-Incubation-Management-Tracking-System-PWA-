/**
 * Unit tests — the Venture identity contract (Vinance Phase 0).
 *
 * A Venture carries an internal id (`ventures.id`, a UUID) and a decorative
 * code (`ventures.venture_id`, "VNT-…"). The code stays the key routes use; the
 * internal id is what every stored reference must hold. These tests pin the
 * vocabulary (`src/lib/ventureIdentity.js`) so no reader re-derives the `^VNT-`
 * shape on its own and drifts.
 */

const {
  VENTURE_CODE_PREFIX,
  isVentureCode,
  isVentureInternalId,
  ventureRefKind,
} = require("@/lib/ventureIdentity");

describe("ventureIdentity — the code", () => {
  test("the prefix is VNT", () => {
    expect(VENTURE_CODE_PREFIX).toBe("VNT");
  });

  test("a code is recognised by its prefix, case-insensitively", () => {
    expect(isVentureCode("VNT-ABCD1234")).toBe(true);
    expect(isVentureCode("vnt-1")).toBe(true);
  });

  test("anything that is not a code is not one", () => {
    expect(isVentureCode("USR_9ED327DED39F")).toBe(false);
    expect(isVentureCode("0b6f4a2c-1d2e-4f5a-8b9c-0d1e2f3a4b5c")).toBe(false);
    expect(isVentureCode("7")).toBe(false);
    expect(isVentureCode(null)).toBe(false);
    expect(isVentureCode(undefined)).toBe(false);
  });
});

describe("ventureIdentity — the internal id", () => {
  test("a UUID is an internal id, a code is not", () => {
    expect(isVentureInternalId("0b6f4a2c-1d2e-4f5a-8b9c-0d1e2f3a4b5c")).toBe(true);
    expect(isVentureInternalId("VNT-ABCD1234")).toBe(false);
  });

  test("the legacy integer id (a database before the conversion) is still internal", () => {
    expect(isVentureInternalId(7)).toBe(true);
    expect(isVentureInternalId("7")).toBe(true);
  });

  test("empty is neither", () => {
    expect(isVentureInternalId("")).toBe(false);
    expect(isVentureInternalId(null)).toBe(false);
  });
});

describe("ventureIdentity — classification", () => {
  test("a reference is classified as code, internal, or empty", () => {
    expect(ventureRefKind("VNT-ABCD1234")).toBe("code");
    expect(ventureRefKind("0b6f4a2c-1d2e-4f5a-8b9c-0d1e2f3a4b5c")).toBe("internal");
    expect(ventureRefKind("")).toBe("empty");
    expect(ventureRefKind(null)).toBe("empty");
  });
});
