import db from "@/lib/db";
import { v4 as uuidv4 } from "uuid";
import { listVentureMembers, summarizeVentureMembers } from "@/models/ventureMembers";

/**
 * VENTURE OS — Shared Business Logic
 * Enhancement 1.1 — Workflow B: Direct Startup Registration
 * Enhancement 1.1 — Workflow A: Program-to-Venture Promotion
 */

const VENTURE_ID_PREFIX = "VNT";

// ── Venture schema bootstrap ────────────────────────────────────────────────
// Extracted to the service layer; re-exported for existing importers
// (see docs/LAYER_SPLIT.md).
export { ensureVentureSchema } from "@/services/ventures/schema";

/**
 * Generate a unique Venture ID in format: VNT-XXXXXXXX
 */
export function generateVentureId() {
  const suffix = uuidv4().replace(/-/g, "").substring(0, 8).toUpperCase();
  return `${VENTURE_ID_PREFIX}-${suffix}`;
}

/**
 * Resolve the members of a program team for Venture promotion.
 *
 * The canonical membership link is contacts.v2_team_id (written by /api/pm/teams);
 * v2_participants.v2_team_id holds the same link for UUID-keyed participants.
 * The old promote path queried v2_group_members (a v2_groups table — wrong) and
 * fell back to ALL program participants — this helper fixes that.
 */
export async function resolveTeamMembersForPromotion(teamId) {
  const res = await db.execute({
    sql: `SELECT c.cid AS contact_id, c.name, c.email
          FROM contacts c
          WHERE c.v2_team_id = ? AND c.deleted = 0
          UNION
          SELECT p.user_id AS contact_id, c2.name, c2.email
          FROM v2_participants p
          JOIN contacts c2 ON c2.cid = p.user_id
          WHERE p.v2_team_id = ? AND c2.deleted = 0`,
    args: [teamId, teamId],
  });
  return (res.rows || []).filter((member) => member && member.contact_id);
}

/**
 * Validate company information for registration.
 * Returns { valid: boolean, errors: string[] }
 */
