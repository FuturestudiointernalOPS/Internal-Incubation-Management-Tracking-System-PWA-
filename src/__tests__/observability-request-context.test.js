/**
 * OBSERVABILITY — request correlation (regression tests).
 *
 * The guarantee under test: a request id exists for the whole life of a request,
 * is visible to code that never receives it as an argument (a module called
 * several layers down), and comes back on the response so a user-facing failure
 * can be matched to its log lines.
 */

const {
  newRequestId,
  runWithRequestContext,
  getRequestContext,
  getRequestId,
  setRequestContext,
  withRequestContext,
} = require("@/lib/request-context");
const { NextResponse } = require("next/server");

/** A module that is several calls away and knows nothing about HTTP. */
async function deeplyNestedRead() {
  await Promise.resolve();
  return { requestId: getRequestId(), route: getRequestContext()?.route };
}

describe("the ambient context", () => {
  test("outside a request there is no id — and nothing throws", () => {
    expect(getRequestId()).toBeNull();
    expect(getRequestContext()).toBeNull();
    expect(setRequestContext({ userId: "U-1" })).toBe(false);
  });

  test("an id generated per call is a non-empty string", () => {
    const a = newRequestId();
    const b = newRequestId();
    expect(typeof a).toBe("string");
    expect(a.length).toBeGreaterThan(0);
    expect(a).not.toBe(b);
  });

  test("the context follows awaited code that never received it", async () => {
    await runWithRequestContext({ requestId: "req-1", route: "/api/x" }, async () => {
      const seen = await deeplyNestedRead();
      expect(seen.requestId).toBe("req-1");
      expect(seen.route).toBe("/api/x");
    });
  });

  test("nested contexts do not leak into the parent", async () => {
    await runWithRequestContext({ requestId: "outer" }, async () => {
      await runWithRequestContext({ requestId: "inner" }, async () => {
        expect(getRequestId()).toBe("inner");
      });
      expect(getRequestId()).toBe("outer");
    });
  });

  test("the active context can be enriched once the user is known", () => {
    runWithRequestContext({ requestId: "req-2" }, () => {
      expect(setRequestContext({ userId: "USR-7" })).toBe(true);
      expect(getRequestContext().userId).toBe("USR-7");
    });
  });
});

describe("withRequestContext — route wrapping", () => {
  test("echoes a fresh id on the response and exposes it to the handler", async () => {
    const handler = withRequestContext(async () => {
      const res = NextResponse.json({ success: true });
      res.headers.set("seen", getRequestId());
      return res;
    });

    const res = await handler(new Request("http://localhost/api/thing"));

    const id = res.headers.get("x-request-id");
    expect(typeof id).toBe("string");
    expect(id.length).toBeGreaterThan(0);
    expect(res.headers.get("seen")).toBe(id);
  });

  test("reuses an incoming x-request-id so a caller can trace end to end", async () => {
    const handler = withRequestContext(async () => NextResponse.json({ ok: true }));

    const res = await handler(
      new Request("http://localhost/api/thing", {
        headers: { "x-request-id": "from-upstream-123" },
      }),
    );

    expect(res.headers.get("x-request-id")).toBe("from-upstream-123");
  });

  test("works with a request shape that has no headers (never throws)", async () => {
    const handler = withRequestContext(async () => ({ plain: true }));
    await expect(handler({})).resolves.toEqual({ plain: true });
  });
});
