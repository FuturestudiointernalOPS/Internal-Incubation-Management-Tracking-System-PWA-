/**
 * PERMISSION PHASE 1 — the "what may I do here?" read must never disagree with
 * the gate it describes.
 *
 * The read exists so a screen can hide or disable what the server would refuse.
 * That is only safe while the read and the gate give the SAME answer, so this
 * file pins them to each other:
 *
 *   1. For every scenario and every reported capability, the read's verdict and
 *      the guard's verdict agree — including the decision vocabulary
 *      (`capability+scope`, `super-admin`, `capability-missing`, `out-of-scope`),
 *      which is the same string the X-Authz-Decision header carries.
 *
 *   2. The read never OVER-CLAIMS. If it says allowed, the gate allows. This is
 *      the security-relevant direction: a UI that hides working buttons is
 *      annoying, a UI that offers a denied action wastes a round trip and
 *      teaches the user to distrust the screen.
 *
 *   3. A broken resolver is never a silent allow — on either path.
 *
 *   4. The read reports only what is ENFORCED. The venture permission matrix is
 *      configured but not yet consulted by the venture routes, so it must not be
 *      published as though it were (`matrix_enforced: false`).
 *
 * The read and the gate share `resolveVentureScopedDecision`; this file is the
 * alarm that rings if a later change pulls them apart.
 */
let mockSession = null;
let mockCtx = null;
let mockCapError = null;
let mockWithin = false;
let mockVentureRow = { venture_id: "VNT-1" };
let mockAssignments = [];
let mockMatrixAllowed = false;

jest.mock("@/lib/auth", () => ({
  getSession: jest.fn(async () => mockSession),
  requireAuth: jest.fn(),
}));

jest.mock("@/lib/authorization", () => ({
  getAuthorizationContext: jest.fn(async () => mockCtx),
  requireAuthorization: jest.fn(async () => mockCapError),
}));

jest.mock("@/lib/authorization/scope", () => ({
  resolveVentureScopeId: jest.fn(async () => "VNT-1"),
  isWithinScope: jest.fn(async () => mockWithin),
}));

const mockDb = {
  execute: jest.fn(async ({ sql }) => {
    if (sql.includes("FROM ventures")) {
      return { rows: mockVentureRow ? [mockVentureRow] : [] };
    }
    if (sql.includes("venture_permission_matrix")) {
      return { rows: [{ allowed: mockMatrixAllowed ? 1 : 0 }] };
    }
    if (sql.includes("venture_staff_assignments")) return { rows: mockAssignments };
    return { rows: [] };
  }),
};

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: mockDb,
  initDb: jest.fn().mockResolvedValue(true),
}));

const { GET } = require("@/app/api/ventures/[id]/my-access/route");
const { requireVentureScopedAccess } = require("@/lib/ventureScopedAccess");
const authz = require("@/lib/authorization");
const scope = require("@/lib/authorization/scope");

const CAPABILITIES = ["view", "edit"];
const ctx = { params: Promise.resolve({ id: "VNT-1" }) };
const req = () => new Request("http://localhost/api/ventures/VNT-1/my-access");
const callRead = async () => {
  const res = await GET(req(), ctx);
  return { status: res.status, body: await res.json() };
};

beforeEach(() => {
  mockSession = { cid: "C1", name: "Actor", role: "staff", email: "a@b.c" };
  mockCtx = null;
  mockCapError = null;
  mockWithin = false;
  mockVentureRow = { venture_id: "VNT-1" };
  mockAssignments = [];
  mockMatrixAllowed = false;
  jest.clearAllMocks();
  // clearAllMocks keeps implementations, but re-stating them keeps this file
  // honest about which closure variable each mock reads.
  authz.getAuthorizationContext.mockImplementation(async () => mockCtx);
  authz.requireAuthorization.mockImplementation(async () => mockCapError);
  scope.resolveVentureScopeId.mockImplementation(async () => "VNT-1");
  scope.isWithinScope.mockImplementation(async () => mockWithin);
});

