/**
 * @jest-environment jsdom
 *
 * The venture dashboard's first metrics column shows the Data bank widget; the
 * Stage & Evidence Score is drawn once, in the health row above it.
 */
import { render, screen } from "@testing-library/react";

jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn() }) }));

const { I18nProvider } = require("@/lib/i18n");
const MetricsColumn = require("@/components/ventures/venture-dashboard/MetricsColumn").default;

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
  const source = fs.readFileSync("src/components/ventures/venture-dashboard/ActivityColumn.js", "utf8");
  expect(source).not.toContain("recentDocuments");
  expect(source).toContain("upcomingMeetings");
  expect(source).toContain("notifications");
});

test("the Data Room screen no longer draws the readiness card (founder, Super Admin, staff)", () => {
  const fs = require("node:fs");
  const source = fs.readFileSync("src/components/ventures/data-room/VentureDataRoom.js", "utf8");
  expect(source).not.toContain("dataRoom.completeness.title");
  expect(source).not.toContain("dataRoom.completeness.percent");
  // the screen itself is intact: catalogue, filters and upload are still there
  expect(source).toContain("DataRoomDocumentCard");
  expect(source).toContain("DataRoomUploadModal");
});
