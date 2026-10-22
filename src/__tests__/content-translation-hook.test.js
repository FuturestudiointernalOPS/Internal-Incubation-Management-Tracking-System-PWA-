/**
 * @jest-environment jsdom
 *
 * The client half of content translation: one request per screen, deduplicated.
 *
 * The screen is rendered immediately in its source language and swaps in place
 * when the answer lands — no spinner, no blank, no layout jump. What this suite
 * pins is the part that makes that affordable and that can regress silently:
 *
 *   1. the texts of the WHOLE payload travel in ONE batched request (deduped),
 *      not one per field and not one per row;
 *   2. the Venture travels with them, because the server checks the reader may
 *      see it;
 *   3. re-rendering the same payload does not ask again;
 *   4. without a Venture there is no request at all (nothing to authorize).
 */
import { renderHook, waitFor } from "@testing-library/react";

jest.mock("@/lib/i18n", () => ({ useI18n: () => ({ lang: "fr" }) }));

const { useContentTranslation } = require("@/lib/hooks/useContentTranslation");

const PATHS = ["items[].title", "items[].activity", "items[].deliverable"];

const PAYLOAD = {
  items: [
    { title: "Discovery", activity: "Discovery", deliverable: "Report" },
    { title: "Discovery", activity: "Validate", deliverable: "Report" },
  ],
};

let calls;

beforeEach(() => {
  calls = [];
  global.fetch = jest.fn(async (_url, init) => {
    const body = JSON.parse(init.body);
    calls.push(body);
    const translations = Object.fromEntries((body.texts || []).map((text) => [text, `fr:${text}`]));
    return { ok: true, json: async () => ({ success: true, translations }) };
  });
});

afterEach(() => {
  jest.clearAllMocks();
});

test("the whole payload travels in one deduplicated request", async () => {
  const { result } = renderHook(() =>
    useContentTranslation(PAYLOAD, PATHS, { ventureId: "VNT-1" }),
  );

  // The source text is what the first paint shows.
  expect(result.current.tv("Discovery")).toBe("Discovery");

  await waitFor(() => expect(result.current.tv("Discovery")).toBe("fr:Discovery"));

  expect(calls).toHaveLength(1);
  expect(calls[0]).toEqual({
    texts: ["Discovery", "Validate", "Report"],
    sourceLang: "en",
    targetLang: "fr",
    ventureId: "VNT-1",
  });
  expect(result.current.tv("Validate")).toBe("fr:Validate");
  expect(result.current.translating).toBe(false);
});

test("a text without a translation keeps its source wording", async () => {
  const { result } = renderHook(() =>
    useContentTranslation(PAYLOAD, PATHS, { ventureId: "VNT-1" }),
  );

  await waitFor(() => expect(result.current.tv("Discovery")).toBe("fr:Discovery"));

  expect(result.current.tv("VNT-12")).toBe("VNT-12");
  expect(result.current.tv(null)).toBe(null);
  expect(result.current.tv("")).toBe("");
});

test("re-rendering the same payload does not ask again", async () => {
  const { result, rerender } = renderHook(() =>
    useContentTranslation(PAYLOAD, PATHS, { ventureId: "VNT-1" }),
  );

  await waitFor(() => expect(result.current.tv("Discovery")).toBe("fr:Discovery"));
  rerender();
  rerender();

  expect(calls).toHaveLength(1);
});

test("without a Venture nothing is requested: there is nothing to authorize", async () => {
  const { result } = renderHook(() => useContentTranslation(PAYLOAD, PATHS));

  // Give the effect a turn; nothing should be on the wire.
  await Promise.resolve();

  expect(calls).toHaveLength(0);
  expect(result.current.tv("Discovery")).toBe("Discovery");
  expect(result.current.translating).toBe(false);
});
