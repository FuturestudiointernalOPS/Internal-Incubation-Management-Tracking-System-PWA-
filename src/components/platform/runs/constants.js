import {
  Mail, Users, Key, FileText, Link2, XCircle, CheckCircle2,
} from "lucide-react";

export const STATUS_CONFIG = {
  draft: { color: "text-slate-500", bg: "bg-slate-500/10", label: "platformMisc.runs.statusDraft" },
  scheduled: { color: "text-blue-500", bg: "bg-blue-500/10", label: "platformMisc.runs.statusScheduled" },
  active: { color: "text-emerald-500", bg: "bg-emerald-500/10", label: "platformMisc.runs.statusActive" },
  closed: { color: "text-amber-500", bg: "bg-amber-500/10", label: "platformMisc.runs.statusClosed" },
  archived: { color: "text-rose-500", bg: "bg-rose-500/10", label: "platformMisc.runs.statusArchived" },
  cancelled: { color: "text-rose-500", bg: "bg-rose-500/10", label: "platformMisc.runs.statusCancelled" },
};

export const SUB_STATUS = {
  draft: { color: "text-slate-500", bg: "bg-slate-500/10", label: "platformMisc.runs.statusDraft" },
  submitted: { color: "text-blue-500", bg: "bg-blue-500/10", label: "platformMisc.runs.statusSubmitted" },
  approved: { color: "text-emerald-500", bg: "bg-emerald-500/10", label: "platformMisc.runs.statusApproved" },
  rejected: { color: "text-rose-500", bg: "bg-rose-500/10", label: "platformMisc.runs.statusRejected" },
  revision_requested: { color: "text-amber-500", bg: "bg-amber-500/10", label: "platformMisc.runs.statusRevision" },
};

// Email lifecycle statuses (Resend events) — success states are delivered/
// opened/clicked; failed/bounced/cancelled remain manually retryable.
export const EMAIL_STATUS_CONFIG = {
  sent: { color: "text-emerald-500", bg: "bg-emerald-500/10", label: "platformMisc.runs.emailSent" },
  delivered: { color: "text-emerald-400", bg: "bg-emerald-500/10", label: "platformMisc.runs.emailDelivered" },
  opened: { color: "text-sky-500", bg: "bg-sky-500/10", label: "platformMisc.runs.emailOpened" },
  clicked: { color: "text-indigo-500", bg: "bg-indigo-500/10", label: "platformMisc.runs.emailClicked" },
  delayed: { color: "text-amber-500", bg: "bg-amber-500/10", label: "platformMisc.runs.emailDelayed" },
  complained: { color: "text-rose-500", bg: "bg-rose-500/10", label: "platformMisc.runs.emailComplained" },
  failed: { color: "text-rose-500", bg: "bg-rose-500/10", label: "platformMisc.runs.emailFailed" },
  bounced: { color: "text-amber-500", bg: "bg-amber-500/10", label: "platformMisc.runs.emailBounced" },
  cancelled: { color: "text-slate-400", bg: "bg-slate-500/10", label: "platformMisc.runs.emailCancelled" },
  skipped: { color: "text-slate-500", bg: "bg-slate-500/10", label: "platformMisc.runs.emailSkipped" },
  pending: { color: "text-amber-500", bg: "bg-amber-500/10", label: "platformMisc.runs.emailPending" },
};

export const EMAIL_STATUS_ORDER = ["sent", "delivered", "opened", "clicked", "delayed", "complained", "failed", "bounced", "cancelled", "skipped", "pending"];

export const EMAIL_PAGE_SIZE = 25;

// Only these statuses are selectable for manual retry.
export const RETRYABLE_EMAIL_STATUSES = ["failed", "bounced", "cancelled", "pending"];

