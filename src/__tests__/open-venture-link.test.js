/**
 * /open/venture/[code] — the reminder email's "Open in ImpactOS" button.
 *
 * Decided at click time: a signed-in reader reaches the Venture page their role
 * can open, a signed-out one the login page (which brings them back), and a
 * signed-out reader whose address had no account reaches registration.
 */
jest.mock("@/server/auth/session", () => ({ getSession: jest.fn() }));

const { NextRequest } = require("next/server");
const { getSession } = require("@/server/auth/session");
const { GET } = require("@/app/open/venture/[code]/route");
const { proxy } = require("@/proxy");

async function open(path) {
  const req = new NextRequest(`http://localhost:3000${path}`);
  const code = decodeURIComponent(path.split("?")[0].split("/").pop());
  const res = await GET(req, { params: Promise.resolve({ code }) });
  const location = new URL(res.headers.get("location"));
  return `${location.pathname}${location.search}`;
}

beforeEach(() => jest.clearAllMocks());

describe("where the reminder button leads", () => {
  test("a super admin lands on the Venture's project page", async () => {
    getSession.mockResolvedValue({ cid: "A", role: "super_admin" });
    expect(await open("/open/venture/VNT-PSPFIX")).toBe("/admin/ventures/projects/VNT-PSPFIX");
  });

  test("staff and participants land on the Venture page of their own section", async () => {
    getSession.mockResolvedValue({ cid: "S", role: "staff" });
    expect(await open("/open/venture/VNT-1")).toBe("/staff/ventures/VNT-1");
    getSession.mockResolvedValue({ cid: "P", role: "participant" });
    expect(await open("/open/venture/VNT-1?signup=1")).toBe("/participant/ventures/VNT-1");
  });

  test("a signed-out reader with an account goes to login, and comes back here", async () => {
    getSession.mockResolvedValue(null);
    expect(await open("/open/venture/VNT-1")).toBe(`/login?next=${encodeURIComponent("/open/venture/VNT-1")}`);
  });

  test("a signed-out reader without an account goes to registration", async () => {
    getSession.mockResolvedValue(null);
    expect(await open("/open/venture/VNT-1?signup=1")).toBe("/register-staff");
  });

  test("the route is reachable without a session cookie", () => {
    const req = new NextRequest("http://localhost:3000/open/venture/VNT-1?signup=1");
    const res = proxy(req);
    expect(res.headers.get("location")).toBeNull();
  });
});
