/**
 * SECURITY — Lot 14 (ERR-1: no internal detail in 5xx bodies).
 *
 * Registry finding ERR-1: routes returned `error.message` in their 500 bodies,
 * which can carry driver/SQL/stack detail to the client. A shared `serverError`
 * helper now logs the real error server-side and answers with a stable message.
 */

const fs = require("fs");
const path = require("path");

const read = (file) => fs.readFileSync(path.join(__dirname, "..", "..", file), "utf8");

const { serverError } = require("@/lib/apiError");

describe("serverError never serializes the caught error", () => {
  test("the body carries a stable message, not the driver detail", async () => {
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    const res = serverError(new Error('relation "secret_table" does not exist'));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body).toEqual({ success: false, error: "errors.somethingWrong" });
    expect(JSON.stringify(body)).not.toContain("secret_table");
    // The real error is logged, not returned.
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  test("a caller may override the status and the message", async () => {
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    const res = serverError(new Error("boom"), { status: 502, message: "errors.upstream" });
    const body = await res.json();

    expect(res.status).toBe(502);
    expect(body.error).toBe("errors.upstream");
    spy.mockRestore();
  });
});

describe("the swept routes do not return raw error messages", () => {
  const SWEPT = [
    "src/app/api/program-types/route.js",
    "src/app/api/run-export/route.js",
    "src/app/api/submissions/route.js",
    "src/app/api/team-tasks/route.js",
    "src/app/api/system/database/route.js",
    "src/app/api/webhooks/resend/route.js",
  ];

  test.each(SWEPT)("%s returns no client-visible error.message", (file) => {
    const src = read(file);
    expect(src).not.toMatch(/error: error\.message/);
    expect(src).not.toMatch(/error: err\.message/);
    expect(src).toContain("@/lib/apiError");
  });
});
