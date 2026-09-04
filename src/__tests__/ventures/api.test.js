/**
 * Integration tests for Venture OS API routes
 *
 * Tests:
 * - POST /api/ventures/register — full registration flow
 * - GET /api/ventures — list ventures
 * - GET /api/ventures/[id] — get venture
 * - PATCH /api/ventures/[id] — update venture
 * - Validation errors
 * - Duplicate detection
 * - Auth enforcement
 */

// Mock dependencies
jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: {
    execute: jest.fn(),
  },
  initDb: jest.fn().mockResolvedValue(true),
}));

jest.mock("@/lib/email", () => ({
  sendInviteEmail: jest.fn().mockResolvedValue({ success: true }),
}));

jest.mock("next/headers", () => ({
  cookies: jest.fn().mockResolvedValue({
    get: jest.fn().mockReturnValue({ value: "test-session-token" }),
  }),
}));

jest.mock("uuid", () => ({
  v4: jest.fn().mockReturnValue("mock-uuid-1234567890abcdef"),
}));

// Phase 10: migrated venture routes gate through the canonical authorization
// resolver. Authorization is out of scope for these business-logic tests,
// so the gate is mocked as granted.
jest.mock("@/lib/authorization", () => ({
  requireAuthorization: jest.fn().mockResolvedValue(null),
}));

// Mock createHandler to simulate session
jest.mock("@/lib/api/createHandler", () => {
  const actualModule = jest.requireActual("@/lib/api/createHandler");
  return {
    __esModule: true,
    default: actualModule.default,
    createHandler: jest.fn().mockImplementation((optionsOrHandler, maybeHandler) => {
      let options = {};
      let handler;
      if (typeof optionsOrHandler === "function") {
        handler = optionsOrHandler;
      } else {
        options = optionsOrHandler;
        handler = maybeHandler;
      }

      return async function (req, ...args) {
        try {
          // Simulate auth: add session
          req.session = { cid: "sa-001", name: "Super Admin", role: "super_admin" };
          return await handler(req, ...args);
        } catch (e) {
          const { NextResponse } = require("next/server");
          return NextResponse.json({ success: false, error: e.message }, { status: 500 });
        }
      };
    }),
  };
});

import db from "@/lib/db";
import { sendInviteEmail } from "@/lib/email";

