import db, { initDb } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";

/**
 * VENTURE OS — Shared Business Logic
 * Enhancement 1.1 — Workflow B: Direct Startup Registration
 * Enhancement 1.1 — Workflow A: Program-to-Venture Promotion
 */

const VENTURE_ID_PREFIX = "VNT";

/**
 * Ensure venture schema is up to date.
 * Adds missing columns safely using ALTER TABLE IF NOT EXISTS.
 * This is safe to call on every request; it's a no-op if columns exist.
 */
export async function ensureVentureSchema() {
  const migrations = [
    // Ventures table columns
    "ALTER TABLE ventures ADD COLUMN IF NOT EXISTS company_name TEXT",
    "ALTER TABLE ventures ADD COLUMN IF NOT EXISTS registration_number TEXT",
    "ALTER TABLE ventures ADD COLUMN IF NOT EXISTS industry TEXT",
    "ALTER TABLE ventures ADD COLUMN IF NOT EXISTS business_stage TEXT",
    "ALTER TABLE ventures ADD COLUMN IF NOT EXISTS description TEXT",
    "ALTER TABLE ventures ADD COLUMN IF NOT EXISTS website TEXT",
    "ALTER TABLE ventures ADD COLUMN IF NOT EXISTS logo_url TEXT",
    "ALTER TABLE ventures ADD COLUMN IF NOT EXISTS created_by TEXT",
    "ALTER TABLE ventures ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()",
    "ALTER TABLE ventures ADD COLUMN IF NOT EXISTS venture_id TEXT",
    // Venture founders columns
    "ALTER TABLE venture_founders ADD COLUMN IF NOT EXISTS phone TEXT",
    "ALTER TABLE venture_founders ADD COLUMN IF NOT EXISTS title TEXT",
    "ALTER TABLE venture_founders ADD COLUMN IF NOT EXISTS invitation_token TEXT",
    "ALTER TABLE venture_founders ADD COLUMN IF NOT EXISTS invitation_sent_at TIMESTAMP",
    "ALTER TABLE venture_founders ADD COLUMN IF NOT EXISTS invitation_accepted_at TIMESTAMP",
    "ALTER TABLE venture_founders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()",
    "ALTER TABLE venture_founders ADD COLUMN IF NOT EXISTS email TEXT",
    "ALTER TABLE venture_founders ADD COLUMN IF NOT EXISTS name TEXT",
    // Venture members columns
    "ALTER TABLE venture_members ADD COLUMN IF NOT EXISTS joined_at TIMESTAMP DEFAULT NOW()",
    // Founder management columns
    "ALTER TABLE venture_founders ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'founder'",
    "ALTER TABLE venture_founders ADD COLUMN IF NOT EXISTS is_owner BOOLEAN DEFAULT FALSE",
    "ALTER TABLE venture_founders ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMP",
    "ALTER TABLE venture_founders ADD COLUMN IF NOT EXISTS suspended_by TEXT",
    "ALTER TABLE venture_founders ADD COLUMN IF NOT EXISTS invitation_expires_at TIMESTAMP",
    // Verification tables
    "CREATE TABLE IF NOT EXISTS venture_verifications (id SERIAL PRIMARY KEY, venture_id TEXT NOT NULL UNIQUE REFERENCES ventures(venture_id) ON DELETE CASCADE, status TEXT NOT NULL DEFAULT 'draft', submitted_at TIMESTAMP, reviewed_by TEXT, reviewed_at TIMESTAMP, reviewer_notes TEXT, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW())",
    "CREATE TABLE IF NOT EXISTS venture_verification_items (id SERIAL PRIMARY KEY, verification_id INTEGER NOT NULL REFERENCES venture_verifications(id) ON DELETE CASCADE, category TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', notes TEXT, reviewed_by TEXT, reviewed_at TIMESTAMP, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW(), UNIQUE(verification_id, category))",
    "CREATE TABLE IF NOT EXISTS venture_verification_documents (id SERIAL PRIMARY KEY, verification_id INTEGER NOT NULL REFERENCES venture_verifications(id) ON DELETE CASCADE, category TEXT NOT NULL, document_type TEXT NOT NULL, file_name TEXT NOT NULL, file_size BIGINT, file_type TEXT, file_url TEXT NOT NULL, uploaded_by TEXT, uploaded_at TIMESTAMP DEFAULT NOW())",
    "CREATE TABLE IF NOT EXISTS venture_verification_history (id SERIAL PRIMARY KEY, verification_id INTEGER NOT NULL REFERENCES venture_verifications(id) ON DELETE CASCADE, action TEXT NOT NULL, previous_status TEXT, new_status TEXT, actor_cid TEXT, actor_name TEXT, notes TEXT, metadata JSONB DEFAULT '{}'::jsonb, created_at TIMESTAMP DEFAULT NOW())",
    "CREATE TABLE IF NOT EXISTS venture_verification_reviews (id SERIAL PRIMARY KEY, verification_id INTEGER NOT NULL REFERENCES venture_verifications(id) ON DELETE CASCADE, reviewer_cid TEXT NOT NULL, reviewer_name TEXT, decision TEXT NOT NULL, notes TEXT, created_at TIMESTAMP DEFAULT NOW())",
    "CREATE TABLE IF NOT EXISTS venture_verification_comments (id SERIAL PRIMARY KEY, verification_id INTEGER NOT NULL REFERENCES venture_verifications(id) ON DELETE CASCADE, author_type TEXT NOT NULL, author_cid TEXT, author_name TEXT, message TEXT NOT NULL, created_at TIMESTAMP DEFAULT NOW())",
  ];

  for (const sql of migrations) {
    try {
      await db.execute(sql);
    } catch (_) {
      // Table might not exist yet; that's ok
    }
  }

  // Copy name -> company_name for any existing rows
  try {
    await db.execute(
      "UPDATE ventures SET company_name = name WHERE company_name IS NULL AND name IS NOT NULL"
    );
  } catch (_) {}
}

/**
 * Generate a unique Venture ID in format: VNT-XXXXXXXX
 */
export function generateVentureId() {
  const suffix = uuidv4().replace(/-/g, "").substring(0, 8).toUpperCase();
  return `${VENTURE_ID_PREFIX}-${suffix}`;
}

/**
 * Validate company information for registration.
 * Returns { valid: boolean, errors: string[] }
 */
export function validateCompanyInfo({
  company_name,
  registration_number,
  industry,
  business_stage,
  founder_email,
  founder_name,
}) {
  const errors = [];

  if (!company_name || !company_name.trim()) {
    errors.push("Company name is required");
  }

  if (!industry || !industry.trim()) {
    errors.push("Industry is required");
  }

  if (!business_stage || !business_stage.trim()) {
    errors.push("Business stage is required");
  }

  if (!founder_email || !founder_email.trim()) {
    errors.push("Founder email is required");
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(founder_email)) {
    errors.push("Invalid founder email format");
  }

  if (!founder_name || !founder_name.trim()) {
    errors.push("Founder name is required");
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Check for duplicate company, registration number, or founder email.
 * Returns { hasDuplicates: boolean, conflicts: string[] }
 */
export async function checkDuplicates({ company_name, registration_number, founder_email }) {
  const conflicts = [];

  // Check duplicate company name
  // Try company_name first, fall back to name for backward compat
  try {
    const nameCheck = await db.execute({
      sql: "SELECT id FROM ventures WHERE LOWER(company_name) = LOWER(?)",
      args: [company_name.trim()],
    });
    if (nameCheck.rows.length > 0) {
      conflicts.push("A company with this name already exists");
    }
  } catch (_) {
    // company_name column may not exist yet; try "name" as fallback
    try {
      const fallbackCheck = await db.execute({
        sql: "SELECT id FROM ventures WHERE LOWER(name) = LOWER(?)",
        args: [company_name.trim()],
      });
      if (fallbackCheck.rows.length > 0) {
        conflicts.push("A company with this name already exists");
      }
    } catch (_) {}
  }

  // Check duplicate registration number
  if (registration_number && registration_number.trim()) {
    const regCheck = await db.execute({
      sql: "SELECT id FROM ventures WHERE registration_number = ?",
      args: [registration_number.trim()],
    });
    if (regCheck.rows.length > 0) {
      conflicts.push("A company with this registration number already exists");
    }
  }

  // Check duplicate founder email
  const emailCheck = await db.execute({
    sql: "SELECT id FROM venture_founders WHERE LOWER(email) = LOWER(?)",
    args: [founder_email.trim()],
  });
  if (emailCheck.rows.length > 0) {
    conflicts.push("A founder with this email already exists");
  }

  return { hasDuplicates: conflicts.length > 0, conflicts };
}

/**
 * Create a venture record.
 */
export async function createVenture({
  venture_id,
  company_name,
  registration_number,
  industry,
  business_stage,
  description,
  website,
  logo_url,
  created_by,
}) {
  // Try with company_name first (new schema), fall back to "name" (legacy schema)
  try {
    await db.execute({
      sql: `INSERT INTO ventures (venture_id, company_name, registration_number, industry, business_stage, description, website, logo_url, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        venture_id,
        company_name.trim(),
        registration_number?.trim() || null,
        industry.trim(),
        business_stage.trim(),
        description?.trim() || null,
        website?.trim() || null,
        logo_url?.trim() || null,
        created_by,
      ],
    });
  } catch (err) {
    // If company_name column doesn't exist, try with "name" instead
    if (err.message?.includes("company_name")) {
      await db.execute({
        sql: `INSERT INTO ventures (venture_id, name, registration_number, industry, business_stage, description, website, logo_url, created_by)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          venture_id,
          company_name.trim(),
          registration_number?.trim() || null,
          industry.trim(),
          business_stage.trim(),
          description?.trim() || null,
          website?.trim() || null,
          logo_url?.trim() || null,
          created_by,
        ],
      });
    } else {
      throw err;
    }
  }

  return { venture_id };
}

/**
 * Create a founder record for a venture.
 */
export async function createFounder({
  venture_id,
  email,
  name,
  phone,
  title,
  invitation_token,
}) {
  await db.execute({
    sql: `INSERT INTO venture_founders (venture_id, email, name, phone, title, invitation_token, invitation_sent_at, status)
          VALUES (?, ?, ?, ?, ?, ?, NOW(), 'pending')`,
    args: [
      venture_id,
      email.trim().toLowerCase(),
      name.trim(),
      phone?.trim() || null,
      title?.trim() || null,
      invitation_token,
    ],
  });

  return { email };
}

/**
 * Add a member to a venture.
 */
export async function addVentureMember({
  venture_id,
  user_cid,
  role = "member",
}) {
  await db.execute({
    sql: `INSERT INTO venture_members (venture_id, user_cid, role)
          VALUES (?, ?, ?)
          ON CONFLICT (venture_id, user_cid) DO UPDATE SET role = ?`,
    args: [
      venture_id,
      user_cid,
      role,
      role,
    ],
  });

  return { user_cid };
}

/**
 * Log a venture activity event.
 */
export async function logVentureActivity({
  venture_id,
  action,
  actor_cid,
  actor_name,
  details = {},
}) {
  await db.execute({
    sql: `INSERT INTO venture_activity_log (venture_id, action, actor_cid, actor_name, details)
          VALUES (?, ?, ?, ?, ?::jsonb)`,
    args: [
      venture_id,
      action,
      actor_cid,
      actor_name || "",
      JSON.stringify(details),
    ],
  });
}

/**
 * Add venture history entry (startup profile wizard step).
 */
export async function addVentureHistory({
  venture_id,
  event_type,
  description,
  metadata = {},
}) {
  await db.execute({
    sql: `INSERT INTO venture_history (venture_id, event_type, description, metadata)
          VALUES (?, ?, ?, ?::jsonb)`,
    args: [
      venture_id,
      event_type,
      description || "",
      JSON.stringify(metadata),
    ],
  });
}

/**
 * Create a notification for a venture event.
 */
export async function createVentureNotification({
  recipient_id,
  title,
  message,
  type = "venture",
}) {
  await db.execute({
    sql: `INSERT INTO v2_notifications (recipient_id, title, message, type, is_read, created_at)
          VALUES (?, ?, ?, ?, 0, NOW())`,
    args: [recipient_id, title, message, type],
  });
}

/**
 * Send invitation email to a founder.
 */
export async function sendFounderInvitation({ email, name, venture_name, token }) {
  // Use the existing email service
  const { sendInviteEmail } = await import("@/lib/email");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const activationUrl = `${appUrl}/activate?token=${token}&venture=${encodeURIComponent(venture_name)}`;

  return sendInviteEmail({
    to: email,
    name,
    role: "Founder",
    token,
  });
}

/**
 * Get a venture by its venture_id with founder info.
 */
export async function getVentureById(ventureId) {
  const ventureRes = await db.execute({
    sql: "SELECT * FROM ventures WHERE venture_id = ?",
    args: [ventureId],
  });

  if (ventureRes.rows.length === 0) return null;

  const venture = ventureRes.rows[0];

  // Get founders
  const foundersRes = await db.execute({
    sql: "SELECT * FROM venture_founders WHERE venture_id = ? ORDER BY created_at ASC",
    args: [ventureId],
  });

  // Get members
  const membersRes = await db.execute({
    sql: `SELECT vm.*, c.name, c.email
          FROM venture_members vm
          LEFT JOIN contacts c ON vm.user_cid = c.cid
          WHERE vm.venture_id = ?`,
    args: [ventureId],
  });

  // Get recent activity
  const activityRes = await db.execute({
    sql: "SELECT * FROM venture_activity_log WHERE venture_id = ? ORDER BY created_at DESC LIMIT 20",
    args: [ventureId],
  });

  // Get history
  const historyRes = await db.execute({
    sql: "SELECT * FROM venture_history WHERE venture_id = ? ORDER BY created_at ASC",
    args: [ventureId],
  });

  // Get startup profile progress
  let profileProgress = null;
  try {
    const progressRes = await db.execute({
      sql: "SELECT * FROM startup_profile_progress WHERE venture_id = ?",
      args: [ventureId],
    });
    profileProgress = progressRes.rows[0] || null;
  } catch (_) {}

  return {
    ...venture,
    founders: foundersRes.rows,
    members: membersRes.rows,
    activity: activityRes.rows,
    history: historyRes.rows,
    profile_progress: profileProgress,
  };
}

/**
 * Update a venture record.
 */
export async function updateVenture(ventureId, updates) {
  const allowedFields = [
    "company_name",
    "registration_number",
    "industry",
    "business_stage",
    "description",
    "website",
    "logo_url",
    "status",
  ];

  const setClauses = [];
  const args = [];

  for (const field of allowedFields) {
    if (updates[field] !== undefined) {
      setClauses.push(`${field} = ?`);
      args.push(updates[field]);
    }
  }

  if (setClauses.length === 0) {
    return { updated: false };
  }

  setClauses.push("updated_at = NOW()");
  args.push(ventureId);

  await db.execute({
    sql: `UPDATE ventures SET ${setClauses.join(", ")} WHERE venture_id = ?`,
    args: args,
  });

  return { updated: true };
}

// =============================================================================
// WORKFLOW A: PROGRAM-TO-VENTURE PROMOTION
// =============================================================================

/**
 * Validate promotion request data.
 * Returns { valid: boolean, errors: string[] }
 */
