/**
 * @jest-environment jsdom
 *
 * PortfolioOverview — the view against the route's real answer.
 *
 * The regression this file exists for: the route answers an ENVELOPE,
 * `{ success, portfolio }`, and the view must reach one level down. Aliasing
 * `data` straight to `portfolio` let the not-empty guard pass on a truthy
 * envelope whose arrays were all undefined, so the first render reached
 * `.map()` on nothing and the section fell into its error boundary. The
 * fixture below is that envelope verbatim, not the portfolio on its own —
 * a test given only the inner object would not have caught it.
 *
 * i18n is mocked to echo the key, so a label asserting has to name its key;
 * that keeps the assertions independent of the wording in either locale.
 */

import React from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import { clearResponseCachePrefix } from "@/lib/hooks/useApi";

jest.mock("@/lib/i18n", () => ({
  useI18n: () => ({ t: (key) => key, lang: "en" }),
}));

const PortfolioOverview = require("@/components/ventures/portfolio/PortfolioOverview")
  .default;

const ENDPOINT = "/api/admin/ventures/dashboard";

// Exactly what GET /api/admin/ventures/dashboard returns — envelope and all.
const ENVELOPE = {
  success: true,
  portfolio: {
    total: 12,
    byPhase: [
      { key: "idea", count: 3 },
      { key: "validation", count: 0 },
      { key: "early_traction", count: 0 },
      { key: "growth", count: 4 },
      { key: "scaling", count: 0 },
      { key: null, count: 2 },
    ],
    bySector: [
      { key: "AgriTech", count: 5 },
      { key: null, count: 2 },
    ],
    byReadiness: [
      { level: "not_ready", min: 0, max: 25, count: 2 },
      { level: "early_ready", min: 26, max: 50, count: 0 },
      { level: "investment_ready", min: 51, max: 75, count: 3 },
      { level: "fundraising_ready", min: 76, max: 100, count: 1 },
    ],
    assessed: 6,
    activeParcours: 7,
    calculated_at: "2026-10-08T10:00:00.000Z",
  },
};

const respondWith = (body, status = 200) => {
  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(body),
    }),
  );
};

beforeEach(() => {
  // The endpoint's own prefix: an empty string is rejected outright by
  // clearResponseCachePrefix, so passing one would clear nothing and let a
  // previous test's payload stand in for a fresh read.
  clearResponseCachePrefix(ENDPOINT);
  respondWith(ENVELOPE);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("PortfolioOverview — reading the route's envelope", () => {
  test("renders the numbers it was handed, reaching through the envelope", async () => {
    render(<PortfolioOverview />);

    // Totals from the envelope's inner object: if the view had stopped at
    // `data`, none of these would ever arrive.
    expect(await screen.findByText("12")).toBeTruthy(); // total Ventures
    expect(screen.getByText("7")).toBeTruthy(); // active Parcours

    // A phase label, a sector name and a readiness band — one from each
    // lens, so every `.map()` in the component is exercised.
    expect(screen.getByText("vadmin.detail.stageIdea")).toBeTruthy();
    expect(screen.getByText("AgriTech")).toBeTruthy();
    expect(screen.getByText("vadmin.portfolio.levels.not_ready")).toBeTruthy();

    // The failure card must not have been chosen over the real data.
    expect(screen.queryByText("vadmin.portfolio.loadFailed")).toBeNull();

    // And it asked at the address the route actually serves: a typo here
    // would only surface in a browser as a 404 behind the failure card.
    expect(global.fetch.mock.calls[0][0]).toBe(ENDPOINT);

    // The read settles its loading flag after the data lands; flush it here
    // rather than letting it arrive between tests, unwrapped.
    await act(async () => {});
  });

  test("keeps empty buckets visible rather than dropping them", async () => {
    render(<PortfolioOverview />);

    // findBy rather than getBy: the data arrives from the mocked fetch, so
    // this must wait for it instead of leaning on the previous test's cache.
    // validation has 0 Ventures and fundraising_ready counts 1; an empty
    // bucket still has to be on the page.
    expect(
      await screen.findByText("vadmin.detail.stageValidation"),
    ).toBeTruthy();
    expect(
      screen.getByText("vadmin.portfolio.levels.fundraising_ready"),
    ).toBeTruthy();
    await act(async () => {});
  });

  test("offers the failure card when the read answers an error", async () => {
    respondWith({ success: false, error: "errors.authRequired" }, 401);

    render(<PortfolioOverview />);

    expect(
      await screen.findByText("vadmin.portfolio.loadFailed"),
    ).toBeTruthy();
    expect(screen.queryByText("12")).toBeNull();
    await act(async () => {});
  });

  test("offers the failure card when the read answers nothing at all", async () => {
    // useApi logs a failed read on purpose; that is its own signal and not
    // this file's subject, so the expected noise is kept out of the report.
    const noisy = jest.spyOn(console, "error").mockImplementation(() => {});
    global.fetch = jest.fn(() => Promise.reject(new Error("network down")));

    render(<PortfolioOverview />);

    await waitFor(() =>
      expect(screen.getByText("vadmin.portfolio.loadFailed")).toBeTruthy(),
    );
    await act(async () => {});
    noisy.mockRestore();
  });
});
