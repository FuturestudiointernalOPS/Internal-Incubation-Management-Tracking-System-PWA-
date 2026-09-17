/**
 * @jest-environment jsdom
 *
 * The reading hook's failure reporting.
 *
 * `error` has always carried the MESSAGE of a request that threw. It could not
 * carry the STATUS, so a screen had no way to tell an expired session (401) from
 * a server fault (500) - it saw the same silence for both. `status` is that
 * missing distinction, and these tests pin its three readings: a number when the
 * server answered, null when it never did, and null again the moment the screen
 * moves to another address.
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
