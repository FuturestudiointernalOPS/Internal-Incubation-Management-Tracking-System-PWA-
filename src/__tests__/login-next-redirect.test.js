/**
 * PAYER → COURSE — the `next` destination contract.
 *
 * After a payment the payer must land DIRECTLY in the course, through either
 * door:
 *
 *   new account      → /setup-password/<token>?next=/participant/learning/<id>
 *                      → (password chosen) → /login?next=... → the course
 *   existing account → /login?next=/participant/learning/<id> → the course
 *
 * Two guarantees are pinned here:
 *   - the `next` value is a SAFE INTERNAL path (never an off-site redirect);
 *   - the link chain actually carries it, from the server that mints it to the
 *     client pages that consume it.
 */
const fs = require("fs");
const path = require("path");

const { safeNextPath } = require("@/lib/safeNextPath");
const { readSurface } = require("./helpers/sourceSurface");

const read = (relativePath) => fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");

const COURSE_ID = "crs-1";
const ENCODED_NEXT = encodeURIComponent(`/participant/learning/${COURSE_ID}`);

describe("an explicit `next` is only ever an INTERNAL path", () => {
  test("a bare path is accepted", () => {
    expect(safeNextPath("/participant/learning/crs-1")).toBe("/participant/learning/crs-1");
    expect(safeNextPath("/courses/venture-2026")).toBe("/courses/venture-2026");
  });

  test("anything that could leave the site is refused", () => {
    // Absolute URL.
    expect(safeNextPath("https://evil.example/steal")).toBeNull();
    // Protocol-relative host — the browser follows it off-site.
    expect(safeNextPath("//evil.example/steal")).toBeNull();
    // Backslash variant of the same trick.
    expect(safeNextPath("/\\evil.example/steal")).toBeNull();
    // A scheme hidden inside an otherwise path-looking value.
    expect(safeNextPath("/redirect?to=https://evil.example")).toBeNull();
  });

  test("a missing or non-path value is refused", () => {
    expect(safeNextPath(null)).toBeNull();
    expect(safeNextPath(undefined)).toBeNull();
    expect(safeNextPath("")).toBeNull();
    expect(safeNextPath("participant/learning/crs-1")).toBeNull();
    expect(safeNextPath(42)).toBeNull();
  });
});

describe("the server mints links that carry the course destination", () => {
  test("the setup-password link carries an encoded `next`", () => {
    // The link builder moved to the service with the checkout decision, and
    // then into the `checkout/` split — readSurface keeps the pin covering it.
    const src = readSurface("src/services/lms/checkout.js");
    // One shared builder, reused by both setup-password exits.
    expect(src).toMatch(/function setupPasswordUrl\(token, courseId\)/);
    expect(src).toContain("?next=${encodeURIComponent(learningPath(courseId))}");
    expect(src).toMatch(/setupPasswordUrl\(fulfillment\.accessToken, registration\.course_id\)/);
    expect(src).toMatch(/setupPasswordUrl\(token, registration\.course_id\)/);
  });

  test("the checkout email's password link carries the same `next`", () => {
    const src = read("src/lib/lms/checkoutMail.js");
    expect(src).toContain("?next=${encodeURIComponent(`/participant/learning/${registration.course_id}`)}");
  });
});

describe("the client pages consume the destination", () => {
  test("the setup-password page forwards `next` to the login page", () => {
    const src = read("src/app/setup-password/[token]/page.js");
    expect(src).toContain("window.location.search");
    expect(src).toContain("safeNextPath");
    // With a destination the login URL carries it; without one it does not change.
    expect(src).toContain("`/login?next=${encodeURIComponent(requested)}`");
    expect(src).toContain('"/login"');
  });

  test("the login page redirects to the explicit destination, through the guard", () => {
    const src = read("src/app/login/page.js");
    expect(src).toContain("window.location.search");
    expect(src).toMatch(/safeNextPath\(new URLSearchParams\(window\.location\.search\)\.get\("next"\)\)/);
    expect(src).toMatch(/if \(requested\) \{\s*router\.replace\(requested\);\s*return;/);
  });

  test("the encoded course path is the one the server mints", () => {
    expect(ENCODED_NEXT).toBe("%2Fparticipant%2Flearning%2Fcrs-1");
  });
});