export function validateCompanyInfo({
  company_name,
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
  // Always use "name" (legacy column exists in the table).
  // Also try setting "company_name" for new schema compatibility.
  const name = company_name.trim();

  try {
    // Try with both name and company_name
    await db.execute({
      sql: `INSERT INTO ventures (venture_id, name, company_name, registration_number, industry, business_stage, description, website, logo_url, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        venture_id, name, name,
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
    // company_name column may not exist yet — fall back to just "name"
    if (err.message?.includes("company_name")) {
      await db.execute({
        sql: `INSERT INTO ventures (venture_id, name, registration_number, industry, business_stage, description, website, logo_url, created_by)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          venture_id, name,
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

// ── Activity log, history and notifications ─────────────────────────────────
// Extracted to the service layer; kept reachable through this module's public
// surface for existing importers (see docs/LAYER_SPLIT.md).
export {
  logVentureActivity,
  addVentureHistory,
  createVentureNotification,
  notifyVentureFounders,
} from "@/services/ventures/activity";

/**
 * Get a venture by its venture_id with founder info.
 */
export async function getVentureById(ventureId) {
  // Normalize: routes may receive a numeric/UUID id (e.g. from list pages or
  // pre-fix promoted ventures). Resolve it to the VNT business key first.
  let key = ventureId;
  if (ventureId && !/^VNT-/i.test(ventureId)) {
    try {
      const byId = await db.execute({
        sql: "SELECT venture_id FROM ventures WHERE id::text = ?",
        args: [ventureId],
      });
      if (byId.rows.length > 0 && byId.rows[0].venture_id) {
        key = byId.rows[0].venture_id;
      }
    } catch (_) {}
  }

  const ventureRes = await db.execute({
    sql: "SELECT * FROM ventures WHERE venture_id = ?",
    args: [key],
  });

  if (ventureRes.rows.length === 0) return null;

  const venture = ventureRes.rows[0];

  // Get founders
  const foundersRes = await db.execute({
    sql: "SELECT * FROM venture_founders WHERE venture_id = ? ORDER BY created_at ASC",
    args: [key],
  });

  // Get members — the membership list IS the Venture's people. The founder table
  // read above is the INVITATION ledger; it is shown on the founders screen and
  // is never the source of a member count.
  let members = [];
  try {
    members = await listVentureMembers(db, key);
  } catch (_) {}
  const memberSummary = summarizeVentureMembers(members);

  // Get recent activity. The actor is resolved to a person when the log kept an
  // id instead of a name, so the journal never reads "by USR_…".
  let activity = [];
  try {
    const activityRes = await db.execute({
      sql: `SELECT al.*, COALESCE(ca.name, cb.name) AS actor_resolved_name
            FROM venture_activity_log al
            LEFT JOIN contacts ca ON ca.cid = al.actor_cid
            LEFT JOIN contacts cb ON cb.cid = al.actor_name
            WHERE al.venture_id = ?
            ORDER BY al.created_at DESC LIMIT 20`,
      args: [key],
    });
    activity = (activityRes.rows || []).map((activityRow) => ({
      ...activityRow,
      actor_name: activityRow.actor_resolved_name || activityRow.actor_name || null,
    }));
  } catch (_) {}

  // Get history
  const historyRes = await db.execute({
    sql: "SELECT * FROM venture_history WHERE venture_id = ? ORDER BY created_at ASC",
    args: [key],
  });

  // Get startup profile progress
  let profileProgress = null;
  try {
    const progressRes = await db.execute({
      sql: "SELECT * FROM startup_profile_progress WHERE venture_id = ?",
      args: [key],
    });
    profileProgress = progressRes.rows[0] || null;
  } catch (_) {}

  return {
    ...venture,
    founders: foundersRes.rows,
    members,
    member_summary: memberSummary,
    activity,
    history: historyRes.rows,
    profile_progress: profileProgress,
  };
}

/**
 * Update a venture record.
 */
export async function updateVenture(ventureId, updates) {
  const allowedFields = [
    "name",
    "company_name",
    "registration_number",
    "mission",
    "vision",
    "industry",
    "sector",
    "business_stage",
    "description",
    "website",
    "logo_url",
    "social_media",
    "status",
    "visibility",
    "language",
    "branding",
    "country",
    "country_code",
    "registration_status",
    "north_star",
    // How the engagement is being run (Incubation / Acceleration / Hybrid) — a
    // label on the Venture, never a level in the hierarchy. Its values live in
    // venture_option_values so they can be renamed without a code change.
    "programme_type",
  ];

  const setClauses = [];
  const args = [];

  // `ventures` carries TWO columns for the same thing — the legacy `name` and
  // the canonical `company_name` (see HANDOVER_VENTURES.md: two generations of
  // the table). Callers write one of them, so a rename used to leave the other
  // stale: the profile screens send only `company_name`, and any surface still
  // reading `name` (the founder's My Ventures card, the portfolio reports) kept
  // showing the Venture's original label — for intake-created Ventures, the
  // name of the Run that collected the application. Mirroring the two here, on
  // the one function every rename goes through, keeps them telling one story.
  const mirrored = { ...updates };
  if (mirrored.company_name !== undefined && mirrored.name === undefined) {
    mirrored.name = mirrored.company_name;
  } else if (mirrored.name !== undefined && mirrored.company_name === undefined) {
    mirrored.company_name = mirrored.name;
  }

  for (const field of allowedFields) {
    if (mirrored[field] !== undefined) {
      setClauses.push(`${field} = ?`);
      args.push(mirrored[field]);
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

/**
 * Change the lead founder / owner of a Venture (Phase 4).
 *
 * The new lead must be an existing active member. The previous lead is
 * cleared, the new member becomes lead_founder + is_owner (member_type
 * founder), the change is appended to ownership_history and audited.
 * A Venture can never end up without a lead through this action.
 */
export async function changeVentureLead({ ventureId, memberId, actorCid }) {
  const memberRes = await db.execute({
    sql: "SELECT * FROM venture_members WHERE id = ? AND venture_id = ? AND removed_at IS NULL",
    args: [memberId, ventureId],
  });
  const member = memberRes.rows[0];
  if (!member) return { error: "Venture member not found." };

  // Capture the current lead/owner (if any) before clearing — used for the
  // append-only contact_roles history mirror.
  let previousLeadCid = null;
  try {
    const prev = await db.execute({
      sql: "SELECT contact_id FROM venture_members WHERE venture_id = ? AND (lead_founder = TRUE OR is_owner = TRUE) AND removed_at IS NULL ORDER BY id DESC LIMIT 1",
      args: [ventureId],
    });
    previousLeadCid = prev.rows?.[0]?.contact_id || null;
  } catch (_) {}

  // Clear the current lead/owner (if any)
  await db.execute({
    sql: "UPDATE venture_members SET lead_founder = FALSE, is_owner = FALSE WHERE venture_id = ? AND (lead_founder = TRUE OR is_owner = TRUE)",
    args: [ventureId],
  });

  // Promote the new lead
  await db.execute({
    sql: "UPDATE venture_members SET lead_founder = TRUE, is_owner = TRUE, member_type = 'founder', role = 'founder' WHERE id = ?",
    args: [memberId],
  });

  // Append-only ownership history
  try {
    await db.execute({
      sql: `INSERT INTO ownership_history (venture_id, previous_owner_id, previous_owner_email, previous_owner_name,
            new_owner_id, new_owner_email, new_owner_name, transferred_by_id, transferred_by_email)
            VALUES (?, NULL, NULL, NULL, ?, ?, ?, ?, ?)`,
      args: [ventureId, member.contact_id || member.user_cid || memberId, "", member.name || "", actorCid || "system", ""],
    });
  } catch (_) {}

  // Append-only contact_roles mirror (context_type='venture')
  try {
    const { syncVentureRoleHistory } = await import("@/lib/contactIdentity");
    const newLeadCid = member.contact_id || member.user_cid || memberId;
    if (previousLeadCid && previousLeadCid !== newLeadCid) {
      await syncVentureRoleHistory({
        contactCid: previousLeadCid,
        ventureId,
        role: "founder",
        active: false,
        actorCid: actorCid || null,
        notes: "founder replaced",
      });
    }
    await syncVentureRoleHistory({
      contactCid: newLeadCid,
      ventureId,
      role: "founder",
      active: true,
      actorCid: actorCid || null,
      notes: "lead founder changed",
    });
  } catch (_) {}

  // Phase 6: the new lead is a founder — make sure the venture relationship
  // grants what the Context Roles registry maps for venture:founder. Kept last
  // so it never disturbs the ownership-history/audit writes above.
  try {
    const { syncContextGrantsForUser } = await import("@/models/authorization/contextGrants");
    await syncContextGrantsForUser(member.contact_id || member.user_cid);
  } catch (_) {}

  return { success: true };
}

// =============================================================================
// WORKFLOW A: PROGRAM-TO-VENTURE PROMOTION
// =============================================================================

// ── ENHANCEMENT 1.2: Startup profile wizard ─────────────────────────────────
// Extracted to the service layer; re-exported for existing importers
// (see docs/LAYER_SPLIT.md).
export {
  WIZARD_STEP_VALIDATORS,
  ALLOWED_DOCUMENT_TYPES,
  ALLOWED_FILE_EXTENSIONS,
  WIZARD_STEPS_MAP,
  TOTAL_WIZARD_STEPS,
  calculateCompletion,
  validateStep,
  validateFullProfile,
  getOrCreateStartupProfile,
  updateWizardStep,
  submitStartupProfile,
  uploadProfileDocument,
  deleteProfileDocument,
  canEditStartupProfile,
  canReadStartupProfile,
} from "@/services/ventures/profile";

// ── ENHANCEMENT 1.3: Founder & co-founder management ───────────────────────
// Extracted to the service layer; re-exported for existing importers
// (see docs/LAYER_SPLIT.md).
export {
  VENTURE_ROLES,
  VENTURE_ROLE_LABELS,
  MANAGEMENT_ROLES,
  canManageFounders,
  listFounders,
  getFounderById,
  inviteFounder,
  updateFounderRole,
  removeFounder,
  transferOwnership,
  suspendFounder,
  reactivateFounder,
} from "@/services/ventures/founders";

// ── ENHANCEMENT 1.4: Startup verification (the Data bank) ───────────────────
// Extracted to the service layer; re-exported for existing importers
// (see docs/LAYER_SPLIT.md).
export {
  VERIFICATION_CATEGORIES,
  VERIFICATION_CATEGORY_LABELS,
  canManageVerification,
  canSubmitVerification,
  getOrCreateVerification,
  submitVerification,
  updateVerificationStatus,
  resubmitVerification,
  uploadVerificationDocument,
  deleteVerificationDocument,
  listVerificationDocumentVersions,
  addVerificationDocumentVersion,
  addVerificationComment,
} from "@/services/ventures/verification";

// ── ENHANCEMENT 2.2: Milestones & deliverables ─────────────────────────────
// Extracted to the service layer; re-exported for existing importers
// (see docs/LAYER_SPLIT.md).
export {
  getMilestone,
  listDeliverables,
  getDeliverable,
  createDeliverable,
  updateDeliverable,
} from "@/services/ventures/deliverables";

// ── ENHANCEMENT 2.3: Task management & Kanban ──────────────────────────────
// Extracted to the service layer; re-exported for existing importers
// (see docs/LAYER_SPLIT.md).
export {
  listTasks,
  getTask,
  createTask,
  updateTask,
  deleteTask,
  listVentureTaskDependencyEdges,
  getUnmetTaskDependencies,
  countTaskBlockers,
  listTasksBlockedBy,
  setTaskDependencies,
  syncTaskBlockState,
  releaseTasksBlockedBy,
  listTaskComments,
  addTaskComment,
  deleteTaskComment,
  listTaskAttachments,
  addTaskAttachment,
  deleteTaskAttachment,
} from "@/services/ventures/tasks";

// ── ENHANCEMENT 2.4: Project timeline & progress tracking ────────────────────
// Extracted to the service layer; re-exported for existing importers
// (see docs/LAYER_SPLIT.md).
export {
  calculateProjectProgress,
  getProjectTimeline,
  getGanttData,
  getDelaySummary,
  addDependency,
  removeDependency,
} from "@/services/ventures/timeline";

// ── ENHANCEMENT 2.5: Reports & project analytics ────────────────────────────
// Extracted to the service layer; re-exported for existing importers
// (see docs/LAYER_SPLIT.md).
export {
  getVentureAnalytics,
  getMilestonesReport,
  getTasksReport,
  getTeamProductivity,
  getExportData,
} from "@/services/ventures/analytics";

// ── ENHANCEMENT 3.1: Coach & mentor management ─────────────────────────────
// Extracted to the service layer; re-exported for existing importers
// (see docs/LAYER_SPLIT.md).
export {
  listCoaches,
  getCoach,
  createCoach,
  updateCoach,
  deleteCoach,
  getVentureAssignments,
  assignCoachToVenture,
  removeAssignment,
} from "@/services/ventures/coaches";

// ── ENHANCEMENT 3.2: Mentoring sessions & scheduling ────────────────────────
// Extracted to the service layer; re-exported for existing importers
// (see docs/LAYER_SPLIT.md).
export {
  listSessions,
  getSession,
  checkDoubleBooking,
  createSession,
  updateSession,
  cancelSession,
  rescheduleSession,
  deleteSession,
  addSessionNote,
  recordAttendance,
  createActionItem,
  updateActionItem,
} from "@/services/ventures/sessions";

// ── ENHANCEMENT 3.3–3.4: Knowledge hub & learning ──────────────────────────
// Extracted to the service layer; re-exported for existing importers
// (see docs/LAYER_SPLIT.md).
export {
  RESOURCE_TYPES,
  listResources,
  getResource,
  createResource,
  updateResource,
  deleteResource,
  listCategories,
  toggleBookmark,
  getUserBookmarks,
  markResourceComplete,
  getRecommendedResources,
  getLearningProgress,
  getPersonalizedRecommendations,
  getLearningHistory,
  listLearningPaths,
  createLearningPath,
  getVentureLearningPaths,
  assignLearningPath,
} from "@/services/ventures/knowledge";

// ── ENHANCEMENT 3.5: Mentor feedback & analytics ────────────────────────────
// Extracted to the service layer; re-exported for existing importers
// (see docs/LAYER_SPLIT.md).
export {
  submitFeedback,
  getFeedback,
  listFeedback,
  deleteFeedback,
  getMentorAnalytics,
  getSessionAnalytics,
  getFeedbackAnalytics,
} from "@/services/ventures/feedback";

// ── ENHANCEMENT 4.1: Investment readiness assessment ────────────────────────
// Extracted to the service layer; re-exported for existing importers
// (see docs/LAYER_SPLIT.md).
export {
  INVESTMENT_CATEGORIES,
  INVESTMENT_LEVELS,
  calculateInvestmentReadiness,
  evaluateInvestmentReadiness,
  generateRecommendations,
  getInvestmentReadiness,
  getInvestmentRecommendations,
} from "@/services/ventures/investmentReadiness";

// ── ENHANCEMENT 4.2: Investor matching ──────────────────────────────────────
// Extracted to the service layer; re-exported for existing importers
// (see docs/LAYER_SPLIT.md).
export {
  listInvestors,
  getInvestor,
  createInvestor,
  calculateMatchScore,
  generateMatches,
  getVentureMatches,
  updateMatchStatus,
} from "@/services/ventures/investorMatching";

// ── ENHANCEMENT 4.3: Pitch deck & data room ─────────────────────────────────
// Extracted to the service layer; re-exported for existing importers
// (see docs/LAYER_SPLIT.md).
export {
  listDocuments,
  getDocument,
  uploadDocument,
  updateDocument,
  deleteDocument,
  createShareLink,
  revokeShare,
  getAccessLogs,
  getDocumentShares,
} from "@/services/ventures/documents";

// ── ENHANCEMENT 4.4: Fundraising pipeline ───────────────────────────────────
// Extracted to the service layer; re-exported for existing importers
// (see docs/LAYER_SPLIT.md).
export {
  ACTIVITY_TYPES,
  listOpportunities,
  getOpportunity,
  createOpportunity,
  updateOpportunity,
  deleteOpportunity,
  addOpportunityNote,
  addOpportunityActivity,
  getPipelineAnalytics,
} from "@/services/ventures/fundraising";

// ── ENHANCEMENT 4.5: Investment analytics & reports ─────────────────────────
// Extracted to the service layer; re-exported for existing importers
// (see docs/LAYER_SPLIT.md).
export {
  getInvestmentAnalytics,
  getInvestmentReportSummary,
} from "@/services/ventures/investmentAnalytics";

// ── ENHANCEMENT 5.1: Administration & system configuration ──────────────────
// Extracted to the service layer; re-exported for existing importers
// (see docs/LAYER_SPLIT.md).
export {
  getSystemSettings,
  updateSetting,
  getFeatureFlags,
  updateFeatureFlag,
  getSystemRoles,
  updateRole,
  createRole,
  getSystemInfo,
  getAdminActivityLogs,
} from "@/services/ventures/systemAdmin";

// ── ENHANCEMENT 5.2: Notification center ────────────────────────────────────
// Extracted to the service layer; re-exported for existing importers
// (see docs/LAYER_SPLIT.md).
export {
  sendNotification,
  listNotifications,
  getNotification,
  markNotificationRead,
  markAllNotificationsRead,
  archiveNotification,
  deleteNotification,
  getUnreadCount,
  getNotificationTemplates,
  renderTemplate,
  getNotificationPreferences,
  updateNotificationPreferences,
  sendTemplatedNotification,
} from "@/services/ventures/notifications";

// ── ENHANCEMENT 5.3: Audit logs & security ─────────────────────────────────
// Extracted to the service layer; re-exported for existing importers
// (see docs/LAYER_SPLIT.md). `logAuditEvent` is also called by the domains
// still in this file, so it is imported as a local binding before re-export.
import {
  logAuditEvent,
  queryAuditLogs,
  getAuditLog,
  getAuditLogStats,
  querySecurityEvents,
  resolveSecurityEvent,
  getSecurityStats,
  getActiveSessions,
  revokeSession,
  revokeUserSessions,
  queryLoginHistory,
  getLoginStats,
} from "@/services/ventures/auditSecurity";

export {
  logAuditEvent,
  queryAuditLogs,
  getAuditLog,
  getAuditLogStats,
  querySecurityEvents,
  resolveSecurityEvent,
  getSecurityStats,
  getActiveSessions,
  revokeSession,
  revokeUserSessions,
  queryLoginHistory,
  getLoginStats,
};

// ── ENHANCEMENT 5.4: External integrations & public APIs ────────────────────
// Extracted to the service layer; re-exported for existing importers
// (see docs/LAYER_SPLIT.md).
export {
  getIntegrationProviders,
  getIntegrations,
  createIntegration,
  updateIntegration,
  deleteIntegration,
  createApiKey,
  getApiKeys,
  revokeApiKey,
  rotateApiKey,
  createWebhook,
  getWebhooks,
  deleteWebhook,
  getWebhookDeliveryLogs,
} from "@/services/ventures/integrations";

// ── ENHANCEMENT 5.5: System monitoring, health & reporting ──────────────────
// Extracted to the service layer; re-exported for existing importers
// (see docs/LAYER_SPLIT.md).
export {
  runHealthChecks,
  getLatestHealthChecks,
  getHealthCheckHistory,
  getOverallHealth,
  getMetrics,
  getRecentMetrics,
  getSystemStatus,
  getAlertStats,
  getJobs,
  getJobStats,
  retryJob,
  getQueueStats,
  getLatestQueueStats,
  getStorageInfo,
  getDatabaseInfo,
  getCacheInfo,
  getApiMonitorInfo,
  generateSystemReport,
  getSystemReports,
} from "@/services/ventures/monitoring";

