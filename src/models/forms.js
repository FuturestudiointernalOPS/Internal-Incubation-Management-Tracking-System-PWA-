/**
 * Forms & submissions model — data access for the platform form/collection,
 * submission/response and knowledge-bank controllers.
 *
 * Each function wraps exactly one SQL statement. SQL is byte-identical to the
 * queries that used to live inline in the controller, so behavior is unchanged.
 *
 * Route → function groups in this file:
 *  - src/app/api/platform/forms/route.js          → getPlatformFormByTextId … archivePlatformForm
 *  - src/app/api/platform/collections/route.js    → getPlatformCollectionById … createPlatformCollectionAuditLog
 *  - src/app/api/platform/notifications/route.js  → listPlatformNotifications … markPlatformNotificationRead
 *  - src/app/api/submissions/route.js             → getSubmissionProgramStatus … updateSubmissionsScoreForParticipant
 *  - src/app/api/responses/route.js               → getCampaignResponseStats … listFlaggedFormResponses
 *  - src/app/api/responses/review/route.js        → resolveFormResponseMatch … updateCampaignContactMatchStatus
 *  - src/app/api/respond/route.js                 → getLegacyFormGroupName … updateCampaignContactResponseStatus
 *  - src/app/api/knowledge/route.js               → createKnowledgeNote … deleteKnowledgeNote
 *
 * Model-layer rules (see docs/MVC_REFACTOR.md):
 *  - No HTTP / Next.js imports here — only the db engine.
 *  - One function per query, named after the data it returns.
 */

export * from "./forms/platform";
export * from "./forms/submissions";
export * from "./forms/respondAndKnowledge";
