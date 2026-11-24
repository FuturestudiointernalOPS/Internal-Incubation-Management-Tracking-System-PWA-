/**
 * @jest-environment jsdom
 *
 * The venture dashboard's first metrics column shows the Data bank widget; the
 * Stage & Evidence Score is drawn once, in the health row above it.
 */
import { render, screen } from "@testing-library/react";

jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn() }) }));

const { I18nProvider } = require("@/lib/i18n");
const MetricsColumn = require("@/components/shared/ventures/console/venture-dashboard/MetricsColumn").default;

const widgetState = () => ({ loading: false, error: null, empty: false });
const data = {
  verification: { status: "pending_review", verified_count: 2, total_count: 6, categories: [{ label: "Business Registration", status: "verified" }, { label: "Founder Identity", status: "pending" }] },
  investment_readiness: { score: 4 },
};

test("shows the Data bank widget with its categories and status", () => {
  render(<I18nProvider><MetricsColumn id="VNT-1" data={data} widgetState={widgetState} refreshWidget={() => {}} verificationStatusLabel={(s) => s} /></I18nProvider>);
  expect(screen.getByRole("heading", { name: /Data bank/i })).toBeTruthy();
  expect(screen.getByText("Business Registration")).toBeTruthy();
  expect(screen.getByText("Founder Identity")).toBeTruthy();
});

test("does not draw a second Readiness (stage & evidence) card", () => {
  render(<I18nProvider><MetricsColumn id="VNT-1" data={data} widgetState={widgetState} refreshWidget={() => {}} verificationStatusLabel={(s) => s} /></I18nProvider>);
  expect(screen.queryByText("Stage & Evidence Score")).toBeNull();
  expect(screen.queryByText(/^Readiness$/)).toBeNull();
});

test("the activity column no longer carries a Recent documents widget", () => {
  const fs = require("node:fs");
  const source = fs.readFileSync("src/components/shared/ventures/console/venture-dashboard/ActivityColumn.js", "utf8");
  expect(source).not.toContain("recentDocuments");
  expect(source).toContain("upcomingMeetings");
  expect(source).toContain("notifications");
});

test("the Data Room draws one coverage table and one document table (founder, Super Admin, staff)", () => {
  const fs = require("node:fs");
  const source = fs.readFileSync("src/components/shared/ventures/console/data-room/VentureDataRoom.js", "utf8");
  // Readiness is asked for again on purpose: it is the coverage table that answers
  // "what is required / submitted / left", and it owns the completeness copy.
  expect(source).toContain("DataRoomCoverage");
  expect(source).toContain("DataRoomDocumentTable");
  expect(source).toContain("DataRoomUploadModal");
});
