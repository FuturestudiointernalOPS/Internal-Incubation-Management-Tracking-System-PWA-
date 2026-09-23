/**
 * Phase 3 — Venture lifecycle & access gate tests (pure helpers).
 */

jest.mock("@/lib/auth", () => ({
  getSession: jest.fn().mockResolvedValue(null),
}));

const {
  lifecycleIsArchived,
  roleIsPrivileged,
  resolveVentureLifecycle,
  requireOperationalVentureAccess,
} = require("@/lib/ventureAuth");
const { resetVentureAccessCache } = require("@/lib/ventureAccessFacts");

// The Venture's own facts are remembered process-wide for a real 10 s window, so
// each test starts from an empty cache — otherwise one test's Venture would
// answer the next test's question.
beforeEach(() => resetVentureAccessCache());

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
    const db = { execute: jest.fn().mockResolvedValue({ rows: [{ status: "active", is_archived: 0 }] }) };
    const lifecycle = await resolveVentureLifecycle("VNT-ABC", db);
    expect(lifecycle.status).toBe("active");
    expect(db.execute.mock.calls[0][0].sql).toContain("WHERE venture_id = ?");
  });

  it("resolves by internal id", async () => {
    const id = "11111111-2222-3333-4444-555555555555";
    const db = {
      execute: jest.fn().mockResolvedValueOnce({ rows: [{ status: "archived", is_archived: 1 }] }),
    };
    const lifecycle = await resolveVentureLifecycle(id, db);
    expect(lifecycle.status).toBe("archived");
    // The internal id is matched as an id, not cast to text: a cast would drop
    // the index on a hot read.
    expect(db.execute.mock.calls[0][0].sql).toContain("WHERE id = ?");
  });

  it("returns null when not found", async () => {
    const db = { execute: jest.fn().mockResolvedValue({ rows: [] }) };
    expect(await resolveVentureLifecycle("VNT-X", db)).toBeNull();
  });
});

describe("requireOperationalVentureAccess", () => {
  const archivedDb = () => ({
    execute: jest.fn().mockResolvedValue({ rows: [{ status: "archived", is_archived: 1 }] }),
  });
  const activeDb = () => ({
    execute: jest.fn().mockResolvedValue({ rows: [{ status: "active", is_archived: 0 }] }),
  });

  it("blocks every mutation on an archived Venture", async () => {
    const gate = await requireOperationalVentureAccess({
      ventureId: "VNT-A",
      db: archivedDb(),
      session: { role: "super_admin" },
      mutate: true,
    });
    expect(gate.ok).toBe(false);
    expect(gate.code).toBe("archived");
  });

  it("allows privileged staff to read an archived Venture (historical)", async () => {
    const gate = await requireOperationalVentureAccess({
      ventureId: "VNT-A",
      db: archivedDb(),
      session: { role: "staff" },
      mutate: false,
    });
    expect(gate.ok).toBe(true);
  });

  it("removes active access for members when archived", async () => {
    const gate = await requireOperationalVentureAccess({
      ventureId: "VNT-A",
      db: archivedDb(),
      session: { role: "founder" },
      mutate: false,
    });
    expect(gate.ok).toBe(false);
    expect(gate.code).toBe("archived");
  });

  it("passes active Ventures through", async () => {
    const gate = await requireOperationalVentureAccess({
      ventureId: "VNT-A",
      db: activeDb(),
      session: { role: "participant" },
      mutate: false,
    });
    expect(gate.ok).toBe(true);
  });
});
