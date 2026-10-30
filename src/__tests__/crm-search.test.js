/**
 * CRM — global search (decisions).
 *
 * Four objects; a short query touches nothing; people are a distinct domain and
 * only appear when the caller holds the right the person record requires.
 */

jest.mock("@/services/authorization/context", () => ({ can: jest.fn() }));
jest.mock("@/models/crm/organizations", () => ({ searchCrmOrganizations: jest.fn() }));
jest.mock("@/models/crm/search", () => ({
  searchCrmPeople: jest.fn(),
  searchCrmLeads: jest.fn(),
  searchCrmOpportunities: jest.fn(),
}));

const { can } = require("@/services/authorization/context");
const { searchCrmOrganizations } = require("@/models/crm/organizations");
const {
  searchCrmPeople,
  searchCrmLeads,
  searchCrmOpportunities,
} = require("@/models/crm/search");
const {
  searchCrm,
  CRM_SEARCH_MIN_LENGTH,
  CRM_SEARCH_GROUP_LIMIT,
} = require("@/services/crm/search");

const session = { cid: "u-1", role: "staff" };

beforeEach(() => {
  jest.clearAllMocks();
  can.mockResolvedValue(false);
  searchCrmPeople.mockResolvedValue({ rows: [{ cid: "c-1", name: "John Doe" }] });
  searchCrmOrganizations.mockResolvedValue({ rows: [{ id: "org-1", name: "MTN Benin" }] });
  searchCrmLeads.mockResolvedValue({ rows: [{ id: "l-1", title: "MTN Partnership" }] });
  searchCrmOpportunities.mockResolvedValue({ rows: [{ id: "o-1", name: "MTN 2027" }] });
});

test("a query shorter than the minimum returns nothing and reads nothing", async () => {
  const result = await searchCrm(session, " m ");

  expect(result.groups).toEqual({ people: [], organizations: [], leads: [], opportunities: [] });
  expect(searchCrmPeople).not.toHaveBeenCalled();
  expect(searchCrmOrganizations).not.toHaveBeenCalled();
  expect(searchCrmLeads).not.toHaveBeenCalled();
  expect(searchCrmOpportunities).not.toHaveBeenCalled();
  expect(CRM_SEARCH_MIN_LENGTH).toBe(2);
});

test("people are left out without the people right", async () => {
  can.mockResolvedValue(false);

  const result = await searchCrm(session, "mtn");

  expect(can).toHaveBeenCalledWith(session, "contacts", "view");
  expect(searchCrmPeople).not.toHaveBeenCalled();
  expect(result.groups.people).toEqual([]);
  expect(result.groups.leads).toHaveLength(1);
  expect(result.canSeePeople).toBe(false);
});

test("people are included with the right, and every group is assembled", async () => {
  can.mockResolvedValue(true);

  const result = await searchCrm(session, "  mtn  ");

  expect(result.query).toBe("mtn");
  expect(result.canSeePeople).toBe(true);
  expect(result.groups).toEqual({
    people: [{ cid: "c-1", name: "John Doe" }],
    organizations: [{ id: "org-1", name: "MTN Benin" }],
    leads: [{ id: "l-1", title: "MTN Partnership" }],
    opportunities: [{ id: "o-1", name: "MTN 2027" }],
  });
  expect(searchCrmOrganizations).toHaveBeenCalledWith("mtn", CRM_SEARCH_GROUP_LIMIT);
});
