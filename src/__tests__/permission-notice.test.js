/**
 * @jest-environment jsdom
 *
 * WHAT A REFUSED ACTION SAYS — and how the notice is presented.
 *
 * Two defects are pinned here:
 *
 *   1. A request the server answered 403 on permission grounds used to fail
 *      SILENTLY. The screen that fired it has no error text to show, so the
 *      person was left with a button that did nothing. The global request
 *      interceptor now raises the app's toast for that vocabulary — and ONLY
 *      for it: a 403 for another reason (a cross-site block, say) must stay
 *      quiet, because the notice claims a permission problem.
 *
 *   2. The toast TRUNCATED a long message and expired before it could be read.
 *      The message is allowed to wrap now, the default showing time is 8s, and
 *      an identical notice already on screen absorbs the newcomer instead of
 *      stacking a duplicate.
 */

import { act, render, screen } from "@testing-library/react";

const GlobalToast = require("@/components/ui/GlobalToast").default;
const ClientErrorReporter =
  require("@/components/ClientErrorReporter").default;

/** The smallest response shape the interceptor touches. */
function fakeResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    clone: () => ({ json: async () => body }),
  };
}

describe("GlobalToast — a long notice is readable and not repeated", () => {
  test("the message wraps instead of being cut off", () => {
    render(<GlobalToast />);
    act(() => {
      window.dispatchEvent(
        new CustomEvent("impactos:notify", {
          detail: {
            type: "error",
            message: "Vous n'avez pas les permissions nécessaires pour cette action.",
          },
        }),
      );
    });

    const node = screen.getByText(
      "Vous n'avez pas les permissions nécessaires pour cette action.",
    );
    expect(node.className).not.toContain("truncate");
    expect(node.className).toContain("break-words");
  });

  test("an identical notice already on screen absorbs the newcomer", () => {
    render(<GlobalToast />);
    act(() => {
      for (let i = 0; i < 3; i += 1) {
        window.dispatchEvent(
          new CustomEvent("impactos:notify", {
            detail: { type: "error", message: "PING" },
          }),
        );
      }
    });

    expect(screen.getAllByText("PING")).toHaveLength(1);
  });

  test("the default showing time is longer than the old 4s", () => {
    const timer = jest.spyOn(window, "setTimeout");
    render(<GlobalToast />);
    act(() => {
      window.dispatchEvent(
        new CustomEvent("impactos:notify", { detail: { message: "HELLO" } }),
      );
    });

    const delays = timer.mock.calls.map(([, delay]) => delay);
    expect(delays).toContain(8000);

    timer.mockRestore();
  });
});

describe("ClientErrorReporter — a permission 403 explains itself", () => {
  let originalFetch;
  let notified;

  beforeEach(() => {
    originalFetch = jest.fn(async () => fakeResponse(200, { success: true }));
    window.fetch = originalFetch;
    notified = jest.fn();
    window.addEventListener("impactos:notify", notified);
  });

  afterEach(() => {
    window.removeEventListener("impactos:notify", notified);
    window.fetch = originalFetch;
  });

  test("the permission vocabulary raises a toast with the translation key", async () => {
    originalFetch.mockResolvedValueOnce(
      fakeResponse(403, {
        success: false,
        error: "errors.insufficientPermissions",
      }),
    );
    render(<ClientErrorReporter />);

    await act(async () => {
      await window.fetch("/api/some-protected-action");
    });

    expect(notified).toHaveBeenCalledTimes(1);
    expect(notified.mock.calls[0][0].detail).toMatchObject({
      type: "error",
      message: "errors.insufficientPermissions",
    });
  });

  test("a 403 for another reason stays silent", async () => {
    originalFetch.mockResolvedValueOnce(
      fakeResponse(403, {
        success: false,
        error: "errors.crossSiteRequestBlocked",
      }),
    );
    render(<ClientErrorReporter />);

    await act(async () => {
      await window.fetch("/api/some-protected-action");
    });

    expect(notified).not.toHaveBeenCalled();
  });
});
