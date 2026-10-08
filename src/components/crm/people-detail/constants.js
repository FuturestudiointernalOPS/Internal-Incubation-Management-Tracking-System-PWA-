/**
 * CRM person-detail constants — the label maps and status styles the detail
 * tabs read. Kept in one module so the page and its tab components share the
 * exact same vocabulary.
 */

export const TIMELINE_LIMIT = 200;

export const MODULE_COLORS = {
  forms: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  programs: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  ventures: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  investors: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  communications: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  crm: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  system: "bg-slate-500/10 text-slate-400 border-slate-500/20",
};

export const ROLE_LABELS = {
  participant: "crm.roles.participant",
  staff: "crm.roles.staff",
  investor: "crm.roles.investor",
  finance: "crm.roles.finance",
  unassigned: "crm.roles.unassigned",
  team: "crm.roles.team",
  founder: "crm.roles.founder",
  pm: "crm.roles.pm",
};

export const PROGRAM_ROLE_LABELS = {
  participant: "crm.roles.participant",
  facilitator: "crm.roles.facilitator",
  program_manager: "crm.roles.pm",
  assistant: "crm.roles.assistant",
  staff: "crm.roles.staff",
};

export const INVITATION_STATUS_LABELS = {
  not_invited: "crm.contacts.invitationNotInvited",
  sent: "crm.contacts.invitationSent",
  activated: "crm.contacts.invitationActivated",
  expired: "crm.contacts.invitationExpired",
};

export const MODULE_LABELS = {
  forms: "crm.modules.forms",
  programs: "crm.modules.programs",
  ventures: "crm.modules.ventures",
  investors: "crm.modules.investors",
  communications: "crm.modules.communications",
  system: "crm.modules.system",
};

// Every email type the SHARED delivery log can hold, so a person's history is
// labelled in the reader's language. An unknown type falls back to a humanized
// code rather than a raw key.
export const EMAIL_TYPE_KEYS = [
  "activation", "access", "welcome", "password_reset", "approval_setup",
  "team_credentials", "campaign", "investor_registration", "investor_decision",
  "venture_approval", "venture_invitation", "venture_member_invitation",
  "venture_notification", "notification",
  "acknowledgement", "approval", "rejection", "manual", "result",
];

// Delivery statuses — the same vocabulary and colours the run email log uses.
export const EMAIL_STATUS_STYLES = {
  sent: "bg-emerald-500/10 text-emerald-500",
  delivered: "bg-emerald-400/10 text-emerald-400",
  opened: "bg-sky-500/10 text-sky-500",
  clicked: "bg-indigo-500/10 text-indigo-500",
  delayed: "bg-amber-500/10 text-amber-500",
  complained: "bg-rose-500/10 text-rose-500",
  failed: "bg-rose-500/10 text-rose-500",
  bounced: "bg-amber-500/10 text-amber-500",
  cancelled: "bg-slate-500/10 text-slate-400",
  skipped: "bg-slate-500/10 text-slate-400",
  pending: "bg-amber-500/10 text-amber-400",
};

export const EMAIL_STATUS_LABEL_KEYS = {
  sent: "platformMisc.runs.emailSent",
  delivered: "platformMisc.runs.emailDelivered",
  opened: "platformMisc.runs.emailOpened",
  clicked: "platformMisc.runs.emailClicked",
  delayed: "platformMisc.runs.emailDelayed",
  complained: "platformMisc.runs.emailComplained",
  failed: "platformMisc.runs.emailFailed",
  bounced: "platformMisc.runs.emailBounced",
  cancelled: "platformMisc.runs.emailCancelled",
  skipped: "platformMisc.runs.emailSkipped",
  pending: "platformMisc.runs.emailPending",
};

export const pickContact = (payload) =>
  payload?.contacts?.length > 0 ? payload.contacts[0] : null;
export const pickTimeline = (payload) => (payload?.success ? payload.events || [] : []);
export const pickRoles = (payload) => (payload?.success ? payload.roles || [] : []);
export const pickProgramHistory = (payload) => (payload?.success ? payload.history || [] : []);
export const pickLearning = (payload) => (payload?.success ? payload.learning || null : null);
export const pickEmails = (payload) => (payload?.success ? payload.emails || [] : []);
