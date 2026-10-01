/**
 * VENTURE STARTUP-PROFILE WIZARD.
 *
 * The 6-step wizard that captures a Venture's startup profile: the per-step
 * validation rules (pure), the completion calculation (pure), the profile /
 * progress readers and writers, the document upsert, and the edit/read access
 * checks (founder-or-super-admin to edit; delegated staff or founder to read).
 *
 * The decisions — which step column to write, how completion is weighted, who
 * may edit or read — live here; every statement is in
 * `@/models/ventureProfileStore`. Nothing here runs SQL.
 *
 * Re-exported unchanged through `@/lib/ventures` (the module it came from) —
 * see docs/LAYER_SPLIT.md.
 */

import {
  selectStartupProfile,
  insertStartupProfile,
  selectProfileProgress,
  insertProfileProgress,
  updateProfileStepColumn,
  updateProfileProgress,
  markProfileSubmitted,
  completeProfileProgress,
  selectProfileDocuments,
  upsertProfileDocument,
  deleteProfileDocumentRow,
  selectFounderIdByEmail,
  selectFounderMemberIdByCid,
  selectVentureCodeByIdText,
} from "@/models/ventureProfileStore";
import { logVentureActivity, addVentureHistory } from "@/services/ventures/activity";

/**
 * Validation rules for each wizard step.
 * Keyed by step number (1-6).
 */
export const WIZARD_STEP_VALIDATORS = {
  1: { // Startup Identity
    required: ["startup_name", "industry", "business_stage"],
    optional: ["tagline", "logo", "website"],
    validate: (data) => {
      const errors = [];
      if (!data.startup_name?.trim()) errors.push("Startup name is required");
      if (!data.industry?.trim()) errors.push("Industry is required");
      if (!data.business_stage?.trim()) errors.push("Business stage is required");
      if (data.website && !/^https?:\/\/.+/.test(data.website)) errors.push("Website must be a valid URL starting with http:// or https://");
      return errors;
    },
  },
  2: { // Business Information
    required: ["legal_structure", "year_founded", "country"],
    optional: ["registration_number", "city", "address", "description"],
    validate: (data) => {
      const errors = [];
      if (!data.legal_structure?.trim()) errors.push("Legal structure is required");
      if (!data.year_founded) errors.push("Year founded is required");
      else if (isNaN(data.year_founded) || data.year_founded < 1900 || data.year_founded > new Date().getFullYear()) {
        errors.push("Year founded must be a valid year between 1900 and " + new Date().getFullYear());
      }
      if (!data.country?.trim()) errors.push("Country is required");
      return errors;
    },
  },
  3: { // Founder Information
    required: ["founders"],
    optional: [],
    validate: (data) => {
      const errors = [];
      if (!Array.isArray(data.founders) || data.founders.length === 0) {
        errors.push("At least one founder is required");
        return errors;
      }
      const emails = new Set();
      data.founders.forEach((founder, index) => {
        if (!founder.name?.trim()) errors.push(`Founder ${index + 1}: Name is required`);
        if (!founder.email?.trim()) errors.push(`Founder ${index + 1}: Email is required`);
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(founder.email)) errors.push(`Founder ${index + 1}: Invalid email format`);
        else if (emails.has(founder.email.toLowerCase())) errors.push(`Founder ${index + 1}: Duplicate email`);
        else emails.add(founder.email.toLowerCase());
        if (!founder.position?.trim()) errors.push(`Founder ${index + 1}: Position is required`);
        if (founder.linkedin && !/^https?:\/\/(www\.)?linkedin\.com\/.+/.test(founder.linkedin)) {
          errors.push(`Founder ${index + 1}: LinkedIn must be a valid LinkedIn URL`);
        }
      });
      return errors;
    },
  },
  4: { // Team Information
    required: ["team_size"],
    optional: ["members"],
    validate: (data) => {
      const errors = [];
      if (!data.team_size && data.team_size !== 0) errors.push("Team size is required");
      else if (isNaN(data.team_size) || data.team_size < 1) errors.push("Team size must be at least 1");
      if (Array.isArray(data.members)) {
        data.members.forEach((member, index) => {
          if (!member.name?.trim()) errors.push(`Member ${index + 1}: Name is required`);
          if (!member.role?.trim()) errors.push(`Member ${index + 1}: Role is required`);
        });
      }
      return errors;
    },
  },
  5: { // Supporting Documents
    required: [],
    optional: ["documents"],
    validate: (_data) => {
      // Document validation happens at upload time
      return [];
    },
  },
};

/**
 * Allowed file types for document uploads.
 */
export const ALLOWED_DOCUMENT_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
];

