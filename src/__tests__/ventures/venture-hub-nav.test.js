/**
 * @jest-environment jsdom
 *
 * One navigation bar on every page of a Venture (Super Admin): the tabs take you
 * anywhere, the active one follows the address, and pages carry no "back to…".
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
jest.mock("@/components/admin/ventures/AddLeadManagerModal", () => function AddLeadManagerModal() { return null; });

const { I18nProvider } = require("@/lib/i18n");
const { clearResponseCache } = require("@/lib/hooks/useApi");
const VentureHubNav = require("@/components/admin/ventures/VentureHubNav").default;

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

test("the bar carries the Venture's name and every destination as a link", async () => {
  view();
  expect(await screen.findByText("AgroTech")).toBeTruthy();
  const hrefs = screen.getAllByRole("link").map((link) => link.getAttribute("href"));
  expect(hrefs).toEqual(expect.arrayContaining([
    "/admin/ventures/VNT-1",
    "/admin/ventures/VNT-1/journey",
    "/admin/ventures/VNT-1/investment",
    "/admin/ventures/VNT-1/reports",
    "/admin/ventures/VNT-1/documents",
    "/admin/ventures/VNT-1?tab=activity",
    "/admin/ventures/VNT-1?tab=profile",
    "/admin/ventures/VNT-1?tab=team",
    "/admin/ventures/VNT-1/projects",
  ]));
});

test("the way back to the list of Ventures is there, once", async () => {
  view();
  const back = await screen.findByRole("link", { name: /Back to Ventures|Retour/i });
  expect(back.getAttribute("href")).toBe("/admin/ventures");
});

test("the active tab follows the address", () => {
  mockPath = "/admin/ventures/VNT-1/journey";
  view();
  expect(current()).toEqual(["/admin/ventures/VNT-1/journey"]);
});

test("on the hub the tab comes from ?tab=", () => {
  mockTab = "profile";
  view();
  expect(current()).toEqual(["/admin/ventures/VNT-1?tab=profile"]);
});

test("on the Project page the Project button is the current one", () => {
  mockPath = "/admin/ventures/VNT-1/projects";
  view();
  expect(current()).toEqual(["/admin/ventures/VNT-1/projects"]);
});

test("the Venture's layout renders the bar once for every page, and no page has its own back link", () => {
  const root = path.join(process.cwd(), "src/app/admin/ventures/[id]");
  expect(fs.readFileSync(path.join(root, "layout.js"), "utf8")).toContain("<VentureHubNav id={id} />");
  const pages = fs.readdirSync(root, { withFileTypes: true }).filter((entry) => entry.isDirectory())
    .map((entry) => path.join(root, entry.name, "page.js")).filter((file) => fs.existsSync(file));
  expect(pages.length).toBeGreaterThan(10);
  for (const file of pages) {
    const source = fs.readFileSync(file, "utf8");
    expect(source).not.toContain("ArrowLeft");
  }
});
