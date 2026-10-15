/**
 * VENTURES — service-level fixes found while walking the venture screens.
 */

const mockSelectCounts = jest.fn();

jest.mock("@/models/ventureVerificationStore", () => ({
  selectVerificationByIdAndVenture: jest.fn().mockResolvedValue({ rows: [{ id: 1, status: "pending" }] }),
  selectVerificationItemByCategory: jest.fn().mockResolvedValue({ rows: [{ id: 9, status: "pending" }] }),
  selectVerificationDocuments: jest.fn(),
  updateVerificationItemStatus: jest.fn().mockResolvedValue({}),
  insertVerificationItemUpdatedHistory: jest.fn().mockResolvedValue({}),
  deleteVerificationDocumentRow: jest.fn(),
  insertVerification: jest.fn(),
  insertVerificationDocument: jest.fn(),
  insertVerificationDocumentVersionOne: jest.fn(),
  insertVerificationItem: jest.fn(),
  insertVerificationResubmittedHistory: jest.fn(),
  insertVerificationStatusHistory: jest.fn(),
  insertVerificationSubmittedHistory: jest.fn(),
  reopenVerificationRow: jest.fn(),
  resetVerificationItemToPending: jest.fn(),
  selectVerification: jest.fn(),
  selectVerificationComments: jest.fn(),
  selectVerificationHistory: jest.fn(),
  selectVerificationItems: jest.fn(),
  selectVerificationReviews: jest.fn(),
  setVerificationItemUnderReview: jest.fn(),
  submitVerificationRow: jest.fn(),
  updateVerificationRow: jest.fn(),
  verifyAllPendingItems: jest.fn(),
}));
jest.mock("@/services/ventures/ventureDocumentTypes", () => ({
  listActiveVentureDocumentTypesOrDefaults: jest.fn().mockResolvedValue([
    { code: "business_registration", verification_method: "upload" },
    { code: "email_verification", verification_method: "external" },
  ]),
}));
jest.mock("@/services/ventures/activity", () => ({ logVentureActivity: jest.fn() }));
jest.mock("@/services/ventures/verification/categories", () => ({
  VERIFICATION_CATEGORY_LABELS: {},
  resolveActiveDocumentTypeCodes: jest.fn().mockResolvedValue(["business_registration", "email_verification"]),
}));
jest.mock("@/services/ventures/verification/versions", () => ({ ensureVerificationVersionTable: jest.fn() }));

const store = require("@/models/ventureVerificationStore");
const { updateVerificationStatus } = require("@/services/ventures/verification/workflow");

const decide = (category, newStatus = "verified") =>
  updateVerificationStatus({ verificationId: 1, ventureId: "VNT-1", newStatus, category, reviewerCid: "c1", reviewerName: "R", notes: "" });

describe("verification — an upload slot with no document cannot be approved", () => {
  beforeEach(() => jest.clearAllMocks());

  test("approving an empty upload slot is refused and nothing is written", async () => {
    store.selectVerificationDocuments.mockResolvedValue({ rows: [] });
    await expect(decide("business_registration")).rejects.toThrow(/no document to approve/i);
    expect(store.updateVerificationItemStatus).not.toHaveBeenCalled();
  });

  test("approving it once a document is filed works", async () => {
    store.selectVerificationDocuments.mockResolvedValue({ rows: [{ id: 3, category: "business_registration" }] });
    await decide("business_registration");
    expect(store.updateVerificationItemStatus).toHaveBeenCalled();
  });

  test("a document filed under another category does not count", async () => {
    store.selectVerificationDocuments.mockResolvedValue({ rows: [{ id: 3, category: "founder_identity" }] });
    await expect(decide("business_registration")).rejects.toThrow();
  });

  test("a slot confirmed another way (email / phone) needs no document", async () => {
    store.selectVerificationDocuments.mockResolvedValue({ rows: [] });
    await decide("email_verification");
    expect(store.updateVerificationItemStatus).toHaveBeenCalled();
  });

  test("rejecting an empty slot stays possible", async () => {
    store.selectVerificationDocuments.mockResolvedValue({ rows: [] });
    await decide("business_registration", "rejected");
    expect(store.updateVerificationItemStatus).toHaveBeenCalled();
  });
});