/** The scenarios the two paths must agree on, whatever the capability. */
const SCENARIOS = [
  {
    name: "a global role (resolver super-admin bypass)",
    role: "super_admin",
    setup: () => {
      mockCtx = { isSuperAdmin: true };
    },
    expected: { allowed: true, decision: "super-admin" },
  },
  {
    name: "a delegated staff member holding the capability inside their scope",
    role: "staff",
    setup: () => {
      mockCapError = null;
      mockWithin = true;
    },
    expected: { allowed: true, decision: "capability+scope" },
  },
  {
    name: "a staff member holding the capability but OUT of scope",
    role: "staff",
    setup: () => {
      mockCapError = null;
      mockWithin = false;
    },
    expected: { allowed: false, decision: "out-of-scope" },
  },
  {
    name: "a staff member without the capability at all",
    role: "staff",
    setup: () => {
      mockCapError = { status: 403 };
      mockWithin = true;
    },
    expected: { allowed: false, decision: "capability-missing" },
  },
  {
    name: "a venture member with read but not write",
    role: "member",
    setup: () => {
      // The resolver grants view, refuses edit — the read must not flatten this
      // into a single yes/no for the whole screen.
      mockWithin = true;
      mockCapError = { status: 403 };
    },
    expected: { allowed: false, decision: "capability-missing" },
  },
];

describe("the read and the gate agree, key by key", () => {
  SCENARIOS.forEach((scenario) => {
    test.each(CAPABILITIES)(
      `${scenario.name} — %s`,
      async (capability) => {
        mockSession = { cid: "C1", role: scenario.role, email: "a@b.c" };
        scenario.setup();

        const read = await callRead();
        const reported = read.body.capabilities[capability];

        const gate = await requireVentureScopedAccess({
          ventureId: "VNT-1",
          module: "ventures",
          capability,
        });
        const gateAllowed = !gate.error;

        // 1. The verdicts agree.
        expect(reported.allowed).toBe(gateAllowed);
        expect(reported.allowed).toBe(scenario.expected.allowed);

        // 2. The decision vocabulary agrees — the read speaks the same language
        //    as X-Authz-Decision, so a screen can explain a denial it received.
        const gateDecision = gate.error
          ? gate.error.headers.get("X-Authz-Decision")
          : gate.path;
        expect(reported.decision).toBe(gateDecision);
        expect(reported.decision).toBe(scenario.expected.decision);
      },
    );
  });

  test("the read never over-claims: allowed implies the gate allows", async () => {
    for (const scenario of SCENARIOS) {
      for (const capability of CAPABILITIES) {
        jest.clearAllMocks();
        authz.getAuthorizationContext.mockImplementation(async () => mockCtx);
        authz.requireAuthorization.mockImplementation(async () => mockCapError);
        scope.resolveVentureScopeId.mockImplementation(async () => "VNT-1");
        scope.isWithinScope.mockImplementation(async () => mockWithin);

        mockCtx = null;
        mockCapError = null;
        mockWithin = false;
        mockSession = { cid: "C1", role: scenario.role, email: "a@b.c" };
        scenario.setup();

        const read = await callRead();
        if (!read.body.capabilities?.[capability]?.allowed) continue;

        const gate = await requireVentureScopedAccess({
          ventureId: "VNT-1",
          module: "ventures",
          capability,
        });
        expect(gate.error).toBeFalsy();
      }
    }
  });
});