export function validatePromotionData({
  program_id,
  company_name,
  industry,
  business_stage,
}) {
  const errors = [];

  if (!program_id || !program_id.trim()) {
    errors.push("Program ID is required");
  }

  if (!company_name || !company_name.trim()) {
    errors.push("Company name is required");
  }

  if (!industry || !industry.trim()) {
    errors.push("Industry is required");
  }

  if (!business_stage || !business_stage.trim()) {
    errors.push("Business stage is required");
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Check for duplicate company or registration number for promotion.
 * Returns { hasDuplicates: boolean, conflicts: string[] }
 */
export async function checkPromotionDuplicates({ company_name, registration_number }) {
  const conflicts = [];

  try {
    const nameCheck = await db.execute({
      sql: "SELECT id FROM ventures WHERE LOWER(company_name) = LOWER(?)",
      args: [company_name.trim()],
    });
    if (nameCheck.rows.length > 0) {
      conflicts.push("A company with this name already exists");
    }
  } catch (_) {
    try {
      const fallbackCheck = await db.execute({
        sql: "SELECT id FROM ventures WHERE LOWER(name) = LOWER(?)",
        args: [company_name.trim()],
      });
      if (fallbackCheck.rows.length > 0) {
        conflicts.push("A company with this name already exists");
      }
    } catch (_) {}
  }

  if (registration_number && registration_number.trim()) {
    const regCheck = await db.execute({
      sql: "SELECT id FROM ventures WHERE registration_number = ?",
      args: [registration_number.trim()],
    });
    if (regCheck.rows.length > 0) {
      conflicts.push("A company with this registration number already exists");
    }
  }

  return { hasDuplicates: conflicts.length > 0, conflicts };
}

/**
 * Fetch program data including its teams/participants for promotion.
 * Returns the program object with teams and participants, or null.
 */
export async function getProgramForPromotion(programId) {
  // Get program
  const progRes = await db.execute({
    sql: "SELECT * FROM v2_programs WHERE id = ?",
    args: [programId],
  });
  if (progRes.rows.length === 0) return null;

  const program = progRes.rows[0];

  // Get teams (groups) in this program
  const teamsRes = await db.execute({
    sql: "SELECT * FROM v2_teams WHERE program_id = ?",
    args: [programId],
  });

  // Get participants in this program (v2_participants)
  const participantsRes = await db.execute({
    sql: "SELECT * FROM v2_participants WHERE program_id = ?",
    args: [programId],
  });

  // Get contacts (users with program_id)
  const contactsRes = await db.execute({
    sql: "SELECT * FROM contacts WHERE program_id = ?",
    args: [programId],
  });

  return {
    ...program,
    teams: teamsRes.rows,
    participants: participantsRes.rows,
    contacts: contactsRes.rows,
  };
}

/**
 * Mark a program as promoted by setting its venture_id.
 */
export async function markProgramAsPromoted(programId, ventureId) {
  await db.execute({
    sql: "UPDATE v2_programs SET venture_id = ? WHERE id = ?",
    args: [ventureId, programId],
  });
}

/**
 * Check if a program has already been promoted.
 */
export async function isProgramAlreadyPromoted(programId) {
  const res = await db.execute({
    sql: "SELECT venture_id FROM v2_programs WHERE id = ?",
    args: [programId],
  });
  if (res.rows.length === 0) return { promoted: false }; // program doesn't exist
  return {
    promoted: !!res.rows[0].venture_id,
    venture_id: res.rows[0].venture_id || null,
  };
}

/**
 * Copy founders from a program's participants into a venture.
 * Iterates through program contacts and participants to find founders.
 */
export async function copyFoundersToVenture({
  venture_id,
  programContacts,
  programParticipants,
}) {
  const founders = [];

  // Collect from contacts where role is participant (they become venture founders)
  for (const contact of programContacts) {
    if (!contact.email) continue;
    founders.push({
      email: contact.email,
      name: contact.name || contact.email.split("@")[0],
      phone: contact.phone || null,
      title: "Founder",
    });
  }

  // Also collect from v2_participants (may include additional members)
  for (const participant of programParticipants) {
    if (!participant.email) continue;
    // Check if this email was already added from contacts
    const alreadyAdded = founders.some(
      (f) => f.email.toLowerCase() === participant.email.toLowerCase()
    );
    if (alreadyAdded) continue;
    founders.push({
      email: participant.email,
      name: participant.name || participant.email.split("@")[0],
      phone: participant.phone || null,
      title: "Founder",
    });
  }

  // Create founders and generate invitation tokens
  const createdFounders = [];
  for (const founder of founders) {
    const token = uuidv4();
    await createFounder({
      venture_id,
      email: founder.email,
      name: founder.name,
      phone: founder.phone,
      title: founder.title,
      invitation_token: token,
    });
    createdFounders.push({ ...founder, token, status: "pending" });
  }

  return createdFounders;
}

/**
 * Copy team members from a program's contacts into a venture.
 * These are non-founder participants who become venture team members.
 */
export async function copyMembersToVenture({
  venture_id,
  programContacts,
  programParticipants,
  founderEmails,
}) {
  const memberSet = new Set();

  // Add contacts who are not founders as members
  for (const contact of programContacts) {
    if (!contact.cid) continue;
    const email = (contact.email || "").toLowerCase();
    if (founderEmails.has(email)) continue; // skip founders
    memberSet.add(contact.cid);
  }

  // Add v2_participants who are not founders as members
  // We use email to match; participants may not have a cid
  for (const participant of programParticipants) {
    if (!participant.id && !participant.user_id) continue;
    const email = (participant.email || "").toLowerCase();
    if (founderEmails.has(email)) continue; // skip founders

    // Use user_id if available (links to contacts), otherwise the participant id
    const memberCid = participant.user_id || participant.id;
    if (memberCid) {
      memberSet.add(memberCid);
    }
  }

  // Insert members
  const createdMembers = [];
  for (const userCid of memberSet) {
    await addVentureMember({
      venture_id,
      user_cid: String(userCid),
      role: "member",
    });
    createdMembers.push({ user_cid: String(userCid), role: "member" });
  }

  return createdMembers;
}

/**
 * Check if a program team is "approved" for promotion.
 * A program is considered approved if:
 * - It has a status of 'Active' or 'Completed'
 * - It has participants assigned
 */
export async function isProgramApproved(programId) {
  const res = await db.execute({
    sql: "SELECT status FROM v2_programs WHERE id = ?",
    args: [programId],
  });
  if (res.rows.length === 0) return false;

  const status = (res.rows[0].status || "").toLowerCase();
  // "Active" and "Completed" programs are eligible for promotion
  return status === "active" || status === "completed";
}

// =============================================================================
// ENHANCEMENT 1.2: STARTUP PROFILE WIZARD
// =============================================================================

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
      data.founders.forEach((f, i) => {
        if (!f.name?.trim()) errors.push(`Founder ${i + 1}: Name is required`);
        if (!f.email?.trim()) errors.push(`Founder ${i + 1}: Email is required`);
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) errors.push(`Founder ${i + 1}: Invalid email format`);
        else if (emails.has(f.email.toLowerCase())) errors.push(`Founder ${i + 1}: Duplicate email`);
        else emails.add(f.email.toLowerCase());
        if (!f.position?.trim()) errors.push(`Founder ${i + 1}: Position is required`);
        if (f.linkedin && !/^https?:\/\/(www\.)?linkedin\.com\/.+/.test(f.linkedin)) {
          errors.push(`Founder ${i + 1}: LinkedIn must be a valid LinkedIn URL`);
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
        data.members.forEach((m, i) => {
          if (!m.name?.trim()) errors.push(`Member ${i + 1}: Name is required`);
          if (!m.role?.trim()) errors.push(`Member ${i + 1}: Role is required`);
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
 * Document type labels for UI display.
 */
export const DOCUMENT_TYPE_LABELS = {
  business_registration: "Business Registration",
  pitch_deck: "Pitch Deck",
  business_plan: "Business Plan",
  financial_docs: "Financial Documents",
  other: "Other Supporting Documents",
};

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
 * Calculate completion percentage based on filled fields across all steps.
 * Each step contributes equally (100/6 ≈ 16.67% per step).
 * Within each step, the percentage is based on required fields filled.
 */
export function calculateCompletion(profileData) {
  if (!profileData) return 0;

  const totalSteps = TOTAL_WIZARD_STEPS;
  const stepWeight = 100 / totalSteps;
  let totalPercent = 0;

  for (let step = 1; step <= totalSteps; step++) {
    const validator = WIZARD_STEP_VALIDATORS[step];
    if (!validator) continue;

    const stepData = profileData[`step_${step}_data`] || {};
    const requiredFields = validator.required;

    if (requiredFields.length === 0) {
      // No required fields means always count this step
      // Check if there's at least some data
      const hasData = Object.keys(stepData).length > 0;
      totalPercent += hasData ? stepWeight : stepWeight * 0.5;
      continue;
    }

    let filledCount = 0;
    for (const field of requiredFields) {
      const val = stepData[field];
      if (field === "team_size") {
        if (val !== undefined && val !== null && val !== "") filledCount++;
      } else if (field === "founders") {
        if (Array.isArray(val) && val.length > 0) filledCount++;
      } else if (Array.isArray(val)) {
        if (val.length > 0) filledCount++;
      } else if (typeof val === "string" && val.trim()) {
        filledCount++;
      } else if (typeof val === "number" || typeof val === "boolean") {
        filledCount++;
      }
    }

    const stepPercent = requiredFields.length > 0
      ? (filledCount / requiredFields.length) * stepWeight
      : 0;
    totalPercent += stepPercent;
  }

  return Math.min(Math.round(totalPercent), 100);
}

/**
 * Get or create startup profile for a venture.
 */
export async function getOrCreateStartupProfile(ventureId) {
  // Check if profile exists
  let profileRes = await db.execute({
    sql: "SELECT * FROM startup_profiles WHERE venture_id = ?",
    args: [ventureId],
  });

  let profile;
  if (profileRes.rows.length === 0) {
    // Create profile
    await db.execute({
      sql: "INSERT INTO startup_profiles (venture_id) VALUES (?)",
      args: [ventureId],
    });
    profileRes = await db.execute({
      sql: "SELECT * FROM startup_profiles WHERE venture_id = ?",
      args: [ventureId],
    });
  }
  profile = profileRes.rows[0];

  // Parse JSON fields
  for (let i = 1; i <= TOTAL_WIZARD_STEPS; i++) {
    const key = `step_${i}_data`;
    if (typeof profile[key] === "string") {
      try { profile[key] = JSON.parse(profile[key]); } catch { profile[key] = {}; }
    }
  }

  // Get or create progress
  let progressRes = await db.execute({
    sql: "SELECT * FROM startup_profile_progress WHERE venture_id = ?",
    args: [ventureId],
  });

  let progress;
  if (progressRes.rows.length === 0) {
    await db.execute({
      sql: "INSERT INTO startup_profile_progress (venture_id, current_step, completion_percentage) VALUES (?, 1, 0)",
      args: [ventureId],
    });
    progressRes = await db.execute({
      sql: "SELECT * FROM startup_profile_progress WHERE venture_id = ?",
      args: [ventureId],
    });
  }
  progress = progressRes.rows[0];

  // Get documents
  const docsRes = await db.execute({
    sql: "SELECT * FROM startup_profile_documents WHERE venture_id = ? ORDER BY uploaded_at DESC",
    args: [ventureId],
  });

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

  await db.execute({
    sql: `UPDATE startup_profiles SET ${stepColumn} = ?::jsonb, updated_at = NOW() WHERE venture_id = ?`,
    args: [serialized, ventureId],
  });

  // Recalculate completion
  const profileRes = await db.execute({
    sql: "SELECT * FROM startup_profiles WHERE venture_id = ?",
    args: [ventureId],
  });

  if (profileRes.rows.length === 0) return { success: false };

  const profile = profileRes.rows[0];
  for (let i = 1; i <= TOTAL_WIZARD_STEPS; i++) {
    const key = `step_${i}_data`;
    if (typeof profile[key] === "string") {
      try { profile[key] = JSON.parse(profile[key]); } catch { profile[key] = {}; }
    }
  }

  const completionPercentage = calculateCompletion(profile);
  const lastCompletedStep = Math.max(0, step);

  // Update progress - store current_step as the step being worked on
  await db.execute({
    sql: `UPDATE startup_profile_progress
          SET current_step = ?, completion_percentage = ?, last_completed_step = ?, last_updated = NOW()
          WHERE venture_id = ?`,
    args: [step, completionPercentage, lastCompletedStep, ventureId],
  });

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
  const profileRes = await db.execute({
    sql: "SELECT * FROM startup_profiles WHERE venture_id = ?",
    args: [ventureId],
  });

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
  await db.execute({
    sql: "UPDATE startup_profiles SET is_submitted = TRUE, submitted_at = ? WHERE venture_id = ?",
    args: [now, ventureId],
  });

  await db.execute({
    sql: `UPDATE startup_profile_progress
          SET current_step = ?, completion_percentage = 100, last_completed_step = ?, is_completed = TRUE, last_updated = NOW()
          WHERE venture_id = ?`,
    args: [TOTAL_WIZARD_STEPS, TOTAL_WIZARD_STEPS, ventureId],
  });

  // Log activity
  const { logVentureActivity, addVentureHistory, createVentureNotification } = await import("./ventures");
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

  await db.execute({
    sql: `INSERT INTO startup_profile_documents (venture_id, document_type, file_name, file_size, file_type, file_url, uploaded_by)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT (venture_id, document_type, file_name)
          DO UPDATE SET file_url = ?, file_size = ?, file_type = ?, uploaded_at = NOW()`,
    args: [ventureId, documentType, fileName, fileSize, fileType, fileUrl, uploadedBy, fileUrl, fileSize, fileType],
  });

  return { success: true };
}

/**
 * Delete a document from the startup profile.
 */
export async function deleteProfileDocument({ ventureId, documentId }) {
  await db.execute({
    sql: "DELETE FROM startup_profile_documents WHERE id = ? AND venture_id = ?",
    args: [documentId, ventureId],
  });
  return { success: true };
}

/**
 * Check if a user is authorized to edit a venture's startup profile.
 */
export async function canEditStartupProfile(ventureId, session) {
  if (!session) return false;
  if (session.role === "super_admin") return true;

  // Check if user is a founder of this venture
  const founderRes = await db.execute({
    sql: "SELECT id FROM venture_founders WHERE venture_id = ? AND LOWER(email) = LOWER(?)",
    args: [ventureId, session.email || ""],
  });
  if (founderRes.rows.length > 0) return true;

  // Check if user is a member with founder-like role
  const memberRes = await db.execute({
    sql: "SELECT id FROM venture_members WHERE venture_id = ? AND user_cid = ? AND role IN ('founder', 'co-founder')",
    args: [ventureId, session.cid],
  });
  if (memberRes.rows.length > 0) return true;

  return false;
}

/**
 * Check if a user has read access to a venture's startup profile.
 */
export async function canReadStartupProfile(ventureId, session) {
  if (!session) return false;
  if (session.role === "super_admin") return true;
  if (session.role === "staff") return true;
  if (session.role === "program_manager") return true;

  // Founders can read
  return canEditStartupProfile(ventureId, session);
}

// =============================================================================
// ENHANCEMENT 1.3: FOUNDER & CO-FOUNDER MANAGEMENT
// =============================================================================

/**
 * Supported roles for venture founders/team members.
 */
export const VENTURE_ROLES = [
  "founder",
  "co-founder",
  "ceo",
  "cto",
  "coo",
  "cfo",
  "cmo",
  "cpo",
  "cio",
  "product_manager",
  "engineering_manager",
  "marketing_lead",
  "sales_lead",
  "operations_lead",
  "finance_lead",
  "hr_lead",
  "legal_lead",
  "advisor",
  "observer",
];

export const VENTURE_ROLE_LABELS = {
  founder: "Founder",
  "co-founder": "Co-Founder",
  ceo: "CEO",
  cto: "CTO",
  coo: "COO",
  cfo: "CFO",
  cmo: "CMO",
  cpo: "CPO",
  cio: "CIO",
  product_manager: "Product Manager",
  engineering_manager: "Engineering Manager",
  marketing_lead: "Marketing Lead",
  sales_lead: "Sales Lead",
  operations_lead: "Operations Lead",
  finance_lead: "Finance Lead",
  hr_lead: "HR Lead",
  legal_lead: "Legal Lead",
  advisor: "Advisor",
  observer: "Observer",
};

/**
 * Roles that have full management permissions.
 */
export const MANAGEMENT_ROLES = ["founder", "co-founder"];

/**
 * Roles that are read-only.
 */
export const READ_ONLY_ROLES = ["advisor", "observer"];

/**
 * Check if a user can manage founders for a venture.
 * Only the owner (is_owner), founders, and super_admin can manage.
 */
export async function canManageFounders(ventureId, session) {
  if (!session) return { allowed: false };
  if (session.role === "super_admin") return { allowed: true, isOwner: true };

  const founderRes = await db.execute({
    sql: "SELECT id, is_owner, role FROM venture_founders WHERE venture_id = ? AND LOWER(email) = LOWER(?)",
    args: [ventureId, session.email || ""],
  });

  if (founderRes.rows.length === 0) {
    return { allowed: false };
  }

  const founder = founderRes.rows[0];
  const allowed = founder.is_owner || MANAGEMENT_ROLES.includes(founder.role);

  return {
    allowed,
    isOwner: !!founder.is_owner,
    founderId: founder.id,
    role: founder.role,
  };
}

/**
 * List all founders for a venture with full details.
 */
export async function listFounders(ventureId) {
  const res = await db.execute({
    sql: `SELECT id, venture_id, email, name, phone, title, role, is_owner, status,
                 invitation_token, invitation_sent_at, invitation_accepted_at,
                 invitation_expires_at, suspended_at, suspended_by,
                 created_at, updated_at
          FROM venture_founders
          WHERE venture_id = ?
          ORDER BY is_owner DESC, created_at ASC`,
    args: [ventureId],
  });

  return res.rows.map((f) => ({
    ...f,
    role_label: VENTURE_ROLE_LABELS[f.role] || f.role,
    is_suspended: !!f.suspended_at,
    invitation_expired: f.invitation_expires_at
      ? new Date(f.invitation_expires_at) < new Date()
      : false,
  }));
}

/**
 * Get a single founder by ID.
 */
export async function getFounderById(founderId) {
  const res = await db.execute({
    sql: `SELECT * FROM venture_founders WHERE id = ?`,
    args: [founderId],
  });
  return res.rows[0] || null;
}

/**
 * Invite a founder / co-founder / executive to a venture.
 * Generates a secure invitation token with expiration.
 */
export async function inviteFounder({
  ventureId,
  invitedByFounderId,
  email,
  name,
  role,
  expiresInHours = 72, // 3 days default
}) {
  // Validate role
  if (!VENTURE_ROLES.includes(role)) {
    throw new Error(`Invalid role: "${role}". Must be one of: ${VENTURE_ROLES.join(", ")}`);
  }

  // Check for existing founder with same email
  const existing = await db.execute({
    sql: "SELECT id, status FROM venture_founders WHERE venture_id = ? AND LOWER(email) = LOWER(?)",
    args: [ventureId, email.trim()],
  });

  if (existing.rows.length > 0) {
    const f = existing.rows[0];
    if (f.status === "accepted") {
      throw new Error("A founder with this email already exists and has accepted.");
    }
    // Re-send invitation for pending founders
    const token = uuidv4();
    const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000).toISOString();

    await db.execute({
      sql: `UPDATE venture_founders
            SET invitation_token = ?, invitation_sent_at = NOW(), invitation_expires_at = ?,
                role = ?, name = ?, status = 'pending', updated_at = NOW()
            WHERE id = ?`,
      args: [token, expiresAt, role, name.trim(), f.id],
    });

    return { id: f.id, token, expires_at: expiresAt, isResend: true };
  }

  // Create new founder record
  const token = uuidv4();
  const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000).toISOString();

  await db.execute({
    sql: `INSERT INTO venture_founders (venture_id, email, name, role, invitation_token, invitation_sent_at, invitation_expires_at, status)
          VALUES (?, ?, ?, ?, ?, NOW(), ?, 'pending')`,
    args: [ventureId, email.trim().toLowerCase(), name.trim(), role, token, expiresAt],
  });

  // Get the new founder ID
  const newRes = await db.execute({
    sql: "SELECT id FROM venture_founders WHERE venture_id = ? AND LOWER(email) = LOWER(?)",
    args: [ventureId, email.trim()],
  });

  return { id: newRes.rows[0]?.id, token, expires_at: expiresAt, isResend: false };
}

/**
 * Update a founder's role and details.
 */
export async function updateFounderRole({ founderId, role, title, phone, name }) {
  if (role && !VENTURE_ROLES.includes(role)) {
    throw new Error(`Invalid role: "${role}".`);
  }

  const sets = [];
  const args = [];

  if (role) { sets.push("role = ?"); args.push(role); }
  if (title !== undefined) { sets.push("title = ?"); args.push(title); }
  if (phone !== undefined) { sets.push("phone = ?"); args.push(phone); }
  if (name !== undefined) { sets.push("name = ?"); args.push(name); }

  if (sets.length === 0) return { updated: false };

  sets.push("updated_at = NOW()");
  args.push(founderId);

  await db.execute({
    sql: `UPDATE venture_founders SET ${sets.join(", ")} WHERE id = ?`,
    args,
  });

  return { updated: true };
}

/**
 * Remove a founder from a venture.
 * Validates: cannot remove last founder, cannot remove current owner without transfer.
 */
export async function removeFounder({ founderId, ventureId, removedByFounderId }) {
  const founder = await getFounderById(founderId);
  if (!founder) throw new Error("Founder not found.");
  if (founder.venture_id !== ventureId) throw new Error("Founder does not belong to this venture.");

  // Check if this is the last founder
  const countRes = await db.execute({
    sql: "SELECT COUNT(*) as cnt FROM venture_founders WHERE venture_id = ? AND status = 'accepted'",
    args: [ventureId],
  });
  const activeCount = parseInt(countRes.rows[0]?.cnt || 0);

  if (activeCount <= 1 && founder.is_owner) {
    throw new Error("Cannot remove the last owner. Transfer ownership first.");
  }

  // Check if founder is the owner and there are other accepted founders
  if (founder.is_owner) {
    const otherActive = await db.execute({
      sql: "SELECT COUNT(*) as cnt FROM venture_founders WHERE venture_id = ? AND id != ? AND status = 'accepted'",
      args: [ventureId, founderId],
    });
    if (parseInt(otherActive.rows[0]?.cnt || 0) === 0) {
      throw new Error("Cannot remove the owner without another active founder. Transfer ownership first.");
    }
  }

  // Log activity before deleting
  try {
    const { logVentureActivity } = await import("./ventures");
    await logVentureActivity({
      venture_id: ventureId,
      action: "FOUNDER_REMOVED",
      actor_cid: String(removedByFounderId || "system"),
      actor_name: "System",
      details: { removed_founder_id: founderId, removed_email: founder.email, role: founder.role },
    });
  } catch (_) {}

  // Delete the founder
  await db.execute({
    sql: "DELETE FROM venture_founders WHERE id = ? AND venture_id = ?",
    args: [founderId, ventureId],
  });

  return { success: true };
}

/**
 * Transfer ownership to another founder.
 * Rules: Only current owner can transfer. Cannot transfer to suspended/inactive users.
 */
export async function transferOwnership({ ventureId, currentOwnerId, newOwnerId, transferredByFounderId }) {
  const currentOwner = await getFounderById(currentOwnerId);
  if (!currentOwner) throw new Error("Current owner not found.");
  if (!currentOwner.is_owner) throw new Error("Only the current owner can transfer ownership.");
  if (currentOwner.venture_id !== ventureId) throw new Error("Owner does not belong to this venture.");

  const newOwner = await getFounderById(newOwnerId);
  if (!newOwner) throw new Error("New owner not found.");
  if (newOwner.venture_id !== ventureId) throw new Error("New owner does not belong to this venture.");
  if (newOwner.suspended_at) throw new Error("Cannot transfer ownership to a suspended user.");
  if (newOwner.status !== "accepted") throw new Error("Cannot transfer ownership to an inactive user.");
  if (newOwner.id === currentOwner.id) throw new Error("Cannot transfer ownership to yourself.");

  // Record ownership history (append-only)
  await db.execute({
    sql: `INSERT INTO ownership_history (venture_id, previous_owner_id, previous_owner_email, previous_owner_name,
          new_owner_id, new_owner_email, new_owner_name, transferred_by_id, transferred_by_email)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      ventureId,
      currentOwner.id,
      currentOwner.email,
      currentOwner.name,
      newOwner.id,
      newOwner.email,
      newOwner.name,
      transferredByFounderId || currentOwner.id,
      currentOwner.email,
    ],
  });

  // Transfer ownership: new owner gets is_owner, old owner loses it
  await db.execute({
    sql: "UPDATE venture_founders SET is_owner = FALSE, updated_at = NOW() WHERE id = ?",
    args: [currentOwner.id],
  });

  await db.execute({
    sql: "UPDATE venture_founders SET is_owner = TRUE, role = 'founder', updated_at = NOW() WHERE id = ?",
    args: [newOwner.id],
  });

  // Log activity
  try {
    const { logVentureActivity } = await import("./ventures");
    await logVentureActivity({
      venture_id: ventureId,
      action: "OWNERSHIP_TRANSFERRED",
      actor_cid: String(transferredByFounderId || currentOwner.id),
      actor_name: currentOwner.name,
      details: {
        from_id: currentOwner.id,
        from_email: currentOwner.email,
        to_id: newOwner.id,
        to_email: newOwner.email,
      },
    });
  } catch (_) {}

  return { success: true, previous_owner: currentOwner.email, new_owner: newOwner.email };
}

/**
 * Suspend a founder.
 */
export async function suspendFounder({ founderId, ventureId, suspendedByFounderId }) {
  const founder = await getFounderById(founderId);
  if (!founder) throw new Error("Founder not found.");
  if (founder.venture_id !== ventureId) throw new Error("Founder does not belong to this venture.");
  if (founder.is_owner) throw new Error("Cannot suspend the owner. Transfer ownership first.");
  if (founder.suspended_at) throw new Error("Founder is already suspended.");

  await db.execute({
    sql: "UPDATE venture_founders SET suspended_at = NOW(), suspended_by = ?, updated_at = NOW() WHERE id = ?",
    args: [String(suspendedByFounderId || "system"), founderId],
  });

  // Log activity
  try {
    const { logVentureActivity } = await import("./ventures");
    await logVentureActivity({
      venture_id: ventureId,
      action: "USER_SUSPENDED",
      actor_cid: String(suspendedByFounderId || "system"),
      actor_name: "System",
      details: { founder_id: founderId, email: founder.email, role: founder.role },
    });
  } catch (_) {}

  return { success: true };
}

/**
 * Reactivate a suspended founder.
 */
export async function reactivateFounder({ founderId, ventureId, reactivatedByFounderId }) {
  const founder = await getFounderById(founderId);
  if (!founder) throw new Error("Founder not found.");
  if (founder.venture_id !== ventureId) throw new Error("Founder does not belong to this venture.");
  if (!founder.suspended_at) throw new Error("Founder is not suspended.");

  await db.execute({
    sql: "UPDATE venture_founders SET suspended_at = NULL, suspended_by = NULL, updated_at = NOW() WHERE id = ?",
    args: [founderId],
  });

  // Log activity
  try {
    const { logVentureActivity } = await import("./ventures");
    await logVentureActivity({
      venture_id: ventureId,
      action: "USER_REACTIVATED",
      actor_cid: String(reactivatedByFounderId || "system"),
      actor_name: "System",
      details: { founder_id: founderId, email: founder.email },
    });
  } catch (_) {}

  return { success: true };
}

// =============================================================================
// ENHANCEMENT 1.4: STARTUP VERIFICATION
// =============================================================================

/**
 * Verification categories.
 */
export const VERIFICATION_CATEGORIES = [
  "business_registration",
  "founder_identity",
  "email_verification",
  "phone_verification",
  "legal_documents",
  "financial_documents",
];

export const VERIFICATION_CATEGORY_LABELS = {
  business_registration: "Business Registration",
  founder_identity: "Founder Identity",
  email_verification: "Email Verification",
  phone_verification: "Phone Verification",
  legal_documents: "Legal Documents",
  financial_documents: "Financial Documents",
};

export const VERIFICATION_STATUSES = ["draft", "pending_review", "verified", "rejected", "suspended"];

/**
 * Allowed document types for verification uploads.
 */
export const VERIFICATION_DOCUMENT_TYPES = {
  business_registration: ["certificate_of_incorporation", "business_license", "tax_registration"],
  founder_identity: ["government_id", "passport", "drivers_license"],
  email_verification: [],
  phone_verification: [],
  legal_documents: ["articles_of_association", "shareholder_agreement", "ip_assignment", "other_legal"],
  financial_documents: ["bank_statement", "financial_statement", "tax_return", "audit_report", "other_financial"],
};

/**
 * Check if user can manage verification (review/submit for others).
 */
export async function canManageVerification(ventureId, session) {
  if (!session) return { allowed: false };
  if (session.role === "super_admin") return { allowed: true, isReviewer: true };
  if (session.role === "verification_officer") return { allowed: true, isReviewer: true };
  if (session.role === "staff") return { allowed: true, isReviewer: true };
  return { allowed: false };
}

/**
 * Check if user can submit verification (founder).
 */
export async function canSubmitVerification(ventureId, session) {
  if (!session) return false;
  if (session.role === "super_admin") return true;

  const founderRes = await db.execute({
    sql: "SELECT id FROM venture_founders WHERE venture_id = ? AND LOWER(email) = LOWER(?)",
    args: [ventureId, session.email || ""],
  });
  return founderRes.rows.length > 0;
}

/**
 * Get or create a verification record for a venture.
 */
export async function getOrCreateVerification(ventureId) {
  let res = await db.execute({
    sql: "SELECT * FROM venture_verifications WHERE venture_id = ?",
    args: [ventureId],
  });

  let verification;
  if (res.rows.length === 0) {
    await db.execute({
      sql: "INSERT INTO venture_verifications (venture_id, status) VALUES (?, 'draft')",
      args: [ventureId],
    });
    res = await db.execute({
      sql: "SELECT * FROM venture_verifications WHERE venture_id = ?",
      args: [ventureId],
    });
  }
  verification = res.rows[0];

  // Get verification items (create defaults if not exist)
  const itemsRes = await db.execute({
    sql: "SELECT * FROM venture_verification_items WHERE verification_id = ?",
    args: [verification.id],
  });

  let items = itemsRes.rows;
  if (items.length === 0) {
    for (const cat of VERIFICATION_CATEGORIES) {
      await db.execute({
        sql: "INSERT INTO venture_verification_items (verification_id, category, status) VALUES (?, ?, 'pending')",
        args: [verification.id, cat],
      });
    }
    // Re-fetch
    const refreshed = await db.execute({
      sql: "SELECT * FROM venture_verification_items WHERE verification_id = ?",
      args: [verification.id],
    });
    items = refreshed.rows;
  }

  // Get documents
  const docsRes = await db.execute({
    sql: `SELECT vvd.* FROM venture_verification_documents vvd WHERE vvd.verification_id = ? ORDER BY vvd.uploaded_at DESC`,
    args: [verification.id],
  });

  // Get history
  const historyRes = await db.execute({
    sql: "SELECT * FROM venture_verification_history WHERE verification_id = ? ORDER BY created_at DESC",
    args: [verification.id],
  });

  // Get reviews
  const reviewsRes = await db.execute({
    sql: "SELECT * FROM venture_verification_reviews WHERE verification_id = ? ORDER BY created_at DESC",
    args: [verification.id],
  });

  // Get comments
  const commentsRes = await db.execute({
    sql: "SELECT * FROM venture_verification_comments WHERE verification_id = ? ORDER BY created_at ASC",
    args: [verification.id],
  });

  return {
    verification,
    items: items.map((item) => ({
      ...item,
      category_label: VERIFICATION_CATEGORY_LABELS[item.category] || item.category,
    })),
    documents: docsRes.rows,
    history: historyRes.rows,
    reviews: reviewsRes.rows,
    comments: commentsRes.rows,
  };
}

/**
 * Submit verification for review.
 */
export async function submitVerification({ ventureId, submittedBy }) {
  const data = await getOrCreateVerification(ventureId);
  const { verification, items, documents } = data;

  if (verification.status === "verified") {
    throw new Error("Venture is already verified.");
  }
  if (verification.status === "pending_review") {
    throw new Error("Verification is already under review.");
  }

  // Check each category has at least one document uploaded
  const missingCategories = [];
  for (const item of items) {
    if (item.category === "email_verification" || item.category === "phone_verification") {
      continue; // These are verified by other means
    }
    const hasDoc = documents.some((d) => d.category === item.category);
    if (!hasDoc && item.status !== "not_applicable") {
      missingCategories.push(VERIFICATION_CATEGORY_LABELS[item.category] || item.category);
    }
  }

  if (missingCategories.length > 0) {
    throw new Error(`Missing documents for: ${missingCategories.join(", ")}`);
  }

  if (verification.status === "pending_review") {
    throw new Error("A verification request is already pending review.");
  }

  const now = new Date().toISOString();

  await db.execute({
    sql: "UPDATE venture_verifications SET status = 'pending_review', submitted_at = ?, updated_at = ? WHERE id = ?",
    args: [now, now, verification.id],
  });

  for (const item of items) {
    if (item.status === "pending" || item.status === "rejected") {
      await db.execute({
        sql: "UPDATE venture_verification_items SET status = 'under_review', updated_at = ? WHERE id = ?",
        args: [now, item.id],
      });
    }
  }

  await db.execute({
    sql: `INSERT INTO venture_verification_history (verification_id, action, previous_status, new_status, actor_cid, actor_name, created_at)
          VALUES (?, 'VERIFICATION_SUBMITTED', ?, 'pending_review', ?, ?, ?)`,
    args: [verification.id, verification.status, submittedBy?.cid || "system", submittedBy?.name || "System", now],
  });

  try {
    const { logVentureActivity } = await import("./ventures");
    await logVentureActivity({
      venture_id: ventureId,
      action: "VERIFICATION_SUBMITTED",
      actor_cid: submittedBy?.cid || "system",
      actor_name: submittedBy?.name || "System",
      details: { verification_id: verification.id, categories: items.length },
    });
  } catch (_) {}

  return { success: true, status: "pending_review", submitted_at: now };
}

/**
 * Update verification status (approve/reject/suspend).
 */
export async function updateVerificationStatus({
  verificationId, ventureId, newStatus, category, reviewerCid, reviewerName, notes,
}) {
  if (!["verified", "rejected", "suspended"].includes(newStatus)) {
    throw new Error(`Invalid status: "${newStatus}". Must be verified, rejected, or suspended.`);
  }

  const verRes = await db.execute({
    sql: "SELECT * FROM venture_verifications WHERE id = ? AND venture_id = ?",
    args: [verificationId, ventureId],
  });
  if (verRes.rows.length === 0) throw new Error("Verification not found.");
  const verification = verRes.rows[0];

  const now = new Date().toISOString();
  const previousStatus = verification.status;

  if (category) {
    if (!VERIFICATION_CATEGORIES.includes(category)) throw new Error(`Invalid category: "${category}".`);

    const itemRes = await db.execute({
      sql: "SELECT * FROM venture_verification_items WHERE verification_id = ? AND category = ?",
      args: [verificationId, category],
    });
    if (itemRes.rows.length === 0) throw new Error("Verification item not found.");
    const item = itemRes.rows[0];

    await db.execute({
      sql: "UPDATE venture_verification_items SET status = ?, notes = ?, reviewed_by = ?, reviewed_at = ?, updated_at = ? WHERE id = ?",
      args: [newStatus, notes || null, reviewerCid, now, now, item.id],
    });

    await db.execute({
      sql: `INSERT INTO venture_verification_history (verification_id, action, previous_status, new_status, actor_cid, actor_name, notes, metadata, created_at)
            VALUES (?, 'ITEM_UPDATED', ?, ?, ?, ?, ?, ?::jsonb, ?)`,
      args: [verificationId, item.status, newStatus, reviewerCid || "system", reviewerName || "System", notes || null, JSON.stringify({ category, item_id: item.id }), now],
    });
  } else {
    await db.execute({
      sql: "UPDATE venture_verifications SET status = ?, reviewed_by = ?, reviewed_at = ?, reviewer_notes = ?, updated_at = ? WHERE id = ?",
      args: [newStatus, reviewerCid, now, notes || null, now, verificationId],
    });

    if (newStatus === "verified") {
      await db.execute({
        sql: "UPDATE venture_verification_items SET status = 'verified', updated_at = ? WHERE verification_id = ? AND status IN ('pending', 'under_review')",
        args: [now, verificationId],
      });
    }

    const actionKey = newStatus === "verified" ? "VERIFICATION_APPROVED" : newStatus === "rejected" ? "VERIFICATION_REJECTED" : "VERIFICATION_SUSPENDED";

    await db.execute({
      sql: `INSERT INTO venture_verification_history (verification_id, action, previous_status, new_status, actor_cid, actor_name, notes, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [verificationId, actionKey, previousStatus, newStatus, reviewerCid || "system", reviewerName || "System", notes || null, now],
    });

    try {
      const { logVentureActivity } = await import("./ventures");
      await logVentureActivity({
        venture_id: ventureId, action: actionKey, actor_cid: reviewerCid || "system",
        actor_name: reviewerName || "System", details: { verification_id: verificationId, previous_status: previousStatus, notes },
      });
    } catch (_) {}
  }

  return { success: true, status: newStatus };
}

/**
 * Resubmit verification after rejection.
 */
export async function resubmitVerification({ ventureId, submittedBy }) {
  const data = await getOrCreateVerification(ventureId);
  const { verification, items } = data;

  if (verification.status !== "rejected") throw new Error("Only rejected verifications can be resubmitted.");

  const now = new Date().toISOString();

  for (const item of items) {
    if (item.status === "rejected") {
      await db.execute({
        sql: "UPDATE venture_verification_items SET status = 'pending', notes = NULL, reviewed_by = NULL, reviewed_at = NULL, updated_at = ? WHERE id = ?",
        args: [now, item.id],
      });
    }
  }

  await db.execute({
    sql: "UPDATE venture_verifications SET status = 'pending_review', submitted_at = ?, reviewed_by = NULL, reviewed_at = NULL, reviewer_notes = NULL, updated_at = ? WHERE id = ?",
    args: [now, now, verification.id],
  });

  await db.execute({
    sql: `INSERT INTO venture_verification_history (verification_id, action, previous_status, new_status, actor_cid, actor_name, created_at)
          VALUES (?, 'VERIFICATION_RESUBMITTED', 'rejected', 'pending_review', ?, ?, ?)`,
    args: [verification.id, submittedBy?.cid || "system", submittedBy?.name || "System", now],
  });

  try {
    const { logVentureActivity } = await import("./ventures");
    await logVentureActivity({
      venture_id: ventureId, action: "VERIFICATION_RESUBMITTED", actor_cid: submittedBy?.cid || "system",
      actor_name: submittedBy?.name || "System", details: { verification_id: verification.id, resubmitted: true },
    });
  } catch (_) {}

  return { success: true, status: "pending_review", submitted_at: now };
}

/**
 * Upload a verification document.
 */
export async function uploadVerificationDocument({ verificationId, category, documentType, fileName, fileSize, fileType, fileUrl, uploadedBy }) {
  if (!VERIFICATION_CATEGORIES.includes(category)) throw new Error(`Invalid category: "${category}".`);

  await db.execute({
    sql: `INSERT INTO venture_verification_documents (verification_id, category, document_type, file_name, file_size, file_type, file_url, uploaded_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [verificationId, category, documentType, fileName, fileSize, fileType, fileUrl, uploadedBy],
  });
  return { success: true };
}

/**
 * Delete a verification document.
 */
export async function deleteVerificationDocument({ documentId }) {
  await db.execute({ sql: "DELETE FROM venture_verification_documents WHERE id = ?", args: [documentId] });
  return { success: true };
}

/**
 * Add a comment to a verification.
 */
export async function addVerificationComment({ verificationId, authorType, authorCid, authorName, message }) {
  await db.execute({
    sql: `INSERT INTO venture_verification_comments (verification_id, author_type, author_cid, author_name, message) VALUES (?, ?, ?, ?, ?)`,
    args: [verificationId, authorType, authorCid, authorName, message],
  });
  return { success: true };
}

// =============================================================================
// ENHANCEMENT 2.2: MILESTONES & DELIVERABLES
// =============================================================================

export const MILESTONE_STATUSES = ["not_started", "in_progress", "completed", "delayed", "cancelled"];
export const DELIVERABLE_STATUSES = ["pending", "in_progress", "submitted", "approved", "rejected", "completed"];
export const DELIVERABLE_TYPES = ["document", "presentation", "prototype", "source_code", "report", "other"];

/**
 * List milestones for a venture.
 */
export async function listMilestones(ventureId, projectId) {
  let sql = `SELECT vm.*,
    (SELECT COUNT(*) FROM venture_deliverables vd WHERE vd.milestone_id = vm.id) as deliverable_count,
    (SELECT COUNT(*) FROM venture_deliverables vd WHERE vd.milestone_id = vm.id AND vd.status IN ('approved', 'completed')) as completed_count
    FROM venture_milestones vm WHERE vm.venture_id = ?`;
  const args = [ventureId];
  if (projectId) { sql += " AND vm.project_id = ?"; args.push(projectId); }
  sql += " ORDER BY vm.display_order ASC, vm.created_at ASC";
  const res = await db.execute({ sql, args });
  return (res.rows || []).map((m) => ({
    ...m,
    assigned_members: typeof m.assigned_members === "string" ? JSON.parse(m.assigned_members) : (m.assigned_members || []),
  }));
}

export async function getMilestone(milestoneId) {
  const res = await db.execute({ sql: "SELECT * FROM venture_milestones WHERE id = ?", args: [milestoneId] });
  if (res.rows.length === 0) return null;
  const m = res.rows[0];
  m.assigned_members = typeof m.assigned_members === "string" ? JSON.parse(m.assigned_members) : (m.assigned_members || []);
  return m;
}

export async function createMilestone({ ventureId, projectId, title, description, priority, dueDate, ownerCid, assignedMembers, displayOrder, createdBy }) {
  if (!displayOrder) {
    const orderRes = await db.execute({
      sql: "SELECT COALESCE(MAX(display_order), 0) + 1 as next FROM venture_milestones WHERE venture_id = ?",
      args: [ventureId],
    });
    displayOrder = orderRes.rows[0]?.next || 1;
  }
  const res = await db.execute({
    sql: `INSERT INTO venture_milestones (venture_id, project_id, title, description, priority, due_date, owner_cid, assigned_members, display_order, created_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?::jsonb, ?, ?) RETURNING id`,
    args: [ventureId, projectId || null, title.trim(), description?.trim() || null, priority || "medium", dueDate || null, ownerCid || null, JSON.stringify(assignedMembers || []), displayOrder, createdBy || "system"],
  });
  const id = res.rows[0]?.id || res.lastInsertRowid;
  return { id };
}

export async function updateMilestone(milestoneId, updates) {
  const allowed = ["title", "description", "status", "priority", "due_date", "owner_cid", "assigned_members", "completion_percentage", "display_order"];
  const sets = []; const args = [];
  for (const f of allowed) {
    if (updates[f] !== undefined) {
      if (f === "assigned_members") { sets.push("assigned_members = ?::jsonb"); args.push(JSON.stringify(updates[f])); }
      else { sets.push(`${f} = ?`); args.push(updates[f]); }
    }
  }
  if (sets.length === 0) return { updated: false };
  sets.push("updated_at = NOW()");
  args.push(milestoneId);
  await db.execute({ sql: `UPDATE venture_milestones SET ${sets.join(", ")} WHERE id = ?`, args });
  return { updated: true };
}

export async function deleteMilestone(milestoneId) {
  await db.execute({ sql: "DELETE FROM venture_milestones WHERE id = ?", args: [milestoneId] });
  return { success: true };
}

// ─── Deliverables ─────────────────────────────────────────────────────────

export async function listDeliverables(milestoneId) {
  const res = await db.execute({
    sql: `SELECT vd.*, (SELECT COUNT(*) FROM venture_deliverable_reviews vdr WHERE vdr.deliverable_id = vd.id) as review_count
          FROM venture_deliverables vd WHERE vd.milestone_id = ? ORDER BY vd.created_at ASC`,
    args: [milestoneId],
  });
  return res.rows || [];
}

export async function getDeliverable(deliverableId) {
  const res = await db.execute({ sql: "SELECT * FROM venture_deliverables WHERE id = ?", args: [deliverableId] });
  return res.rows[0] || null;
}

export async function createDeliverable({ milestoneId, ventureId, title, description, deliverableType, dueDate, assignedCid, createdBy }) {
  const res = await db.execute({
    sql: `INSERT INTO venture_deliverables (milestone_id, venture_id, title, description, deliverable_type, due_date, assigned_cid, created_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    args: [milestoneId, ventureId, title.trim(), description?.trim() || null, deliverableType || "document", dueDate || null, assignedCid || null, createdBy || "system"],
  });
  return { id: res.rows[0]?.id || res.lastInsertRowid };
}

export async function updateDeliverable(deliverableId, updates, actorCid, actorName) {
  const allowed = ["title", "description", "deliverable_type", "status", "due_date", "assigned_cid", "attachment_url", "attachment_name", "approval_status", "reviewer_cid", "reviewer_name", "rejection_reason"];
  const sets = []; const args = [];
  for (const f of allowed) {
    if (updates[f] !== undefined) { sets.push(`${f} = ?`); args.push(updates[f]); }
  }

  // Handle approval workflow
  if (updates.approval_status === "approved" || updates.approval_status === "rejected") {
    sets.push("reviewer_cid = ?"); args.push(updates.reviewer_cid || actorCid);
    sets.push("reviewer_name = ?"); args.push(updates.reviewer_name || actorName);
    sets.push("reviewed_at = NOW()");
    if (updates.approval_status === "approved") sets.push("status = 'completed'");

    await db.execute({
      sql: `INSERT INTO venture_deliverable_reviews (deliverable_id, reviewer_cid, reviewer_name, decision, comments)
            VALUES (?, ?, ?, ?, ?)`,
      args: [deliverableId, actorCid || "system", actorName || "System", updates.approval_status, updates.rejection_reason || null],
    });
  }

  if (updates.status === "submitted") sets.push("status = 'submitted'");

  if (sets.length === 0) return { updated: false };
  sets.push("updated_at = NOW()");
  args.push(deliverableId);
  await db.execute({ sql: `UPDATE venture_deliverables SET ${sets.join(", ")} WHERE id = ?`, args });

  // Recalculate milestone completion
  const d = await getDeliverable(deliverableId);
  if (d) {
    const cnt = await db.execute({
      sql: "SELECT COUNT(*) as t, SUM(CASE WHEN status IN ('approved','completed') THEN 1 ELSE 0 END) as d FROM venture_deliverables WHERE milestone_id = ?",
      args: [d.milestone_id],
    });
    const r = cnt.rows[0] || { t: 0, d: 0 };
    const pct = r.t > 0 ? Math.round((r.d / r.t) * 100) : 0;
    await db.execute({ sql: "UPDATE venture_milestones SET completion_percentage = ?, updated_at = NOW() WHERE id = ?", args: [pct, d.milestone_id] });
  }

  return { updated: true };
}

export async function deleteDeliverable(deliverableId) {
  await db.execute({ sql: "DELETE FROM venture_deliverables WHERE id = ?", args: [deliverableId] });
  return { success: true };
}

// =============================================================================
// ENHANCEMENT 2.3: TASK MANAGEMENT & KANBAN
// =============================================================================

export const TASK_STATUSES = ["backlog", "todo", "in_progress", "review", "done", "blocked", "cancelled"];
export const TASK_PRIORITIES = ["low", "medium", "high", "critical"];

export async function listTasks(ventureId, milestoneId, status, assignedCid) {
  let sql = "SELECT * FROM venture_tasks WHERE venture_id = ?";
  const args = [ventureId];
  if (milestoneId) { sql += " AND milestone_id = ?"; args.push(milestoneId); }
  if (status) { sql += " AND status = ?"; args.push(status); }
  if (assignedCid) { sql += " AND assigned_cid = ?"; args.push(assignedCid); }
  sql += " ORDER BY display_order ASC, created_at DESC";
  const res = await db.execute({ sql, args });
  return (res.rows || []).map((t) => ({
    ...t,
    labels: typeof t.labels === "string" ? JSON.parse(t.labels) : (t.labels || []),
    checklist: typeof t.checklist === "string" ? JSON.parse(t.checklist) : (t.checklist || []),
  }));
}

export async function getTask(taskId) {
  const res = await db.execute({ sql: "SELECT * FROM venture_tasks WHERE id = ?", args: [taskId] });
  if (res.rows.length === 0) return null;
  const t = res.rows[0];
  t.labels = typeof t.labels === "string" ? JSON.parse(t.labels) : (t.labels || []);
  t.checklist = typeof t.checklist === "string" ? JSON.parse(t.checklist) : (t.checklist || []);
  return t;
}

export async function createTask({ ventureId, milestoneId, title, description, priority, dueDate, estimatedHours, assignedCid, assignedName, reporterCid, reporterName, labels, displayOrder }) {
  if (!displayOrder) {
    const o = await db.execute({ sql: "SELECT COALESCE(MAX(display_order), 0) + 1 as n FROM venture_tasks WHERE venture_id = ?", args: [ventureId] });
    displayOrder = o.rows[0]?.n || 1;
  }
  const res = await db.execute({
    sql: `INSERT INTO venture_tasks (venture_id, milestone_id, title, description, priority, due_date, estimated_hours, assigned_cid, assigned_name, reporter_cid, reporter_name, labels, display_order)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb, ?) RETURNING id`,
    args: [ventureId, milestoneId || null, title.trim(), description?.trim() || null, priority || "medium", dueDate || null, estimatedHours || null, assignedCid || null, assignedName || null, reporterCid || null, reporterName || null, JSON.stringify(labels || []), displayOrder],
  });
  return { id: res.rows[0]?.id || res.lastInsertRowid };
}

export async function updateTask(taskId, updates) {
  const allowed = ["title", "description", "status", "priority", "due_date", "estimated_hours", "actual_hours", "assigned_cid", "assigned_name", "labels", "checklist", "display_order"];
  const sets = []; const args = [];
  for (const f of allowed) {
    if (updates[f] !== undefined) {
      if (f === "labels" || f === "checklist") { sets.push(`${f} = ?::jsonb`); args.push(JSON.stringify(updates[f])); }
      else { sets.push(`${f} = ?`); args.push(updates[f]); }
    }
  }
  if (sets.length === 0) return { updated: false };
  sets.push("updated_at = NOW()");
  args.push(taskId);
  await db.execute({ sql: `UPDATE venture_tasks SET ${sets.join(", ")} WHERE id = ?`, args });
  return { updated: true };
}

export async function deleteTask(taskId) {
  await db.execute({ sql: "DELETE FROM venture_tasks WHERE id = ?", args: [taskId] });
  return { success: true };
}

// ─── Task Comments ────────────────────────────────────────────────────────

export async function listTaskComments(taskId) {
  const res = await db.execute({
    sql: "SELECT * FROM venture_task_comments WHERE task_id = ? AND is_deleted = FALSE ORDER BY created_at ASC",
    args: [taskId],
  });
  return res.rows || [];
}

export async function addTaskComment({ taskId, parentId, authorCid, authorName, body }) {
  const res = await db.execute({
    sql: `INSERT INTO venture_task_comments (task_id, parent_id, author_cid, author_name, body) VALUES (?, ?, ?, ?, ?) RETURNING id`,
    args: [taskId, parentId || null, authorCid, authorName || "System", body.trim()],
  });
  return { id: res.rows[0]?.id || res.lastInsertRowid };
}

export async function deleteTaskComment(commentId) {
  await db.execute({ sql: "UPDATE venture_task_comments SET is_deleted = TRUE, updated_at = NOW() WHERE id = ?", args: [commentId] });
  return { success: true };
}

// ─── Task Attachments ─────────────────────────────────────────────────────

export async function listTaskAttachments(taskId) {
  const res = await db.execute({ sql: "SELECT * FROM venture_task_attachments WHERE task_id = ? ORDER BY uploaded_at DESC", args: [taskId] });
  return res.rows || [];
}

export async function addTaskAttachment({ taskId, fileName, fileSize, fileType, fileUrl, uploadedBy }) {
  const res = await db.execute({
    sql: `INSERT INTO venture_task_attachments (task_id, file_name, file_size, file_type, file_url, uploaded_by) VALUES (?, ?, ?, ?, ?, ?) RETURNING id`,
    args: [taskId, fileName, fileSize || null, fileType || null, fileUrl, uploadedBy || "system"],
  });
  return { id: res.rows[0]?.id || res.lastInsertRowid };
}

export async function deleteTaskAttachment(attachmentId) {
  await db.execute({ sql: "DELETE FROM venture_task_attachments WHERE id = ?", args: [attachmentId] });
  return { success: true };
}

// =============================================================================
// ENHANCEMENT 2.4: PROJECT TIMELINE & PROGRESS TRACKING
// =============================================================================

/**
 * Calculate overall project progress based on milestones, tasks, and deliverables.
 */
export async function calculateProjectProgress(ventureId) {
  const result = { milestones: 0, tasks: 0, deliverables: 0, overall: 0, delayed: 0, blocked: 0 };

  // Milestones
  const ms = await db.execute({
    sql: `SELECT COUNT(*) as total,
       SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as done,
       SUM(CASE WHEN status = 'delayed' THEN 1 ELSE 0 END) as delayed,
       SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled
       FROM venture_milestones WHERE venture_id = ?`,
    args: [ventureId],
  });
  const m = ms.rows[0] || { total: 0, done: 0, delayed: 0, cancelled: 0 };
  result.milestones = { total: parseInt(m.total) || 0, done: parseInt(m.done) || 0, delayed: parseInt(m.delayed) || 0, cancelled: parseInt(m.cancelled) || 0 };
  result.delayed += parseInt(m.delayed) || 0;

  // Tasks
  const ts = await db.execute({
    sql: `SELECT COUNT(*) as total,
       SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as done,
       SUM(CASE WHEN status = 'blocked' THEN 1 ELSE 0 END) as blocked
       FROM venture_tasks WHERE venture_id = ?`,
    args: [ventureId],
  });
  const t = ts.rows[0] || { total: 0, done: 0, blocked: 0 };
  result.tasks = { total: parseInt(t.total) || 0, done: parseInt(t.done) || 0, blocked: parseInt(t.blocked) || 0 };
  result.blocked += parseInt(t.blocked) || 0;

  // Deliverables
  const ds = await db.execute({
    sql: `SELECT COUNT(*) as total,
       SUM(CASE WHEN status IN ('approved','completed') THEN 1 ELSE 0 END) as done
       FROM venture_deliverables WHERE venture_id = ?`,
    args: [ventureId],
  });
  const d = ds.rows[0] || { total: 0, done: 0 };
  result.deliverables = { total: parseInt(d.total) || 0, done: parseInt(d.done) || 0 };

  // Overall progress: weighted average (milestones 40%, tasks 40%, deliverables 20%)
  const totalWeight =
    (result.milestones.total > 0 ? 40 : 0) +
    (result.tasks.total > 0 ? 40 : 0) +
    (result.deliverables.total > 0 ? 20 : 0);

  if (totalWeight === 0) {
    result.overall = 0;
  } else {
    const weighted =
      (result.milestones.total > 0 ? (result.milestones.done / result.milestones.total) * 40 : 0) +
      (result.tasks.total > 0 ? (result.tasks.done / result.tasks.total) * 40 : 0) +
      (result.deliverables.total > 0 ? (result.deliverables.done / result.deliverables.total) * 20 : 0);
    result.overall = Math.round(weighted);
  }

  return result;
}

/**
 * Get timeline events for Gantt chart rendering.
 */
export async function getProjectTimeline(ventureId) {
  const events = [];

  // Milestones as timeline rows
  const milestones = await db.execute({
    sql: `SELECT id, title, status, completion_percentage as progress, due_date, created_at FROM venture_milestones WHERE venture_id = ? ORDER BY display_order ASC, created_at ASC`,
    args: [ventureId],
  });
  for (const m of milestones.rows || []) {
    events.push({
      id: `milestone-${m.id}`,
      type: "milestone",
      reference_type: "milestone",
      reference_id: m.id,
      title: m.title,
      status: m.status,
      progress: m.progress || 0,
      start_date: m.created_at,
      end_date: m.due_date,
      parent_id: null,
    });
  }

  // Tasks as timeline rows (under their milestone if applicable)
  const tasks = await db.execute({
    sql: `SELECT id, title, status, milestone_id, due_date, created_at FROM venture_tasks WHERE venture_id = ? ORDER BY created_at ASC`,
    args: [ventureId],
  });
  for (const t of tasks.rows || []) {
    const progressMap = { backlog: 0, todo: 0, in_progress: 50, review: 80, done: 100, blocked: 0, cancelled: 0 };
    events.push({
      id: `task-${t.id}`,
      type: "task",
      reference_type: "task",
      reference_id: t.id,
      title: t.title,
      status: t.status,
      progress: progressMap[t.status] || 0,
      start_date: t.created_at,
      end_date: t.due_date,
      parent_id: t.milestone_id ? `milestone-${t.milestone_id}` : null,
    });
  }

  // Deliverables as timeline rows
  const deliverables = await db.execute({
    sql: `SELECT vd.id, vd.title, vd.status, vd.milestone_id, vd.due_date, vd.created_at FROM venture_deliverables vd WHERE vd.venture_id = ? ORDER BY vd.created_at ASC`,
    args: [ventureId],
  });
  for (const d of deliverables.rows || []) {
    const progressMap = { pending: 0, in_progress: 30, submitted: 70, approved: 100, rejected: 0, completed: 100 };
    events.push({
      id: `deliverable-${d.id}`,
      type: "deliverable",
      reference_type: "deliverable",
      reference_id: d.id,
      title: d.title,
      status: d.status,
      progress: progressMap[d.status] || 0,
      start_date: d.created_at,
      end_date: d.due_date,
      parent_id: d.milestone_id ? `milestone-${d.milestone_id}` : null,
    });
  }

  // Dependencies
  const deps = await db.execute({
    sql: "SELECT * FROM venture_dependencies WHERE venture_id = ?",
    args: [ventureId],
  });

  // Overdue detection
  const now = new Date();
  const overdue = events.filter((e) => e.end_date && new Date(e.end_date) < now && e.progress < 100);

  return {
    events,
    dependencies: deps.rows || [],
    overdue: overdue.map((e) => ({ id: e.id, title: e.title, type: e.type, due_date: e.end_date, progress: e.progress })),
  };
}

/**
 * Get Gantt chart data (events sorted and structured for rendering).
 */
export async function getGanttData(ventureId) {
  const timeline = await getProjectTimeline(ventureId);
  const progress = await calculateProjectProgress(ventureId);

  // Sort: milestones first, then by parent grouping
  const sorted = [...timeline.events].sort((a, b) => {
    if (a.type === "milestone" && b.type !== "milestone") return -1;
    if (a.type !== "milestone" && b.type === "milestone") return 1;
    if (a.parent_id && b.parent_id && a.parent_id !== b.parent_id) {
      return a.parent_id.localeCompare(b.parent_id);
    }
    if (a.start_date && b.start_date) return new Date(a.start_date) - new Date(b.start_date);
    return 0;
  });

  return {
    rows: sorted,
    dependencies: timeline.dependencies,
    overdue: timeline.overdue,
    progress,
  };
}

/**
 * Get delay detection summary.
 */
export async function getDelaySummary(ventureId) {
  const now = new Date();

  const overdueTasks = await db.execute({
    sql: `SELECT id, title, status, due_date FROM venture_tasks WHERE venture_id = ? AND due_date IS NOT NULL AND due_date < NOW() AND status NOT IN ('done', 'cancelled') ORDER BY due_date ASC`,
    args: [ventureId],
  });

  const delayedMilestones = await db.execute({
    sql: `SELECT id, title, status, due_date FROM venture_milestones WHERE venture_id = ? AND due_date IS NOT NULL AND due_date < NOW() AND status NOT IN ('completed', 'cancelled') ORDER BY due_date ASC`,
    args: [ventureId],
  });

  const upcomingDeadlines = await db.execute({
    sql: `SELECT id, title, 'task' as type, due_date FROM venture_tasks WHERE venture_id = ? AND due_date IS NOT NULL AND due_date BETWEEN NOW() AND NOW() + INTERVAL '7 days' AND status NOT IN ('done', 'cancelled') UNION ALL
          SELECT id, title, 'milestone' as type, due_date FROM venture_milestones WHERE venture_id = ? AND due_date IS NOT NULL AND due_date BETWEEN NOW() AND NOW() + INTERVAL '7 days' AND status NOT IN ('completed', 'cancelled') ORDER BY due_date ASC`,
    args: [ventureId, ventureId],
  });

  return {
    overdue_tasks: overdueTasks.rows || [],
    delayed_milestones: delayedMilestones.rows || [],
    upcoming_deadlines: upcomingDeadlines.rows || [],
  };
}

// ─── Dependencies ──────────────────────────────────────────────────────────

export async function addDependency({ ventureId, sourceType, sourceId, targetType, targetId }) {
  // Check for circular dependency
  const circular = await db.execute({
    sql: `SELECT id FROM venture_dependencies WHERE venture_id = ? AND source_type = ? AND source_id = ? AND target_type = ? AND target_id = ?`,
    args: [ventureId, targetType, targetId, sourceType, sourceId],
  });
  if (circular.rows.length > 0) throw new Error("Circular dependency detected.");

  await db.execute({
    sql: `INSERT INTO venture_dependencies (venture_id, source_type, source_id, target_type, target_id)
          VALUES (?, ?, ?, ?, ?) ON CONFLICT DO NOTHING`,
    args: [ventureId, sourceType, sourceId, targetType, targetId],
  });
  return { success: true };
}

export async function removeDependency(dependencyId) {
  await db.execute({ sql: "DELETE FROM venture_dependencies WHERE id = ?", args: [dependencyId] });
  return { success: true };
}

// =============================================================================
// ENHANCEMENT 2.5: REPORTS & PROJECT ANALYTICS
// =============================================================================

/**
 * Compute full project analytics for a venture.
 */
export async function getVentureAnalytics(ventureId) {
  const now = new Date();

  // ── Project Summary ──
  const [mRes, tRes, dRes] = await Promise.all([
    db.execute({ sql: "SELECT COUNT(*) as t, SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) as done, SUM(CASE WHEN status='delayed' THEN 1 ELSE 0 END) as delayed FROM venture_milestones WHERE venture_id=?", args: [ventureId] }),
    db.execute({ sql: "SELECT COUNT(*) as t, SUM(CASE WHEN status='done' THEN 1 ELSE 0 END) as done, SUM(CASE WHEN status='blocked' THEN 1 ELSE 0 END) as blocked, SUM(CASE WHEN due_date<NOW() AND status NOT IN ('done','cancelled') THEN 1 ELSE 0 END) as overdue FROM venture_tasks WHERE venture_id=?", args: [ventureId] }),
    db.execute({ sql: "SELECT COUNT(*) as t, SUM(CASE WHEN status IN ('approved','completed') THEN 1 ELSE 0 END) as done FROM venture_deliverables WHERE venture_id=?", args: [ventureId] }),
  ]);

  const m = mRes.rows[0] || { t: 0, done: 0, delayed: 0 };
  const t = tRes.rows[0] || { t: 0, done: 0, blocked: 0, overdue: 0 };
  const d = dRes.rows[0] || { t: 0, done: 0 };

  const milestones = { total: parseInt(m.t)||0, done: parseInt(m.done)||0, delayed: parseInt(m.delayed)||0 };
  const tasks = { total: parseInt(t.t)||0, done: parseInt(t.done)||0, blocked: parseInt(t.blocked)||0, overdue: parseInt(t.overdue)||0 };
  const deliverables = { total: parseInt(d.t)||0, done: parseInt(d.done)||0 };

  // ── Overall completion ──
  const totalWeight = (milestones.total > 0 ? 40 : 0) + (tasks.total > 0 ? 40 : 0) + (deliverables.total > 0 ? 20 : 0);
  const overall = totalWeight > 0 ? Math.round(
    ((milestones.total > 0 ? milestones.done/milestones.total*40 : 0) +
     (tasks.total > 0 ? tasks.done/tasks.total*40 : 0) +
     (deliverables.total > 0 ? deliverables.done/deliverables.total*20 : 0)) / totalWeight * 100
  ) : 0;

  // ── Health score ──
  const healthPenalty = (tasks.overdue * 5) + (milestones.delayed * 10) + (tasks.blocked * 8);
  const healthScore = Math.max(0, Math.min(100, overall - healthPenalty));

  // ── Average completion time (tasks) ──
  const avgTime = await db.execute({
    sql: `SELECT AVG(EXTRACT(EPOCH FROM (updated_at - created_at))/86400) as avg_days
          FROM venture_tasks WHERE venture_id=? AND status='done' AND updated_at > created_at`,
    args: [ventureId],
  });
  const avgCompletionDays = Math.round((avgTime.rows[0]?.avg_days || 0) * 10) / 10;

  // ── On-time delivery % ──
  const onTime = await db.execute({
    sql: `SELECT COUNT(*) as total,
       SUM(CASE WHEN due_date IS NOT NULL AND updated_at <= due_date THEN 1 ELSE 0 END) as on_time
       FROM venture_tasks WHERE venture_id=? AND status='done' AND due_date IS NOT NULL`,
    args: [ventureId],
  });
  const o = onTime.rows[0] || { total: 0, on_time: 0 };
  const onTimeDelivery = parseInt(o.total) > 0 ? Math.round((parseInt(o.on_time)/parseInt(o.total))*100) : 0;

  // ── Status distribution ──
  const statusDist = await db.execute({
    sql: `SELECT status, COUNT(*) as cnt FROM venture_tasks WHERE venture_id=? GROUP BY status ORDER BY cnt DESC`,
    args: [ventureId],
  });
  const taskStatusDist = {};
  for (const r of statusDist.rows || []) taskStatusDist[r.status] = parseInt(r.cnt);

  const msStatusDist = await db.execute({
    sql: `SELECT status, COUNT(*) as cnt FROM venture_milestones WHERE venture_id=? GROUP BY status ORDER BY cnt DESC`,
    args: [ventureId],
  });
  const milestoneStatusDist = {};
  for (const r of msStatusDist.rows || []) milestoneStatusDist[r.status] = parseInt(r.cnt);

  // ── Trend (last 30 days activity) ──
  const trend = await db.execute({
    sql: `SELECT DATE(created_at) as day, action, COUNT(*) as cnt
          FROM venture_milestone_activity WHERE venture_id=? AND created_at > NOW() - INTERVAL '30 days'
          GROUP BY day, action ORDER BY day ASC`,
    args: [ventureId],
  });

  const activityTrend = [];
  const dayMap = {};
  for (const r of trend.rows || []) {
    const day = r.day;
    if (!dayMap[day]) { dayMap[day] = { date: day, total: 0, completed: 0, created: 0 }; activityTrend.push(dayMap[day]); }
    dayMap[day].total += parseInt(r.cnt);
    if (r.action?.includes('COMPLETED') || r.action?.includes('APPROVED')) dayMap[day].completed += parseInt(r.cnt);
    if (r.action?.includes('CREATED')) dayMap[day].created += parseInt(r.cnt);
  }

  // ── Workload distribution ──
  const workload = await db.execute({
    sql: `SELECT assigned_name, COUNT(*) as task_count,
       SUM(CASE WHEN status='done' THEN 1 ELSE 0 END) as done_count,
       SUM(CASE WHEN status='blocked' THEN 1 ELSE 0 END) as blocked_count
       FROM venture_tasks WHERE venture_id=? AND assigned_name IS NOT NULL
       GROUP BY assigned_name ORDER BY task_count DESC`,
    args: [ventureId],
  });

  // ── Productivity score ──
  const totalTasks = tasks.total || 1;
  const productivityScore = Math.round(((tasks.done / totalTasks) * 50) + (onTimeDelivery * 0.3) + (Math.max(0, 100 - tasks.blocked * 10) * 0.2));

  return {
    summary: { milestones, tasks, deliverables, overall, health_score: healthScore },
    kpis: {
      overall_completion: overall,
      tasks_completed: tasks.done,
      tasks_pending: tasks.total - tasks.done,
      tasks_overdue: tasks.overdue,
      milestones_completed: milestones.done,
      avg_completion_days: avgCompletionDays,
      on_time_delivery: onTimeDelivery,
      productivity_score: productivityScore,
      health_score: healthScore,
      blocked_count: tasks.blocked,
      delayed_count: milestones.delayed,
    },
    charts: {
      task_status_distribution: taskStatusDist,
      milestone_status_distribution: milestoneStatusDist,
      activity_trend_30d: activityTrend,
      workload_distribution: workload.rows || [],
      completion_breakdown: {
        milestones: milestones.total > 0 ? Math.round((milestones.done/milestones.total)*100) : 0,
        tasks: tasks.total > 0 ? Math.round((tasks.done/tasks.total)*100) : 0,
        deliverables: deliverables.total > 0 ? Math.round((deliverables.done/deliverables.total)*100) : 0,
      },
    },
  };
}

/**
 * Get all milestones for a venture with progress data (report).
 */
export async function getMilestonesReport(ventureId) {
  const res = await db.execute({
    sql: `SELECT vm.*,
       (SELECT COUNT(*) FROM venture_deliverables vd WHERE vd.milestone_id=vm.id) as del_total,
       (SELECT COUNT(*) FROM venture_deliverables vd WHERE vd.milestone_id=vm.id AND vd.status IN ('approved','completed')) as del_done,
       (SELECT COUNT(*) FROM venture_tasks vt WHERE vt.milestone_id=vm.id) as task_total,
       (SELECT COUNT(*) FROM venture_tasks vt WHERE vt.milestone_id=vm.id AND vt.status='done') as task_done
       FROM venture_milestones vm WHERE vm.venture_id=? ORDER BY vm.created_at DESC`,
    args: [ventureId],
  });
  return (res.rows || []).map((m) => ({
    ...m,
    deliverables_progress: m.del_total > 0 ? Math.round((m.del_done/m.del_total)*100) : 0,
    tasks_progress: m.task_total > 0 ? Math.round((m.task_done/m.task_total)*100) : 0,
  }));
}

/**
 * Get all tasks for a venture (report).
 */
export async function getTasksReport(ventureId, filters = {}) {
  let sql = `SELECT vt.*, vm.title as milestone_title
             FROM venture_tasks vt
             LEFT JOIN venture_milestones vm ON vt.milestone_id=vm.id
             WHERE vt.venture_id=?`;
  const args = [ventureId];

  if (filters.status) { sql += " AND vt.status=?"; args.push(filters.status); }
  if (filters.priority) { sql += " AND vt.priority=?"; args.push(filters.priority); }
  if (filters.assigned_cid) { sql += " AND vt.assigned_cid=?"; args.push(filters.assigned_cid); }
  if (filters.due_before) { sql += " AND vt.due_date<=?"; args.push(filters.due_before); }
  if (filters.due_after) { sql += " AND vt.due_date>=?"; args.push(filters.due_after); }

  sql += " ORDER BY vt.created_at DESC";
  if (filters.limit) { sql += " LIMIT ?"; args.push(parseInt(filters.limit)); }

  const res = await db.execute({ sql, args });
  return res.rows || [];
}

/**
 * Get team productivity report.
 */
export async function getTeamProductivity(ventureId) {
  const members = await db.execute({
    sql: `SELECT assigned_name as name, assigned_cid as cid,
       COUNT(*) as total_tasks,
       SUM(CASE WHEN status='done' THEN 1 ELSE 0 END) as completed,
       SUM(CASE WHEN status='blocked' THEN 1 ELSE 0 END) as blocked,
       SUM(CASE WHEN due_date<NOW() AND status NOT IN ('done','cancelled') THEN 1 ELSE 0 END) as overdue,
       SUM(estimated_hours) as total_estimated,
       SUM(CASE WHEN status='done' THEN estimated_hours ELSE 0 END) as completed_estimated
       FROM venture_tasks WHERE venture_id=? AND assigned_name IS NOT NULL
       GROUP BY assigned_name, assigned_cid ORDER BY completed DESC`,
    args: [ventureId],
  });

  return (members.rows || []).map((m) => ({
    ...m,
    total_tasks: parseInt(m.total_tasks)||0,
    completed: parseInt(m.completed)||0,
    blocked: parseInt(m.blocked)||0,
    overdue: parseInt(m.overdue)||0,
    total_estimated: parseFloat(m.total_estimated)||0,
    completed_estimated: parseFloat(m.completed_estimated)||0,
    completion_rate: parseInt(m.total_tasks) > 0 ? Math.round((parseInt(m.completed)/parseInt(m.total_tasks))*100) : 0,
  }));
}

/**
 * Generate export data (CSV-friendly array).
 */
export async function getExportData(ventureId, type = "tasks") {
  if (type === "tasks") {
    const tasks = await getTasksReport(ventureId);
    return tasks.map((t) => ({
      Title: t.title, Status: t.status, Priority: t.priority,
      Assignee: t.assigned_name || "", Milestone: t.milestone_title || "",
      "Due Date": t.due_date ? new Date(t.due_date).toLocaleDateString() : "",
      "Est. Hours": t.estimated_hours || "",
      "Created At": new Date(t.created_at).toLocaleDateString(),
    }));
  }
  if (type === "milestones") {
    const ms = await getMilestonesReport(ventureId);
    return ms.map((m) => ({
      Title: m.title, Status: m.status, Priority: m.priority,
      "Due Date": m.due_date ? new Date(m.due_date).toLocaleDateString() : "",
      "Completion %": m.completion_percentage,
      Deliverables: `${m.del_done||0}/${m.del_total||0}`,
      Tasks: `${m.task_done||0}/${m.task_total||0}`,
    }));
  }
  return [];
}

// =============================================================================
// ENHANCEMENT 3.1: COACH & MENTOR MANAGEMENT
// =============================================================================

/**
 * List all coaches (optionally filtered by type).
 */
export async function listCoaches(coachType) {
  let sql = "SELECT * FROM venture_coaches WHERE 1=1";
  const args = [];
  if (coachType) { sql += " AND coach_type = ?"; args.push(coachType); }
  sql += " ORDER BY full_name ASC";
  const res = await db.execute({ sql, args });
  return (res.rows || []).map((c) => ({
    ...c,
    areas_of_expertise: typeof c.areas_of_expertise === "string" ? JSON.parse(c.areas_of_expertise) : (c.areas_of_expertise || []),
    industries: typeof c.industries === "string" ? JSON.parse(c.industries) : (c.industries || []),
    languages: typeof c.languages === "string" ? JSON.parse(c.languages) : (c.languages || []),
  }));
}

export async function getCoach(coachId) {
  const res = await db.execute({ sql: "SELECT * FROM venture_coaches WHERE id = ?", args: [coachId] });
  if (res.rows.length === 0) return null;
  const c = res.rows[0];
  c.areas_of_expertise = typeof c.areas_of_expertise === "string" ? JSON.parse(c.areas_of_expertise) : (c.areas_of_expertise || []);
  c.industries = typeof c.industries === "string" ? JSON.parse(c.industries) : (c.industries || []);
  c.languages = typeof c.languages === "string" ? JSON.parse(c.languages) : (c.languages || []);
  return c;
}

export async function createCoach({ coachType, fullName, email, phone, organization, biography, yearsExperience, areasOfExpertise, industries, languages, timezone, linkedinUrl, websiteUrl, createdBy }) {
  const res = await db.execute({
    sql: `INSERT INTO venture_coaches (coach_type, full_name, email, phone, organization, biography, years_experience, areas_of_expertise, industries, languages, timezone, linkedin_url, website_url, created_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?::jsonb, ?::jsonb, ?::jsonb, ?, ?, ?, ?) RETURNING id`,
    args: [coachType || "coach", fullName.trim(), email.trim().toLowerCase(), phone||null, organization||null, biography||null, yearsExperience||null, JSON.stringify(areasOfExpertise||[]), JSON.stringify(industries||[]), JSON.stringify(languages||[]), timezone||"UTC", linkedinUrl||null, websiteUrl||null, createdBy||"system"],
  });
  return { id: res.rows[0]?.id || res.lastInsertRowid };
}

export async function updateCoach(coachId, updates) {
  const allowed = ["full_name", "photo_url", "email", "phone", "organization", "biography", "years_experience", "availability", "timezone", "linkedin_url", "website_url", "status", "coach_type"];
  const sets = []; const args = [];
  for (const f of allowed) {
    if (updates[f] !== undefined) {
      if (f === "areas_of_expertise" || f === "industries" || f === "languages") {
        sets.push(`${f} = ?::jsonb`); args.push(JSON.stringify(updates[f]));
      } else { sets.push(`${f} = ?`); args.push(updates[f]); }
    }
  }
  if (sets.length === 0) return { updated: false };
  sets.push("updated_at = NOW()");
  args.push(coachId);
  await db.execute({ sql: `UPDATE venture_coaches SET ${sets.join(", ")} WHERE id = ?`, args });
  return { updated: true };
}

export async function deleteCoach(coachId) {
  await db.execute({ sql: "DELETE FROM venture_coaches WHERE id = ?", args: [coachId] });
  return { success: true };
}

// ─── Assignments ───────────────────────────────────────────────────────────

export async function getVentureAssignments(ventureId) {
  const res = await db.execute({
    sql: `SELECT vca.*, vc.full_name, vc.email, vc.photo_url, vc.organization, vc.biography, vc.years_experience,
       vc.areas_of_expertise, vc.industries, vc.availability, vc.timezone, vc.linkedin_url, vc.status as coach_status
       FROM venture_coach_assignments vca
       JOIN venture_coaches vc ON vca.coach_id = vc.id
       WHERE vca.venture_id = ? AND vca.status = 'active'
       ORDER BY vca.is_primary DESC, vca.assignment_date ASC`,
    args: [ventureId],
  });
  return (res.rows || []).map((a) => ({
    ...a,
    areas_of_expertise: typeof a.areas_of_expertise === "string" ? JSON.parse(a.areas_of_expertise) : (a.areas_of_expertise || []),
    industries: typeof a.industries === "string" ? JSON.parse(a.industries) : (a.industries || []),
  }));
}

export async function assignCoachToVenture({ ventureId, coachId, coachType, isPrimary, assignedBy, notes }) {
  const coach = await getCoach(coachId);
  if (!coach) throw new Error("Coach not found.");
  if (coach.status !== "active") throw new Error("Cannot assign an inactive coach.");
  if (coach.availability === "inactive") throw new Error("Coach is marked as inactive.");

  // Check for duplicate
  const existing = await db.execute({
    sql: "SELECT id FROM venture_coach_assignments WHERE venture_id = ? AND coach_id = ? AND status = 'active'",
    args: [ventureId, coachId],
  });
  if (existing.rows.length > 0) throw new Error("Coach is already assigned to this venture.");

  // If setting as primary, unset any existing primary
  if (isPrimary) {
    await db.execute({
      sql: "UPDATE venture_coach_assignments SET is_primary = FALSE WHERE venture_id = ? AND coach_type = ?",
      args: [ventureId, coachType],
    });
  }

  const res = await db.execute({
    sql: `INSERT INTO venture_coach_assignments (venture_id, coach_id, coach_type, is_primary, assigned_by, notes)
          VALUES (?, ?, ?, ?, ?, ?) RETURNING id`,
    args: [ventureId, coachId, coachType || coach.coach_type, isPrimary ? 1 : 0, assignedBy || "system", notes || null],
  });

  // Log activity
  await db.execute({
    sql: `INSERT INTO venture_coach_activity (coach_id, venture_id, action, actor_cid, details)
          VALUES (?, ?, ?, ?, ?::jsonb)`,
    args: [coachId, ventureId, coachType === "advisor" ? "ADVISOR_ASSIGNED" : "COACH_ASSIGNED", assignedBy || "system", JSON.stringify({ venture_id: ventureId, coach_name: coach.full_name })],
  });

  return { id: res.rows[0]?.id || res.lastInsertRowid };
}

export async function removeAssignment(assignmentId, removedBy) {
  await db.execute({
    sql: "UPDATE venture_coach_assignments SET status = 'removed' WHERE id = ?",
    args: [assignmentId],
  });

  // Log
  try {
    const aRes = await db.execute({ sql: "SELECT * FROM venture_coach_assignments WHERE id = ?", args: [assignmentId] });
    if (aRes.rows.length > 0) {
      await db.execute({
        sql: `INSERT INTO venture_coach_activity (coach_id, venture_id, action, actor_cid, details)
              VALUES (?, ?, 'COACH_REMOVED', ?, ?::jsonb)`,
        args: [aRes.rows[0].coach_id, aRes.rows[0].venture_id, removedBy || "system", JSON.stringify({ assignment_id: assignmentId })],
      });
    }
  } catch (_) {}

  return { success: true };
}

// =============================================================================
// ENHANCEMENT 3.2: MENTORING SESSIONS & SCHEDULING
// =============================================================================

export const SESSION_TYPES = ["coaching", "mentoring", "advisory", "office_hours", "review_meeting", "pitch_review", "investor_preparation", "technical_review", "other"];
export const SESSION_STATUSES = ["scheduled", "confirmed", "in_progress", "completed", "cancelled", "rescheduled", "no_show"];

export async function listSessions(ventureId, { startDate, endDate, status, coachId, limit } = {}) {
  let sql = "SELECT * FROM venture_sessions WHERE venture_id = ?";
  const args = [ventureId];
  if (startDate) { sql += " AND start_time >= ?"; args.push(startDate); }
  if (endDate) { sql += " AND end_time <= ?"; args.push(endDate); }
  if (status) { sql += " AND status = ?"; args.push(status); }
  if (coachId) { sql += " AND coach_id = ?"; args.push(parseInt(coachId)); }
  sql += " ORDER BY start_time DESC";
  if (limit) { sql += " LIMIT ?"; args.push(parseInt(limit)); }
  const res = await db.execute({ sql, args });
  return res.rows || [];
}

export async function getSession(sessionId) {
  const [sRes, nRes, aRes, iRes] = await Promise.all([
    db.execute({ sql: "SELECT * FROM venture_sessions WHERE id = ?", args: [sessionId] }),
    db.execute({ sql: "SELECT * FROM venture_session_notes WHERE session_id = ? ORDER BY created_at ASC", args: [sessionId] }),
    db.execute({ sql: "SELECT * FROM venture_session_attendance WHERE session_id = ?", args: [sessionId] }),
    db.execute({ sql: "SELECT * FROM venture_session_action_items WHERE session_id = ? ORDER BY created_at DESC", args: [sessionId] }),
  ]);
  if (sRes.rows.length === 0) return null;
  return { ...sRes.rows[0], notes: nRes.rows || [], attendance: aRes.rows || [], action_items: iRes.rows || [] };
}

export async function checkDoubleBooking({ ventureId, coachId, startTime, endTime, excludeSessionId }) {
  let sql = `SELECT id FROM venture_sessions WHERE venture_id = ? AND status NOT IN ('cancelled','no_show') AND start_time < ? AND end_time > ?`;
  const args = [ventureId, endTime, startTime];
  if (excludeSessionId) { sql += " AND id != ?"; args.push(parseInt(excludeSessionId)); }
  const vRes = await db.execute({ sql, args });
  if (vRes.rows.length > 0) return { conflict: true, type: "venture", message: "Time slot conflicts with an existing session." };
  if (coachId) {
    const cRes = await db.execute({
      sql: `SELECT id FROM venture_sessions WHERE coach_id = ? AND status NOT IN ('cancelled','no_show') AND start_time < ? AND end_time > ?`,
      args: [parseInt(coachId), endTime, startTime],
    });
    if (cRes.rows.length > 0) return { conflict: true, type: "coach", message: "Coach has a conflicting session." };
  }
  return { conflict: false };
}

export async function createSession({ ventureId, title, description, sessionType, coachId, coachName, founderCid, founderName, startTime, endTime, timezone, location, meetingLink, agenda, createdBy }) {
  if (new Date(startTime) >= new Date(endTime)) throw new Error("End time must be after start time.");
  if (new Date(endTime) < new Date()) throw new Error("Cannot schedule sessions in the past.");
  const conflict = await checkDoubleBooking({ ventureId, coachId, startTime, endTime });
  if (conflict.conflict) throw new Error(conflict.message);
  const res = await db.execute({
    sql: `INSERT INTO venture_sessions (venture_id, title, description, session_type, coach_id, coach_name, founder_cid, founder_name, start_time, end_time, timezone, location, meeting_link, agenda, created_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    args: [ventureId, title.trim(), description||null, sessionType||"coaching", coachId||null, coachName||null, founderCid||null, founderName||null, startTime, endTime, timezone||"UTC", location||null, meetingLink||null, agenda||null, createdBy||"system"],
  });
  const id = res.rows[0]?.id || res.lastInsertRowid;
  await db.execute({
    sql: `INSERT INTO venture_session_activity (session_id, venture_id, action, actor_cid, details) VALUES (?, ?, 'SESSION_CREATED', ?, ?::jsonb)`,
    args: [id, ventureId, createdBy||"system", JSON.stringify({ title, session_type: sessionType })],
  });
  return { id };
}

export async function updateSession(sessionId, updates) {
  const allowed = ["title", "description", "session_type", "coach_id", "coach_name", "founder_cid", "founder_name", "start_time", "end_time", "timezone", "location", "meeting_link", "status", "agenda", "recording_url"];
  const sets = []; const args = [];
  for (const f of allowed) { if (updates[f] !== undefined) { sets.push(`${f} = ?`); args.push(updates[f]); } }
  if (sets.length === 0) return { updated: false };
  if (updates.start_time || updates.end_time) {
    const s = await db.execute({ sql: "SELECT * FROM venture_sessions WHERE id = ?", args: [sessionId] });
    if (s.rows.length > 0) {
      const c = await checkDoubleBooking({ ventureId: s.rows[0].venture_id, coachId: s.rows[0].coach_id, startTime: updates.start_time||s.rows[0].start_time, endTime: updates.end_time||s.rows[0].end_time, excludeSessionId: sessionId });
      if (c.conflict) throw new Error(c.message);
    }
  }
  sets.push("updated_at = NOW()"); args.push(sessionId);
  await db.execute({ sql: `UPDATE venture_sessions SET ${sets.join(", ")} WHERE id = ?`, args });
  if (updates.status === "cancelled") await db.execute({ sql: `INSERT INTO venture_session_activity (session_id, action, details) VALUES (?, 'SESSION_CANCELLED', ?::jsonb)`, args: [sessionId, JSON.stringify({})] });
  if (updates.status === "completed") await db.execute({ sql: `INSERT INTO venture_session_activity (session_id, action, details) VALUES (?, 'SESSION_COMPLETED', ?::jsonb)`, args: [sessionId, JSON.stringify({})] });
  return { updated: true };
}

export async function cancelSession(sessionId) {
  await updateSession(sessionId, { status: "cancelled" });
  return { success: true };
}

export async function rescheduleSession(sessionId, newStartTime, newEndTime) {
  const s = await db.execute({ sql: "SELECT * FROM venture_sessions WHERE id = ?", args: [sessionId] });
  if (s.rows.length === 0) throw new Error("Session not found.");
  const c = await checkDoubleBooking({ ventureId: s.rows[0].venture_id, coachId: s.rows[0].coach_id, startTime: newStartTime, endTime: newEndTime, excludeSessionId: sessionId });
  if (c.conflict) throw new Error(c.message);
  await db.execute({ sql: "UPDATE venture_sessions SET start_time = ?, end_time = ?, status = 'rescheduled', updated_at = NOW() WHERE id = ?", args: [newStartTime, newEndTime, sessionId] });
  await db.execute({ sql: `INSERT INTO venture_session_activity (session_id, action, details) VALUES (?, 'SESSION_RESCHEDULED', ?::jsonb)`, args: [sessionId, JSON.stringify({ new_start: newStartTime, new_end: newEndTime })] });
  return { success: true };
}

export async function deleteSession(sessionId) {
  await db.execute({ sql: "DELETE FROM venture_sessions WHERE id = ?", args: [sessionId] });
  return { success: true };
}

export async function addSessionNote({ sessionId, noteType, content, authorCid, authorName, attachments }) {
  const res = await db.execute({
    sql: `INSERT INTO venture_session_notes (session_id, note_type, content, author_cid, author_name, attachments) VALUES (?, ?, ?, ?, ?, ?::jsonb) RETURNING id`,
    args: [sessionId, noteType||"shared", content, authorCid||null, authorName||null, JSON.stringify(attachments||[])],
  });
  return { id: res.rows[0]?.id || res.lastInsertRowid };
}

export async function recordAttendance({ sessionId, participantCid, participantName, participantType, status }) {
  await db.execute({
    sql: `INSERT INTO venture_session_attendance (session_id, participant_cid, participant_name, participant_type, status) VALUES (?, ?, ?, ?, ?)
          ON CONFLICT (session_id, participant_cid) DO UPDATE SET status = ?, timestamp = NOW()`,
    args: [sessionId, participantCid, participantName||null, participantType||null, status||"attended", status||"attended"],
  });
  return { success: true };
}

export async function createActionItem({ sessionId, title, description, ownerCid, ownerName, priority, dueDate }) {
  const res = await db.execute({
    sql: `INSERT INTO venture_session_action_items (session_id, title, description, owner_cid, owner_name, priority, due_date) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    args: [sessionId, title.trim(), description||null, ownerCid||null, ownerName||null, priority||"medium", dueDate||null],
  });
  return { id: res.rows[0]?.id || res.lastInsertRowid };
}

export async function updateActionItem(itemId, updates) {
  const allowed = ["title", "description", "owner_cid", "owner_name", "priority", "due_date", "status", "completed_at"];
  const sets = []; const args = [];
  for (const f of allowed) { if (updates[f] !== undefined) { sets.push(`${f} = ?`); args.push(updates[f]); } }
  if (sets.length === 0) return { updated: false };
  sets.push("updated_at = NOW()"); args.push(itemId);
  await db.execute({ sql: `UPDATE venture_session_action_items SET ${sets.join(", ")} WHERE id = ?`, args });
  return { updated: true };
}

// =============================================================================
// ENHANCEMENT 3.3: KNOWLEDGE HUB & LEARNING RESOURCES
// =============================================================================

export const RESOURCE_TYPES = ["article", "video", "pdf", "template", "checklist", "presentation", "external_link", "course", "case_study"];

export async function listResources({ category, type, search, featured, limit = 50, offset = 0 }) {
  let sql = `SELECT kr.*, kc.name as category_name FROM knowledge_resources kr LEFT JOIN knowledge_categories kc ON kr.category_id = kc.id WHERE kr.status = 'published'`;
  const args = [];
  if (category) { sql += " AND (kc.slug = ? OR kc.name = ?)"; args.push(category, category); }
  if (type) { sql += " AND kr.resource_type = ?"; args.push(type); }
  if (featured) { sql += " AND kr.is_featured = TRUE"; }
  if (search) { sql += " AND (kr.title ILIKE ? OR kr.description ILIKE ?)"; args.push(`%${search}%`, `%${search}%`); }
  sql += " ORDER BY kr.is_featured DESC, kr.created_at DESC LIMIT ? OFFSET ?"; args.push(limit, offset);
  const res = await db.execute({ sql, args });
  return (res.rows || []).map((r) => ({ ...r, tags: typeof r.tags === "string" ? JSON.parse(r.tags) : (r.tags || []) }));
}

export async function getResource(resourceId, userCid) {
  const res = await db.execute({ sql: `SELECT kr.*, kc.name as category_name FROM knowledge_resources kr LEFT JOIN knowledge_categories kc ON kr.category_id = kc.id WHERE kr.id = ?`, args: [resourceId] });
  if (res.rows.length === 0) return null;
  const r = res.rows[0]; r.tags = typeof r.tags === "string" ? JSON.parse(r.tags) : (r.tags || []);
  await db.execute({ sql: "UPDATE knowledge_resources SET view_count = view_count + 1 WHERE id = ?", args: [resourceId] });
  if (userCid) {
    await db.execute({ sql: `INSERT INTO knowledge_progress (resource_id, user_cid, last_viewed_at) VALUES (?, ?, NOW()) ON CONFLICT (resource_id, user_cid) DO UPDATE SET last_viewed_at = NOW()`, args: [resourceId, userCid] });
    await db.execute({ sql: `INSERT INTO knowledge_activity (resource_id, user_cid, action) VALUES (?, ?, 'RESOURCE_VIEWED')`, args: [resourceId, userCid] });
    const bm = await db.execute({ sql: "SELECT id FROM knowledge_bookmarks WHERE resource_id = ? AND user_cid = ?", args: [resourceId, userCid] });
    r.is_bookmarked = bm.rows.length > 0;
    const pg = await db.execute({ sql: "SELECT is_completed FROM knowledge_progress WHERE resource_id = ? AND user_cid = ?", args: [resourceId, userCid] });
    r.is_completed = pg.rows.length > 0 && pg.rows[0].is_completed;
  }
  return r;
}

export async function createResource({ title, description, resourceType, categoryId, url, content, fileUrl, fileSize, fileType, estimatedMinutes, authorName, authorCid, tags, isFeatured }) {
  if (!title?.trim()) throw new Error("Title is required.");
  if (!RESOURCE_TYPES.includes(resourceType)) throw new Error(`Invalid resource type: "${resourceType}".`);
  const catName = categoryId ? (await db.execute({ sql: "SELECT name FROM knowledge_categories WHERE id = ?", args: [categoryId] })).rows[0]?.name : null;
  const id = (await db.execute({
    sql: `INSERT INTO knowledge_resources (title, description, resource_type, category_id, category_name, url, content, file_url, file_size, file_type, estimated_minutes, author_name, author_cid, tags, is_featured) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb, ?) RETURNING id`,
    args: [title.trim(), description||null, resourceType, categoryId||null, catName, url||null, content||null, fileUrl||null, fileSize||null, fileType||null, estimatedMinutes||null, authorName||null, authorCid||null, JSON.stringify(tags||[]), isFeatured?1:0],
  })).rows[0]?.id;
  await db.execute({ sql: `INSERT INTO knowledge_activity (resource_id, user_cid, action) VALUES (?, ?, 'RESOURCE_CREATED')`, args: [id, authorCid||"system"] });
  return { id };
}

export async function updateResource(resourceId, updates) {
  const allowed = ["title", "description", "resource_type", "category_id", "url", "content", "file_url", "file_size", "file_type", "estimated_minutes", "tags", "status", "is_featured"];
  const sets = []; const args = [];
  for (const f of allowed) { if (updates[f] !== undefined) { sets.push(`${f} = ?`); args.push(updates[f]); } }
  if (sets.length === 0) return { updated: false };
  sets.push("updated_at = NOW()"); args.push(resourceId);
  await db.execute({ sql: `UPDATE knowledge_resources SET ${sets.join(", ")} WHERE id = ?`, args });
  return { updated: true };
}

export async function deleteResource(resourceId) {
  await db.execute({ sql: "DELETE FROM knowledge_resources WHERE id = ?", args: [resourceId] });
  return { success: true };
}

export async function listCategories() {
  const res = await db.execute({ sql: "SELECT * FROM knowledge_categories ORDER BY display_order ASC" });
  for (const cat of res.rows || []) {
    const c = await db.execute({ sql: "SELECT COUNT(*) as cnt FROM knowledge_resources WHERE category_id = ? AND status = 'published'", args: [cat.id] });
    cat.resource_count = parseInt(c.rows[0]?.cnt || 0);
  }
  return res.rows || [];
}

export async function toggleBookmark(resourceId, userCid) {
  const existing = await db.execute({ sql: "SELECT id FROM knowledge_bookmarks WHERE resource_id = ? AND user_cid = ?", args: [resourceId, userCid] });
  if (existing.rows.length > 0) { await db.execute({ sql: "DELETE FROM knowledge_bookmarks WHERE id = ?", args: [existing.rows[0].id] }); return { bookmarked: false }; }
  await db.execute({ sql: "INSERT INTO knowledge_bookmarks (resource_id, user_cid) VALUES (?, ?)", args: [resourceId, userCid] });
  return { bookmarked: true };
}

export async function getUserBookmarks(userCid) {
  const res = await db.execute({ sql: `SELECT kr.*, kb.created_at as bookmarked_at FROM knowledge_bookmarks kb JOIN knowledge_resources kr ON kb.resource_id = kr.id WHERE kb.user_cid = ? ORDER BY kb.created_at DESC`, args: [userCid] });
  return (res.rows || []).map((r) => ({ ...r, tags: typeof r.tags === "string" ? JSON.parse(r.tags) : (r.tags || []) }));
}

export async function markResourceComplete(resourceId, userCid) {
  await db.execute({ sql: `INSERT INTO knowledge_progress (resource_id, user_cid, is_completed, completed_at, last_viewed_at) VALUES (?, ?, TRUE, NOW(), NOW()) ON CONFLICT (resource_id, user_cid) DO UPDATE SET is_completed = TRUE, completed_at = NOW(), last_viewed_at = NOW()`, args: [resourceId, userCid] });
  return { success: true };
}

export async function getRecommendedResources(ventureId) {
  const v = await db.execute({ sql: "SELECT industry FROM ventures WHERE venture_id = ?", args: [ventureId] });
  const industry = v.rows[0]?.industry || "";
  const res = await db.execute({
    sql: `SELECT kr.*, kc.name as category_name FROM knowledge_resources kr LEFT JOIN knowledge_categories kc ON kr.category_id = kc.id WHERE kr.status = 'published' AND (kr.is_featured = TRUE OR kr.tags::text ILIKE ?) ORDER BY kr.view_count DESC, kr.created_at DESC LIMIT 10`,
    args: [`%${industry}%`],
  });
  return (res.rows || []).map((r) => ({ ...r, tags: typeof r.tags === "string" ? JSON.parse(r.tags) : (r.tags || []) }));
}

// =============================================================================
// ENHANCEMENT 3.4: LEARNING PROGRESS & RECOMMENDATIONS
// =============================================================================

export async function getLearningProgress(ventureId, userCid) {
  const [totalRes, completedRes, hoursRes, streakRes, pendingRes] = await Promise.all([
    db.execute({ sql: "SELECT COUNT(*) as cnt FROM knowledge_resources WHERE status = 'published'", args: [] }),
    db.execute({ sql: "SELECT COUNT(*) as cnt FROM knowledge_progress WHERE user_cid = ? AND is_completed = TRUE", args: [userCid] }),
    db.execute({ sql: "SELECT COALESCE(SUM(kr.estimated_minutes), 0) as total FROM knowledge_progress kp JOIN knowledge_resources kr ON kp.resource_id = kr.id WHERE kp.user_cid = ? AND kp.is_completed = TRUE", args: [userCid] }),
    db.execute({ sql: `SELECT COUNT(*) as streak FROM knowledge_progress WHERE user_cid = ? AND is_completed = TRUE AND completed_at >= NOW() - INTERVAL '7 days'`, args: [userCid] }),
    db.execute({ sql: `SELECT kr.id, kr.title, kr.resource_type, kc.name as category_name, kp.last_viewed_at FROM knowledge_progress kp JOIN knowledge_resources kr ON kp.resource_id = kr.id LEFT JOIN knowledge_categories kc ON kr.category_id = kc.id WHERE kp.user_cid = ? AND (kp.is_completed = FALSE OR kp.is_completed IS NULL) ORDER BY kp.last_viewed_at DESC LIMIT 10`, args: [userCid] }),
  ]);
  const total = parseInt(totalRes.rows[0]?.cnt || 1);
  const completed = parseInt(completedRes.rows[0]?.cnt || 0);
  const hoursLearned = Math.round(parseFloat(hoursRes.rows[0]?.total || 0) / 60 * 10) / 10;
  return {
    total_resources: total, completed_resources: completed,
    completion_percentage: Math.round((completed / total) * 100),
    hours_learned: hoursLearned,
    learning_streak: parseInt(streakRes.rows[0]?.streak || 0),
    pending_resources: pendingRes.rows || [],
  };
}

export async function getPersonalizedRecommendations(ventureId, userCid, limit = 10) {
  const vRes = await db.execute({ sql: "SELECT industry, business_stage FROM ventures WHERE venture_id = ?", args: [ventureId] });
  const venture = vRes.rows[0] || {};
  const industry = venture.industry || "";
  const stage = venture.business_stage || "";
  const completed = await db.execute({ sql: "SELECT resource_id FROM knowledge_progress WHERE user_cid = ? AND is_completed = TRUE", args: [userCid] });
  const completedIds = new Set((completed.rows || []).map((r) => r.resource_id));
  const bookmarked = await db.execute({ sql: "SELECT resource_id FROM knowledge_bookmarks WHERE user_cid = ?", args: [userCid] });
  const bookmarkedIds = new Set((bookmarked.rows || []).map((r) => r.resource_id));

  const res = await db.execute({
    sql: `SELECT kr.*, kc.name as category_name FROM knowledge_resources kr LEFT JOIN knowledge_categories kc ON kr.category_id = kc.id WHERE kr.status = 'published' ORDER BY (CASE WHEN kr.tags::text ILIKE ? THEN 3 ELSE 0 END) + (CASE WHEN kr.tags::text ILIKE ? THEN 2 ELSE 0 END) + (kr.view_count * 0.01) + (CASE WHEN kr.is_featured THEN 2 ELSE 0 END) DESC LIMIT ?`,
    args: [`%${industry}%`, `%${stage}%`, limit * 2],
  });

  const results = [];
  for (const r of res.rows || []) {
    if (results.length >= limit) break;
    if (completedIds.has(r.id)) continue;
    r.is_bookmarked = bookmarkedIds.has(r.id);
    r.tags = typeof r.tags === "string" ? JSON.parse(r.tags) : (r.tags || []);
    const tagsLower = (r.tags || []).map((t) => t.toLowerCase());
    r.recommendation_reason = tagsLower.some((t) => industry.toLowerCase().includes(t))
      ? "Based on your industry" : r.is_featured ? "Featured resource" : "Popular resource";
    results.push(r);
    await db.execute({ sql: `INSERT INTO learning_recommendation_log (venture_id, resource_id, reason, score) VALUES (?, ?, ?, ?) ON CONFLICT DO NOTHING`, args: [ventureId, r.id, r.recommendation_reason, 0] }).catch(() => {});
  }
  return results;
}

export async function getLearningHistory(userCid, limit = 20) {
  const res = await db.execute({
    sql: `SELECT ka.*, kr.title as resource_title, kr.resource_type FROM knowledge_activity ka LEFT JOIN knowledge_resources kr ON ka.resource_id = kr.id WHERE ka.user_cid = ? ORDER BY ka.created_at DESC LIMIT ?`,
    args: [userCid, limit],
  });
  return res.rows || [];
}

export async function listLearningPaths(level) {
  let sql = "SELECT * FROM learning_paths WHERE is_active = TRUE";
  const args = [];
  if (level) { sql += " AND level = ?"; args.push(level); }
  sql += " ORDER BY level ASC, name ASC";
  const res = await db.execute({ sql, args });
  return (res.rows || []).map((p) => ({ ...p, resource_ids: typeof p.resource_ids === "string" ? JSON.parse(p.resource_ids) : (p.resource_ids || []) }));
}

export async function createLearningPath({ name, description, level, categoryId, resourceIds, estimatedHours, createdBy }) {
  const id = (await db.execute({
    sql: `INSERT INTO learning_paths (name, description, level, category_id, resource_ids, estimated_hours, created_by) VALUES (?, ?, ?, ?, ?::jsonb, ?, ?) RETURNING id`,
    args: [name.trim(), description||null, level||"beginner", categoryId||null, JSON.stringify(resourceIds||[]), estimatedHours||null, createdBy||"system"],
  })).rows[0]?.id;
  return { id };
}

export async function getVentureLearningPaths(ventureId) {
  const res = await db.execute({
    sql: `SELECT lpa.*, lp.name, lp.description, lp.level, lp.resource_ids, lp.estimated_hours FROM learning_path_assignments lpa JOIN learning_paths lp ON lpa.path_id = lp.id WHERE lpa.venture_id = ? ORDER BY lpa.assigned_at DESC`,
    args: [ventureId],
  });
  const paths = [];
  for (const row of res.rows || []) {
    const resourceIds = typeof row.resource_ids === "string" ? JSON.parse(row.resource_ids) : (row.resource_ids || []);
    const cnt = resourceIds.length > 0 ? (await db.execute({ sql: `SELECT COUNT(*) as c FROM knowledge_progress WHERE resource_id = ANY($1) AND is_completed = TRUE`, args: [resourceIds] }).catch(() => ({ rows: [{ c: 0 }] }))).rows[0]?.c || 0 : 0;
    paths.push({ ...row, resource_ids: resourceIds, completion: resourceIds.length > 0 ? Math.round((cnt / resourceIds.length) * 100) : 0 });
  }
  return paths;
}

export async function assignLearningPath({ ventureId, pathId, assignedBy }) {
  await db.execute({ sql: `INSERT INTO learning_path_assignments (venture_id, path_id, assigned_by) VALUES (?, ?, ?) ON CONFLICT (venture_id, path_id) DO UPDATE SET status = 'active'`, args: [ventureId, pathId, assignedBy||"system"] });
  return { success: true };
}

// =============================================================================
// ENHANCEMENT 3.5: MENTOR FEEDBACK & ANALYTICS
// =============================================================================

export async function submitFeedback({ sessionId, ventureId, coachId, founderCid, ratingOverall, ratingCommunication, ratingExpertise, ratingAvailability, ratingHelpfulness, comments, isAnonymous }) {
  const s = await db.execute({ sql: "SELECT status FROM venture_sessions WHERE id = ?", args: [sessionId] });
  if (s.rows.length === 0) throw new Error("Session not found.");
  if (!["completed", "in_progress"].includes(s.rows[0].status)) throw new Error("Feedback requires a completed or in-progress session.");
  if (!ratingOverall || ratingOverall < 1 || ratingOverall > 5) throw new Error("Rating must be 1-5.");

  const id = (await db.execute({
    sql: `INSERT INTO venture_mentor_feedback (session_id, venture_id, coach_id, founder_cid, rating_overall, rating_communication, rating_expertise, rating_availability, rating_helpfulness, comments, is_anonymous)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT (session_id, coach_id) DO UPDATE SET
          rating_overall=EXCLUDED.rating_overall, comments=EXCLUDED.comments, updated_at=NOW() RETURNING id`,
    args: [sessionId, ventureId, coachId||null, founderCid||null, ratingOverall, ratingCommunication||null, ratingExpertise||null, ratingAvailability||null, ratingHelpfulness||null, comments||null, isAnonymous?1:0],
  })).rows[0]?.id;
  if (coachId) await recalculateCoachAnalytics(coachId);
  await db.execute({ sql: `INSERT INTO venture_feedback_activity (feedback_id, coach_id, venture_id, action, actor_cid) VALUES (?, ?, ?, 'FEEDBACK_SUBMITTED', ?)`, args: [id, coachId, ventureId, founderCid||"system"] });
  return { id };
}

export async function getFeedback(feedbackId) {
  const r = await db.execute({ sql: "SELECT vmf.*, vs.title as session_title FROM venture_mentor_feedback vmf LEFT JOIN venture_sessions vs ON vmf.session_id = vs.id WHERE vmf.id = ?", args: [feedbackId] });
  return r.rows[0] || null;
}

export async function listFeedback({ ventureId, coachId, sessionId }) {
  let sql = `SELECT vmf.*, vs.title as session_title, vs.session_type, vc.full_name as coach_name FROM venture_mentor_feedback vmf LEFT JOIN venture_sessions vs ON vmf.session_id = vs.id LEFT JOIN venture_coaches vc ON vmf.coach_id = vc.id WHERE 1=1`;
  const args = [];
  if (ventureId) { sql += " AND vmf.venture_id = ?"; args.push(ventureId); }
  if (coachId) { sql += " AND vmf.coach_id = ?"; args.push(parseInt(coachId)); }
  if (sessionId) { sql += " AND vmf.session_id = ?"; args.push(parseInt(sessionId)); }
  sql += " ORDER BY vmf.created_at DESC LIMIT 50";
  const r = await db.execute({ sql, args });
  return r.rows || [];
}

export async function deleteFeedback(feedbackId) {
  const f = await getFeedback(feedbackId);
  if (!f) return { success: false };
  await db.execute({ sql: "DELETE FROM venture_mentor_feedback WHERE id = ?", args: [feedbackId] });
  if (f.coach_id) await recalculateCoachAnalytics(f.coach_id);
  return { success: true };
}

async function recalculateCoachAnalytics(coachId) {
  if (!coachId) return;
  const [rR, sR, aR, cR, vR, acR, hR] = await Promise.all([
    db.execute({ sql: "SELECT AVG(rating_overall) as r, COUNT(*) as c FROM venture_mentor_feedback WHERE coach_id=?", args: [coachId] }),
    db.execute({ sql: "SELECT COUNT(*) as c FROM venture_sessions WHERE coach_id=? AND status='completed'", args: [coachId] }),
    db.execute({ sql: `SELECT COUNT(*) as a FROM venture_session_attendance WHERE session_id IN (SELECT id FROM venture_sessions WHERE coach_id=?) AND status='attended'`, args: [coachId] }),
    db.execute({ sql: "SELECT COUNT(*) as c FROM venture_sessions WHERE coach_id=? AND status='cancelled'", args: [coachId] }),
    db.execute({ sql: "SELECT COUNT(*) as c FROM venture_coach_assignments WHERE coach_id=? AND status='active'", args: [coachId] }),
    db.execute({ sql: `SELECT COUNT(*) as c FROM venture_session_action_items vai JOIN venture_sessions vs ON vai.session_id=vs.id WHERE vs.coach_id=? AND vai.status='completed'`, args: [coachId] }),
    db.execute({ sql: `SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (end_time-start_time))/3600),0) as h FROM venture_sessions WHERE coach_id=? AND status='completed'`, args: [coachId] }),
  ]);
  const avgR = parseFloat(rR.rows[0]?.r)||0;
  const fCount = parseInt(rR.rows[0]?.c)||0;
  const sC = parseInt(sR.rows[0]?.c)||0;
  const attended = parseInt(aR.rows[0]?.a)||0;
  const cancelled = parseInt(cR.rows[0]?.c)||0;
  const totalS = sC + cancelled || 1;
  const typeR = await db.execute({ sql: "SELECT coach_type FROM venture_coaches WHERE id=?", args: [coachId] });
  const ct = typeR.rows[0]?.coach_type || "coach";

  await db.execute({
    sql: `INSERT INTO venture_mentor_analytics (coach_id, coach_type, average_rating, sessions_completed, attendance_rate, cancellation_rate, assigned_ventures, completed_action_items, mentoring_hours, founder_satisfaction, engagement_score, last_calculated)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
          ON CONFLICT (coach_id) DO UPDATE SET average_rating=EXCLUDED.average_rating, sessions_completed=EXCLUDED.sessions_completed,
          attendance_rate=EXCLUDED.attendance_rate, cancellation_rate=EXCLUDED.cancellation_rate,
          assigned_ventures=EXCLUDED.assigned_ventures, completed_action_items=EXCLUDED.completed_action_items,
          mentoring_hours=EXCLUDED.mentoring_hours, founder_satisfaction=EXCLUDED.founder_satisfaction,
          engagement_score=EXCLUDED.engagement_score, last_calculated=NOW(), updated_at=NOW()`,
    args: [coachId, ct, Math.round(avgR*100)/100, sC, sC>0?Math.round((attended/sC)*100):0, Math.round((cancelled/totalS)*100),
      parseInt(vR.rows[0]?.c)||0, parseInt(acR.rows[0]?.c)||0, Math.round(parseFloat(hR.rows[0]?.h||0)*100)/100,
      fCount>0?Math.round(avgR*20):0, Math.min(100, Math.round((sC*5)+(parseInt(vR.rows[0]?.c||0)*10)+(parseInt(acR.rows[0]?.c||0)*3)+(parseFloat(hR.rows[0]?.h||0)*2)))],
  });
}

export async function getMentorAnalytics(coachType) {
  const r = await db.execute({
    sql: `SELECT vma.*, vc.full_name, vc.email, vc.photo_url, vc.organization, vc.areas_of_expertise FROM venture_mentor_analytics vma JOIN venture_coaches vc ON vma.coach_id = vc.id WHERE vma.coach_type=? AND vc.status='active' ORDER BY vma.engagement_score DESC LIMIT 50`,
    args: [coachType],
  });
  return (r.rows||[]).map((r) => ({...r, areas_of_expertise: typeof r.areas_of_expertise==="string"?JSON.parse(r.areas_of_expertise):(r.areas_of_expertise||[])}));
}

export async function getSessionAnalytics(ventureId) {
  const [tR, cR, ccR, nR, hR, fR] = await Promise.all([
    db.execute({ sql: "SELECT COUNT(*) as c FROM venture_sessions WHERE venture_id=?", args: [ventureId] }),
    db.execute({ sql: "SELECT COUNT(*) as c FROM venture_sessions WHERE venture_id=? AND status='completed'", args: [ventureId] }),
    db.execute({ sql: "SELECT COUNT(*) as c FROM venture_sessions WHERE venture_id=? AND status='cancelled'", args: [ventureId] }),
    db.execute({ sql: "SELECT COUNT(*) as c FROM venture_sessions WHERE venture_id=? AND status='no_show'", args: [ventureId] }),
    db.execute({ sql: `SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (end_time-start_time))/3600),0) as h FROM venture_sessions WHERE venture_id=? AND status='completed'`, args: [ventureId] }),
    db.execute({ sql: "SELECT AVG(rating_overall) as r, COUNT(*) as c FROM venture_mentor_feedback WHERE venture_id=?", args: [ventureId] }),
  ]);
  const total = parseInt(tR.rows[0]?.c||0);
  return {
    total_sessions: total, completed: parseInt(cR.rows[0]?.c||0),
    cancelled: parseInt(ccR.rows[0]?.c||0), no_shows: parseInt(nR.rows[0]?.c||0),
    total_hours: Math.round(parseFloat(hR.rows[0]?.h||0)*10)/10,
    average_rating: parseFloat(fR.rows[0]?.r)||0, feedback_count: parseInt(fR.rows[0]?.c||0),
    completion_rate: total>0?Math.round((parseInt(cR.rows[0]?.c||0)/total)*100):0,
  };
}

export async function getFeedbackAnalytics(ventureId) {
  const [trend, dist] = await Promise.all([
    db.execute({ sql: `SELECT DATE(created_at) as d, AVG(rating_overall) as r, COUNT(*) as c FROM venture_mentor_feedback WHERE venture_id=? GROUP BY DATE(created_at) ORDER BY d LIMIT 30`, args: [ventureId] }),
    db.execute({ sql: `SELECT rating_overall, COUNT(*) as c FROM venture_mentor_feedback WHERE venture_id=? GROUP BY rating_overall ORDER BY rating_overall`, args: [ventureId] }),
  ]);
  return { trend: trend.rows||[], distribution: dist.rows||[] };
}