export const ALLOWED_FILE_EXTENSIONS = [".pdf", ".png", ".jpg", ".jpeg", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx"];

/**
 * Map of step number to step name for the 6-step wizard.
 */
export const WIZARD_STEPS_MAP = {
  1: "Startup Identity",
  2: "Business Information",
  3: "Founder Information",
  4: "Team Information",
  5: "Supporting Documents",
  6: "Review & Submit",
};

export const TOTAL_WIZARD_STEPS = 6;

/**
 * Calculate completion percentage from the required content steps only.
 * Optional / review-only steps (Supporting Documents, Review) never block
 * completion: the denominator is the steps that carry required fields
 * (steps 1-4 today), so a profile whose required content is filled reaches
 * 100 even without uploaded documents.
 */
export function calculateCompletion(profileData) {
  if (!profileData) return 0;

  const requiredStepNumbers = [];
  for (let step = 1; step <= TOTAL_WIZARD_STEPS; step++) {
    const validator = WIZARD_STEP_VALIDATORS[step];
    if (validator && validator.required.length > 0) requiredStepNumbers.push(step);
  }
  if (requiredStepNumbers.length === 0) return 0;

  const stepWeight = 100 / requiredStepNumbers.length;
  let totalPercent = 0;

  for (const step of requiredStepNumbers) {
    const validator = WIZARD_STEP_VALIDATORS[step];
    const stepData = profileData[`step_${step}_data`] || {};
    const requiredFields = validator.required;

    let filledCount = 0;
    for (const field of requiredFields) {
      const fieldValue = stepData[field];
      if (field === "team_size") {
        if (fieldValue !== undefined && fieldValue !== null && fieldValue !== "") filledCount++;
      } else if (field === "founders") {
        if (Array.isArray(fieldValue) && fieldValue.length > 0) filledCount++;
      } else if (Array.isArray(fieldValue)) {
        if (fieldValue.length > 0) filledCount++;
      } else if (typeof fieldValue === "string" && fieldValue.trim()) {
        filledCount++;
      } else if (typeof fieldValue === "number" || typeof fieldValue === "boolean") {
        filledCount++;
      }
    }

    totalPercent += (filledCount / requiredFields.length) * stepWeight;
  }

  return Math.min(Math.round(totalPercent), 100);
}

/** Parse the `step_N_data` JSON columns of a startup_profiles row in place. */
function parseStepData(profile) {
  for (let i = 1; i <= TOTAL_WIZARD_STEPS; i++) {
    const key = `step_${i}_data`;
    if (typeof profile[key] === "string") {
      try { profile[key] = JSON.parse(profile[key]); } catch { profile[key] = {}; }
    }
  }
  return profile;
}

/**
 * Get or create startup profile for a venture.
 */
export async function getOrCreateStartupProfile(ventureId) {
  // Check if profile exists
  let profileRes = await selectStartupProfile(ventureId);

  let profile;
  if (profileRes.rows.length === 0) {
    // Create profile
    await insertStartupProfile(ventureId);
    profileRes = await selectStartupProfile(ventureId);
  }
  profile = profileRes.rows[0];

  // Parse JSON fields
  parseStepData(profile);

  // Get or create progress
  let progressRes = await selectProfileProgress(ventureId);

  let progress;
  if (progressRes.rows.length === 0) {
    await insertProfileProgress(ventureId);
    progressRes = await selectProfileProgress(ventureId);
  }
  progress = progressRes.rows[0];

  // Get documents
  const docsRes = await selectProfileDocuments(ventureId);

  return {
    profile,
    progress,
    documents: docsRes.rows || [],
    completion_percentage: calculateCompletion(profile),
  };
}

/**
 * Update a specific wizard step's data (autosave).
 * Recalculates completion percentage and updates progress.
 */
export async function updateWizardStep({ ventureId, step, data }) {
  if (step < 1 || step > TOTAL_WIZARD_STEPS) {
    throw new Error(`Invalid step: ${step}. Must be 1-${TOTAL_WIZARD_STEPS}.`);
  }

  const stepColumn = `step_${step}_data`;
  const serialized = JSON.stringify(data || {});

  await updateProfileStepColumn(ventureId, stepColumn, serialized);

  // Recalculate completion
  const profileRes = await selectStartupProfile(ventureId);

  if (profileRes.rows.length === 0) return { success: false };

  const profile = profileRes.rows[0];
  parseStepData(profile);

  const completionPercentage = calculateCompletion(profile);
  const lastCompletedStep = Math.max(0, step);

  // Update progress - store current_step as the step being worked on
  await updateProfileProgress(ventureId, step, completionPercentage, lastCompletedStep);

  return {
    success: true,
    completion_percentage: completionPercentage,
    current_step: step,
  };
}

/**
 * Validate a single wizard step.
 */
export function validateStep(step, data) {
  const validator = WIZARD_STEP_VALIDATORS[step];
  if (!validator) return { valid: true, errors: [] };
  const errors = validator.validate(data || {});
  return { valid: errors.length === 0, errors };
}

/**
 * Validate the full profile across all 6 steps before submission.
 */
export function validateFullProfile(profileData) {
  const allErrors = {};
  let totalErrors = 0;

  for (let step = 1; step < TOTAL_WIZARD_STEPS; step++) {
    // Step 5 (documents) and step 6 (review) don't have strict validation
    if (step === 5) continue;
    const stepData = profileData[`step_${step}_data`] || {};
    const result = validateStep(step, stepData);
    if (!result.valid) {
      allErrors[step] = result.errors;
      totalErrors += result.errors.length;
    }
  }

  return { valid: totalErrors === 0, errors: allErrors, totalErrors };
}

/**
 * Submit the startup profile (final step).
 */
export async function submitStartupProfile({ ventureId, submittedBy }) {
  // Get profile
  const profileRes = await selectStartupProfile(ventureId);

  if (profileRes.rows.length === 0) {
    throw new Error("Startup profile not found. Complete the wizard first.");
  }

  const profile = profileRes.rows[0];

  // Parse JSON
  const profileData = {};
  for (let i = 1; i <= TOTAL_WIZARD_STEPS; i++) {
    const key = `step_${i}_data`;
    if (typeof profile[key] === "string") {
      try { profileData[key] = JSON.parse(profile[key]); } catch { profileData[key] = {}; }
    } else {
      profileData[key] = profile[key] || {};
    }
  }

  // Validate full profile
  const validation = validateFullProfile(profileData);
  if (!validation.valid) {
    throw new Error(`Profile validation failed: ${validation.totalErrors} errors found.`);
  }

  // Mark as submitted
  const now = new Date().toISOString();
  await markProfileSubmitted(ventureId, now);

  await completeProfileProgress(ventureId, TOTAL_WIZARD_STEPS);

  // Log activity
  await logVentureActivity({
    venture_id: ventureId,
    action: "PROFILE_SUBMITTED",
    actor_cid: submittedBy || "system",
    actor_name: "Founder",
    details: { completed_steps: TOTAL_WIZARD_STEPS, submitted_at: now },
  });

  await addVentureHistory({
    venture_id: ventureId,
    event_type: "PROFILE_SUBMITTED",
    description: "Startup profile submitted successfully",
    metadata: { completed_steps: TOTAL_WIZARD_STEPS, submitted_at: now },
  });

  return { success: true, submitted_at: now };
}

/**
 * Upload a document for the startup profile.
 */
export async function uploadProfileDocument({ ventureId, documentType, fileName, fileSize, fileType, fileUrl, uploadedBy }) {
  if (!ALLOWED_DOCUMENT_TYPES.includes(fileType)) {
    throw new Error(`Invalid file type: ${fileType}. Allowed types: PDF, PNG, JPG, DOC, DOCX, XLS, XLSX, PPT, PPTX`);
  }

  await upsertProfileDocument({ ventureId, documentType, fileName, fileSize, fileType, fileUrl, uploadedBy });

  return { success: true };
}

/**
 * Delete a document from the startup profile.
 */
export async function deleteProfileDocument({ ventureId, documentId }) {
  await deleteProfileDocumentRow(ventureId, documentId);
  return { success: true };
}

/**
 * Check if a user is authorized to edit a venture's startup profile.
 */
export async function canEditStartupProfile(ventureId, session) {
  if (!session) return false;
  if (session.role === "super_admin") return true;

  // Check if user is a founder of this venture
  const founderRes = await selectFounderIdByEmail(ventureId, session.email || "");
  if (founderRes.rows.length > 0) return true;

  // Check if user is a member with founder-like role
  const memberRes = await selectFounderMemberIdByCid(ventureId, session.cid);
  if (memberRes.rows.length > 0) return true;

  return false;
}

/**
 * Delegated staff read helper (Phase 2 — assignment-aware): a staff or
 * program_manager may act on a Venture only when they hold an explicit
 * active staff assignment (venture_staff_assignments). Resolves the VNT
 * code when passed the internal UUID.
 */
async function hasDelegatedVentureAssignment(ventureId, session) {
  if (!session?.cid) return false;
  try {
    const { hasActiveVentureAssignment } = await import("@/lib/ventureAuth");
    let code = ventureId;
    if (typeof ventureId === "string" && /[a-f0-9-]{36}/i.test(ventureId)) {
      const byId = await selectVentureCodeByIdText(ventureId);
      if (byId.rows?.[0]) code = byId.rows[0].venture_id;
    }
    return await hasActiveVentureAssignment(code, session.cid);
  } catch (_) {
    return false;
  }
}

/**
 * Check if a user has read access to a venture's startup profile.
 */
export async function canReadStartupProfile(ventureId, session) {
  if (!session) return false;
  if (session.role === "super_admin") return true;

  // Delegated staff (Phase 2): read access derives from an explicit Venture
  // assignment — never from the staff role alone.
  if (["staff", "program_manager"].includes(session.role)) {
    return hasDelegatedVentureAssignment(ventureId, session);
  }

  // Founders can read
  return canEditStartupProfile(ventureId, session);
}
