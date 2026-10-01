/**
 * VENTURE OS — Shared Business Logic
 * Enhancement 1.1 — Workflow B: Direct Startup Registration
 * Enhancement 1.1 — Workflow A: Program-to-Venture Promotion
 *
 * This module is now a BARREL: every domain was extracted to the service layer
 * (`src/services/ventures/*`) over the repository layer
 * (`src/models/venture*Store.js`) and is re-exported here so existing importers
 * keep working. See docs/LAYER_SPLIT.md. New code imports from the services.
 */

// ── Venture schema bootstrap ────────────────────────────────────────────────
// Extracted to the service layer; re-exported for existing importers
// (see docs/LAYER_SPLIT.md).
export { ensureVentureSchema } from "@/services/ventures/schema";

// ── Intake: ids, validation and creation ────────────────────────────────────
// Extracted to the service layer; re-exported for existing importers
// (see docs/LAYER_SPLIT.md).
export {
  generateVentureId,
  resolveTeamMembersForPromotion,
  validateCompanyInfo,
  checkDuplicates,
  createVenture,
  createFounder,
} from "@/services/ventures/intake";

// ── Activity log, history and notifications ─────────────────────────────────
// Extracted to the service layer; kept reachable through this module's public
// surface for existing importers (see docs/LAYER_SPLIT.md).
export {
  logVentureActivity,
  addVentureHistory,
  createVentureNotification,
  notifyVentureFounders,
} from "@/services/ventures/activity";

// ── Core record: read, update and lead change ───────────────────────────────
// Extracted to the service layer; re-exported for existing importers
// (see docs/LAYER_SPLIT.md).
export {
  getVentureById,
  updateVenture,
  changeVentureLead,
} from "@/services/ventures/record";

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

