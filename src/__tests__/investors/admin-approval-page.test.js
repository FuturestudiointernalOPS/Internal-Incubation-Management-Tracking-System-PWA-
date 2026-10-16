/**
 * @jest-environment jsdom
 *
 * Admin → Investors: tab counts stay right on every tab, approve / reject /
 * suspend ask first (they e-mail the investor), and a failure is announced.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const mockConfirm = jest.fn(async () => true);
jest.mock("@/components/ui/DialogProvider", () => ({ useDialogs: () => ({ confirm: mockConfirm }) }));
jest.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams("") }));
jest.mock("@/lib/hooks/useSessionUser", () => ({ useSessionUser: () => ({ role: "admin" }) }));

const { I18nProvider } = require("@/lib/i18n");
const { clearResponseCache } = require("@/lib/hooks/useApi");
const Page = require("@/app/admin/investors/page").default;

const all = [
  { id: "p1", name: "Awa", organization_name: "Awa Capital", email: "a@x.org", approval_status: "pending_review" },
  { id: "p2", name: "Kofi", organization_name: "Kofi Fund", email: "k@x.org", approval_status: "approved" },
  { id: "p3", name: "Zed", organization_name: "Zed LP", email: "z@x.org", approval_status: "approved" },
];

let posts;
let notices;
let postReply;
const onNotify = (e) => notices.push(e.detail);

beforeEach(() => {
  clearResponseCache();
  mockConfirm.mockReset();
  mockConfirm.mockResolvedValue(true);
  posts = [];
  notices = [];
  postReply = { success: true };
  window.addEventListener("impactos:notify", onNotify);
  global.fetch = jest.fn((url, options = {}) => {
    if (options.method === "POST") {
      posts.push(JSON.parse(options.body));
      return Promise.resolve({ ok: true, json: () => Promise.resolve(postReply) });
    }
    const status = new URL(String(url), "http://x").searchParams.get("status");
    const rows = status === "approved" ? all.filter((i) => i.approval_status === "approved") : all;
    return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, investors: rows }) });
  });
});
afterEach(() => window.removeEventListener("impactos:notify", onNotify));

const renderPage = () => render(<I18nProvider><Page /></I18nProvider>);

test("tab counts do not collapse when a tab is selected", async () => {
  renderPage();
  await screen.findByText("Awa Capital");
  fireEvent.click(screen.getByRole("button", { name: /Approved|Approuvé/ }));
  await waitFor(() => expect(screen.queryByText("Awa Capital")).toBeNull());
  const all_ = screen.getByRole("button", { name: /^(All|Tous)/ });
  expect(all_.textContent).toMatch(/3$/);
  expect(screen.getByRole("button", { name: /Pending|Attente/ }).textContent).toMatch(/1$/);
});

test("approving asks first, posts once and confirms with a toast", async () => {
  renderPage();
  await screen.findByText("Awa Capital");
  fireEvent.click(screen.getByRole("button", { name: /^(Approve|Approuver)$/ }));
  await waitFor(() => expect(posts).toEqual([{ profile_id: "p1", action: "approve" }]));
  expect(mockConfirm).toHaveBeenCalledTimes(1);
  await waitFor(() => expect(notices.some((n) => n.type === "success")).toBe(true));
});

test("declining the confirmation sends nothing", async () => {
  mockConfirm.mockResolvedValue(false);
  renderPage();
  await screen.findByText("Awa Capital");
  fireEvent.click(screen.getByRole("button", { name: /^(Reject|Rejeter)$/ }));
  await waitFor(() => expect(mockConfirm).toHaveBeenCalled());
  expect(mockConfirm.mock.calls[0][0].tone).toBe("danger");
  expect(posts).toEqual([]);
});

test("a refused action and a network failure are both announced", async () => {
  postReply = { success: false, error: "" };
  renderPage();
  await screen.findByText("Awa Capital");
  fireEvent.click(screen.getByRole("button", { name: /^(Approve|Approuver)$/ }));
  await waitFor(() => expect(notices.some((n) => n.type === "error")).toBe(true));

  notices.length = 0;
  global.fetch = jest.fn((url, options = {}) =>
    options.method === "POST"
      ? Promise.reject(new Error("offline"))
      : Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, investors: all }) }));
  fireEvent.click(screen.getByRole("button", { name: /^(Approve|Approuver)$/ }));
  await waitFor(() => expect(notices.some((n) => n.type === "error")).toBe(true));
});
