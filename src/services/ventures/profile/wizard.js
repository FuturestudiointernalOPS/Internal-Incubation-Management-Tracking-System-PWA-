/**
 * profile — The startup-profile wizard: step validators, constants, completion, step data.
 *
 * Part of `services/ventures/profile` (split out of the former single
 * 441-line module, lane L2; code moved verbatim). The public surface is
 * re-exported unchanged by `src/services/ventures/profile.js`.
 */

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
export function parseStepData(profile) {
  for (let i = 1; i <= TOTAL_WIZARD_STEPS; i++) {
    const key = `step_${i}_data`;
    if (typeof profile[key] === "string") {
      try { profile[key] = JSON.parse(profile[key]); } catch { profile[key] = {}; }
    }
  }
  return profile;
}