// We need to import the route handlers via dynamic import since they're Next.js API routes
describe("Venture API Integration Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("POST /api/ventures/register", () => {
    it("is retired — Venture creation only flows through the Forms/Runs intake pipeline", async () => {
      const { POST } = await import("@/app/api/ventures/register/route");
      const req = new Request("http://localhost:3000/api/ventures/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company_name: "TechFlow Inc." }),
      });
      const response = await POST(req);
      const data = await response.json();
      expect(response.status).toBe(410);
      expect(data.success).toBe(false);
      expect(data.code).toBe("LEGACY_FLOW_RETIRED");
    });
  });

  describe("GET /api/ventures", () => {
    it("should return a list of ventures", async () => {
      db.execute.mockResolvedValue({
        rows: [
          {
            id: 1,
            venture_id: "VNT-ABCD1234",
            company_name: "TechFlow Inc.",
            industry: "fintech",
            business_stage: "early_traction",
            status: "active",
            founder_count: 1,
            member_count: 0,
            created_at: "2024-01-01T00:00:00Z",
          },
          {
            id: 2,
            venture_id: "VNT-EFGH5678",
            company_name: "GreenEnergy Co",
            industry: "cleantech",
            business_stage: "growth",
            status: "active",
            founder_count: 2,
            member_count: 3,
            created_at: "2024-02-01T00:00:00Z",
          },
        ],
      });

      const { GET } = await import("@/app/api/ventures/route");

      const req = new Request("http://localhost:3000/api/ventures");
      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.ventures).toHaveLength(2);
    });

    it("should filter by status", async () => {
      db.execute.mockResolvedValue({ rows: [] });

      const { GET } = await import("@/app/api/ventures/route");

      const req = new Request("http://localhost:3000/api/ventures?status=active");
      await GET(req);

      expect(db.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          sql: expect.stringContaining("v.status = ?"),
          args: expect.arrayContaining(["active"]),
        }),
      );
    });
  });

  describe("GET /api/ventures/[id]", () => {
    it("should return a venture by ID", async () => {
      db.execute
        .mockResolvedValueOnce({
          rows: [{
            id: 1,
            venture_id: "VNT-ABCD1234",
            company_name: "TechFlow Inc.",
            industry: "fintech",
            business_stage: "early_traction",
            status: "active",
            created_at: "2024-01-01T00:00:00Z",
          }],
        })
        .mockResolvedValueOnce({ rows: [{ id: 1, email: "john@example.com", name: "John Doe", status: "pending" }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: 1, action: "VENTURE_CREATED", actor_cid: "sa-001" }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, event_type: "PROFILE_WIZARD_INIT" }] });

      const { GET } = await import("@/app/api/ventures/[id]/route");

      const req = new Request("http://localhost:3000/api/ventures/VNT-ABCD1234");
      const response = await GET(req, { params: { id: "VNT-ABCD1234" } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.venture.venture_id).toBe("VNT-ABCD1234");
      expect(data.venture.founders).toHaveLength(1);
      expect(data.venture.activity).toHaveLength(1);
    });

    it("should return 404 for non-existent venture", async () => {
      db.execute.mockResolvedValue({ rows: [] });

      const { GET } = await import("@/app/api/ventures/[id]/route");

      const req = new Request("http://localhost:3000/api/ventures/VNT-NONEXISTENT");
      const response = await GET(req, { params: { id: "VNT-NONEXISTENT" } });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.error).toBe("Venture not found");
    });
  });

  describe("PATCH /api/ventures/[id]", () => {
    it("should update a venture", async () => {
      // Mock getVentureById (venture exists)
      db.execute
        .mockResolvedValueOnce({
          rows: [{
            id: 1,
            venture_id: "VNT-ABCD1234",
            company_name: "TechFlow Inc.",
            industry: "fintech",
            business_stage: "early_traction",
            status: "active",
            created_at: "2024-01-01T00:00:00Z",
          }],
        })
        .mockResolvedValueOnce({ rows: [] }) // founders
        .mockResolvedValueOnce({ rows: [] }) // members
        .mockResolvedValueOnce({ rows: [{ id: 1, action: "VENTURE_CREATED" }] }) // activity
        .mockResolvedValueOnce({ rows: [] }) // history
        // updateVenture
        .mockResolvedValueOnce({ rows: [] })
        // logVentureActivity
        .mockResolvedValueOnce({ rows: [] })
        // addVentureHistory
        .mockResolvedValueOnce({ rows: [] })
        // getVentureById again (for response)
        .mockResolvedValueOnce({
          rows: [{
            id: 1,
            venture_id: "VNT-ABCD1234",
            company_name: "New Name",
            industry: "fintech",
            business_stage: "early_traction",
            status: "active",
          }],
        })
        .mockResolvedValueOnce({ rows: [] }) // founders
        .mockResolvedValueOnce({ rows: [] }) // members
        .mockResolvedValueOnce({ rows: [{ id: 1, action: "VENTURE_CREATED" }, { id: 2, action: "VENTURE_UPDATED" }] }) // activity
        .mockResolvedValueOnce({ rows: [{ id: 1, event_type: "VENTURE_UPDATED" }] }); // history

      const { PATCH } = await import("@/app/api/ventures/[id]/route");

      const req = new Request("http://localhost:3000/api/ventures/VNT-ABCD1234", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company_name: "New Name" }),
      });
      const response = await PATCH(req, { params: { id: "VNT-ABCD1234" } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.venture.company_name).toBe("New Name");
    });

    it("should return 404 for non-existent venture on patch", async () => {
      db.execute.mockResolvedValue({ rows: [] });

      const { PATCH } = await import("@/app/api/ventures/[id]/route");

      const req = new Request("http://localhost:3000/api/ventures/VNT-NONEXISTENT", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company_name: "New Name" }),
      });
      const response = await PATCH(req, { params: { id: "VNT-NONEXISTENT" } });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
    });
  });
});
