/**
 * @jest-environment jsdom
 *
 * The super-admin venture dashboard shows the Venture setup percentage next to
 * Stage, Team and the evidence score.
 */
import { fireEvent, render, screen } from "@testing-library/react";

const { I18nProvider } = require("@/lib/i18n");
const { clearResponseCache } = require("@/lib/hooks/useApi");
const HealthSummary = require("@/components/ventures/venture-dashboard/HealthSummary").default;

const data = { venture: { business_stage: "idea" }, team: { active: 1 }, investment_readiness: { score: 4 } };

beforeEach(() => {
  clearResponseCache();
  global.fetch = jest.fn((url) =>
    Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ success: true, progress: { venture_setup: 56 } }),
      url,
    }),
  );
});

test("the Venture setup tile reads the progress endpoint", async () => {
  render(<I18nProvider><HealthSummary data={data} ventureId="VNT-1" /></I18nProvider>);
  expect(await screen.findByText("56%")).toBeTruthy();
  expect(screen.getByText(/^(Profile|Profil)$/)).toBeTruthy();
  expect(global.fetch.mock.calls[0][0]).toBe("/api/ventures/VNT-1/progress");
  // the three existing tiles are still there
  expect(screen.getByText("4%")).toBeTruthy();
});

test("while the figure is unknown the tile says so instead of 0%", () => {
  global.fetch = jest.fn(() => new Promise(() => {}));
  render(<I18nProvider><HealthSummary data={data} ventureId="VNT-1" /></I18nProvider>);
  expect(screen.getByText("—")).toBeTruthy();
});

// Distinct venture ids: the shared read hook de-duplicates in-flight requests by address,
// and the "unknown figure" test above leaves one pending on VNT-1.
test("the Profile tile opens the Profile tab when the hub gives it a way to", async () => {
  const open = jest.fn();
  render(<I18nProvider><HealthSummary data={data} ventureId="VNT-2" onOpenProfile={open} /></I18nProvider>);
  await screen.findByText("56%");
  const tile = screen.getByTitle(/Open the Profile tab|Ouvrir l'onglet Profil/);
  fireEvent.click(tile);
  expect(open).toHaveBeenCalledTimes(1);
});

test("without a way to open it (standalone page) the Profile tile stays a plain figure", async () => {
  render(<I18nProvider><HealthSummary data={data} ventureId="VNT-3" /></I18nProvider>);
  await screen.findByText("56%");
  expect(screen.queryByTitle(/Open the Profile tab/)).toBeNull();
});

test("the hub passes the Profile tab to the embedded dashboard; the founder card opens it too", () => {
  const fs = require("node:fs");
  expect(fs.readFileSync("src/components/admin/ventures/VentureDetailView.js", "utf8")).toContain('onOpenProfile={() => setActiveTab("profile")}');
  expect(fs.readFileSync("src/components/ventures/workspace/tabs/DashboardHistoryTabs.js", "utf8")).toContain('onSection("profile")');
});
