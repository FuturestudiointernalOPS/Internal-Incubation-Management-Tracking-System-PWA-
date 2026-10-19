/**
 * GET /api/people/search — the people picker behind session guests.
 *
 * The endpoint answers "who is already here?" while an address is typed, so an
 * invite can be addressed to the person ImpactOS knows. These tests lock the
 * two things that must never drift:
 *
 *   • it is a READ — gated on contacts.view, not the contacts.create that
 *     writing a new person through /api/people needs;
 *   • a term can never widen into the whole table (LIKE wildcards are stripped,
 *     and a term too short to narrow anything returns nothing at all).
 */

const executed = [];

const mockRows = [
  { cid: "USR_1", name: "Ama Doe", email: "ama@example.com", role: "participant", status: "active", phone: "000" },
  { cid: "USR_2", name: "Kofi", email: "kofi@example.com", role: "staff", status: "active", phone: "111" },
];

const mockExecute = jest.fn(async ({ sql, args = [] }) => {
  executed.push({ sql, args });
  return { rows: mockRows };
});

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: { execute: mockExecute },
  initDb: jest.fn().mockResolvedValue(true),
}));

const mockRequireAuth = jest.fn().mockResolvedValue(null);
jest.mock("@/server/auth/guards", () => ({
  requireAuth: (...args) => mockRequireAuth(...args),
}));

const mockRequireAuthorization = jest.fn().mockResolvedValue(null);
jest.mock("@/models/authorization/index", () => ({
  requireAuthorization: (...args) => mockRequireAuthorization(...args),
}));

const { GET } = require("@/app/api/people/search/route");

const call = (query) => GET(new Request(`http://localhost/api/people/search${query}`));
const readJson = (res) => res.json();

beforeEach(() => {
  executed.length = 0;
  mockExecute.mockClear();
  mockRequireAuth.mockResolvedValue(null);
  mockRequireAuthorization.mockResolvedValue(null);
});

describe("the directory read", () => {
  test("a term returns the people the picker can offer", async () => {
    const res = await call("?q=ama");
    expect(res.status).toBe(200);
    const data = await readJson(res);
    expect(data.success).toBe(true);
    expect(data.people).toEqual([
      { cid: "USR_1", name: "Ama Doe", email: "ama@example.com", role: "participant", status: "active" },
      { cid: "USR_2", name: "Kofi", email: "kofi@example.com", role: "staff", status: "active" },
    ]);
    // The picker needs a name and an address — never the phone number.
    expect(data.people[0].phone).toBeUndefined();
  });

  test("the query is scoped to live contacts and bounded", async () => {
    await call("?q=ama");
    expect(executed).toHaveLength(1);
    expect(executed[0].sql).toContain("deleted_at IS NULL");
    expect(executed[0].sql).toContain("LOWER(email) LIKE ?");
    expect(executed[0].sql).toContain("LOWER(name) LIKE ?");
    expect(executed[0].sql).toMatch(/LIMIT \d+/);
    expect(executed[0].args).toEqual(["ama%", "%ama%", "ama%"]);
  });

  test("the term is lower-cased, so the same search works however it is typed", async () => {
    await call("?q=AMA");
    expect(executed[0].args).toEqual(["ama%", "%ama%", "ama%"]);
  });
});

describe("a term can never widen into the whole table", () => {
  test("LIKE wildcards are stripped, and a wildcard-only term reads nothing", async () => {
    const res = await call(`?q=${encodeURIComponent("%%")}`);
    const data = await readJson(res);
    expect(data.people).toEqual([]);
    expect(mockExecute).not.toHaveBeenCalled();
  });

  test("a one-character term reads nothing", async () => {
    const res = await call("?q=a");
    expect((await readJson(res)).people).toEqual([]);
    expect(mockExecute).not.toHaveBeenCalled();
  });

  test("an empty query is not an error, it is an empty answer", async () => {
    const res = await call("");
    expect(res.status).toBe(200);
    expect((await readJson(res)).people).toEqual([]);
  });
});

describe("the gate is a read gate", () => {
  test("an unauthenticated caller is refused", async () => {
    mockRequireAuth.mockResolvedValueOnce(
      new Response(JSON.stringify({ success: false }), { status: 401 }),
    );
    const res = await call("?q=ama");
    expect(res.status).toBe(401);
    expect(mockExecute).not.toHaveBeenCalled();
  });

  test("it asks for contacts.view, not contacts.create", async () => {
    await call("?q=ama");
    expect(mockRequireAuthorization).toHaveBeenCalledWith("contacts", "view");
  });

  test("a caller without the capability is refused", async () => {
    mockRequireAuthorization.mockResolvedValueOnce(
      new Response(JSON.stringify({ success: false }), { status: 403 }),
    );
    const res = await call("?q=ama");
    expect(res.status).toBe(403);
    expect(mockExecute).not.toHaveBeenCalled();
  });
});
