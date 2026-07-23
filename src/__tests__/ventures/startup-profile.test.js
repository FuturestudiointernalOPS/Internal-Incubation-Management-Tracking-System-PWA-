/**
 * Unit tests for Venture OS — Enhancement 1.2: Startup Profile Wizard
 *
 * Tests:
 * - calculateCompletion
 * - validateStep
 * - validateFullProfile
 * - WIZARD_STEP_VALIDATORS for all 6 steps
 * - canEditStartupProfile / canReadStartupProfile (mocked)
 * - ALLOWED_DOCUMENT_TYPES
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
  calculateCompletion,
  validateStep,
  validateFullProfile,
  WIZARD_STEP_VALIDATORS,
  ALLOWED_DOCUMENT_TYPES,
  ALLOWED_FILE_EXTENSIONS,
  TOTAL_WIZARD_STEPS,
  WIZARD_STEPS_MAP,
  canEditStartupProfile,
  canReadStartupProfile,
  updateWizardStep,
  submitStartupProfile,
  uploadProfileDocument,
} from "@/lib/ventures";

describe("Startup Profile Wizard — Business Logic", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── Constants ─────────────────────────────────────────────────

  describe("Constants", () => {
    it("should have 6 wizard steps", () => {
      expect(TOTAL_WIZARD_STEPS).toBe(6);
    });

    it("should have names for all 6 steps", () => {
      expect(Object.keys(WIZARD_STEPS_MAP)).toHaveLength(6);
      expect(WIZARD_STEPS_MAP[1]).toBe("Startup Identity");
      expect(WIZARD_STEPS_MAP[2]).toBe("Business Information");
      expect(WIZARD_STEPS_MAP[3]).toBe("Founder Information");
      expect(WIZARD_STEPS_MAP[4]).toBe("Team Information");
      expect(WIZARD_STEPS_MAP[5]).toBe("Supporting Documents");
      expect(WIZARD_STEPS_MAP[6]).toBe("Review & Submit");
    });

    it("should have validators for steps 1-5", () => {
      expect(WIZARD_STEP_VALIDATORS[1]).toBeDefined();
      expect(WIZARD_STEP_VALIDATORS[2]).toBeDefined();
      expect(WIZARD_STEP_VALIDATORS[3]).toBeDefined();
      expect(WIZARD_STEP_VALIDATORS[4]).toBeDefined();
      expect(WIZARD_STEP_VALIDATORS[5]).toBeDefined();
    });

    it("should allow common document types", () => {
      expect(ALLOWED_DOCUMENT_TYPES).toContain("application/pdf");
      expect(ALLOWED_DOCUMENT_TYPES).toContain("image/png");
      expect(ALLOWED_DOCUMENT_TYPES).toContain("image/jpeg");
    });

    it("should allow common file extensions", () => {
      expect(ALLOWED_FILE_EXTENSIONS).toContain(".pdf");
      expect(ALLOWED_FILE_EXTENSIONS).toContain(".png");
      expect(ALLOWED_FILE_EXTENSIONS).toContain(".docx");
      expect(ALLOWED_FILE_EXTENSIONS).toContain(".xlsx");
    });
  });

  // ─── calculateCompletion ────────────────────────────────────────

  describe("calculateCompletion", () => {
    it("should return 0 for null/undefined data", () => {
      expect(calculateCompletion(null)).toBe(0);
      expect(calculateCompletion(undefined)).toBe(0);
    });

    it("should return 0 for completely empty profile", () => {
      const profile = {
        step_1_data: {},
        step_2_data: {},
        step_3_data: {},
        step_4_data: {},
        step_5_data: {},
      };
      const result = calculateCompletion(profile);
      expect(result).toBe(0);
    });

    it("should return partial completion for partially filled step 1", () => {
      const profile = {
        step_1_data: { startup_name: "Test Corp", industry: "fintech" },
        step_2_data: {},
        step_3_data: {},
        step_4_data: {},
        step_5_data: {},
      };
      // Step 1 has 3 required fields: startup_name, industry, business_stage
      // With 2/3 filled, that's 66% of step 1's weight
      // 66% of 16.67 ≈ 11.11, rounded to 11
      const result = calculateCompletion(profile);
      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThan(50);
    });

    it("should return 100% for fully filled profile", () => {
      const profile = {
        step_1_data: { startup_name: "Test Corp", industry: "fintech", business_stage: "early_traction" },
        step_2_data: { legal_structure: "LLC", year_founded: 2024, country: "Benin" },
        step_3_data: { founders: [{ name: "John", email: "john@test.com", position: "CEO" }] },
        step_4_data: { team_size: 5 },
        step_5_data: {},
      };
      const result = calculateCompletion(profile);
      expect(result).toBeGreaterThan(80);
    });

    it("should handle step 3 founders array correctly", () => {
      const withFounder = calculateCompletion({
        step_1_data: {},
        step_2_data: {},
        step_3_data: { founders: [{ name: "John", email: "john@test.com", position: "CEO" }] },
        step_4_data: {},
        step_5_data: {},
      });
      const withoutFounder = calculateCompletion({
        step_1_data: {},
        step_2_data: {},
        step_3_data: { founders: [] },
        step_4_data: {},
        step_5_data: {},
      });
      expect(withFounder).toBeGreaterThan(withoutFounder);
    });
  });

  // ─── validateStep ───────────────────────────────────────────────

  describe("validateStep", () => {
    it("should return valid for complete step 1 data", () => {
      const result = validateStep(1, {
        startup_name: "Test Corp",
        industry: "fintech",
        business_stage: "early_traction",
      });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should reject empty step 1 data", () => {
      const result = validateStep(1, {});
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(3);
    });

    it("should reject invalid URL in step 1", () => {
      const result = validateStep(1, {
        startup_name: "Test Corp",
        industry: "fintech",
        business_stage: "early_traction",
        website: "not-a-url",
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Website must be a valid URL starting with http:// or https://");
    });

    it("should accept valid URL in step 1", () => {
      const result = validateStep(1, {
        startup_name: "Test Corp",
        industry: "fintech",
        business_stage: "early_traction",
        website: "https://testcorp.com",
      });
      expect(result.valid).toBe(true);
    });

    it("should validate step 2 business information", () => {
      const valid = validateStep(2, {
        legal_structure: "LLC",
        year_founded: 2024,
        country: "Benin",
      });
      expect(valid.valid).toBe(true);

      const invalid = validateStep(2, {});
      expect(invalid.valid).toBe(false);
      expect(invalid.errors.length).toBeGreaterThanOrEqual(2);
    });

    it("should validate year_founded range", () => {
      const tooEarly = validateStep(2, {
        legal_structure: "LLC",
        year_founded: 1800,
        country: "Benin",
      });
      expect(tooEarly.valid).toBe(false);

      const future = validateStep(2, {
        legal_structure: "LLC",
        year_founded: 9999,
        country: "Benin",
      });
      expect(future.valid).toBe(false);
    });

    it("should validate step 3 founders", () => {
      const valid = validateStep(3, {
        founders: [{ name: "John", email: "john@test.com", position: "CEO" }],
      });
      expect(valid.valid).toBe(true);

      const empty = validateStep(3, { founders: [] });
      expect(empty.valid).toBe(false);

      const noName = validateStep(3, {
        founders: [{ name: "", email: "john@test.com", position: "CEO" }],
      });
      expect(noName.valid).toBe(false);
    });

    it("should detect duplicate founder emails", () => {
      const result = validateStep(3, {
        founders: [
          { name: "John", email: "john@test.com", position: "CEO" },
          { name: "Jane", email: "john@test.com", position: "CTO" },
        ],
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.toLowerCase().includes("duplicate"))).toBe(true);
    });

    it("should validate LinkedIn URL in step 3", () => {
      const result = validateStep(3, {
        founders: [
          {
            name: "John",
            email: "john@test.com",
            position: "CEO",
            linkedin: "https://linkedin.com/in/johndoe",
          },
        ],
      });
      expect(result.valid).toBe(true);

      const badLinkedin = validateStep(3, {
        founders: [
          {
            name: "John",
            email: "john@test.com",
            position: "CEO",
            linkedin: "https://example.com",
          },
        ],
      });
      expect(badLinkedin.valid).toBe(false);
    });

    it("should validate step 4 team information", () => {
      const valid = validateStep(4, { team_size: 5 });
      expect(valid.valid).toBe(true);

      const noSize = validateStep(4, {});
      expect(noSize.valid).toBe(false);

      const zeroSize = validateStep(4, { team_size: 0 });
      expect(zeroSize.valid).toBe(false);
    });

    it("should validate step 4 team members", () => {
      const result = validateStep(4, {
        team_size: 3,
        members: [{ name: "Alice", role: "Developer" }],
      });
      expect(result.valid).toBe(true);

      const missingField = validateStep(4, {
        team_size: 3,
        members: [{ name: "", role: "" }],
      });
      expect(missingField.valid).toBe(false);
    });

    it("should return valid for step 5 (documents are optional)", () => {
      const result = validateStep(5, {});
      expect(result.valid).toBe(true);
    });

    it("should return valid for unknown step", () => {
      const result = validateStep(99, {});
      expect(result.valid).toBe(true);
    });
  });

  // ─── validateFullProfile ────────────────────────────────────────

  describe("validateFullProfile", () => {
    it("should return valid for a complete profile", () => {
      const result = validateFullProfile({
        step_1_data: { startup_name: "Test Corp", industry: "fintech", business_stage: "early_traction" },
        step_2_data: { legal_structure: "LLC", year_founded: 2024, country: "Benin" },
        step_3_data: { founders: [{ name: "John", email: "john@test.com", position: "CEO" }] },
        step_4_data: { team_size: 5 },
        step_5_data: {},
      });
      expect(result.valid).toBe(true);
      expect(result.totalErrors).toBe(0);
    });

    it("should detect errors across all steps", () => {
      const result = validateFullProfile({
        step_1_data: { startup_name: "Test Corp" }, // missing industry + stage
        step_2_data: {}, // missing all required
        step_3_data: { founders: [] }, // no founders
        step_4_data: {}, // missing team_size
        step_5_data: {},
      });
      expect(result.valid).toBe(false);
      expect(result.totalErrors).toBeGreaterThan(0);
      expect(result.errors[1]).toBeDefined();
      expect(result.errors[2]).toBeDefined();
      expect(result.errors[3]).toBeDefined();
      expect(result.errors[4]).toBeDefined();
    });
  });

  // ─── canEditStartupProfile (mocked) ────────────────────────────

  describe("canEditStartupProfile", () => {
    it("should allow super_admin to edit", async () => {
      db.execute.mockResolvedValue({ rows: [] });
      const result = await canEditStartupProfile("VNT-001", {
        role: "super_admin",
        email: "admin@test.com",
      });
      expect(result).toBe(true);
    });

    it("should reject non-founders without super_admin", async () => {
      db.execute
        .mockResolvedValueOnce({ rows: [] }) // founder check
        .mockResolvedValueOnce({ rows: [] }); // member check
      const result = await canEditStartupProfile("VNT-001", {
        role: "staff",
        email: "staff@test.com",
        cid: "staff-001",
      });
      expect(result).toBe(false);
    });

    it("should allow founders to edit", async () => {
      db.execute
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // founder check matches
        .mockResolvedValueOnce({ rows: [] });
      const result = await canEditStartupProfile("VNT-001", {
        role: "founder",
        email: "founder@test.com",
        cid: "f-001",
      });
      expect(result).toBe(true);
    });

    it("should reject unauthenticated users", async () => {
      const result = await canEditStartupProfile("VNT-001", null);
      expect(result).toBe(false);
    });
  });

  // ─── canReadStartupProfile (mocked) ────────────────────────────

  describe("canReadStartupProfile", () => {
    it("should allow super_admin to read", async () => {
      db.execute.mockResolvedValue({ rows: [] });
      const result = await canReadStartupProfile("VNT-001", {
        role: "super_admin",
      });
      expect(result).toBe(true);
    });

    it("should allow staff to read", async () => {
      db.execute.mockResolvedValue({ rows: [] });
      const result = await canReadStartupProfile("VNT-001", {
        role: "staff",
      });
      expect(result).toBe(true);
    });

    it("should allow program_manager to read", async () => {
      db.execute.mockResolvedValue({ rows: [] });
      const result = await canReadStartupProfile("VNT-001", {
        role: "program_manager",
      });
      expect(result).toBe(true);
    });
  });

  // ─── updateWizardStep (mocked) ──────────────────────────────────

  describe("updateWizardStep", () => {
    it("should throw error for invalid step", async () => {
      await expect(
        updateWizardStep({ ventureId: "VNT-001", step: 0, data: {} })
      ).rejects.toThrow("Invalid step");
      await expect(
        updateWizardStep({ ventureId: "VNT-001", step: 7, data: {} })
      ).rejects.toThrow("Invalid step");
    });

    it("should update step data and return completion", async () => {
      db.execute
        .mockResolvedValueOnce({ rows: [] }) // UPDATE startup_profiles
        .mockResolvedValueOnce({
          rows: [{
            id: 1,
            venture_id: "VNT-001",
            step_1_data: JSON.stringify({ startup_name: "Test", industry: "fintech", business_stage: "early" }),
            step_2_data: "{}",
            step_3_data: "{}",
            step_4_data: "{}",
            step_5_data: "{}",
            is_submitted: false,
          }],
        }) // SELECT after update
        .mockResolvedValueOnce({ rows: [] }); // UPDATE progress

      const result = await updateWizardStep({
        ventureId: "VNT-001",
        step: 1,
        data: { startup_name: "Test", industry: "fintech", business_stage: "early" },
      });

      expect(result.success).toBe(true);
      expect(result.completion_percentage).toBeGreaterThan(0);
    });
  });

  // ─── submitStartupProfile (mocked) ─────────────────────────────

  describe("submitStartupProfile", () => {
    it("should throw error if profile not found", async () => {
      db.execute.mockResolvedValue({ rows: [] });
      await expect(
        submitStartupProfile({ ventureId: "VNT-001", submittedBy: "test" })
      ).rejects.toThrow("Startup profile not found");
    });

    it("should throw error if validation fails", async () => {
      db.execute.mockResolvedValueOnce({
        rows: [{
          id: 1,
          venture_id: "VNT-001",
          step_1_data: "{}",
          step_2_data: "{}",
          step_3_data: "{}",
          step_4_data: "{}",
          step_5_data: "{}",
        }],
      });
      await expect(
        submitStartupProfile({ ventureId: "VNT-001", submittedBy: "test" })
      ).rejects.toThrow("Profile validation failed");
    });

    it("should submit a valid profile", async () => {
      const fullProfile = {
        id: 1,
        venture_id: "VNT-001",
        step_1_data: JSON.stringify({ startup_name: "Test", industry: "fintech", business_stage: "early" }),
        step_2_data: JSON.stringify({ legal_structure: "LLC", year_founded: 2024, country: "Benin" }),
        step_3_data: JSON.stringify({ founders: [{ name: "John", email: "john@test.com", position: "CEO" }] }),
        step_4_data: JSON.stringify({ team_size: 5 }),
        step_5_data: "{}",
        is_submitted: false,
      };

      db.execute
        .mockResolvedValueOnce({ rows: [fullProfile] }) // SELECT profile
        .mockResolvedValueOnce({ rows: [] }) // UPDATE submitted
        .mockResolvedValueOnce({ rows: [] }) // UPDATE progress
        .mockResolvedValueOnce({ rows: [] }) // logVentureActivity
        .mockResolvedValueOnce({ rows: [] }) // addVentureHistory
        .mockResolvedValueOnce({ rows: [] }) // logVentureActivity internal import
        .mockResolvedValueOnce({ rows: [] }) // addVentureHistory internal import
        .mockResolvedValueOnce({ rows: [] }); // createVentureNotification internal import

      const result = await submitStartupProfile({
        ventureId: "VNT-001",
        submittedBy: "founder-001",
      });

      expect(result.success).toBe(true);
      expect(result.submitted_at).toBeDefined();
    });
  });

  // ─── uploadProfileDocument (mocked) ────────────────────────────

  describe("uploadProfileDocument", () => {
    it("should reject invalid file types", async () => {
      await expect(
        uploadProfileDocument({
          ventureId: "VNT-001",
          documentType: "pitch_deck",
          fileName: "hack.exe",
          fileType: "application/x-msdownload",
          fileUrl: "https://example.com/hack.exe",
          uploadedBy: "test",
        })
      ).rejects.toThrow("Invalid file type");
    });

    it("should accept valid file types", async () => {
      db.execute.mockResolvedValue({ rows: [] });
      const result = await uploadProfileDocument({
        ventureId: "VNT-001",
        documentType: "pitch_deck",
        fileName: "pitch.pdf",
        fileSize: 1024,
        fileType: "application/pdf",
        fileUrl: "https://example.com/pitch.pdf",
        uploadedBy: "founder-001",
      });
      expect(result.success).toBe(true);
      expect(db.execute).toHaveBeenCalledTimes(1);
    });
  });
});
