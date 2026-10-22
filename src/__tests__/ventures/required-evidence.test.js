/**
 * getRequiredEvidence — the working behind the Stage & Evidence Score: every
 * REQUIRED Data Room category, its verdict and its documents.
 */
const mockStore = {
  selectVentureStagesForVentures: jest.fn(),
  selectDataRoomRequirementsForVentures: jest.fn(),
  selectDataRoomDocumentStatusesForVentures: jest.fn(),
};
jest.mock("@/models/ventureDataRoomStore", () => mockStore);
jest.mock("@/models/ventureIdentityStore", () => ({
  resolveVentureInternalIds: jest.fn(async () => ["u1"]),
}));

const { getRequiredEvidence } = require("@/services/ventures/dataRoom/readiness");

const requirements = [
  { venture_id: "u1", category: "company_overview", level: "required" },
  { venture_id: "u1", category: "legal_corporate", level: "required" },
  { venture_id: "u1", category: "financial", level: "required" },
  { venture_id: "u1", category: "team", level: "recommended" },
];

beforeEach(() => {
  mockStore.selectVentureStagesForVentures.mockResolvedValue({ rows: [{ id: "u1", business_stage: "idea" }] });
  mockStore.selectDataRoomRequirementsForVentures.mockResolvedValue({ rows: requirements });
});

test("lists each required category with its documents and verdict", async () => {
  mockStore.selectDataRoomDocumentStatusesForVentures.mockResolvedValue({
    rows: [
      { id: "d1", title: "Certificate", venture_id: "u1", category: "company_overview", status: "verified" },
      { id: "d2", title: "Statutes", venture_id: "u1", category: "legal_corporate", status: "uploaded" },
      { id: "d3", title: "Team CV", venture_id: "u1", category: "team", status: "verified" },
    ],
  });

  const result = await getRequiredEvidence("VNT-1");

  // the recommended Team category is not part of the evidence
  expect(result.items.map((item) => item.category)).toEqual(["company_overview", "legal_corporate", "financial"]);
  expect(result.items.map((item) => item.status)).toEqual(["verified", "awaiting", "missing"]);
  expect(result.items[0].documents).toEqual([{ id: "d1", title: "Certificate", status: "verified" }]);
  expect(result.items[1].documents[0].status).toBe("awaiting");
  expect(result).toMatchObject({ required_total: 3, verified_count: 1, awaiting_count: 1, missing_count: 1, percent: 33 });
});

test("approving the awaiting document raises the percentage", async () => {
  mockStore.selectDataRoomDocumentStatusesForVentures.mockResolvedValue({
    rows: [
      { id: "d1", title: "Certificate", category: "company_overview", status: "verified" },
      { id: "d2", title: "Statutes", category: "legal_corporate", status: "verified" },
    ],
  });
  expect((await getRequiredEvidence("VNT-1")).percent).toBe(67);
});

test("nothing required is not measurable, never 0% or 100%", async () => {
  mockStore.selectDataRoomRequirementsForVentures.mockResolvedValue({
    rows: [{ venture_id: "u1", category: "team", level: "recommended" }],
  });
  mockStore.selectDataRoomDocumentStatusesForVentures.mockResolvedValue({ rows: [] });
  const result = await getRequiredEvidence("VNT-1");
  expect(result.percent).toBeNull();
  expect(result.items).toEqual([]);
});

test("an unreadable venture answers null", async () => {
  mockStore.selectVentureStagesForVentures.mockResolvedValue({ rows: [] });
  mockStore.selectDataRoomDocumentStatusesForVentures.mockResolvedValue({ rows: [] });
  expect(await getRequiredEvidence("VNT-1")).toBeNull();
});
