/**
 * IMPACTOS EMAIL SERVICE
 *
 * The public surface of the email service. Every name below is implemented in
 * src/lib/email/ — one module per concern: configuration, the two transports,
 * the provider chooser, the template engine, recipient resolution, delivery and
 * log, then the senders.
 *
 * This facade exists so the ~27 modules that import `@/lib/email` keep importing
 * it: only this file's surface is a promise, the arrangement behind it is not.
 */

export {
  FUTURE_STUDIO_FOOTER,
  applyTemplate,
  getTemplate,
  getDefaultTemplate,
  getDesignedTemplate,
  resolveResultDelayMinutes,
} from "./email/templates";

export {
  isPlaceholderEmail,
  resolveSubmissionEmail,
  resolveRecipientEmail,
  isGenericName,
  resolvePersonName,
  resolveProjectName,
  detectLanguage,
  decideEmailKind,
} from "./email/addresses";

export {
  sendEmail,
} from "./email/send";

export {
  sendStandaloneEmail,
  sendTrackedEmail,
  sendManualMessage,
} from "./email/delivery";

export {
  sendInviteEmail,
  sendLoginEmail,
  sendWelcomeEmail,
  sendPasswordResetEmail,
} from "./email/senders/accounts";

export {
  sendVentureMemberInvitationEmail,
  sendVentureFounderInvitationEmail,
} from "./email/senders/ventures";

export {
  sendDecisionEmail,
  sendConfirmationEmail,
} from "./email/senders/workflow";

export {
  sendResultEmail,
} from "./email/senders/results";

/**
 * The delivery log and its schema self-heal live in the service layer
 * (`@/services/email/log`). The senders call them directly; they stay
 * re-exported here so the importers that reach them through `@/lib/email`
 * (see docs/LAYER_SPLIT.md) keep working.
 */
export {
  ensureEmailLogTable,
  getEmailLogRow,
  hasSentEmailToRecipientInRun,
  getActivationHistory,
  ensurePasswordSetupTokensSchema,
  recordEmailStatus,
  recordEmailFailure,
  markEmailBounced,
  recordResendEvent,
  getEmailStatsForForm,
} from "@/services/email/log";
