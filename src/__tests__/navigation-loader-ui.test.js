/**
 * @jest-environment jsdom
 *
 * GLOBAL NAVIGATION LOADER — component tests
 *
 * The bar is deliberately lazy (a grace period) and self-healing (a safety
 * timeout), and both are timers attached to the DOCUMENT, next to the click
 * listener that starts them. Two properties matter about that arrangement, and
 * neither is visible from the rendered output alone:
 *
 *   - a click on an internal link starts a navigation, and the bar appears only
 *     after the grace period (a fast navigation must never flash it);
 *   - unmounting DETACHES the listener — the component must leave nothing
 *     behind on the document it borrowed.
 *
 * `usePathname` is stubbed to match jsdom's own address ("/"), which is the
 * arrangement the component sees in the browser: the address it reads from the
 * window and the one it reads from the router agree.
 */

import { act, render } from "@testing-library/react";

const mockPath = { current: "/" };
jest.mock("next/navigation", () => ({
  usePathname: () => mockPath.current,
  useSearchParams: () => new URLSearchParams(""),
}));

const NavigationLoader = require("@/components/ui/NavigationLoader").default;

describe("NavigationLoader", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockPath.current = "/";
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  test("an internal link click shows the bar only after the grace period", () => {
    const { container, unmount } = render(<NavigationLoader />);
    // Nothing is shown until a navigation actually starts.
    expect(container.firstChild).toBeNull();

    const link = document.createElement("a");
    link.setAttribute("href", "/b");
    document.body.appendChild(link);
    link.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true }),
    );

    // The click only arms the grace timer — a fast navigation shows no bar.
    expect(container.firstChild).toBeNull();

    act(() => {
      jest.advanceTimersByTime(250);
    });
    expect(container.firstChild).not.toBeNull();

    unmount();
    link.remove();
  });

  test("an external link is ignored", () => {
    const { container, unmount } = render(<NavigationLoader />);

    const link = document.createElement("a");
    link.setAttribute("href", "https://example.com/elsewhere");
    document.body.appendChild(link);
    link.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true }),
    );

    act(() => {
      jest.advanceTimersByTime(1000);
    });
    // A full page load is not a client navigation: the bar never appears.
    expect(container.firstChild).toBeNull();

    unmount();
    link.remove();
  });

  test("unmounting detaches the document click listener", () => {
    const add = jest.spyOn(document, "addEventListener");
    const remove = jest.spyOn(document, "removeEventListener");
    const { unmount } = render(<NavigationLoader />);

    const clickHandler = add.mock.calls.find(([type]) => type === "click")?.[1];
    expect(typeof clickHandler).toBe("function");

    unmount();

    expect(
      remove.mock.calls.some(
        ([type, handler]) => type === "click" && handler === clickHandler,
      ),
    ).toBe(true);

    add.mockRestore();
    remove.mockRestore();
  });
});
