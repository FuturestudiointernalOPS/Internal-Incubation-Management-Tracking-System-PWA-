/**
 * @jest-environment jsdom
 *
 * The reading hook's contract, as the screens that use it depend on it.
 *
 * First, its failure reporting. `error` has always carried the MESSAGE of a
 * request that threw. It could not carry the STATUS, so a screen had no way to
 * tell an expired session (401) from a server fault (500) - it saw the same
 * silence for both. `status` is that missing distinction, and these tests pin its
 * three readings: a number when the server answered, null when it never did, and
 * null again the moment the screen moves to another address.
 *
 * Second, how many times it reads. A hook whose effect re-runs on every render
 * turns one screen into a request flood, and it does so silently - the screen
 * looks right. The counts below are the guard against that, because the two ways
 * to cause it are both things a caller writes without thinking.
 */

import { renderHook, waitFor } from "@testing-library/react";
import { useApi, fetchJsonEnvelope, fetchJsonShared } from "@/lib/hooks/useApi";

function jsonResponse(body, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  });
}

beforeEach(() => {
  global.fetch = jest.fn();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("useApi — the status of the last response", () => {
  it("reports the status of a successful read", async () => {
    global.fetch.mockImplementation(() =>
      jsonResponse({ success: true, things: [1, 2] }),
    );

    const { result } = renderHook(() => useApi("/api/status-ok"));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.status).toBe(200);
    expect(result.current.error).toBeNull();
    expect(result.current.data).toEqual({ success: true, things: [1, 2] });
  });

  it("reports 401, which is how a screen knows the session expired", async () => {
    global.fetch.mockImplementation(() =>
      jsonResponse({ success: false, error: "Unauthenticated" }, 401),
    );

    const { result } = renderHook(() => useApi("/api/status-401"));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.status).toBe(401);
    // The distinction that matters: a refusal is NOT a request that failed to
    // complete, so no message is reported as a network error.
    expect(result.current.error).toBeNull();
  });

  it("reports 500, which is what separates a server fault from an expiry", async () => {
    global.fetch.mockImplementation(() =>
      jsonResponse({ success: false, error: "boom" }, 500),
    );

    const { result } = renderHook(() => useApi("/api/status-500"));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.status).toBe(500);
    expect(result.current.error).toBeNull();
  });

  it("reports no status at all when the request never got an answer", async () => {
    const silence = jest.spyOn(console, "error").mockImplementation(() => {});
    global.fetch.mockImplementation(() => Promise.reject(new Error("offline")));

    const { result } = renderHook(() => useApi("/api/status-network"));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.status).toBeNull();
    expect(result.current.error).toBe("offline");
    silence.mockRestore();
  });

  it("stops reporting the previous address's verdict once the address changes", async () => {
    global.fetch.mockImplementation((url) => {
      if (url === "/api/status-first") {
        return jsonResponse({ success: false }, 403);
      }
      // The second address never answers, so the only thing under test is
      // whether the first address's 403 is still being reported.
      return new Promise(() => {});
    });

    const { result, rerender } = renderHook(({ url }) => useApi(url), {
      initialProps: { url: "/api/status-first" },
    });

    await waitFor(() => expect(result.current.status).toBe(403));

    rerender({ url: "/api/status-second" });
    expect(result.current.status).toBeNull();
  });

  it("reads the same address as null while it is still unanswered", async () => {
    global.fetch.mockImplementation(() => new Promise(() => {}));

    const { result } = renderHook(() => useApi("/api/status-pending"));

    expect(result.current.status).toBeNull();
    expect(result.current.loading).toBe(true);
  });
});

