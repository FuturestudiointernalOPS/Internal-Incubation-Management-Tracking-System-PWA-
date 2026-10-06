/**
 * Unit tests for Venture OS — Enhancement 1.2: Startup Profile Wizard
 *
 * read access and writes
 */


// Mock db
jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: {
    execute: jest.fn(),
  },
  initDb: jest.fn().mockResolvedValue(true),
}));

// Venture read access for staff is assignment-aware (Phase 2), so the
// delegated-assignment helper is mocked at the module level.
jest.mock("@/lib/ventureAuth", () => ({
  hasActiveVentureAssignment: jest.fn(),
}));

import db from "@/lib/db";
import { hasActiveVentureAssignment } from "@/lib/ventureAuth";
import { canEditStartupProfile,
  canReadStartupProfile,
  updateWizardStep,
  submitStartupProfile,
  uploadProfileDocument } from "@/services/ventures/profile";

describe("Startup Profile Wizard — read access and writes", () => {
  beforeEach(() => {
    // resetAllMocks (not clearAllMocks): clearAllMocks only clears call
    // history, so a mockResolvedValueOnce that a test queues but never
    // consumes (e.g. canEditStartupProfile short-circuits after the founder
    // check) leaks into the next test and shifts its db.execute queue.
    jest.resetAllMocks();
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

    it("should reject staff without a venture assignment (Phase 2)", async () => {
      hasActiveVentureAssignment.mockResolvedValue(false);
      const result = await canReadStartupProfile("VNT-001", {
        role: "staff",
        cid: "staff-001",
      });
      expect(result).toBe(false);
    });

    it("should allow staff with an active venture assignment to read", async () => {
      hasActiveVentureAssignment.mockResolvedValue(true);
      const result = await canReadStartupProfile("VNT-001", {
        role: "staff",
        cid: "staff-001",
      });
      expect(result).toBe(true);
      expect(hasActiveVentureAssignment).toHaveBeenCalledWith("VNT-001", "staff-001");
    });

    it("should reject program_manager without a venture assignment (Phase 2)", async () => {
      hasActiveVentureAssignment.mockResolvedValue(false);
      const result = await canReadStartupProfile("VNT-001", {
        role: "program_manager",
        cid: "pm-001",
      });
      expect(result).toBe(false);
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