describe("the read is usable exactly when it matters", () => {
  test("a person with no access still gets an answer, not a 403", async () => {
    mockSession = { cid: "C1", role: "member", email: "a@b.c" };
    mockCapError = { status: 403 };
    mockWithin = false;

    const read = await callRead();
    // The read must not require the capability it reports: telling someone
    // "you may do nothing here" is the whole point.
    expect(read.status).toBe(200);
    expect(read.body.capabilities.view.allowed).toBe(false);
    expect(read.body.capabilities.edit.allowed).toBe(false);
  });

  test("an unauthenticated request is refused and reports nothing", async () => {
    mockSession = null;
    const read = await callRead();
    expect(read.status).toBe(401);
    expect(read.body.capabilities).toBeUndefined();
  });

  test("an unknown Venture is a 404 — the endpoint cannot probe for Ventures", async () => {
    mockVentureRow = null;
    const read = await callRead();
    expect(read.status).toBe(404);
    expect(read.body.capabilities).toBeUndefined();
  });

  test("the assignments are reported as facts, not as a verdict", async () => {
    mockAssignments = [
      {
        responsibility_code: "coach",
        scope_type: "venture_wide",
        scope_ref_type: null,
        scope_ref_id: null,
      },
    ];
    mockWithin = true;
    const read = await callRead();
    expect(read.body.assignments).toEqual(mockAssignments);
    // Nothing in the payload turns an assignment into a permission on its own.
    expect(read.body.capabilities.edit.allowed).toBe(true); // from the resolver, not the row
  });
});

describe("the enforced cell is reported truthfully", () => {
  const COACH = [
    { responsibility_code: "coach", scope_type: "venture_wide", scope_ref_type: null, scope_ref_id: null },
  ];
  const LEAD = [
    { responsibility_code: "lead_manager", scope_type: "venture_wide", scope_ref_type: null, scope_ref_id: null },
  ];

  test("a Coach whose cell is denied reads false", async () => {
    mockWithin = true;
    mockAssignments = COACH;
    mockMatrixAllowed = false;
    const read = await callRead();
    expect(read.body.matrix["calendar.schedule"].allowed).toBe(false);
  });

  test("a Lead Manager whose cell is granted reads true", async () => {
    mockWithin = true;
    mockAssignments = LEAD;
    mockMatrixAllowed = true;
    const read = await callRead();
    expect(read.body.matrix["calendar.schedule"].allowed).toBe(true);
  });

  test("a global role reads true even holding no assignment row", async () => {
    mockSession = { cid: "SA", role: "super_admin" };
    mockCtx = { isSuperAdmin: true };
    mockAssignments = [];
    mockMatrixAllowed = false; // the matrix says no...
    const read = await callRead();
    // ...but the gate bypasses, so an under-claim here would hide a working button.
    expect(read.body.matrix["calendar.schedule"].allowed).toBe(true);
    expect(read.body.is_super_admin).toBe(true);
  });

  test("someone with no assignment at all reads false", async () => {
    mockWithin = true;
    mockAssignments = [];
    mockMatrixAllowed = true; // even when the matrix would allow it
    const read = await callRead();
    expect(read.body.matrix["calendar.schedule"].allowed).toBe(false);
  });
});

describe("it reports only what is enforced", () => {
  test("the reported keys are the two the gate actually consults", async () => {
    mockWithin = true;
    const read = await callRead();
    expect(read.body.reported).toEqual(["view", "edit"]);
    expect(Object.keys(read.body.capabilities).sort()).toEqual(["edit", "view"]);
  });

  test("the enforced matrix cells are named, and nothing else is published", async () => {
    mockWithin = true;
    mockAssignments = [
      { responsibility_code: "coach", scope_type: "venture_wide", scope_ref_type: null, scope_ref_id: null },
    ];
    const read = await callRead();
    // The list is the contract: a cell appears only when a route reads it.
    expect(read.body.matrix_enforced).toEqual(["calendar.schedule"]);
    expect(Object.keys(read.body.matrix)).toEqual(["calendar.schedule"]);
  });

  test("a broken resolver fails closed on both paths — never a silent allow", async () => {
    mockWithin = true;
    mockCapError = null;
    authz.requireAuthorization.mockRejectedValue(new Error("resolver down"));

    const read = await callRead();
    expect(read.status).toBe(500);
    expect(read.body.capabilities).toBeUndefined();

    const gate = await requireVentureScopedAccess({
      ventureId: "VNT-1",
      module: "ventures",
      capability: "view",
    });
    expect(gate.error.status).toBe(500);
    expect(gate.error.headers.get("X-Authz-Decision")).toBe("system-failure");
    expect(gate.session).toBeUndefined();
  });
});
