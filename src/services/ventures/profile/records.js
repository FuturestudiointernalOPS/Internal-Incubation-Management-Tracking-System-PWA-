/**
 * profile — Startup-profile records: read/create, step updates, validation, submit, documents.
 *
 * Part of `services/ventures/profile` (split out of the former single
 * 441-line module, lane L2; code moved verbatim). The public surface is
 * re-exported unchanged by `src/services/ventures/profile.js`.
 */
import {
  completeProfileProgress,
  deleteProfileDocumentRow,
  insertProfileProgress,
  insertStartupProfile,
  markProfileSubmitted,
  selectProfileDocuments,
  selectProfileProgress,
  selectStartupProfile,
  updateProfileProgress,
  updateProfileStepColumn,
  upsertProfileDocument,
} from "@/models/ventureProfileStore";
import { addVentureHistory, logVentureActivity } from "@/services/ventures/activity";
import {
  ALLOWED_DOCUMENT_TYPES,
  TOTAL_WIZARD_STEPS,
  WIZARD_STEP_VALIDATORS,
  calculateCompletion,
  parseStepData,
} from "./wizard";

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
