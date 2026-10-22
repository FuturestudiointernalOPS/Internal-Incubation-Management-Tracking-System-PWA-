/**
 * @jest-environment jsdom
 *
 * Clicking the Stage & Evidence percentage shows its working: the required
 * documents that count, the ones awaiting approval, rejected and missing ones.
 */
import { fireEvent, render, screen } from "@testing-library/react";

jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn() }) }));

const { I18nProvider } = require("@/lib/i18n");
const HealthSummary = require("@/components/ventures/venture-dashboard/HealthSummary").default;
const EvidenceBreakdown = require("@/components/ventures/venture-dashboard/EvidenceBreakdown").default;

const readiness = {
  score: 19,
  stage: "idea",
  stage_weight: 10,
  evidence_percent: 25,
  evidence_measurable: true,
  evidence: {
    required_total: 4,
    verified_count: 1,
    items: [
      { category: "company_overview", status: "verified", documents: [{ id: "a", title: "Certificate of incorporation", status: "verified" }] },
      { category: "legal_corporate", status: "awaiting", documents: [{ id: "b", title: "Statutes", status: "awaiting" }] },
      { category: "financial", status: "missing", documents: [] },
      { category: "team", status: "rejected", documents: [{ id: "c", title: "Founders CV", status: "rejected" }] },
    ],
  },
};

const wrap = (node) => render(<I18nProvider>{node}</I18nProvider>);

test("the breakdown lists required documents by verdict", () => {
  wrap(<EvidenceBreakdown readiness={readiness} isOpen onClose={() => {}} />);
  expect(screen.getByText("Certificate of incorporation")).toBeTruthy();
  expect(screen.getByText("Statutes")).toBeTruthy();
  expect(screen.getByText("Founders CV")).toBeTruthy();
  expect(screen.getByText(/Counted now/)).toBeTruthy();
  expect(screen.getByText(/Awaiting approval/)).toBeTruthy();
  expect(screen.getByText(/Missing — nothing usable/)).toBeTruthy();
  expect(screen.getByText("25%")).toBeTruthy();
});

test("when nothing is required it says so instead of listing", () => {
  wrap(<EvidenceBreakdown readiness={{ ...readiness, evidence_measurable: false, evidence_percent: null, evidence: { items: [] } }} isOpen onClose={() => {}} />);
  expect(screen.getByText(/No document is marked required/)).toBeTruthy();
});

test("clicking the score tile opens the breakdown", () => {
  global.fetch = jest.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, progress: { venture_setup: 56 } }) }));
  wrap(<HealthSummary data={{ venture: { business_stage: "idea" }, team: { active: 1 }, investment_readiness: readiness }} ventureId="VNT-1" />);
  expect(screen.queryByText("Statutes")).toBeNull();
  fireEvent.click(screen.getByTitle(/How the score is calculated|Comment le score/));
  expect(screen.getByText("Statutes")).toBeTruthy();
});

test("the tile is named Readiness, not Stage & Evidence Score", () => {
  const en = require("@/locales/en/vadmin.json");
  const fr = require("@/locales/fr/vadmin.json");
  expect(en.vadmin.dashboard.stageEvidenceScore).toBe("Readiness");
  expect(fr.vadmin.dashboard.stageEvidenceScore).toBe("Préparation");
  expect(en.vadmin.dashboard.stageEvidenceHint).not.toMatch(/not investment readiness/i);
});
