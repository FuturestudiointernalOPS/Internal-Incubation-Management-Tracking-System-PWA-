/**
 * Unit tests for Venture OS — Workflow B: Direct Startup Registration
 *
 * Tests:
 * - generateVentureId format
 * - validateCompanyInfo validation rules
 * - checkDuplicates (mocked)
 * - createVenture (mocked)
 * - createFounder (mocked)
 * - logVentureActivity (mocked)
 * - addVentureHistory (mocked)
 * - createVentureNotification (mocked)
 * - getVentureById (mocked)
 * - updateVenture (mocked)
 */

// Mock db
jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: {
    execute: jest.fn(),
  },
  initDb: jest.fn().mockResolvedValue(true),
}));

import db from "@/lib/db";
import {
  generateVentureId,
  validateCompanyInfo,
  checkDuplicates,
  createVenture,
  createFounder,
  logVentureActivity,
  addVentureHistory,
  createVentureNotification,
  getVentureById,
  updateVenture,
} from "@/lib/ventures";

describe("Venture OS — Workflow B", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── generateVentureId ───────────────────────────────────────────

  describe("generateVentureId", () => {
    it("should generate a venture ID with VNT- prefix", () => {
      const id = generateVentureId();
      expect(id).toMatch(/^VNT-/);
    });

    it("should generate a unique ID each time", () => {
      const id1 = generateVentureId();
      const id2 = generateVentureId();
      expect(id1).not.toBe(id2);
    });

    it("should generate an ID with 8 characters after prefix", () => {
      const id = generateVentureId();
      const suffix = id.replace("VNT-", "");
      expect(suffix.length).toBe(8);
    });
  });

  // ─── validateCompanyInfo ─────────────────────────────────────────

  describe("validateCompanyInfo", () => {
    it("should return valid for complete, valid data", () => {
      const result = validateCompanyInfo({
        company_name: "TechFlow Inc.",
        industry: "fintech",
        business_stage: "early_traction",
        founder_email: "john@example.com",
        founder_name: "John Doe",
      });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should reject missing company name", () => {
      const result = validateCompanyInfo({
        company_name: "",
        industry: "fintech",
        business_stage: "early_traction",
        founder_email: "john@example.com",
        founder_name: "John Doe",
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Company name is required");
    });

    it("should reject missing industry", () => {
      const result = validateCompanyInfo({
        company_name: "TechFlow Inc.",
        industry: "",
        business_stage: "early_traction",
        founder_email: "john@example.com",
        founder_name: "John Doe",
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Industry is required");
    });

    it("should reject missing business stage", () => {
      const result = validateCompanyInfo({
        company_name: "TechFlow Inc.",
        industry: "fintech",
        business_stage: "",
        founder_email: "john@example.com",
        founder_name: "John Doe",
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Business stage is required");
    });

    it("should reject missing founder email", () => {
      const result = validateCompanyInfo({
        company_name: "TechFlow Inc.",
        industry: "fintech",
        business_stage: "early_traction",
        founder_email: "",
        founder_name: "John Doe",
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Founder email is required");
    });

    it("should reject invalid founder email format", () => {
      const result = validateCompanyInfo({
        company_name: "TechFlow Inc.",
        industry: "fintech",
        business_stage: "early_traction",
        founder_email: "not-an-email",
        founder_name: "John Doe",
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Invalid founder email format");
    });

    it("should reject missing founder name", () => {
      const result = validateCompanyInfo({
        company_name: "TechFlow Inc.",
        industry: "fintech",
        business_stage: "early_traction",
        founder_email: "john@example.com",
        founder_name: "",
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Founder name is required");
    });

    it("should return multiple errors when multiple fields are invalid", () => {
      const result = validateCompanyInfo({
        company_name: "",
        industry: "",
        business_stage: "",
        founder_email: "",
        founder_name: "",
      });
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(5);
    });
  });

  // ─── checkDuplicates ─────────────────────────────────────────────

  describe("checkDuplicates", () => {
    it("should return no conflicts when no duplicates exist", async () => {
      db.execute.mockResolvedValue({ rows: [] });

      const result = await checkDuplicates({
        company_name: "Unique Corp",
        registration_number: "RC-123",
        founder_email: "unique@example.com",
      });

      expect(result.hasDuplicates).toBe(false);
      expect(result.conflicts).toHaveLength(0);
    });

    it("should detect duplicate company name", async () => {
      db.execute
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // name check
        .mockResolvedValueOnce({ rows: [] }) // reg check
        .mockResolvedValueOnce({ rows: [] }); // email check

      const result = await checkDuplicates({
        company_name: "Existing Corp",
        registration_number: "RC-123",
        founder_email: "new@example.com",
      });

      expect(result.hasDuplicates).toBe(true);
      expect(result.conflicts).toContain("A company with this name already exists");
    });

    it("should detect duplicate registration number", async () => {
      db.execute
        .mockResolvedValueOnce({ rows: [] }) // name check
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // reg check
        .mockResolvedValueOnce({ rows: [] }); // email check

      const result = await checkDuplicates({
        company_name: "New Corp",
        registration_number: "RC-EXISTING",
        founder_email: "new@example.com",
      });

      expect(result.hasDuplicates).toBe(true);
      expect(result.conflicts).toContain("A company with this registration number already exists");
    });

    it("should detect duplicate founder email", async () => {
      db.execute
        .mockResolvedValueOnce({ rows: [] }) // name check
        .mockResolvedValueOnce({ rows: [] }) // reg check (registration_number is empty — query won't execute)
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }); // email check

      const result = await checkDuplicates({
        company_name: "New Corp",
        registration_number: "",
        founder_email: "existing@example.com",
      });

      expect(result.hasDuplicates).toBe(true);
      expect(result.conflicts).toContain("A founder with this email already exists");
    });
  });

  // ─── createVenture ───────────────────────────────────────────────

  describe("createVenture", () => {
    it("should insert a venture record", async () => {
      db.execute.mockResolvedValue({ rows: [{ venture_id: "VNT-ABCD1234" }] });

      const result = await createVenture({
        venture_id: "VNT-ABCD1234",
        company_name: "TechFlow Inc.",
        registration_number: "RC-123",
        industry: "fintech",
        business_stage: "early_traction",
        description: "A fintech startup",
        website: "https://techflow.io",
        created_by: "super_admin",
      });

      expect(result.venture_id).toBe("VNT-ABCD1234");
      expect(db.execute).toHaveBeenCalledTimes(1);
      expect(db.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          sql: expect.stringContaining("INSERT INTO ventures"),
        }),
      );
    });
  });

  // ─── createFounder ───────────────────────────────────────────────

  describe("createFounder", () => {
    it("should insert a founder record", async () => {
      db.execute.mockResolvedValue({ rows: [] });

      const result = await createFounder({
        venture_id: "VNT-ABCD1234",
        email: "john@example.com",
        name: "John Doe",
        phone: "+22900000000",
        title: "CEO",
        invitation_token: "token-123",
      });

      expect(result.email).toBe("john@example.com");
      expect(db.execute).toHaveBeenCalledTimes(1);
      expect(db.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          sql: expect.stringContaining("INSERT INTO venture_founders"),
        }),
      );
    });
  });

  // ─── logVentureActivity ──────────────────────────────────────────

  describe("logVentureActivity", () => {
    it("should insert an activity log entry", async () => {
      db.execute.mockResolvedValue({ rows: [] });

      await logVentureActivity({
        venture_id: "VNT-ABCD1234",
        action: "VENTURE_CREATED",
        actor_cid: "sa-001",
        actor_name: "Admin",
        details: { company_name: "TechFlow Inc." },
      });

      expect(db.execute).toHaveBeenCalledTimes(1);
      expect(db.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          sql: expect.stringContaining("INSERT INTO venture_activity_log"),
        }),
      );
    });
  });

  // ─── addVentureHistory ───────────────────────────────────────────

  describe("addVentureHistory", () => {
    it("should insert a history entry", async () => {
      db.execute.mockResolvedValue({ rows: [] });

      await addVentureHistory({
        venture_id: "VNT-ABCD1234",
        event_type: "PROFILE_WIZARD_INIT",
        description: "Wizard initialized",
        metadata: { step: 1, total_steps: 5 },
      });

      expect(db.execute).toHaveBeenCalledTimes(1);
      expect(db.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          sql: expect.stringContaining("INSERT INTO venture_history"),
        }),
      );
    });
  });

  // ─── createVentureNotification ──────────────────────────────────

  describe("createVentureNotification", () => {
    it("should insert a notification", async () => {
      db.execute.mockResolvedValue({ rows: [] });

      await createVentureNotification({
        recipient_id: "sa",
        title: "Startup Created",
        message: "Test startup created",
        type: "venture",
      });

      expect(db.execute).toHaveBeenCalledTimes(1);
      expect(db.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          sql: expect.stringContaining("INSERT INTO v2_notifications"),
        }),
      );
    });
  });

  // ─── getVentureById ─────────────────────────────────────────────

  describe("getVentureById", () => {
    it("should return null when venture not found", async () => {
      db.execute.mockResolvedValue({ rows: [] });

      const result = await getVentureById("VNT-NONEXISTENT");
      expect(result).toBeNull();
    });

    it("should return venture with related data when found", async () => {
      const mockVenture = {
        id: 1,
        venture_id: "VNT-ABCD1234",
        company_name: "TechFlow Inc.",
        industry: "fintech",
        business_stage: "early_traction",
        status: "active",
        created_at: "2024-01-01T00:00:00Z",
      };

      db.execute
        .mockResolvedValueOnce({ rows: [mockVenture] }) // venture query
        .mockResolvedValueOnce({ rows: [{ id: 1, email: "john@example.com", name: "John Doe" }] }) // founders
        .mockResolvedValueOnce({ rows: [] }) // members
        .mockResolvedValueOnce({ rows: [{ id: 1, action: "VENTURE_CREATED" }] }) // activity
        .mockResolvedValueOnce({ rows: [{ id: 1, event_type: "PROFILE_WIZARD_INIT" }] }); // history

      const result = await getVentureById("VNT-ABCD1234");

      expect(result).not.toBeNull();
      expect(result.venture_id).toBe("VNT-ABCD1234");
      expect(result.founders).toHaveLength(1);
      expect(result.members).toHaveLength(0);
      expect(result.activity).toHaveLength(1);
      expect(result.history).toHaveLength(1);
    });
  });

  // ─── updateVenture ──────────────────────────────────────────────

  describe("updateVenture", () => {
    it("should update allowed fields", async () => {
      db.execute.mockResolvedValue({ rows: [] });

      const result = await updateVenture("VNT-ABCD1234", {
        company_name: "New Name",
        description: "Updated description",
        status: "active",
      });

      expect(result.updated).toBe(true);
      expect(db.execute).toHaveBeenCalledTimes(1);
      const callArgs = db.execute.mock.calls[0][0];
      expect(callArgs.sql).toContain("UPDATE ventures");
      expect(callArgs.sql).toContain("company_name = ?");
      expect(callArgs.sql).toContain("description = ?");
      expect(callArgs.sql).toContain("status = ?");
    });

    it("should return updated: false when no allowed fields provided", async () => {
      const result = await updateVenture("VNT-ABCD1234", {
        invalid_field: "test",
      });

      expect(result.updated).toBe(false);
      expect(db.execute).not.toHaveBeenCalled();
    });

    it("should not update non-allowed fields", async () => {
      db.execute.mockResolvedValue({ rows: [] });

      await updateVenture("VNT-ABCD1234", {
        company_name: "Valid Name",
        created_by: "hacker",
      });

      expect(db.execute).toHaveBeenCalledTimes(1);
      const callSql = db.execute.mock.calls[0][0].sql;
      expect(callSql).toContain("company_name");
      expect(callSql).not.toContain("created_by");
    });
  });
});
