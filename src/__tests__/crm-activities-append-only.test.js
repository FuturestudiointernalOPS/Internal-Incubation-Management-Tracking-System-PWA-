/**
 * CRM — recorded activities are history: the API refuses to rewrite it.
 *
 * The screens no longer offer edit or delete; these tests pin the server-side
 * half of the same decision.
 */

jest.mock("@/lib/api/createHandler", () => ({ createHandler: (handler) => handler }));
jest.mock("@/models/authorization/index", () => ({
  requireAuthorization: jest.fn(async () => null),
}));

const { requireAuthorization } = require("@/models/authorization/index");
const { PATCH, DELETE } = require("@/app/api/crm/activities/[id]/route");

const params = { params: Promise.resolve({ id: "activity-1" }) };

beforeEach(() => {
  jest.clearAllMocks();
});

test("PATCH is refused with the append-only message", async () => {
  const response = await PATCH({ json: async () => ({ title: "Changed" }) }, params);

  expect(response.status).toBe(409);
  await expect(response.json()).resolves.toMatchObject({
    success: false,
    error: "crm.activities.historyAppendOnly",
  });
  expect(requireAuthorization).toHaveBeenCalledWith("crm", "edit");
});

test("DELETE is refused with the append-only message", async () => {
  const response = await DELETE({}, params);

  expect(response.status).toBe(409);
  await expect(response.json()).resolves.toMatchObject({
    success: false,
    error: "crm.activities.historyAppendOnly",
  });
  expect(requireAuthorization).toHaveBeenCalledWith("crm", "delete");
});
