
/**
 * Admin/ops model — data access for the admin + ops controllers listed below.
 *
 * Each function wraps exactly one SQL statement. SQL is byte-identical to the
 * queries that used to live inline in the controllers, so behavior is unchanged.
 *
 * Model-layer rules (see docs/MVC_REFACTOR.md):
 *  - No HTTP / Next.js imports here — only the db engine.
 *  - One function per query, named after the data it returns.
 *
 * Route → function-group map:
 *   src/app/api/admin/analytics/route.js          getTaskStatusStats(), getBlockerStatusStats(),
 *                                                 getSubmittedReportCountsByWeek(), getV2ProjectCount(),
 *                                                 getDistinctTaskUserCount(), getAvgBlockerResolutionSeconds(),
 *                                                 getWeeklyProductivityStats()
 *   src/app/api/admin/analytics/users/route.js    getTaskProjectUserOptions(), getTaskAggregatesForUsers(),
 *                                                 getBlockerAggregatesForUsers(), getUserProjectCounts(),
 *                                                 getUserIndependentTaskCounts(), getUserReportCompliance()
 *   src/app/api/admin/fix-participant/route.js    getLatestProgram(), getContactByCid(),
 *                                                 addParticipantProgramMembership(), clearContactProgramId(),
 *                                                 findExistingParticipantSync(), insertV2Participant()
 *   src/app/api/admin/bulk-upload/route.js        getAllActiveContactPhones(), findActiveContactByEmail(),
 *                                                 updateContactByEmail(), insertContact(),
 *                                                 deleteContactByCid(), insertBulkImportNotification()
 *   src/app/api/admin/approve-user/route.js       getUserForApproval(), approveContact(),
 *                                                 insertPasswordSetupToken(), insertApprovalAuditLog(),
 *                                                 markApprovalUserNotificationsRead()
 *   src/app/api/admin/reject-user/route.js        getUserForRejection(), rejectContact(),
 *                                                 insertRejectionAuditLog(), markRejectionUserNotificationsRead()
 *   src/app/api/admin/pending-users/route.js      listPendingUsers()
 *   src/app/api/admin/run-migration/route.js      executeMigrationStatement()
 *   src/app/api/op-reports/route.js               listOpReports(), getOpReportId(), updateOpReport(),
 *                                                 insertOpReport()
 *   src/app/api/errors/route.js                   findRecentErrorByFingerprint(),
 *                                                 findRecentErrorByMessageAndPage(), incrementErrorOccurrence(),
 *                                                 insertErrorLog(), listErrorLogs(), updateErrorResolution(),
 *                                                 updateErrorResolutionNotes(), updateErrorTaskId()
 *   src/app/api/audit-log/route.js                listAuditLogs()
 *
 * Note: extraction is strictly 1:1 with the original inline call sites, so a
 * handful of lookups (e.g. the pending-contact lookup shared by approve/reject)
 * intentionally repeat the same SQL across functions.
 */


export * from "./adminOps/userManagement";
export * from "./adminOps/reportsAndErrors";