// Filter option lists for the Run Overview tracking columns.
export const EMAIL_FILTER_OPTIONS = ["sent", "delivered", "opened", "clicked", "delayed", "bounced", "failed", "cancelled", "skipped", "pending", "not_sent"];
export const REVIEW_FILTER_OPTIONS = ["approved", "rejected", "revision_requested"];
export const STATUS_FILTER_OPTIONS = ["submitted", "approved", "rejected", "revision_requested", "draft"];
export const ACCOUNT_STATUS_OPTIONS = ["active", "inactive", "activation_pending", "pending_approval", "archived", "deleted", "not_created"];
export const ACCOUNT_STATUS_STYLES = {
  not_created: { cls: "bg-slate-500/10 text-slate-400", label: "platformMisc.runs.accountNotCreated", title: "platformMisc.runs.accountNotCreatedTitle" },
  pending_approval: { cls: "bg-orange-500/10 text-orange-400", label: "platformMisc.runs.accountPendingApproval", title: "platformMisc.runs.accountPendingApprovalTitle" },
  activation_pending: { cls: "bg-amber-500/10 text-amber-500", label: "platformMisc.runs.accountPendingActivation", title: "platformMisc.runs.accountPendingActivationTitle" },
  active: { cls: "bg-emerald-500/10 text-emerald-500", label: "platformMisc.runs.accountActivated", title: "platformMisc.runs.accountActivatedTitle" },
  inactive: { cls: "bg-rose-500/10 text-rose-400", label: "platformMisc.runs.accountInactive", title: "platformMisc.runs.accountInactiveTitle" },
  archived: { cls: "bg-slate-500/10 text-slate-400", label: "platformMisc.runs.accountArchived", title: "platformMisc.runs.accountArchivedTitle" },
  deleted: { cls: "bg-rose-500/10 text-rose-400", label: "platformMisc.runs.accountDeleted", title: "platformMisc.runs.accountDeletedTitle" },
};

// The payment side of a response, when the Execution sells a course. The badge
// shows the money; its title carries the other two states (access, receipt), so
// one column answers "did this person pay, and did they get in?".
export const PAYMENT_STATUS_STYLES = {
  pending: { cls: "bg-amber-500/10 text-amber-500", label: "platformMisc.runs.paymentPending" },
  paid: { cls: "bg-emerald-500/10 text-emerald-500", label: "platformMisc.runs.paymentPaid" },
  failed: { cls: "bg-rose-500/10 text-rose-400", label: "platformMisc.runs.paymentFailed" },
  cancelled: { cls: "bg-slate-500/10 text-slate-400", label: "platformMisc.runs.paymentCancelled" },
  refunded: { cls: "bg-slate-500/10 text-slate-400", label: "platformMisc.runs.paymentRefunded" },
};
export const PAYMENT_ACCESS_LABELS = {
  pending: "platformMisc.runs.paymentAccessPending",
  granted: "platformMisc.runs.paymentAccessGranted",
  failed: "platformMisc.runs.paymentAccessFailed",
};
export const PAYMENT_EMAIL_LABELS = {
  pending: "platformMisc.runs.paymentEmailPending",
  sent: "platformMisc.runs.paymentEmailSent",
  failed: "platformMisc.runs.paymentEmailFailed",
};

export const TARGET_LABELS = {
  user: "platformMisc.runs.targetUser", group: "platformMisc.runs.targetGroup", program: "platformMisc.runs.targetProgram", cohort: "platformMisc.runs.targetCohort",
  team: "platformMisc.runs.targetTeam", organization: "platformMisc.runs.targetOrganization", all: "platformMisc.runs.targetAll",
};

// Automation switches a run can set for itself. Every flag resolves run → form →
// on, so an explicit run value overrides the form for that flag only.
export const RUN_AUTOMATION_FLAGS = [
  { section: "on_submit", flag: "send_acknowledgement", icon: Mail, label: "platformMisc.runs.automationSubmissionAck" },
  { section: "on_approve", flag: "send_approval_email", icon: CheckCircle2, label: "platformMisc.runs.automationApprovalEmail" },
  { section: "on_approve", flag: "create_platform_user", icon: Users, label: "platformMisc.runs.automationCreateUser" },
  { section: "on_approve", flag: "send_activation_email", icon: Key, label: "platformMisc.runs.automationActivationEmail" },
  { section: "on_approve", flag: "enroll_in_program", icon: FileText, label: "platformMisc.runs.automationEnrollProgram" },
  { section: "on_approve", flag: "assign_to_group", icon: Link2, label: "platformMisc.runs.automationAssignGroup" },
  { section: "on_reject", flag: "send_rejection_email", icon: XCircle, label: "platformMisc.runs.automationRejectionEmail" },
];

/**
 * The accepted formats for the picker. Kept here rather than imported from the
 * server rule because that module also owns the storage client, which has no
 * business in a browser bundle; `runReportFiles.js` enforces the same list.
 */
export const REPORT_FILE_ACCEPT = ".pdf,.docx,.txt,.md,.markdown";

// Tracking filters (Approval Email / Review / Status / Activation Email /
// Account Status) — same pattern as field filters, but backed by fixed
// option lists and the tracking filter state.
export const TRACKING_FILTERS = [
  { key: "approval_email", label: "Approval Email" },
  { key: "review", label: "Review" },
  { key: "status", label: "Status" },
  { key: "activation_email", label: "Activation Email" },
  { key: "account_status", label: "Account Status" },
];
