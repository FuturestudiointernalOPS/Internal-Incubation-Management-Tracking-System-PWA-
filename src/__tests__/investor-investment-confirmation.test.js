/**
 * Phase 5 — investment confirmation decisions.
 */

jest.mock("@/models/investor/investment", () => ({
  upsertInvestorInvestmentClaim: jest.fn(),
  confirmInvestorInvestmentRecord: jest.fn(),
  rejectInvestorInvestmentRecord: jest.fn(),
  getInvestorInvestmentById: jest.fn(),
  listInvestmentsForInvestor: jest.fn(),
  listInvestmentClaimsForStudio: jest.fn(),
  selectVentureForFinancing: jest.fn(),
  selectFinancingByMarker: jest.fn(),
  insertInvestorFinancingEvent: jest.fn(),
  enqueueOutbox: jest.fn(),
  listPendingOutbox: jest.fn(),
  markOutboxProcessed: jest.fn(),
  markOutboxFailed: jest.fn(),
  updateInvestmentFinancingEvent: jest.fn(),
  insertInvestmentRejectedInvestorNotification: jest.fn(),
}));

jest.mock("@/models/investor", () => ({
  addInvestmentToActiveCampaign: jest.fn(),
  createInvestmentDecision: jest.fn(),
  getInvestmentNotificationInfo: jest.fn(),
  getRelationshipWorkspaceAssigneesForInvestment: jest.fn(),
  getRelationshipWorkspaceIdForInvestment: jest.fn(),
  insertInvestmentCommittedTimeline: jest.fn(),
  insertInvestmentConfirmedAdminNotification: jest.fn(),
  insertInvestmentConfirmedInvestorNotification: jest.fn(),
  insertInvestmentConfirmedStaffNotification: jest.fn(),
  listAdminAndStaffCids: jest.fn(),
  markRelationshipWorkspaceActiveInvestment: jest.fn(),
  upsertInvestmentPipeline: jest.fn(),
  getInvestorProfileIdByUserId: jest.fn(),
}));

jest.mock("@/services/investor/activity", () => ({
  emitInvestorEvent: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/services/investor/featureFlags", () => ({
  readInvestorFlags: jest.fn(),
}));

const investmentModel = require("@/models/investor/investment");
const investorModel = require("@/models/investor");
const { emitInvestorEvent } = require("@/services/investor/activity");
const { readInvestorFlags } = require("@/services/investor/featureFlags");
const {
  claimInvestment,
  confirmInvestment,
  rejectInvestment,
} = require("@/services/investor/investment");

beforeEach(() => {
  jest.clearAllMocks();
  readInvestorFlags.mockResolvedValue({ investmentConfirmation: true });
  investmentModel.listPendingOutbox.mockResolvedValue({ rows: [] });
  investmentModel.enqueueOutbox.mockResolvedValue({ rows: [{ id: 1 }] });
  investorModel.getInvestmentNotificationInfo.mockResolvedValue({ rows: [{}] });
  investorModel.listAdminAndStaffCids.mockResolvedValue({ rows: [] });
  investorModel.getRelationshipWorkspaceIdForInvestment.mockResolvedValue({ rows: [] });
  investorModel.getRelationshipWorkspaceAssigneesForInvestment.mockResolvedValue({ rows: [] });
});

describe("claimInvestment", () => {
  it("requires amount and currency", async () => {
    expect(await claimInvestment({ ventureId: "v1", session: { cid: "u1" } })).toEqual({
      ok: false,
      status: 400,
      error: "venture_id, amount and currency are required.",
    });
  });

  it("creates a pending claim without investment_recorded", async () => {
    investorModel.getInvestorProfileIdByUserId.mockResolvedValue({ rows: [{ id: "inv1" }] });
    investorModel.upsertInvestmentPipeline.mockResolvedValue({
      rows: [{ id: "pl1", stage: "invested", was_inserted: false }],
    });
    investmentModel.upsertInvestorInvestmentClaim.mockResolvedValue({
      rows: [{ id: "rec1", confirmation_status: "pending", pipeline_id: "pl1" }],
    });

    const result = await claimInvestment({
      ventureId: "v1",
      amount: 5000,
      currency: "xof",
      instrument: "equity",
      investedOn: "2026-11-01",
      session: { cid: "u1" },
    });

    expect(result.ok).toBe(true);
    expect(result.investment.confirmation_status).toBe("pending");
    expect(investmentModel.upsertInvestorInvestmentClaim).toHaveBeenCalledWith(
      expect.objectContaining({
        confirmationStatus: "pending",
        currency: "XOF",
        amount: 5000,
      }),
    );
    expect(investorModel.createInvestmentDecision).not.toHaveBeenCalled();
    expect(investmentModel.enqueueOutbox).not.toHaveBeenCalled();
    expect(emitInvestorEvent).not.toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "investment_recorded" }),
    );
  });
});

describe("confirmInvestment", () => {
  it("fires side effects and logs investment_recorded", async () => {
    investmentModel.confirmInvestorInvestmentRecord.mockResolvedValue({
      rows: [{
        id: "rec1",
        pipeline_id: "pl1",
        venture_id: "v1",
        investor_profile_id: "inv1",
        amount: 5000,
        currency: "XOF",
        instrument: "equity",
        invested_on: "2026-11-01",
        confirmation_status: "confirmed",
      }],
    });

    const result = await confirmInvestment({ id: "rec1", session: { cid: "admin1" } });
    expect(result.ok).toBe(true);
    expect(investorModel.createInvestmentDecision).toHaveBeenCalledWith({
      pipeline_id: "pl1",
      investment_amount: 5000,
      notes: null,
    });
    expect(investmentModel.enqueueOutbox).toHaveBeenCalled();
    expect(emitInvestorEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "investment_recorded" }),
    );
  });
});

describe("rejectInvestment", () => {
  it("requires a reason and notifies the investor", async () => {
    expect(await rejectInvestment({ id: "rec1", reason: "  ", session: {} })).toEqual({
      ok: false,
      status: 400,
      error: "A rejection reason is required.",
    });

    investmentModel.rejectInvestorInvestmentRecord.mockResolvedValue({
      rows: [{
        id: "rec1",
        venture_id: "v1",
        investor_profile_id: "inv1",
        confirmation_status: "rejected",
      }],
    });
    investorModel.getInvestmentNotificationInfo.mockResolvedValue({
      rows: [{ user_id: "u1", venture_name: "Demo" }],
    });

    const result = await rejectInvestment({
      id: "rec1",
      reason: "Figures do not match",
      session: { cid: "admin1" },
    });
    expect(result.ok).toBe(true);
    expect(investmentModel.insertInvestmentRejectedInvestorNotification).toHaveBeenCalledWith(
      expect.objectContaining({ recipient_id: "u1" }),
    );
    expect(investorModel.createInvestmentDecision).not.toHaveBeenCalled();
  });
});