describe("how many times it reads", () => {
  const listTransform = (payload) => (payload?.success ? payload.things || [] : []);

  // Both of these are the natural thing to write, and both of them gave the
  // default a new identity on every render. While that identity was a dependency
  // of the read, the effect re-ran on every render, and every re-run put another
  // request on the wire - twenty-six of them for one screen in the measurement
  // that found this.
  const inlineDefaults = [
    ["an empty array", () => []],
    ["an empty object", () => ({})],
  ];

  it.each(inlineDefaults)(
    "reads once when the default is %s written inline",
    async (_label, makeDefault) => {
      global.fetch.mockImplementation(() =>
        jsonResponse({ success: true, things: [1] }),
      );

      const { result } = renderHook(() =>
        useApi(`/api/read-count-${_label}`, {
          defaultValue: makeDefault(),
          transform: listTransform,
        }),
      );

      await waitFor(() => expect(result.current.loading).toBe(false));
      // Long enough for a runaway effect to have fired several times.
      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(result.current.data).toEqual([1]);
    },
  );

  it("reads once when the identical answer arrives again", async () => {
    global.fetch.mockImplementation(() =>
      jsonResponse({ success: true, things: [1] }),
    );

    const { result } = renderHook(() =>
      useApi("/api/read-count-stable", {
        defaultValue: [],
        transform: listTransform,
      }),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    // A refresh bypasses the cache, so this one DOES go to the network.
    await result.current.refresh();
    const afterRefresh = global.fetch.mock.calls.length;
    await new Promise((resolve) => setTimeout(resolve, 150));

    expect(global.fetch.mock.calls.length).toBe(afterRefresh);
  });

  it("reads once when the transform is written inline", async () => {
    global.fetch.mockImplementation(() =>
      jsonResponse({ success: true, things: [1] }),
    );

    const { result } = renderHook(() =>
      useApi("/api/read-count-inline-transform", {
        defaultValue: [],
        // A fresh function identity on every render, which is what a caller gets
        // by writing the transform at the call site. This is the third way to put
        // the read back on the wire once per render.
        transform: (payload) => (payload?.success ? payload.things || [] : []),
      }),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    // Long enough for a runaway effect to have fired several times.
    await new Promise((resolve) => setTimeout(resolve, 150));

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(result.current.data).toEqual([1]);
  });
});

describe("the caller's deps", () => {
  const pickThings = (payload) => (payload?.success ? payload.things || [] : []);

  // `deps` is spread into the read's dependency list, so the read is re-issued
  // exactly when one of the values changes. Both halves of that contract matter:
  // a value that changes must re-read, and a fresh array carrying the SAME values
  // - the natural thing to write inline - must not. Pinning them here is what
  // keeps a future change to the spread (a JSON key, a memoised list) honest.
  it("reads again when a dependency's value changes", async () => {
    global.fetch.mockImplementation(() =>
      jsonResponse({ success: true, things: [1] }),
    );

    const { result, rerender } = renderHook(
      ({ dep }) =>
        useApi("/api/deps-change", { deps: [dep], transform: pickThings }),
      { initialProps: { dep: "a" } },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    const before = global.fetch.mock.calls.length;

    rerender({ dep: "b" });

    await waitFor(() =>
      expect(global.fetch.mock.calls.length).toBeGreaterThan(before),
    );
  });

  it("does not read again when a new array carries the same values", async () => {
    global.fetch.mockImplementation(() =>
      jsonResponse({ success: true, things: [1] }),
    );

    const { result, rerender } = renderHook(
      ({ dep }) =>
        useApi("/api/deps-stable", { deps: [dep], transform: pickThings }),
      { initialProps: { dep: "a" } },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    const before = global.fetch.mock.calls.length;

    // A NEW array, same contents: React compares the contents of the spread
    // list, so this must not put another request on the wire.
    rerender({ dep: "a" });
    await new Promise((resolve) => setTimeout(resolve, 150));

    expect(global.fetch.mock.calls.length).toBe(before);
  });
});

describe("the shared GET, in its two forms", () => {
  it("returns the body from fetchJsonShared and the status from fetchJsonEnvelope", async () => {
    global.fetch.mockImplementation(() =>
      jsonResponse({ success: true, value: 7 }, 201),
    );

    const body = await fetchJsonShared("/api/shared-a");
    expect(body).toEqual({ success: true, value: 7 });

    const envelope = await fetchJsonEnvelope("/api/shared-a");
    expect(envelope).toEqual({
      body: { success: true, value: 7 },
      status: 201,
      ok: true,
    });
  });

  it("puts one request on the wire between both forms asked at the same instant", async () => {
    global.fetch.mockImplementation(() =>
      jsonResponse({ success: true }, 200),
    );

    const [body, envelope] = await Promise.all([
      fetchJsonShared("/api/shared-b"),
      fetchJsonEnvelope("/api/shared-b"),
    ]);

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(body).toEqual({ success: true });
    expect(envelope.status).toBe(200);
  });
});

describe("request options", () => {
  it("passes them to the request, and keeps nothing to share", async () => {
    global.fetch.mockImplementation(() =>
      jsonResponse({ success: true, value: 1 }),
    );

    const first = await fetchJsonEnvelope("/api/options-a", {
      cache: "no-store",
    });
    await fetchJsonEnvelope("/api/options-a", { cache: "no-store" });

    expect(first.status).toBe(200);
    // Two requests, because an answer the caller asked not to be kept must not be
    // handed to, or taken from, anybody else.
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(global.fetch).toHaveBeenLastCalledWith("/api/options-a", {
      cache: "no-store",
    });
  });

  it("keeps sharing for callers that pass none", async () => {
    global.fetch.mockImplementation(() =>
      jsonResponse({ success: true, value: 1 }),
    );

    await Promise.all([
      fetchJsonEnvelope("/api/options-b"),
      fetchJsonEnvelope("/api/options-b"),
    ]);

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
