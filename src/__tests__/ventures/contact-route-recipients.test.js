/** The contact route lets the founder pick among the ACTIVE leads, by id — nothing else. */
const mockSend = jest.fn(async ({ leads }) => ({ sent: leads.length, failed: [] }));
const lead = (id, name) => ({ id, name, email: `${name}@x.org`, contact_cid: `USR_${id}`, reachable: true, active: true, responsibility_code: "lead_manager" });

jest.mock("@/lib/api/createHandler", () => ({ createHandler: (handler) => handler }));
jest.mock("@/lib/ventureScopedAccess", () => ({
  requireVentureScopedAccess: jest.fn(async () => ({ session: { cid: "USR_F", name: "Founder", email: "f@x.org" } })),
}));
jest.mock("@/lib/rate-limit", () => ({ enforceRateLimit: jest.fn(() => null) }));
jest.mock("@/models/ventureWorkspace", () => ({ getVentureDisplayNameByCode: jest.fn(async () => ({ rows: [{ venture_name: "AgroTech" }] })) }));
jest.mock("@/services/ventures/support", () => ({
  MAX_MESSAGE_LENGTH: 2000,
  activeLeadRecipients: () => [lead(1, "harry"), lead(2, "joakh")],
  readVentureSupport: jest.fn(async () => ({ current: [] })),
  sendFounderMessageToLeads: (...args) => mockSend(...args),
}));

const { POST } = require("@/app/api/ventures/[id]/support/contact/route");
const call = (body) => POST(new Request("http://x/api", { method: "POST", body: JSON.stringify(body) }), { params: Promise.resolve({ id: "VNT-1" }) });

beforeEach(() => mockSend.mockClear());

test("no recipients given: every active lead is written to", async () => {
  await call({ message: "hi" });
  expect(mockSend.mock.calls[0][0].leads.map((entry) => entry.id)).toEqual([1, 2]);
});

test("recipients given: only those leads", async () => {
  await call({ message: "hi", recipients: [2] });
  expect(mockSend.mock.calls[0][0].leads.map((entry) => entry.id)).toEqual([2]);
});

test("an id that is not an active lead is ignored, and picking nobody valid is refused", async () => {
  const response = await call({ message: "hi", recipients: [99] });
  expect(response.status).toBe(400);
  expect(mockSend).not.toHaveBeenCalled();
});

test("the message is written to the leads' inbox as the founder (cid from the session, never the request)", async () => {
  await call({ message: "hi", founder_cid: "USR_EVIL", recipients: [1] });
  const args = mockSend.mock.calls[0][0];
  expect(args.founderCid).toBe("USR_F");
  expect(args.leads.map((entry) => entry.contact_cid)).toEqual(["USR_1"]);
});

test("partly reached: success, with the people who have no account reported", async () => {
  mockSend.mockResolvedValueOnce({ sent: 1, failed: [{ name: "joakh", reason: "no_account" }] });
  const response = await call({ message: "hi" });
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ success: true, sent: 1, failed: [{ name: "joakh", reason: "no_account" }] });
});

test("nobody has an account: a clear refusal, not a generic failure", async () => {
  mockSend.mockResolvedValueOnce({ sent: 0, failed: [{ name: "harry", reason: "no_account" }, { name: "joakh", reason: "no_account" }] });
  const response = await call({ message: "hi" });
  expect(response.status).toBe(409);
  expect((await response.json()).error).toBe("errors.contactNoAccount");
});

test("a write that failed for another reason is a delivery failure", async () => {
  mockSend.mockResolvedValueOnce({ sent: 0, failed: [{ name: "harry", reason: "db down" }] });
  const response = await call({ message: "hi", recipients: [1] });
  expect(response.status).toBe(502);
  expect((await response.json()).error).toBe("errors.contactNotDelivered");
});
