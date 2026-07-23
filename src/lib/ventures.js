import db, { initDb } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";

/**
 * VENTURE OS — Shared Business Logic
 * Enhancement 1.1 — Workflow B: Direct Startup Registration
 * Enhancement 1.1 — Workflow A: Program-to-Venture Promotion
 */

const VENTURE_ID_PREFIX = "VNT";

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
  const nameCheck = await db.execute({
    sql: "SELECT id FROM ventures WHERE LOWER(company_name) = LOWER(?)",
    args: [company_name.trim()],
  });
  if (nameCheck.rows.length > 0) {
    conflicts.push("A company with this name already exists");
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

  return {
    ...venture,
    founders: foundersRes.rows,
    members: membersRes.rows,
    activity: activityRes.rows,
    history: historyRes.rows,
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

  const nameCheck = await db.execute({
    sql: "SELECT id FROM ventures WHERE LOWER(company_name) = LOWER(?)",
    args: [company_name.trim()],
  });
  if (nameCheck.rows.length > 0) {
    conflicts.push("A company with this name already exists");
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
