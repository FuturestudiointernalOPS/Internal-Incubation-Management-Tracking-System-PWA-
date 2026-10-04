/**
 * Phase 3 — Venture lifecycle & access gate tests (pure helpers).
 *
 * The lifecycle now reads through a store that owns its db, so the table shape
 * is driven by the module mock rather than an injected double; the assertions
 * (and their guarantees) are unchanged.
 */

jest.mock("@/server/auth/session", () => ({
  getSession: jest.fn().mockResolvedValue(null),
}));

jest.mock("@/lib/db", () => {
  const state = { rows: [], calls: [] };
  const execute = jest.fn(async ({ sql, args = [] }) => {
    state.calls.push({ sql, args });
    return { rows: state.rows };
  });
  return {
    __esModule: true,
    default: { execute },
    initDb: jest.fn().mockResolvedValue(true),
    __state: state,
  };
});

const { __state: state } = require("@/lib/db");
const {
  lifecycleIsArchived,
  roleIsPrivileged,
  resolveVentureLifecycle,
  requireOperationalVentureAccess,
} = require("@/lib/ventureAuth");
const { resetVentureAccessCache } = require("@/services/ventures/accessFacts");

// The Venture's own facts are remembered process-wide for a real 10 s window, so
// each test starts from an empty cache — otherwise one test's Venture would
// answer the next test's question.
beforeEach(() => {
  resetVentureAccessCache();
  state.calls.length = 0;
  state.rows = [{ status: "active", is_archived: 0 }];
});

describe("lifecycleIsArchived", () => {
  it("detects archived from status or is_archived flag", () => {
    expect(lifecycleIsArchived({ status: "archived", is_archived: 1 })).toBe(true);
    expect(lifecycleIsArchived({ status: "active", is_archived: 1 })).toBe(true);
    expect(lifecycleIsArchived({ status: "paused", is_archived: 0 })).toBe(false);
    expect(lifecycleIsArchived({ status: "active" })).toBe(false);
    expect(lifecycleIsArchived(null)).toBe(false);
  });
});

describe("roleIsPrivileged", () => {
  it("grants staff/SA/PM; denies participants", () => {
    expect(roleIsPrivileged("super_admin")).toBe(true);
    expect(roleIsPrivileged("staff")).toBe(true);
    expect(roleIsPrivileged("program_manager")).toBe(true);
    expect(roleIsPrivileged("participant")).toBe(false);
    expect(roleIsPrivileged("founder")).toBe(false);
  });
});

describe("resolveVentureLifecycle", () => {
  it("resolves by venture_id code", async () => {
    const lifecycle = await resolveVentureLifecycle("VNT-ABC");
    expect(lifecycle.status).toBe("active");
    expect(state.calls[0].sql).toContain("WHERE venture_id = ?");
  });

  it("resolves by internal id", async () => {
    state.rows = [{ status: "archived", is_archived: 1 }];
    const id = "11111111-2222-3333-4444-555555555555";
    const lifecycle = await resolveVentureLifecycle(id);
    expect(lifecycle.status).toBe("archived");
    // The internal id is matched as an id, not cast to text: a cast would drop
    // the index on a hot read.
    expect(state.calls[0].sql).toContain("WHERE id = ?");
  });

  it("returns null when not found", async () => {
    state.rows = [];
    expect(await resolveVentureLifecycle("VNT-X")).toBeNull();
  });
});

describe("requireOperationalVentureAccess", () => {
  const asArchived = () => {
    state.rows = [{ status: "archived", is_archived: 1 }];
  };
  const asActive = () => {
    state.rows = [{ status: "active", is_archived: 0 }];
  };

  it("blocks every mutation on an archived Venture", async () => {
    asArchived();
    const gate = await requireOperationalVentureAccess({
      ventureId: "VNT-A",
      session: { role: "super_admin" },
      mutate: true,
    });
    expect(gate.ok).toBe(false);
    expect(gate.code).toBe("archived");
  });

  it("allows privileged staff to read an archived Venture (historical)", async () => {
    asArchived();
    const gate = await requireOperationalVentureAccess({
      ventureId: "VNT-A",
      session: { role: "staff" },
      mutate: false,
    });
    expect(gate.ok).toBe(true);
  });

  it("removes active access for members when archived", async () => {
    asArchived();
    const gate = await requireOperationalVentureAccess({
      ventureId: "VNT-A",
      session: { role: "founder" },
      mutate: false,
    });
    expect(gate.ok).toBe(false);
    expect(gate.code).toBe("archived");
  });

  it("passes active Ventures through", async () => {
    asActive();
    const gate = await requireOperationalVentureAccess({
      ventureId: "VNT-A",
      session: { role: "participant" },
      mutate: false,
    });
    expect(gate.ok).toBe(true);
  });
});
