/**
 * PHASE UI-2a — Context & Scope contracts.
 *
 * The standalone Context & Scope screen was retired with the dead editor. Its
 * route remains a pure forwarder, and the active person detail reads the real
 * scope-check decision. Nothing here pins a deleted screen.
 */

const fs = require("fs");
const path = require("path");

const read = (rel) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");

describe("UI-2a — routes and active wiring", () => {
  test("the retired Context & Scope route forwards to the new homes", () => {
    const src = read("src/app/admin/security/permissions/context-scope/page.js");
    expect(src).toContain("/profiles?sub=contextRoles");
    expect(src).toContain("/eligibility?sub=scope");
    expect(src).toContain("/audit");
    // A pure forwarder: no shell, so this path can never render a navigation.
    expect(src).not.toContain("PermissionShell");
  });

  test("the active person detail uses the real scope-check decision", () => {
    const src = read("src/components/permissions/center/sections/PersonDetail.js");
    expect(src).toContain("/api/engineering/permissions/scope-check");
  });
});
