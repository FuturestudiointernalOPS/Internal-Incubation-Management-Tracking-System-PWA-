/**
 * @jest-environment jsdom
 *
 * One navigation bar on every view of a Venture (Super Admin): every destination
 * is a tab of ONE address — `/admin/ventures/[id]?tab=…` — and the active tab
 * follows the address. No view adds a path segment: the retired per-view
 * addresses are generated as redirects from the address catalogue.
 */
import { render, screen } from "@testing-library/react";
import fs from "node:fs";
import path from "node:path";

let mockPath = "/admin/ventures/VNT-1";
let mockTab = "";
jest.mock("next/navigation", () => ({
  usePathname: () => mockPath,
  useSearchParams: () => ({ get: (key) => (key === "tab" ? mockTab : null) }),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}));
jest.mock("@/spaces/admin/components/ventures/AddLeadManagerModal", () => function AddLeadManagerModal() { return null; });

const { I18nProvider } = require("@/lib/i18n");
const { clearResponseCache } = require("@/lib/hooks/useApi");
const VentureHubNav = require("@/spaces/admin/components/ventures/VentureHubNav").default;

beforeEach(() => {
  clearResponseCache();
  mockPath = "/admin/ventures/VNT-1";
  mockTab = "";
  global.fetch = jest.fn(() =>
    Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ success: true, venture: { company_name: "AgroTech", venture_id: "VNT-1", business_stage: "idea", created_at: "2026-10-09T10:00:00Z" } }) }),
  );
});

const view = () => render(<I18nProvider><VentureHubNav id="VNT-1" /></I18nProvider>);
const current = () => screen.getAllByRole("link").filter((link) => link.getAttribute("aria-current") === "page").map((link) => link.getAttribute("href"));

test("the bar carries the Venture's name and every destination as a tab of the hub", async () => {
  view();
  expect(await screen.findByText("AgroTech")).toBeTruthy();
  const hrefs = screen.getAllByRole("link").map((link) => link.getAttribute("href"));
  expect(hrefs).toEqual(expect.arrayContaining([
    "/admin/ventures/VNT-1",
    "/admin/ventures/VNT-1?tab=journey",
    "/admin/ventures/VNT-1?tab=investment",
    "/admin/ventures/VNT-1?tab=reports",
    "/admin/ventures/VNT-1?tab=reporting",
    "/admin/ventures/VNT-1?tab=dataRoom",
    "/admin/ventures/VNT-1?tab=activity",
    "/admin/ventures/VNT-1?tab=profile",
    "/admin/ventures/VNT-1?tab=team",
    "/admin/ventures/VNT-1?tab=projects",
  ]));
  // The views that used to be path segments are still reachable — as tabs.
  expect(hrefs).toEqual(expect.arrayContaining([
    "/admin/ventures/VNT-1?tab=verification",
    "/admin/ventures/VNT-1?tab=document-types",
    "/admin/ventures/VNT-1?tab=tasks",
    "/admin/ventures/VNT-1?tab=sessions",
    "/admin/ventures/VNT-1?tab=investors",
    "/admin/ventures/VNT-1?tab=fundraising",
    "/admin/ventures/VNT-1?tab=analytics",
    "/admin/ventures/VNT-1?tab=coaches",
    "/admin/ventures/VNT-1?tab=feedback",
    "/admin/ventures/VNT-1?tab=knowledge",
    "/admin/ventures/VNT-1?tab=history",
    "/admin/ventures/VNT-1?tab=notes",
    "/admin/ventures/VNT-1?tab=permissions",
    "/admin/ventures/VNT-1?tab=edit",
  ]));
});

test("no destination is still written as a path segment", async () => {
  view();
  const hrefs = screen.getAllByRole("link").map((link) => link.getAttribute("href"));
  const segments = hrefs.filter((href) => href && href.startsWith("/admin/ventures/VNT-1/"));
  expect(segments).toEqual([]);
});

test("the way back to the list of Ventures is there, once", async () => {
  view();
  const back = await screen.findByRole("link", { name: /Back to Ventures|Retour/i });
  expect(back.getAttribute("href")).toBe("/admin/ventures");
});

test("the active tab follows ?tab=", () => {
  mockTab = "journey";
  view();
  expect(current()).toEqual(["/admin/ventures/VNT-1?tab=journey"]);
});

test("without ?tab= the Dashboard tab is the current one", () => {
  view();
  expect(current()).toEqual(["/admin/ventures/VNT-1"]);
});

test("the Project button is current on ?tab=projects", () => {
  mockTab = "projects";
  view();
  expect(current()).toEqual(["/admin/ventures/VNT-1?tab=projects"]);
});

test("the retired record views are gone from the page tree — a tab replaced each", () => {
  const root = path.join(process.cwd(), "src/app/admin/ventures/[id]");
  expect(fs.readFileSync(path.join(root, "layout.js"), "utf8")).toContain("<VentureHubNav id={id} />");
  const folders = fs.readdirSync(root, { withFileTypes: true }).filter((entry) => entry.isDirectory());
  expect(folders.map((entry) => entry.name)).toEqual([]);
});
