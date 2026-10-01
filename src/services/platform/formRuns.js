/**
 * Platform — form runs (SERVICE layer).
 *
 * The domain work behind `/api/platform/form-runs`. This first slice takes the
 * READ assembly of one Run's detail (the run screen): the auto-close-on-open
 * rule, the one-wave bundle of assignments/submissions/reviews/evaluations/email
 * logs/form fields/report file, the respondent enrichment (real email and name,
 * account status, activation history from the email log and the token state) and
 * the anonymous presentation rule. The CONTROLLER keeps the capabilities, the
 * request routing and the response envelope.
 *
 * Layer (see docs/LAYER_SPLIT.md): decisions and shaping, no SQL, no HTTP. It
 * reads through `@/models/**` and `@/lib/**`.
 */

import {
  detectLanguage,
  ensureEmailLogTable,
  getActivationHistory,
  getDesignedTemplate,
  getEmailLogRow,
  getTemplate,
  hasSentEmailToRecipientInRun,
  isGenericName,
  isPlaceholderEmail,
  recordEmailStatus,
  resolvePersonName,
  resolveProjectName,
  resolveResultDelayMinutes,
  resolveSubmissionEmail,
  sendDecisionEmail,
  sendManualMessage,
} from "@/lib/email";
import { resolveAutomationFlag } from "@/lib/platform/automationSettings";
import { onAssignmentAdded, onReview, onRunCreated, onRunLaunched, onSubmission, sendAcknowledgementForSubmission } from "@/lib/platform/automation";
import { syncApprovedSubmissionToProgramGroup } from "@/services/contacts/contactGroupSync";
import { maybeAutoApprove } from "@/models/platform/ai/autoApprove";
import { calculateSubmissionScores } from "@/services/platform/scoring";
import {
  addPublicSlugColumnIfMissing,
  countNonDraftSubmissionsByRunId,
  createFormRun,
  createRunAssignmentForRunCreation,
  createSubmissionReview,
  deleteAssignmentById,
  deleteEmailLogsByRunId,
  deleteEvaluationsByRunId,
  deleteEvaluationsBySubmissionId,
  deleteFormRunById,
  deleteReviewsByRunId,
  deleteReviewsBySubmissionId,
  deleteSubmissionById,
  deleteTimelineBySubmissionId,
  findContactByLowerEmailForManualAdd,
  findExistingSubmissionIdForRunAndSubmitter,
  getActivationEmailLogsByRunId,
  getActivationMessageSubmissionsByIdsInRun,
  getAssignedGroupForManualAddById,
  getAssignmentsAfterAssignByRunId,
  getAssignmentsAfterUnassignByRunId,
  getAssignmentsByRunId,
  getCancelledBatchSubmissionIdsInRun,
  getContactsByCids,
  getContactsByLowerEmails,
  getContactNameEmailByCid,
  getContactStatusForActivationById,
  getContactsForAssignmentEnrichment,
  getDecisionEmailSubmissionById,
  getFamiliesForAssignmentEnrichment,
  getFieldLabelsByRunId,
  getFormById,
  getFormFieldsForRunById,
  getFormForActivationRetryById,
  getFormForActivationSendById,
  getFormVersionById,
  getFormForInsertSubmissionAutomationById,
  getFormForManualAddAutomationById,
  getFormForSubmissionAutomationById,
  getFullRunAfterAssignById,
  getFullRunForInsertSubmissionAutomationById,
  getFullRunForSubmissionAutomationById,
  getGroupAssignedToRunById,
  getGroupNameForDecisionEmailByRunId,
  getLatestEmailsByRunId,
  getLatestEvaluationBySubmissionId,
  getLatestEvaluationForOverridesBySubmissionId,
  getLatestEvaluationsByRunId,
  getLatestScoreBySubmissionId,
  getManualMessageFieldLabelsByRunId,
  getManualMessageGroupNameByRunId,
  getManualMessageSubmissionsByIdsInRun,
  getPasswordTokensByContactCids,
  getProgramsForAssignmentEnrichment,
  getRetryEmailValidationsByIdsInRun,
  getReviewerNameByCid,
  getReviewsByRunId,
  getRunDataForActivationRetryById,
  getRunAfterSlugRotationById,
  getRunDataForActivationSendById,
  getRunDataForReviewAutomationById,
  getRunDetailWithGroupTargetById,
  getRunFormContextBySubmissionId,
  getRunFormIdForEvaluationById,
  getRunFormIdForManualEvaluationById,
  getRunForManualAddById,
  getRunIdByAssignmentId,
  getRunPublicSlugById,
  getRunSubmissionGateById,
  getRunTemplateSettingsForDecisionById,
  getSubmissionCurrentStatusById,
  getSubmissionForActivationRetryById,
  getSubmissionReviewStateById,
  getSubmissionReviewsBySubmissionId,
  getSubmissionRunIdById,
  getSubmissionsByRunId,
  insertContactForManualAdd,
  insertManualAddSubmission,
  insertRunAssignmentForAction,
  insertSubmissionForSubmitter,
  insertTimelineEntry,
  launchRunById,
  listApprovedSubmissionsAwaitingResultEmail,
  updateContactNameById,
  updateEvaluationDimensionsById,
  updatePublicSlugForRegeneratedLinkById,
  updatePublicSlugRetryAfterAlterById,
  updateFormRunMetadataById,
  updateRunPublicSlugById,
  updateRunStatusById,
  updateSubmissionContentAndStatusById,
  updateSubmissionStatusById,
} from "@/models/formRuns";
import { getPlatformFormFields, getPlatformFormSections } from "@/models/forms";
import { MAX_OUTPUT_INSTRUCTION } from "@/models/platform/ai/report";
import {
  deleteRunReportFileByRunId,
  getRunReportFileByRunId,
  getRunReportFileTextByRunId,
  runReportFileDescriptor,
} from "@/models/platform/reportFiles";
import { removeRunReportFileObject } from "@/lib/platform/runReportFiles";

/**
 * Resolve display names for run assignments server-side so the UI never has
 * to match against a partial client-side contact list (which previously fell
 * back to raw target IDs / placeholder names for contacts beyond the first
 * 200 loaded into the page).
 *
 * - user    -> contacts by cid OR email (generic placeholder names such as
 *              "Unknown" fall back to the contact email, then null)
 * - group   -> families by registration_id OR id
 * - program -> v2_programs by id
 *
 * Adds target_name / target_email to each assignment row (mutates in place).
 */
export async function enrichAssignments(assignments) {
  const rows = Array.isArray(assignments) ? assignments : assignments?.rows || [];
  if (rows.length === 0) return rows;

  const byType = (targetType) => rows.filter((row) => row.target_type === targetType).map((row) => row.target_id).filter(Boolean);

  const userMap = new Map();
  const groupMap = new Map();
  const programMap = new Map();

  const userIds = byType('user');
  if (userIds.length > 0) {
    try {
      const emails = userIds.map((userId) => String(userId).toLowerCase());
      const contactsResult = await getContactsForAssignmentEnrichment(userIds, emails);
      for (const row of contactsResult.rows) {
        userMap.set(row.cid, row);
        if (row.email) userMap.set(String(row.email).toLowerCase(), row);
      }
    } catch (_) {}
  }

  const groupIds = byType('group');
  if (groupIds.length > 0) {
    try {
      const familiesResult = await getFamiliesForAssignmentEnrichment(groupIds);
      for (const row of familiesResult.rows) {
        if (row.registration_id) groupMap.set(row.registration_id, row);
        groupMap.set(String(row.id), row);
      }
    } catch (_) {}
  }

  const programIds = byType('program');
  if (programIds.length > 0) {
    try {
      const programsResult = await getProgramsForAssignmentEnrichment(programIds);
      for (const row of programsResult.rows) programMap.set(String(row.id), row);
    } catch (_) {}
  }

  for (const assignment of rows) {
    if (assignment.target_type === 'user') {
      const user = userMap.get(assignment.target_id) || userMap.get(String(assignment.target_id).toLowerCase());
      if (user) {
        assignment.target_email = user.email || null;
        assignment.target_name = user.name && !isGenericName(user.name) ? user.name : user.email || null;
      } else {
        assignment.target_name = null;
        assignment.target_email = null;
      }
    } else if (assignment.target_type === 'group') {
      const group = groupMap.get(assignment.target_id) || groupMap.get(String(assignment.target_id).toLowerCase());
      assignment.target_name = group ? group.name || null : null;
    } else if (assignment.target_type === 'program') {
      const program = programMap.get(assignment.target_id) || programMap.get(String(assignment.target_id).toLowerCase());
      assignment.target_name = program ? program.name || null : null;
    }
  }
  return rows;
}

/**
 * Derives the standardized account status for a submission from its matched
 * Contact row. Status-based only: password existence is NOT treated as proof
 * of activation — 'approved' remains approved until the account is 'active'.
 */
function deriveAccountStatus(contactRow) {
  if (!contactRow) return "not_created";
  if (Number(contactRow.deleted) === 1 || contactRow.deleted_at) return "deleted";
  if (contactRow.archived_at) return "archived";
  const st = String(contactRow.status || "").toLowerCase();
  if (st === "inactive") return "inactive";
  if (st === "active") return "active";
  if (st === "approved") return "activation_pending";
  if (st === "pending") return "pending_approval";
  return "pending_approval";
}

/**
 * Assemble one Run's detail (the run screen).
 *
 * @param {string|number} id the run id
 * @returns {Promise<{status: number, body: Object}>} a 404 when the run is unknown
 */
export async function buildRunDetail(id) {
  const run = await getRunDetailWithGroupTargetById(id);
  if (run.rows.length === 0) {
    return { status: 404, body: { success: false, error: "errors.notFound" } };
  }

  // "Auto-Close": a run past its deadline closes ITSELF the moment anyone
  // opens it (instead of merely refusing late answers), which is the status
  // the operator would otherwise have to set by hand.
  const runSettingsForView = run.rows[0].settings || {};
  if (
    runSettingsForView.auto_close === true &&
    run.rows[0].closes_at && new Date(run.rows[0].closes_at) < new Date() &&
    !["closed", "archived", "cancelled"].includes(run.rows[0].status)
  ) {
    try {
      const closed = await updateRunStatusById(id, "closed");
      if (closed.rows[0]) run.rows[0] = { ...run.rows[0], status: closed.rows[0].status };
    } catch (_) {}
  }

  // The Run is the only read the others depend on (for its form_id), so it
  // is wave 1 and everything below rides in wave 2: assignments,
  // submissions, reviews, the AI evaluations, the email logs, the form's
  // fields and the report-file descriptor all need only the Run id. Awaiting
  // them one after another made this screen twelve round trips long.
  const formIdOfRun = run.rows[0].form_id;

  const [
    assignments,
    submissions,
    reviews,
    evaluationsResult,
    emailsResult,
    activationLogsResult,
    formFieldsResult,
    reportFileRow,
  ] = await Promise.all([
    getAssignmentsByRunId(id),
    getSubmissionsByRunId(id),
    getReviewsByRunId(id),
    // Supplementary reads: a hiccup must not stop the run from opening, so
    // each falls back to an empty answer instead of rejecting the wave.
    getLatestEvaluationsByRunId(id).catch(() => ({ rows: [] })),
    getLatestEmailsByRunId(id).catch(() => ({ rows: [] })),
    getActivationEmailLogsByRunId(id).catch(() => ({ rows: [] })),
    getFormFieldsForRunById(formIdOfRun).catch(() => ({ rows: [] })),
    getRunReportFileByRunId(id).catch(() => null),
  ]);

  // AI evaluation rows (latest per submission) so the Responses table can
  // show stored scores/rankings without loading each submission individually.
  const evaluations = evaluationsResult.rows || [];

  // Email delivery log so the Responses table can show activation-email state.
  const emails = emailsResult.rows || [];

  // Full activation email history for the run (ALL rows, not just latest)
  // so first/last sent timestamps can be surfaced per submission.
  const activationLogs = activationLogsResult.rows || [];

  // Assignment display names depend only on the assignments read, not on the
  // contact lookups further down: start them now so their reads overlap
  // instead of waiting for the enrichment to finish.
  const enrichedAssignmentsPromise = enrichAssignments(assignments.rows);

  // ── Run-scoped respondent enrichment: dynamic filter fields ──
  const fieldLabels = {};
  const filterableFields = [];
  try {
    for (const field of formFieldsResult.rows) {
      fieldLabels[String(field.id)] = field.label;
      let parsedOptions = null;
      if (field.options) {
        try {
          parsedOptions = typeof field.options === "string" ? JSON.parse(field.options) : field.options;
        } catch (_) {
          parsedOptions = null;
        }
      }
      const options = Array.isArray(parsedOptions)
        ? parsedOptions
            .map((option) => (typeof option === "string" ? option : option?.label || option?.value || String(option)))
            .filter((option) => option != null && String(option).trim() !== "")
        : [];
      if (options.length > 0) filterableFields.push({ label: field.label, options: options });
    }
  } catch (_) {}

  // Emails: batch contact lookup, falling back to the submission data
  const rawSubmissions = submissions.rows;
  const cids = [...new Set(rawSubmissions.map((submission) => submission.submitter_id).filter(Boolean))];

  // Pre-resolve each applicant's real email so we can look up contacts by
  // BOTH submitter_id AND email — anonymous/imported submissions often
  // have a null/mismatched submitter_id while the contact exists by email.
  const resolvedEmails = rawSubmissions.map((submission) =>
    resolveSubmissionEmail({
      submissionData: submission.data || {},
      fieldLabels,
      contactEmail: "",
    }),
  );
  const emailKeys = [...new Set(resolvedEmails.map((email) => (email ? String(email).toLowerCase() : "")).filter(Boolean))];

  const emailMap = new Map();
  const nameMap = new Map();
  const accountMap = new Map(); // keyed by BOTH cid and lower(email)
  if (cids.length > 0) {
    try {
      const contactsByCidResult = await getContactsByCids(cids);
      for (const row of contactsByCidResult.rows) {
        emailMap.set(row.cid, row.email || "");
        nameMap.set(row.cid, row.name || "");
        accountMap.set(row.cid, row);
        if (row.email) accountMap.set(String(row.email).toLowerCase(), row);
      }
    } catch (_) {}
  }
  if (emailKeys.length > 0) {
    try {
      const contactsByEmailResult = await getContactsByLowerEmails(emailKeys);
      for (const row of contactsByEmailResult.rows) {
        accountMap.set(row.cid, row);
        if (row.email) accountMap.set(String(row.email).toLowerCase(), row);
        if (!emailMap.has(row.cid)) emailMap.set(row.cid, row.email || "");
        if (!nameMap.has(row.cid)) nameMap.set(row.cid, row.name || "");
      }
    } catch (_) {}
  }

  // Password-setup tokens per contact (latest per contact) — for link validity
  const tokenByCid = new Map();
  try {
    const contactCids = [...new Set([...accountMap.values()].map((account) => account.cid).filter(Boolean))];
    if (contactCids.length > 0) {
      const tokensResult = await getPasswordTokensByContactCids(contactCids);
      for (const tokenRow of tokensResult.rows) {
        if (!tokenByCid.has(tokenRow.contact_cid)) tokenByCid.set(tokenRow.contact_cid, tokenRow);
      }
    }
  } catch (_) {}

  const enrichedSubmissions = rawSubmissions.map((submission) => {
    // Real applicant email: the form's actual email answer first, then any
    // real email in the submission, then the CRM email — placeholder
    // import addresses are NEVER shown.
    const email = resolveSubmissionEmail({
      submissionData: submission.data || {},
      fieldLabels,
      contactEmail: emailMap.get(submission.submitter_id) || "",
    });
    const displayName =
      resolvePersonName({
        contactName: nameMap.get(submission.submitter_id) || "",
        submitterName: submission.submitter_name || "",
        submissionData: submission.data || {},
        fieldLabels,
      }) ||
      // Fallbacks must never surface placeholder names when a real one
      // is missing — prefer the submitter id over "Unknown"/"Anonymous".
      (!isGenericName(submission.submitter_name) ? submission.submitter_name : "") ||
      submission.submitter_id;
    // Account activation is independent of email delivery. A non-empty
    // password means the user completed account setup (the activate route
    // sets both password and status = 'active'). Resolve by submitter_id
    // first, then by the real applicant email.
    // IMPORTANT: when the submitter's stored contact only holds an import
    // placeholder email (import-…@placeholder…, .local, …), it is NOT the
    // identity that receives the activation link — the real-email contact
    // is. Preferring the placeholder contact would report the account as
    // never activated even though the person activated the real-email
    // account. So: placeholder submitter contact → prefer the contact
    // matched by the resolved real email; otherwise keep submitter contact.
    const contactByCid = accountMap.get(submission.submitter_id) || null;
    const contactByEmail = email ? accountMap.get(String(email).toLowerCase()) : null;
    const contactRow =
      (contactByCid && !isPlaceholderEmail(contactByCid.email) ? contactByCid : null) ||
      contactByEmail ||
      contactByCid;
    const account_created = !!contactRow;
    const account_activated = account_created && String(contactRow.status || "").toLowerCase() === "active";
    const account_status = deriveAccountStatus(contactRow);

    // Activation history from the REAL email log + token state (first/last
    // sent, link validity) — the source of truth for Send vs Resend.
    const actRows = activationLogs.filter((log) => log.submission_id === submission.id);
    const sentAct = actRows.filter((activationRow) => activationRow.status === "sent");
    const token = contactRow ? tokenByCid.get(contactRow.cid) : null;
    const token_valid = !!(token && Number(token.used) === 0 && new Date(token.expires_at) > new Date());
    return {
      ...submission,
      email,
      display_name: displayName,
      account_created,
      account_activated,
      account_status,
      activation_history: {
        email_status: actRows.length ? actRows[actRows.length - 1].status : null,
        first_sent_at: sentAct.length ? (sentAct[0].sent_at || sentAct[0].created_at) : null,
        last_sent_at: sentAct.length ? (sentAct[sentAct.length - 1].sent_at || sentAct[sentAct.length - 1].created_at) : null,
        email_count: actRows.length,
        token_valid,
        token_expires_at: token?.expires_at || null,
        token_used: token ? token.used : null,
      },
    };
  });

  // "Anonymous Submissions": the reviewer sees the answers and the outcome,
  // never WHO answered. This is a presentation rule over the payload the run
  // screen renders — the senders still resolve the real address from the
  // stored data, so nothing about delivery changes.
  if (runSettingsForView.anonymous === true) {
    for (const submission of enrichedSubmissions) {
      submission.display_name = "Anonymous";
      submission.email = null;
      submission.submitter_name = null;
      submission.submitter_id = null;
    }
  }

  // The document this Run hands to its report writer, if any. Read together
  // with the rest of the wave so the configuration screen can show it — and
  // offer "regenerate" — without a second round trip. Supplementary: a hiccup
  // here must not stop the run from opening.
  let reportFile = null;
  try {
    reportFile = runReportFileDescriptor(reportFileRow);
  } catch (_) {}

  return {
    status: 200,
    body: {
      success: true,
      run: run.rows[0],
      report_file: reportFile,
      assignments: await enrichedAssignmentsPromise,
      submissions: enrichedSubmissions,
      reviews: reviews.rows,
      evaluations,
      emails,
      field_labels: fieldLabels,
      filterable_fields: filterableFields,
    },
  };
}

/** Fire-and-forget timeline entry, used across the review and email flows. */
export function logTimeline(submissionId, action, actorId, actorName, meta = {}) {
  insertTimelineEntry(submissionId, action, actorId, actorName, meta).catch(() => {});
}

/**
 * Send (or re-send) the tracked decision email for a submission using the
 * SAME resolution chain as the approval flow: recipient from submission
 * data, name resolved deterministically with the form's real field labels,
 * run→form→default template, score variable, group gating. Used by both the
 * review workflow and the manual retry action.
 *
 * Returns { status: "sent"|"already_sent"|"skipped"|"failed"|"not_found", error?, to? }.
 */
export async function sendDecisionEmailForSubmission({ submission_id, decision, comment }) {
  const submissionResult = await getDecisionEmailSubmissionById(submission_id);
  if (submissionResult.rows.length === 0) return { status: "not_found", error: "Submission not found" };
  const row = submissionResult.rows[0];

  try {
    const subData = row.data || {};

    // Fetch the form's real field labels + CRM contact once, then resolve
    // BOTH the name and the real applicant email from the same sources so
    // the UI and the sender can never disagree about the recipient.
    let labels = {};
    let crmName = "";
    let crmEmail = "";
    try {
      const fieldLabelsResult = await getFieldLabelsByRunId(row.run_id);
      for (const fieldRow of fieldLabelsResult.rows) labels[String(fieldRow.id)] = fieldRow.label;
      const cNameRes = await getContactNameEmailByCid(row.submitter_id);
      if (cNameRes.rows[0]) {
        crmName = cNameRes.rows[0].name || "";
        crmEmail = cNameRes.rows[0].email || "";
      }
    } catch (_) {}

    // Real applicant email — placeholders (import-…@placeholder…) never used.
    const applicantEmail = resolveSubmissionEmail({
      submissionData: subData,
      fieldLabels: labels,
      contactEmail: crmEmail,
    });
    if (!applicantEmail) return { status: "failed", error: "No real email address found in the submission data" };

    // Duplicate-recipient guard: when the same email address appears in
    // multiple submissions of this run, only ONE decision email is ever sent.
    const alreadyEmailed = await hasSentEmailToRecipientInRun({
      run_id: row.run_id,
      email_type: decision === "approved" ? "approval" : "rejection",
      recipient: applicantEmail,
    });
    if (alreadyEmailed) {
      await recordEmailStatus({
        submission_id: parseInt(submission_id),
        contact_cid: row.submitter_id || null,
        email_type: decision === "approved" ? "approval" : "rejection",
        status: "skipped",
        error: "Skipped — duplicate recipient: an email was already sent to this address for this run",
        to: applicantEmail,
      });
      return { status: "skipped", error: "Duplicate recipient — already emailed in this run", to: applicantEmail };
    }

    // Best real name — resolved deterministically with the form's actual
    // question labels (submission data is keyed by field id).
    const applicantName = resolvePersonName({
      contactName: crmName,
      submitterName: row.submitter_name || "",
      submissionData: subData,
      fieldLabels: labels,
    });

    // ── Should this decision email go out at all? ──
    // The RUN decides; the form is only its default (run → form → on). One read
    // serves both this verdict and the template lookup further down.
    let decisionSettings = null;
    try {
      const settingsResult = await getRunTemplateSettingsForDecisionById(row.run_id);
      decisionSettings = settingsResult.rows[0] || null;
    } catch (_) {}

    let shouldSend = true;
    if (decision === "approved") {
      if (!resolveAutomationFlag(decisionSettings?.settings, decisionSettings?.run_settings, "on_approve.send_approval_email")) {
        await recordEmailStatus({
          submission_id: parseInt(submission_id),
          contact_cid: row.submitter_id || null,
          email_type: "approval",
          status: "skipped",
          error: "Skipped — Approval email switched off for this run",
          to: applicantEmail,
        });
        return { status: "skipped", error: "Approval email switched off for this run", to: applicantEmail };
      }

      // Approval email requires a group (organizational context). With no
      // group, the person stays in the platform/CRM but no email is sent.
      try {
        const grpCheck = await getGroupAssignedToRunById(row.run_id);
        if (grpCheck.rows.length === 0) {
          shouldSend = false;
          await recordEmailStatus({
            submission_id: parseInt(submission_id),
            contact_cid: row.submitter_id || null,
            email_type: "approval",
            status: "skipped",
            error: "Skipped — No group assigned; approval email not sent",
            to: applicantEmail,
          });
          return { status: "skipped", error: "No group assigned; approval email not sent", to: applicantEmail };
        }
      } catch (_) {}
    }
    if (decision !== "approved") {
      if (!resolveAutomationFlag(decisionSettings?.settings, decisionSettings?.run_settings, "on_reject.send_rejection_email")) {
        shouldSend = false;
      }
    }
    if (!shouldSend) return { status: "skipped", error: "Email disabled by workflow settings", to: applicantEmail };

    // Gather template + score for variables
    let decisionTemplate = null;
    let templateVars = null;
    let score = null;
    try {
      const runInfo2 = { rows: decisionSettings ? [decisionSettings] : [] };
      if (runInfo2.rows[0]) {
        const formName = runInfo2.rows[0].name || "";
        decisionTemplate = getTemplate(
          runInfo2.rows[0].settings || {},
          decision === "approved" ? "approval" : "rejection",
          runInfo2.rows[0].run_settings || {}
        );
        templateVars = { form_name: formName };
        try {
          const groupRes = await getGroupNameForDecisionEmailByRunId(row.run_id);
          if (groupRes.rows.length > 0) templateVars.group_name = groupRes.rows[0].group_name;
        } catch (_) {}
      }
      const scoreResult = await getLatestScoreBySubmissionId(submission_id);
      if (scoreResult.rows.length > 0) score = scoreResult.rows[0].overall_score;
    } catch (_) {}

    const { sendTrackedEmail } = await import("@/lib/email");
    const emailType = decision === "approved" ? "approval" : "rejection";
    const tracked = await sendTrackedEmail({
      submission_id: parseInt(submission_id),
      contact_cid: row.submitter_id || null,
      email_type: emailType,
      provider: "gmail",
      to: applicantEmail,
      sendFn: () => sendDecisionEmail({
        to: applicantEmail,
        applicantName,
        formName: templateVars?.form_name || "application",
        decision,
        comment: comment || "",
        template: decisionTemplate,
        templateVars: { ...(templateVars || {}), score: score != null ? String(score) : "" },
      }),
    });
    if (tracked.success) {
      logTimeline(parseInt(submission_id), "email_sent", "system", "System", { to: applicantEmail, decision, retry: true });
      return { status: "sent", to: applicantEmail };
    }
    if (tracked.skipped) return { status: "already_sent", to: applicantEmail };
    logTimeline(parseInt(submission_id), "email_failed", "system", "System", { to: applicantEmail, decision, email_type: emailType, retry: true });
    return { status: "failed", error: tracked.error || "Email send failed", to: applicantEmail };
  } catch (error) {
    console.error("[form-runs] Decision email error:", error);
    return { status: "failed", error: error?.message || "Email error" };
  }
}

/** Render one submission answer value for the result PDF (phone JSON → text). */
function formatResultAnswer(value) {
  if (value === undefined || value === null || value === "") return "";
  if (typeof value === "string") {
    const trimmedValue = value.trim();
    if (trimmedValue.startsWith("{") && trimmedValue.includes('"code"')) {
      try {
        const parsedCode = JSON.parse(trimmedValue);
        if (parsedCode.code && parsedCode.number) return `${parsedCode.code} ${parsedCode.number}`;
      } catch (_) {}
    }
    return trimmedValue;
  }
  if (Array.isArray(value)) return value.map(formatResultAnswer).filter(Boolean).join(", ");
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch (_) {
      return String(value);
    }
  }
  return String(value);
}

/**
 * Does this run send the Founder Fit Score result email?
 *
 * The Founder Fit Score run gets a report-specific message; every other run
 * keeps the neutral copy. The form name is the stable signal — the seeded form
 * is "Founder Fit Score Assessment" — with the run name as a fallback so a run
 * created from a renamed copy still matches.
 */
function isFounderFitResultRun(ctx) {
  return /founder\s*fit/i.test(`${ctx?.form_name || ""} ${ctx?.run_name || ""}`);
}

/**
 * Build the participant-facing RESULT document for a submission — the
 * applicant's answers, the evaluation feedback and the final score. The
 * document never references how the evaluation was produced (the applicant
 * must not learn an automated evaluation ran).
 *
 * Nothing is sent and nothing is recorded: the sender AND the read-only
 * preview shown before sending both call this builder, so what the reviewer
 * sees and what the applicant receives can never disagree.
 *
 * Returns { status: "ok", pdfBytes, lang, applicantName, to, row, score, projectName, template }
 *      or { status: "not_found"|"failed", error }.
 *
 * When the run carries an Output Instruction, the report is composed by AI from
 * the same run data and shaped by that instruction. The composed document is
 * STORED and reused while the state and instruction are unchanged, so this — the
 * single builder both preview and send call — still yields identical bytes for
 * both. Without an instruction nothing changes.
 */
export async function buildResultDocument({ submission_id, forceReport = false }) {
  const submissionResult = await getDecisionEmailSubmissionById(submission_id);
  if (submissionResult.rows.length === 0) return { status: "not_found", error: "Submission not found" };
  const row = submissionResult.rows[0];

  if (String(row.status || "") === "draft") {
    return { status: "failed", error: "Cannot send a result for a draft submission" };
  }

  // The run + form this submission belongs to. This one read is what tells a
  // Founder Fit run from every other one, AND it supplies the field labels, the
  // run settings and the run id the report itself is built from.
  //
  // It used to be wrapped in `catch (_) {}`, so any failure fell through to
  // `ctx = null` and silently sent the NEUTRAL copy with a stripped-down
  // document — nothing in the UI, the timeline or the logs said so.
  //
  // A read failure, or a submission that resolves to no run/form at all, now
  // refuses the send instead of downgrading it: a quietly wrong participant
  // email is worse than a visible, retryable error. A submission always has a
  // run and a form (both foreign keys are NOT NULL), so either outcome here
  // means something is genuinely broken.
  let ctx = null;
  try {
    const ctxResult = await getRunFormContextBySubmissionId(submission_id);
    ctx = ctxResult.rows[0] || null;
  } catch (error) {
    console.error(`[form-runs] Run/form context read failed for submission ${submission_id}:`, error);
    return {
      status: "failed",
      error: "Could not read the run and form this submission belongs to — no result sent. Retry; if it keeps failing, the submission's run or its form is missing.",
    };
  }
  if (!ctx) {
    console.error(`[form-runs] Submission ${submission_id} resolves to no run/form context — run or form missing`);
    return {
      status: "failed",
      error: "This submission's run or form could not be found — no result sent.",
    };
  }

  // A result document requires an evaluation (dimensions + overall score).
  const evaluationResult = await getLatestEvaluationBySubmissionId(submission_id);
  if (evaluationResult.rows.length === 0) {
    return { status: "failed", error: "This submission has not been evaluated yet — run the evaluation first" };
  }
  const evalRow = evaluationResult.rows[0];
  let rawDims = Array.isArray(evalRow.dimensions) ? evalRow.dimensions : [];
  if (!rawDims.length && typeof evalRow.dimensions === "string") {
    try {
      rawDims = JSON.parse(evalRow.dimensions) || [];
    } catch (_) {}
  }
  if (evalRow.overall_score == null && rawDims.length === 0) {
    return { status: "failed", error: "This submission has no evaluation results yet" };
  }

  try {
    const subData = row.data || {};

    // Fetch the form's real field labels + CRM contact once, then resolve
    // BOTH the name and the real applicant email from the same sources so
    // the UI and the sender can never disagree about the recipient.
    let labels = {};
    let crmName = "";
    let crmEmail = "";
    try {
      const fieldLabelsResult = await getFieldLabelsByRunId(row.run_id);
      for (const fieldRow of fieldLabelsResult.rows) labels[String(fieldRow.id)] = fieldRow.label;
      const cNameRes = await getContactNameEmailByCid(row.submitter_id);
      if (cNameRes.rows[0]) {
        crmName = cNameRes.rows[0].name || "";
        crmEmail = cNameRes.rows[0].email || "";
      }
    } catch (_) {}

    // Real applicant email — placeholders (import-…@placeholder…) never used.
    const applicantEmail = resolveSubmissionEmail({
      submissionData: subData,
      fieldLabels: labels,
      contactEmail: crmEmail,
    });
    if (!applicantEmail) return { status: "failed", error: "No real email address found in the submission data" };

    // Best real name — resolved deterministically with the form's actual
    // question labels (submission data is keyed by field id).
    const applicantName = resolvePersonName({
      contactName: crmName,
      submitterName: row.submitter_name || "",
      submissionData: subData,
      fieldLabels: labels,
    });

    // Venture / project name when the form asked for one ("Startup Name") — the
    // result email names the project in its closing recommendation.
    const projectName = resolveProjectName({ submissionData: subData, fieldLabels: labels });

    // Workflow language from the form's question labels (FR forms get a
    // French document + email, EN forms an English one).
    const lang = detectLanguage(labels);

    // ── Answers: rebuild the form Q&A in section order ──
    let sectionsRows = [];
    let fieldRows = [];
    if (ctx?.form_id) {
      try {
        const sectionsResult = await getPlatformFormSections(ctx.form_id);
        sectionsRows = sectionsResult.rows || [];
        const fieldsResult = await getPlatformFormFields(ctx.form_id);
        fieldRows = fieldsResult.rows || [];
      } catch (_) {}
    }
    const isHidden = (field) => String(field.field_type || "") === "hidden";
    const getVal = (field) => subData[field.label] ?? subData[String(field.id)] ?? subData[field.id];

    const sections = [];
    const matchedKeys = new Set();
    for (const section of sectionsRows) {
      const items = [];
      for (const field of fieldRows) {
        if (String(field.section_id) !== String(section.id)) continue;
        if (isHidden(field)) continue;
        const value = formatResultAnswer(getVal(field));
        if (value === "") continue;
        matchedKeys.add(String(field.id));
        if (field.label) matchedKeys.add(field.label);
        items.push({ label: field.label || String(field.id), value });
      }
      if (items.length > 0) sections.push({ title: section.title, items });
    }

    // Fields without any section (older forms) → one flat group.
    const looseItems = [];
    for (const field of fieldRows) {
      if (sectionsRows.some((section) => String(section.id) === String(field.section_id))) continue;
      if (isHidden(field)) continue;
      const value = formatResultAnswer(getVal(field));
      if (value === "") continue;
      matchedKeys.add(String(field.id));
      if (field.label) matchedKeys.add(field.label);
      looseItems.push({ label: field.label || String(field.id), value });
    }
    if (looseItems.length > 0) sections.push({ title: null, items: looseItems });

    // Unmatched data keys (imported submissions may store answers under keys
    // that no longer map to a form field) — still part of the response.
    const unmatchedItems = Object.entries(subData)
      .filter(([key]) => !String(key).startsWith("_"))
      .filter(([key, value]) => !matchedKeys.has(String(key)) && formatResultAnswer(value) !== "")
      .map(([key, value]) => ({ label: key, value: formatResultAnswer(value) }));
    if (unmatchedItems.length > 0) sections.push({ title: null, items: unmatchedItems });

    // ── Evaluation: final dimension scores + feedback for the PDF ──
    // Weighted recompute mirrors the review page: human overrides (final_score)
    // are the source of truth when present.
    const totalWeight = rawDims.reduce((sum, dimension) => sum + (dimension.weight ?? 1), 0);
    const weighted = rawDims.reduce((sum, dimension) => sum + ((dimension.final_score ?? dimension.score ?? 0) * (dimension.weight ?? 1)), 0);
    const finalScore = rawDims.length > 0 && totalWeight > 0
      ? Math.round((weighted / totalWeight) * 10)
      : evalRow.overall_score;
    const dimensions = rawDims
      .map((dimension) => {
        const humanComment = typeof dimension.human_comment === "string" ? dimension.human_comment.trim() : "";
        const reasoning = typeof dimension.reasoning === "string" ? dimension.reasoning.trim() : "";
        return {
          name: dimension.name,
          score: dimension.final_score ?? dimension.score ?? null,
          feedback: humanComment || reasoning,
          strengths: Array.isArray(dimension.strengths) ? dimension.strengths.map((strength) => String(strength)) : [],
          improvements: Array.isArray(dimension.weaknesses) ? dimension.weaknesses.map((weakness) => String(weakness)) : [],
        };
      })
      .filter((dimension) => dimension.name);

    // ── Outcome: only when a real decision exists (approved/rejected/revision) ──
    let outcome = null;
    if (["approved", "rejected", "revision_requested"].includes(row.status)) {
      let comment = "";
      try {
        const reviewsResult = await getSubmissionReviewsBySubmissionId(submission_id);
        const latest = reviewsResult.rows[0];
        if (latest && typeof latest.comment === "string") comment = latest.comment;
      } catch (_) {}
      outcome = { decision: row.status, comment };
    }

    // ── The brief for the composed report ──
    // Two sources, either of which is enough on its own:
    //   • the run-specific Output Instruction, and/or
    //   • the document attached to this Run, already read into text at upload
    //     time (it may state every requirement the report needs).
    // Present → the report is written by AI from this same data, shaped by what
    // the administrator supplied, and stored so preview and send render the same
    // document. Neither → the fixed renderer, exactly as before.
    const outputInstruction = typeof ctx?.run_settings?.output_instruction === "string"
      ? ctx.run_settings.output_instruction.trim()
      : "";

    // Only a document that yielded TEXT can shape the report. An attachment that
    // could not be read (a scan) is simply not part of the brief — the screen says
    // so on its own; the report is never blocked by it.
    const reportFile = ctx?.run_id ? await getRunReportFileTextByRunId(ctx.run_id) : null;
    const referenceText = reportFile?.status === "ok" ? reportFile.text.trim() : "";

    let composedReport = null;
    if (outputInstruction || referenceText) {
      const { getOrCreateSubmissionReport } = await import("@/models/platform/ai/report");
      const composed = await getOrCreateSubmissionReport({
        submissionId: parseInt(submission_id),
        evaluationId: evalRow.id ?? null,
        decision: row.status || null,
        instruction: outputInstruction,
        reference: referenceText,
        referenceName: referenceText ? reportFile?.fileName || "" : "",
        lang,
        force: forceReport,
        payload: {
          runName: ctx?.run_name || "",
          formName: ctx?.form_name || "",
          applicantName: applicantName || "",
          submittedAt: row.submitted_at || row.updated_at || null,
          finalScore: finalScore != null ? Number(finalScore) : 0,
          ranking: evalRow.ranking || "",
          outcome,
          dimensions,
          sections,
        },
      });
      if (composed?.error || !composed?.report) {
        return {
          status: "failed",
          error: `This run asks for a composed report, but it could not be generated (${composed?.error || "empty result"})`,
        };
      }
      composedReport = composed.report;
      if (composed.generated) {
        logTimeline(parseInt(submission_id), "report_generated", "system", "System", { model: "deepseek-chat" });
      }
    }

    // ── Build the PDF document (nothing is sent from here) ──
    const { buildSubmissionResultPdf, buildComposedReportPdf } = await import("@/models/platform/resultPdf");
    const pdfBytes = composedReport
      ? buildComposedReportPdf({
          lang,
          applicantName: applicantName || "",
          submittedAt: row.submitted_at || row.updated_at || null,
          document: composedReport,
          // The instruction writes the READING; the platform appends the form's
          // questions and the participant's answers after it.
          sections,
        })
      : buildSubmissionResultPdf({
          lang,
          applicantName: applicantName || "",
          submittedAt: row.submitted_at || row.updated_at || null,
          finalScore: finalScore != null ? Number(finalScore) : 0,
          ranking: evalRow.ranking || "",
          outcome,
          dimensions,
          sections,
        });

    return {
      status: "ok",
      pdfBytes,
      lang,
      applicantName: applicantName || "",
      to: applicantEmail,
      row,
      score: finalScore != null ? Math.round(Number(finalScore)) : null,
      projectName,
      template: isFounderFitResultRun(ctx) ? "founder_fit" : "generic",
    };
  } catch (error) {
    console.error("[form-runs] Result document error:", error);
    return { status: "failed", error: error?.message || "Document error" };
  }
}

/**
 * Send the participant-facing RESULT email (PDF attachment) for a submission.
 *
 * Recipient/name resolution follows the SAME chain as the decision email so
 * the UI and the sender can never disagree; the send is tracked exactly once
 * per submission (email_type "result") and respects the per-run
 * duplicate-recipient guard used by the other workflow emails.
 *
 * Returns { status: "sent"|"already_sent"|"skipped"|"failed"|"not_found", error?, to? }.
 */
export async function sendResultEmailForSubmission({ submission_id }) {
  try {
    const resultDocument = await buildResultDocument({ submission_id });
    if (resultDocument.status !== "ok") return { status: resultDocument.status, error: resultDocument.error };
    const { row, to: applicantEmail, applicantName, lang, pdfBytes, score, projectName, template } = resultDocument;

    // Already emailed for THIS submission → polite already_sent (re-click).
    const existingLog = await getEmailLogRow(parseInt(submission_id), "result");
    if (existingLog && existingLog.status === "sent") {
      return { status: "already_sent", to: existingLog.recipient || applicantEmail };
    }

    // Duplicate-recipient guard: when the same email address appears in
    // multiple submissions of this run, only ONE result email is ever sent.
    const alreadyEmailed = await hasSentEmailToRecipientInRun({
      run_id: row.run_id,
      email_type: "result",
      recipient: applicantEmail,
    });
    if (alreadyEmailed) {
      await recordEmailStatus({
        submission_id: parseInt(submission_id),
        contact_cid: row.submitter_id || null,
        email_type: "result",
        status: "skipped",
        error: "Skipped — duplicate recipient: a result email was already sent to this address for this run",
        to: applicantEmail,
      });
      return { status: "skipped", error: "Duplicate recipient — already emailed in this run", to: applicantEmail };
    }

    // The result text DESIGNED for this run (or its form) takes over the built-in
    // wording. Read without the platform default, because the built-in wording
    // depends on the kind of run — see getDesignedTemplate. A read failure simply
    // leaves the built-in copy in place; it never blocks the send.
    let designedTemplate = { subject: "", body: "" };
    try {
      const settingsResult = await getRunTemplateSettingsForDecisionById(row.run_id);
      const settingsRow = settingsResult.rows[0] || null;
      designedTemplate = getDesignedTemplate(settingsRow?.settings || {}, "result", settingsRow?.run_settings || {});
    } catch (error) {
      console.warn("[form-runs] Result template settings unreadable:", error.message);
    }

    const { sendResultEmail, sendTrackedEmail } = await import("@/lib/email");
    const tracked = await sendTrackedEmail({
      submission_id: parseInt(submission_id),
      contact_cid: row.submitter_id || null,
      email_type: "result",
      provider: "gmail",
      to: applicantEmail,
      sendFn: () =>
        sendResultEmail({
          to: applicantEmail,
          applicantName,
          pdfBuffer: pdfBytes,
          lang,
          runId: row.run_id,
          submissionId: parseInt(submission_id),
          score,
          projectName,
          template,
          designed: designedTemplate,
        }),
    });
    if (tracked.success) {
      logTimeline(parseInt(submission_id), "email_sent", "system", "System", { to: applicantEmail, email_type: "result" });
      return { status: "sent", to: applicantEmail };
    }
    if (tracked.skipped) return { status: "already_sent", to: applicantEmail };
    logTimeline(parseInt(submission_id), "email_failed", "system", "System", { to: applicantEmail, email_type: "result" });
    return { status: "failed", error: tracked.error || "Email send failed", to: applicantEmail };
  } catch (error) {
    console.error("[form-runs] Result email error:", error);
    return { status: "failed", error: error?.message || "Email error" };
  }
}

/**
 * Deliver every result email whose scheduled time has passed.
 *
 * The delay is the RUN's own setting (see resolveResultDelayMinutes): the clock
 * starts at the submission, so a result is "due" once `submitted_at + delay`
 * is in the past. Only approved, evaluated submissions are candidates — the
 * report cannot exist before that, and the query already excludes any
 * submission whose result was sent. Sending goes through
 * sendResultEmailForSubmission, so the per-submission sentinel, the
 * duplicate-recipient guard and the delivery log all apply unchanged: running
 * this twice never sends twice.
 *
 * Returns a small report ({ checked, sent, skipped, failed, not_due }) so a
 * scheduler call can be observed rather than guessed at.
 */
export async function dispatchScheduledResultEmails({ run_id = null } = {}) {
  const summary = { checked: 0, sent: 0, skipped: 0, failed: 0, not_due: 0 };
  try {
    // The candidate query reads platform_email_log; create it first so a fresh
    // database answers with "nothing to send" instead of a missing-table error.
    await ensureEmailLogTable();
    const candidatesResult = await listApprovedSubmissionsAwaitingResultEmail();
    const now = Date.now();
    for (const candidate of candidatesResult.rows || []) {
      if (run_id != null && String(candidate.run_id) !== String(run_id)) continue;
      const delayMinutes = resolveResultDelayMinutes(candidate.form_settings || {}, candidate.run_settings || {});
      // No delay = no automatic send: the operator sends the result by hand.
      if (delayMinutes <= 0) continue;
      const submittedAt = candidate.submitted_at ? new Date(candidate.submitted_at).getTime() : NaN;
      if (!Number.isFinite(submittedAt)) continue;
      summary.checked += 1;
      if (submittedAt + delayMinutes * 60 * 1000 > now) {
        summary.not_due += 1;
        continue;
      }
      const outcome = await sendResultEmailForSubmission({ submission_id: candidate.id });
      if (outcome.status === "sent") summary.sent += 1;
      else if (outcome.status === "already_sent" || outcome.status === "skipped") summary.skipped += 1;
      else summary.failed += 1;
    }
  } catch (error) {
    console.error("[form-runs] Scheduled result dispatch error:", error);
    return { ...summary, error: error?.message || "Scheduled dispatch failed" };
  }
  return summary;
}

/**
 * Shared approval/rejection workflow — used by BOTH the single review action
 * and the bulk review action so bulk approval is a controlled extension of
 * the individual flow, never a parallel implementation.
 *
 * Idempotency guard → review row (+ dimension overrides) → status update →
 * tracked decision email (Gmail, run→form→default template, resolved name) →
 * REVIEW_COMPLETED automation (activation/access emails, CRM identity) →
 * program auto-assignment.
 *
 * The controller INJECTS the two pieces that belong to the HTTP boundary:
 * `after` (the `next/server` deferred-task hook) and `scheduleResultSweep`.
 * The service stays HTTP-free (see docs/LAYER_SPLIT.md) and simply asks the
 * caller to run the result sweep once the response has been written.
 *
 * Returns { ok: true, submission, already_approved? } or
 *         { ok: false, statusCode, error }.
 */
export async function processReviewInternal({
  submission_id,
  decision,
  comment,
  internal_note,
  dimension_overrides,
  force,
  session,
  includeResultPdf = false,
  after,
  scheduleResultSweep,
}) {
  // ── IDEMPOTENCY GUARD: never re-approve an already-approved submission ──
  // Manual override requires explicit force: true
  const existingSub = await getSubmissionReviewStateById(submission_id);
  if (existingSub.rows.length === 0) {
    return { ok: false, statusCode: 404, error: "Submission not found" };
  }
  const prevStatus = existingSub.rows[0].status;
  if (prevStatus === "approved" && decision === "approved" && !force) {
    return { ok: true, already_approved: true, submission: existingSub.rows[0] };
  }

  // ── "Also send the AI result PDF" is a promise the submission has to be able
  // to keep: that document IS the evaluation. Refuse the WHOLE action before any
  // side effect — no review row, no status change, no email — and say why, so
  // the reviewer evaluates the submission and approves again. An approval whose
  // requested document cannot follow is never half-sent. ──
  if (includeResultPdf && decision === "approved") {
    const evalGate = await getLatestEvaluationBySubmissionId(submission_id);
    const evalGateRow = evalGate.rows[0] || null;
    let gateDims = evalGateRow?.dimensions;
    if (typeof gateDims === "string") {
      try { gateDims = JSON.parse(gateDims); } catch (_) { gateDims = []; }
    }
    const hasResult = !!evalGateRow && (evalGateRow.overall_score != null || (Array.isArray(gateDims) && gateDims.length > 0));
    if (!hasResult) {
      return {
        ok: false,
        statusCode: 409,
        errorCode: "result_pdf_not_evaluated",
        error: "No AI result yet — this submission has not been evaluated. Run the evaluation first, then approve with the PDF.",
      };
    }
  }

  let reviewerName = session.cid;
  try {
    const reviewerResult = await getReviewerNameByCid(session.cid);
    if (reviewerResult.rows.length) reviewerName = reviewerResult.rows[0].name;
  } catch (_) {}

  // Save review with dimension overrides if provided
  await createSubmissionReview({
    submissionId: submission_id,
    reviewerId: session.cid,
    reviewerName,
    decision,
    comment,
    internalNote: internal_note,
  });

  // Store dimension overrides in separate evaluation update
  if (dimension_overrides && Array.isArray(dimension_overrides) && dimension_overrides.length > 0) {
    try {
      const evaluationResult = await getLatestEvaluationForOverridesBySubmissionId(submission_id);
      if (evaluationResult.rows.length > 0) {
        const existing = evaluationResult.rows[0];
        const dims = existing.dimensions || [];
        const updatedDims = dims.map(dimension => {
          const override = dimension_overrides.find(overrideCandidate => overrideCandidate.name === dimension.name);
          if (override) {
            return { ...dimension, human_score: override.human_score, human_comment: override.human_comment || "", final_score: override.final_score };
          }
          return dimension;
        });
        await updateEvaluationDimensionsById(existing.id, updatedDims);
      }
    } catch (_) {}
  }

  // Update submission status — map workflow decision to core platform state
  const CORE_STATES = ["approved", "rejected", "revision_requested", "submitted", "draft"];
  const newStatus = CORE_STATES.includes(decision) ? decision : "approved";
  const result = await updateSubmissionStatusById(submission_id, newStatus);

  logTimeline(parseInt(submission_id), decision, session.cid, reviewerName, { comment, internal_note });

  // Send decision email to applicant — TRACKED (never sent twice)
  await sendDecisionEmailForSubmission({ submission_id, decision, comment: comment || "" });

  // The reviewer also asked for the AI result document. It goes out as its OWN
  // email — its own type, its own guard in the Emails tab — through the exact
  // path behind "Send Response", so the document is identical whether it is
  // sent from the approval checkbox or by hand. The gate above guarantees an
  // evaluation exists, so this never sends an empty document.
  let resultPdf = null;
  if (includeResultPdf && decision === "approved") {
    try {
      resultPdf = await sendResultEmailForSubmission({ submission_id });
    } catch (error) {
      resultPdf = { status: "failed", error: error?.message || "Result PDF failed" };
    }
  }

  // Fire automation — get run details + form config for context
  const submissionRunResult = await getSubmissionRunIdById(submission_id);
  if (submissionRunResult.rows.length > 0) {
    const runData = await getRunDataForReviewAutomationById(submissionRunResult.rows[0].run_id);
    let formData = null;
    if (runData.rows[0]) {
      const formResult = await getFormById(runData.rows[0].form_id);
      formData = formResult.rows[0] || null;
    }

    // Record a PENDING activation email BEFORE firing the background task.
    // If the serverless function is terminated before `after()` completes,
    // this pending row remains visible in the Emails tab as retryable.
    if (decision === "approved") {
      try {
        await recordEmailStatus({
          submission_id: parseInt(submission_id),
          contact_cid: result.rows[0]?.submitter_id || null,
          email_type: "activation",
          status: "pending",
          error: "Queued — waiting for background automation",
          to: result.rows[0]?.submitter_id || null,
        });
      } catch (_) {}
    }

    after(() => {
      onReview(
        { id: null, submission_id: parseInt(submission_id), decision, comment, reviewer_name: reviewerName },
        result.rows[0],
        runData.rows[0] || null,
        session,
        formData
      ).catch((err) => {
        console.error("[form-runs] Background automation failed:", err.message);
      });
    });

    // Synchronous program/group sync (does NOT rely on background automation).
    if (decision === "approved" && runData.rows[0]) {
      await syncApprovedSubmissionToProgramGroup(result.rows[0]);
    }

    // A result whose scheduled time has already passed goes out as soon as the
    // reviewer decides — no need to reopen the run for it to be picked up.
    // The sweep honours the run's delay and is idempotent, so it is safe to ask
    // on every decision (a delay of 0 asks for nothing).
    if (decision === "approved") {
      scheduleResultSweep(submissionRunResult.rows[0].run_id);
    }
  }

  return { ok: true, submission: result.rows[0], result_pdf: resultPdf };
}

// ── Run lifecycle: status, launch, assignments ───────────────────────────────

/** The only statuses a run may hold. The controller validates against this. */
export const RUN_STATUSES = ["draft", "scheduled", "active", "closed", "cancelled", "archived"];

export function isValidRunStatus(status) {
  return RUN_STATUSES.includes(status);
}

/** Move a run to a new lifecycle status. Returns the updated run row. */
export async function changeRunStatus(id, status) {
  const result = await updateRunStatusById(id, status);
  return result.rows[0];
}

/**
 * Launch (activate) a run. A run created before the share-link feature has no
 * public slug, so make sure one exists first, then activate and fire the
 * launch automation. Returns the updated run row.
 */
export async function launchRun({ id, session }) {
  const existing = await getRunPublicSlugById(id);
  let slug = existing.rows[0]?.public_slug;
  if (!slug) {
    slug = "r" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    await updateRunPublicSlugById(slug, id);
  }

  const result = await launchRunById(id, slug);
  onRunLaunched(result.rows[0], session);
  return result.rows[0];
}

/** The audiences a run may be assigned to. */
export const ASSIGNMENT_TARGET_TYPES = ["user", "group", "program", "cohort", "team", "organization", "all"];

/**
 * Assign a run to one or more audiences. Accepts either the legacy single
 * target (target_type + target_id) or a list of targets, so one action can
 * assign a run to multiple audiences (e.g. Program AND Group) in one request.
 *
 * Returns { ok: false, error } when no valid target survived the filter, or
 * { ok: true, added, skipped, assignments } with the run's assignments enriched
 * for the UI. The controller owns the `runs.edit` capability and the envelope.
 */
export async function assignRunTargets({ run_id, target_type, target_id, targets, session }) {
  const targetList = Array.isArray(targets)
    ? targets
    : [{ target_type: target_type || "user", target_id }];
  const valid = targetList.filter(
    (target) => target && ASSIGNMENT_TARGET_TYPES.includes(target.target_type) && target.target_id,
  );
  if (valid.length === 0) {
    return { ok: false, error: "run_id and target required" };
  }

  const runId = parseInt(run_id);
  let added = 0;
  let skipped = 0;
  const createdTargets = [];
  for (const target of valid) {
    const insertResult = await insertRunAssignmentForAction({
      runId,
      targetType: target.target_type,
      targetId: target.target_id,
      assignedBy: session.cid,
    });
    if (insertResult.rowsAffected > 0) {
      added++;
      createdTargets.push({ target_type: target.target_type, target_id: target.target_id });
    } else {
      skipped++;
    }
  }

  const assignments = await getAssignmentsAfterAssignByRunId(runId);
  // Fire automation for each newly created assignment.
  const fullRun = await getFullRunAfterAssignById(runId);
  for (const target of createdTargets) {
    onAssignmentAdded(target, fullRun.rows[0] || { id: runId });
  }
  return { ok: true, added, skipped, assignments: await enrichAssignments(assignments.rows) };
}

/**
 * Remove one assignment, then return the run's remaining assignments (enriched
 * for the UI). A missing assignment resolves to no run, which returns an empty
 * list rather than failing.
 */
export async function unassignRun({ assignment_id }) {
  const assignmentResult = await getRunIdByAssignmentId(assignment_id);
  const runId = assignmentResult.rows[0]?.run_id;

  await deleteAssignmentById(assignment_id);

  if (!runId) return { assignments: [] };
  const assignments = await getAssignmentsAfterUnassignByRunId(runId);
  return { assignments: await enrichAssignments(assignments.rows) };
}

// ── Submit / manual-add: the respondent write path ──────────────────────────

/**
 * Submit (or re-save) the session user's response to a run.
 *
 * The rules the controller must not re-implement:
 *   - a run must be ACTIVE, and its deadline (with "Auto-Close") gates answers;
 *   - "Multiple Submissions" off means a repeat save UPDATES the person's own
 *     response; on, it adds a new one;
 *   - "Submission Limit" caps new responses (0 = unlimited); an update is exempt;
 *   - an approved/rejected response is frozen;
 *   - a PAID Execution is never scored or auto-approved here (checkout grants
 *     access after payment).
 *
 * Returns { ok:true, submission } or { ok:false, statusCode, error }.
 */
export async function submitResponse({ run_id, data, status: subStatus, session }) {
  // Check run is active and not closed
  const run = await getRunSubmissionGateById(run_id);
  if (run.rows.length === 0) return { ok: false, statusCode: 404, error: "Run not found" };
  if (run.rows[0].status !== "active") return { ok: false, statusCode: 400, error: "Run is not active" };
  const gateSettings = run.rows[0].settings || {};
  // A PAID Execution captures a registration and nothing else until the money
  // is confirmed, so its responses are never scored or auto-approved here —
  // the checkout flow is what grants access, after payment.
  const sellsCourse = Boolean(run.rows[0].lms_course_id);
  if (run.rows[0].closes_at && new Date(run.rows[0].closes_at) < new Date()) {
    // "Auto-Close" makes the run close ITSELF at its deadline instead of only
    // refusing late answers — the status the operator would set by hand.
    if (gateSettings.auto_close) {
      try { await updateRunStatusById(run_id, "closed"); } catch (_) {}
    }
    return { ok: false, statusCode: 400, error: "Submission deadline has passed" };
  }

  // "Multiple Submissions" off (the default) means one response per person:
  // a repeat save UPDATES that person's own response. On, a repeat save adds
  // a NEW response instead — which is what lets the submission limit below
  // ever be reached by one person.
  const allowMultiple = gateSettings.allow_multiple === true;
  const existing = await findExistingSubmissionIdForRunAndSubmitter(run_id, session.cid);
  const submissionToUpdate = !allowMultiple && existing.rows.length > 0 ? existing : { rows: [] };

  const newStatus = subStatus || "submitted";

  // "Submission Limit" caps how many responses the run accepts (0 =
  // unlimited). Only a NEW response consumes a seat, so updating one's own
  // response is exempt.
  if (newStatus !== "draft" && submissionToUpdate.rows.length === 0) {
    const limit = parseInt(gateSettings.submission_limit) || 0;
    if (limit > 0) {
      const countRes = await countNonDraftSubmissionsByRunId(run_id, session.cid);
      const current = parseInt(countRes.rows[0]?.c) || 0;
      if (current >= limit) {
        return { ok: false, statusCode: 400, error: "platformMisc.runs.submissionLimitReached" };
      }
    }
  }

  // Build final data with optional scoring
  let finalData = { ...(data || {}) };
  // Is AI evaluation switched ON for this form? A FORM-level question: it says
  // nothing about whether THIS response already carries an evaluation. The
  // two were confused, so every re-save re-ran the model and appended a row.
  let formAiEnabled = false;
  if (newStatus === "submitted") {
    const scores = await calculateSubmissionScores(run_id, finalData);
    if (scores) finalData._scores = scores;
    try {
      const { formHasAiEvaluation } = await import("@/lib/platform/ai/evaluate");
      const runInfo = await getRunFormIdForEvaluationById(run_id);
      if (runInfo.rows.length > 0) formAiEnabled = await formHasAiEvaluation(runInfo.rows[0].form_id);
    } catch (_) {}
  }

  if (submissionToUpdate.rows.length > 0) {
    const currentStatus = await getSubmissionCurrentStatusById(submissionToUpdate.rows[0].id);
    // Don't allow overwriting approved/rejected submissions
    if (currentStatus.rows[0] && (currentStatus.rows[0].status === "approved" || currentStatus.rows[0].status === "rejected")) {
      return { ok: false, statusCode: 400, error: "Cannot modify an already decided submission" };
    }
    const result = await updateSubmissionContentAndStatusById({
      submissionId: submissionToUpdate.rows[0].id,
      data: finalData,
      status: newStatus,
    });
    logTimeline(submissionToUpdate.rows[0].id, newStatus === "draft" ? "draft_saved" : "submitted", session.cid, null);
    // Fire automation
    if (newStatus !== "draft") {
      const fullRun = await getFullRunForSubmissionAutomationById(run_id);
      const runRow = fullRun.rows[0];
      let formRow = null;
      if (runRow) {
        const formResult = await getFormForSubmissionAutomationById(runRow.form_id);
        formRow = formResult.rows[0] || null;
      }
      onSubmission(result.rows[0], runRow || { id: parseInt(run_id) }, formRow, session);
      // AI evaluation — but ONLY when this response has never been evaluated.
      // Re-evaluating appends a duplicate row AND spends a model call to
      // answer a question that is already answered; the new row carries no
      // human values, so it would also hide whatever a human had entered.
      // If we cannot tell whether it was evaluated, we do NOT evaluate.
      if (formAiEnabled && !sellsCourse) {
        const newSubmissionId = result.rows[0].id;
        try {
          const { submissionHasEvaluation, evaluateSubmission } = await import("@/lib/platform/ai/evaluate");
          const alreadyEvaluated = await submissionHasEvaluation(newSubmissionId).catch(() => true);
          if (!alreadyEvaluated) {
            const evaluation = await evaluateSubmission(newSubmissionId);
            logTimeline(newSubmissionId, "ai_evaluated", "system", "System", {});
            // A score that meets the form's cutoff approves the applicant
            // right away — the same automatic step the evaluation endpoint
            // applies, so nothing depends on an administrator opening the run.
            if (evaluation) await maybeAutoApprove(newSubmissionId, evaluation);
          }
        } catch (error) {
          console.error("[form-runs] AI eval failed for submission", newSubmissionId, ":", error.message);
          logTimeline(newSubmissionId, "ai_eval_failed", "system", "System", { error: error.message });
        }
      }
    }
    return { ok: true, submission: result.rows[0] };
  }

  const result = await insertSubmissionForSubmitter({
    runId: run_id,
    submitterId: session.cid,
    submitterName: null,
    status: newStatus,
    data: finalData,
  });
  logTimeline(result.rows[0].id, newStatus === "draft" ? "started" : "submitted", session.cid, null);
  // Fire automation
  if (newStatus !== "draft") {
    const fullRun = await getFullRunForInsertSubmissionAutomationById(run_id);
    const runRow = fullRun.rows[0];
    let formRow = null;
    if (runRow) {
      const formResult = await getFormForInsertSubmissionAutomationById(runRow.form_id);
      formRow = formResult.rows[0] || null;
    }
    onSubmission(result.rows[0], runRow || { id: parseInt(run_id) }, formRow, session);
    // A brand-new response cannot already have an evaluation, so the
    // form-level switch is the whole question here.
    if (formAiEnabled && !sellsCourse) {
      const newSubmissionId = result.rows[0].id;
      try {
        const { evaluateSubmission } = await import("@/lib/platform/ai/evaluate");
        const evaluation = await evaluateSubmission(newSubmissionId);
        logTimeline(newSubmissionId, "ai_evaluated", "system", "System", {});
        // Same automatic approval step as every other evaluation path.
        if (evaluation) await maybeAutoApprove(newSubmissionId, evaluation);
      } catch (error) {
        console.error("[form-runs] AI eval failed for submission", newSubmissionId, ":", error.message);
        logTimeline(newSubmissionId, "ai_eval_failed", "system", "System", { error: error.message });
      }
    }
  }
  return { ok: true, submission: result.rows[0] };
}

/**
 * Manual add — a super-admin injects a respondent directly into a run.
 *
 * The submission is created as "approved" by default so the person is
 * immediately eligible for an activation/join email. Pass status:'submitted'
 * (or 'draft') explicitly to exercise the full scoring/review flow.
 *
 * The respondent is resolved to a REAL contact (existing by lower-case email,
 * else created) so the name + email flow through scoring, review and the
 * approval/activation pipeline; a run's group assignment places a new contact
 * in that group, otherwise they stay neutral. Returns { ok:true, submission } or
 * { ok:false, statusCode, error }.
 */
export async function manualAddRespondent({ run_id, name, email, data, status: subStatus, session }) {
  const run = await getRunForManualAddById(run_id);
  if (run.rows.length === 0) return { ok: false, statusCode: 404, error: "Run not found" };

  const cleanName = (name || "").trim();
  const cleanEmail = (email || "").trim().toLowerCase();

  // Resolve/ensure a real contact so the respondent's name + email flow
  // through scoring, review, and the approval/activation email pipeline.
  let submitterId = null;
  if (cleanEmail) {
    const existing = await findContactByLowerEmailForManualAdd(cleanEmail);
    if (existing.rows.length > 0) {
      submitterId = existing.rows[0].cid;
      if (cleanName && !existing.rows[0].name) {
        await updateContactNameById(submitterId, cleanName);
      }
    } else {
      submitterId = "USR_" + Math.random().toString(36).substring(2, 14).toUpperCase();
      // Approved respondents default to Member. If the run carries a
      // group/program assignment, the respondent is placed in that group
      // (its designation applies then); otherwise they stay neutral —
      // never an assumed participant.
      let assignedGroup = null;
      try {
        const assignRes = await getAssignedGroupForManualAddById(run.rows[0].id);
        if (assignRes.rows[0]) {
          assignedGroup = String(assignRes.rows[0].target_id || "").trim().toUpperCase() || null;
        }
      } catch (_) {}
      await insertContactForManualAdd({
        cid: submitterId,
        name: cleanName || cleanEmail,
        email: cleanEmail,
        groupName: assignedGroup,
      });
    }
  } else {
    submitterId = "manual_" + Math.random().toString(36).substring(2, 12);
  }

  const newStatus = subStatus || "approved";

  let finalData = { ...(data || {}) };
  // manual_add CREATES a response, so the form-level switch is the whole
  // question — there is nothing that could already have been evaluated.
  let formAiEnabled = false;
  if (newStatus === "submitted") {
    const scores = await calculateSubmissionScores(run_id, finalData);
    if (scores) finalData._scores = scores;
    try {
      const { formHasAiEvaluation } = await import("@/lib/platform/ai/evaluate");
      const runInfo = await getRunFormIdForManualEvaluationById(run_id);
      if (runInfo.rows.length > 0) formAiEnabled = await formHasAiEvaluation(runInfo.rows[0].form_id);
    } catch (_) {}
  }

  const result = await insertManualAddSubmission({
    runId: run_id,
    submitterId,
    submitterName: cleanName || null,
    status: newStatus,
    data: finalData,
  });
  logTimeline(result.rows[0].id, newStatus === "draft" ? "started" : "submitted", session.cid, cleanName || null);

  if (newStatus !== "draft") {
    const runRow = run.rows[0];
    let formRow = null;
    if (runRow) {
      const formResult = await getFormForManualAddAutomationById(runRow.form_id);
      formRow = formResult.rows[0] || null;
    }
    onSubmission(result.rows[0], runRow || { id: parseInt(run_id) }, formRow, session);
    if (formAiEnabled && !runRow?.lms_course_id) {
      const newSubmissionId = result.rows[0].id;
      try {
        const { evaluateSubmission } = await import("@/lib/platform/ai/evaluate");
        const evaluation = await evaluateSubmission(newSubmissionId);
        logTimeline(newSubmissionId, "ai_evaluated", "system", "System", {});
        // Same automatic approval step as every other evaluation path.
        if (evaluation) await maybeAutoApprove(newSubmissionId, evaluation);
      } catch (error) {
        console.error("[form-runs] AI eval failed for manual submission", newSubmissionId, ":", error.message);
        logTimeline(newSubmissionId, "ai_eval_failed", "system", "System", { error: error.message });
      }
    }
  }

  return { ok: true, submission: result.rows[0] };
}

// ── Email actions: retry, cancel, bulk result send ──────────────────────────

/**
 * Retry failed emails — MANUAL only, never automatic. Each selected
 * (submission, email_type) pair must have a FAILED/bounced/cancelled/pending
 * send; a succeeded send is never resent.
 *
 * Re-sends go through the SAME helpers the first send used: approval/rejection
 * through the tracked decision email, `result` through the result sender,
 * acknowledgement through the acknowledgement sender, and `activation` re-fires
 * the REVIEW_COMPLETED automation so contact, token, template and idempotency
 * logic stay identical.
 */
export async function retryFailedEmails({ run_id, retries, session }) {
  // Backend validation: every submission must belong to THIS run.
  const idList = [...new Set(retries.map((retry) => parseInt(retry.submission_id)))];
  const validationsResult = await getRetryEmailValidationsByIdsInRun(idList, run_id);
  const validMap = new Map(validationsResult.rows.map((row) => [row.id, row]));

  const results = [];
  for (const item of retries) {
    const id = parseInt(item.submission_id);
    const type = String(item.email_type);
    const name = validMap.get(id)?.submitter_name || "";
    if (!validMap.has(id)) {
      results.push({ submission_id: id, email_type: type, name, status: "failed", error: "Submission is not in this run" });
      continue;
    }
    const logRow = await getEmailLogRow(id, type);
    if (logRow && logRow.status === "sent") {
      results.push({ submission_id: id, email_type: type, name, status: "already_sent", error: "Email already sent — not resent" });
      continue;
    }
    if (!logRow || !["failed", "bounced", "cancelled", "pending"].includes(logRow.status)) {
      results.push({ submission_id: id, email_type: type, name, status: "skipped", error: "No failed/bounced/cancelled/pending send to retry" });
      continue;
    }

    if (type === "approval" || type === "rejection") {
      const sendResult = await sendDecisionEmailForSubmission({
        submission_id: id,
        decision: type === "approval" ? "approved" : "rejected",
        comment: "",
      });
      results.push({ submission_id: id, email_type: type, name, status: sendResult.status, error: sendResult.error, to: sendResult.to });
    } else if (type === "result") {
      const sendResult = await sendResultEmailForSubmission({ submission_id: id });
      results.push({ submission_id: id, email_type: type, name, status: sendResult.status, error: sendResult.error, to: sendResult.to });
    } else if (type === "acknowledgement") {
      // Submission confirmation — same resolution chain as when it first
      // fired (recipient, name, run → form → default template).
      const sendResult = await sendAcknowledgementForSubmission({ submission_id: id });
      results.push({ submission_id: id, email_type: type, name, status: sendResult.status, error: sendResult.error, to: sendResult.to });
    } else if (type === "activation") {
      try {
        const submissionResult = await getSubmissionForActivationRetryById(id);
        const runData = await getRunDataForActivationRetryById(submissionResult.rows[0]?.run_id);
        let formData = null;
        if (runData.rows[0]) {
          const formResult = await getFormForActivationRetryById(runData.rows[0].form_id);
          formData = formResult.rows[0] || null;
        }
        await onReview(
          { id: null, submission_id: id, decision: "approved", comment: "Manual email retry", reviewer_name: session.cid },
          submissionResult.rows[0],
          runData.rows[0] || null,
          session,
          formData
        );
        const after = await getEmailLogRow(id, "activation");
        results.push({
          submission_id: id,
          email_type: "activation",
          name,
          status: after?.status === "sent" ? "sent" : after?.status === "failed" ? "failed" : "skipped",
          error: after?.status === "failed" ? (after.error || "Activation email failed") : undefined,
          to: after?.recipient,
        });
      } catch (error) {
        results.push({ submission_id: id, email_type: "activation", name, status: "failed", error: error?.message || "Retry error" });
      }
    } else {
      results.push({ submission_id: id, email_type: type, name, status: "failed", error: `Unsupported email type: ${type}` });
    }
  }

  return { results };
}

/**
 * Mark a batch of NOT-attempted (submission, email_type) pairs as cancelled.
 * An already-sent pair is never touched, so history is preserved and a
 * successful send is never overwritten. Returns the count marked.
 */
export async function markEmailsCancelled({ run_id, items }) {
  const idList = [...new Set(items.map((item) => parseInt(item?.submission_id)).filter((numericId) => Number.isFinite(numericId)))];
  const validationsResult = await getCancelledBatchSubmissionIdsInRun(idList, run_id);
  const validSet = new Set(validationsResult.rows.map((row) => row.id));

  let marked = 0;
  for (const item of items) {
    const id = parseInt(item?.submission_id);
    const type = String(item?.email_type || "");
    if (!Number.isFinite(id) || !type || !validSet.has(id)) continue;
    const logRow = await getEmailLogRow(id, type);
    if (logRow && logRow.status === "sent") continue; // never touch successful sends
    await recordEmailStatus({
      submission_id: id,
      contact_cid: logRow?.contact_cid || null,
      email_type: type,
      status: "cancelled",
      error: "Cancelled by administrator before send",
      to: logRow?.recipient || null,
    });
    marked++;
  }
  return { marked };
}

/**
 * Send each selected applicant their response PDF (answers, evaluation feedback,
 * final score) through the same per-submission result sender as retries —
 * tracked once per submission, draft/no-evaluation submissions reported as
 * skipped/failed. The PDF/copy never mention AI or the form/run names.
 */
export async function sendResultEmails({ run_id, submission_ids }) {
  const idList = [...new Set(submission_ids.map((id) => parseInt(id)).filter((numericId) => Number.isFinite(numericId)))];
  const validationsResult = await getManualMessageSubmissionsByIdsInRun(idList, run_id);
  const validMap = new Map(validationsResult.rows.map((row) => [row.id, row]));

  const results = [];
  for (const id of idList) {
    const submission = validMap.get(id);
    if (!submission) {
      results.push({ submission_id: id, name: "", status: "failed", error: "Submission is not in this run" });
      continue;
    }
    const sendResult = await sendResultEmailForSubmission({ submission_id: id });
    results.push({ submission_id: id, name: submission.submitter_name || "", status: sendResult.status || "failed", error: sendResult.error, to: sendResult.to });
  }

  return { results };
}

// ── Messaging: manual free-text and activation sends ─────────────────────────

/**
 * Send a free-text message to selected respondents of a run (Room Overview).
 * The recipient email and person name are resolved from the submission data with
 * the form's real field labels; a placeholder or missing address fails that
 * recipient only, never the batch. Returns { batch_id, recipients, sent, failed,
 * results } — the same envelope the UI already consumes.
 */
export async function sendManualMessages({ run_id, submission_ids, subject, body: messageBody }) {
  const batchId = "msg_" + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
  const idList = [...new Set(submission_ids.map((id) => parseInt(id)).filter((numericId) => Number.isFinite(numericId)))];
  const validationsResult = await getManualMessageSubmissionsByIdsInRun(idList, run_id);
  const validMap = new Map(validationsResult.rows.map((row) => [row.id, row]));

  // Fetch the form's field labels once for identity resolution.
  let fieldLabels = {};
  try {
    const fieldLabelsResult = await getManualMessageFieldLabelsByRunId(run_id);
    for (const fieldRow of fieldLabelsResult.rows) fieldLabels[String(fieldRow.id)] = fieldRow.label;
  } catch (_) {}

  let groupName = null;
  try {
    const groupResult = await getManualMessageGroupNameByRunId(run_id);
    if (groupResult.rows.length > 0) groupName = groupResult.rows[0].name;
  } catch (_) {}

  const results = [];
  let sent = 0;
  let failed = 0;

  for (const id of idList) {
    const submission = validMap.get(id);
    if (!submission) {
      results.push({ submission_id: id, status: "failed", error: "Submission is not in this run" });
      failed++;
      continue;
    }

    const subData = submission.data || {};
    const contactEmail = resolveSubmissionEmail({ submissionData: subData, fieldLabels, contactEmail: "" });
    if (!contactEmail || isPlaceholderEmail(contactEmail)) {
      results.push({ submission_id: id, name: submission.submitter_name || "", status: "failed", error: "No usable recipient email" });
      failed++;
      continue;
    }

    const name = resolvePersonName({
      contactName: "",
      submitterName: submission.submitter_name || "",
      submissionData: subData,
      fieldLabels,
    }) || submission.submitter_name || "Participant";

    const sendResult = await sendManualMessage({
      to: contactEmail,
      name,
      subject,
      body: messageBody,
      submission_id: id,
      contact_cid: submission.submitter_id || null,
      batch_id: batchId,
      templateVars: {
        form_name: "",
        group_name: groupName || "",
      },
    });

    if (sendResult.success) {
      sent++;
      results.push({ submission_id: id, name, status: "sent", to: contactEmail });
    } else {
      failed++;
      results.push({ submission_id: id, name, status: "failed", error: sendResult.error || "Send failed", to: contactEmail });
    }
  }

  return { batch_id: batchId, recipients: idList.length, sent, failed, results };
}

/**
 * Send (or, with `force`, re-send) the activation/join email to selected
 * APPROVED respondents of a run. The send runs through the same REVIEW_COMPLETED
 * automation the approval flow uses, so the token, template and idempotency
 * logic are identical; `force` bypasses the once-per-submission dedup so a fresh
 * link can be issued after the previous one expired. A missing/closed response,
 * a not-approved response or an already-active account is skipped, not failed.
 */
export async function sendActivationMessages({ run_id, submission_ids, force, session }) {
  const forceResend = force === true || force === 1 || force === "true" || force === "1";

  // Backend validation: every submission must belong to THIS run.
  const idList = [...new Set(submission_ids.map((id) => parseInt(id)))];
  const validationsResult = await getActivationMessageSubmissionsByIdsInRun(idList, run_id);
  const validMap = new Map(validationsResult.rows.map((row) => [row.id, row]));

  const results = [];
  for (const id of idList) {
    const submission = validMap.get(id);
    if (!submission) {
      results.push({ submission_id: id, name: "", status: "failed", error: "Submission is not in this run" });
      continue;
    }
    const name = submission.submitter_name || "";
    if (String(submission.status || "").toLowerCase() !== "approved") {
      results.push({ submission_id: id, name, status: "skipped", error: "Submission is not approved" });
      continue;
    }

    const logRow = await getEmailLogRow(id, "activation");
    if (!forceResend && logRow && logRow.status === "sent") {
      results.push({ submission_id: id, name, status: "already_sent", error: "Activation email already sent" });
      continue;
    }

    // Account already activated → no activation email needed. This avoids
    // the misleading "Send failed" when the person already completed setup.
    try {
      const actCheck = await getContactStatusForActivationById(submission.submitter_id);
      if (actCheck.rows[0] && String(actCheck.rows[0].status || "").toLowerCase() === "active") {
        results.push({ submission_id: id, name, status: "skipped", error: "Account already activated — no activation email needed" });
        continue;
      }
    } catch (_) {}

    try {
      const runData = await getRunDataForActivationSendById(submission.run_id);
      let formData = null;
      if (runData.rows[0]) {
        const formResult = await getFormForActivationSendById(runData.rows[0].form_id);
        formData = formResult.rows[0] || null;
      }
      // Force resend bypasses the once-per-submission dedup so an admin can
      // issue a fresh activation link after the previous 48h link expired.
      const reviewSubmission = forceResend ? { ...submission, _forceActivationResend: true } : submission;
      await onReview(
        { id: null, submission_id: id, decision: "approved", comment: forceResend ? "Manual activation resend" : "Manual activation send", reviewer_name: session.cid },
        reviewSubmission,
        runData.rows[0] || null,
        session,
        formData
      );
      const after = await getEmailLogRow(id, "activation");
      const hist = await getActivationHistory({ submission_id: id, contact_cid: submission.submitter_id || null });
      results.push({
        submission_id: id,
        name,
        status: after?.status === "sent" ? "sent" : after?.status === "failed" ? "failed" : "skipped",
        error: after?.status === "failed" || !after
          ? (after?.error || "Activation email failed")
          : after?.status === "pending"
            ? "Activation send did not complete — check the Emails tab"
            : after?.error || undefined,
        to: after?.recipient,
        first_sent_at: hist.first_sent_at,
        last_sent_at: hist.last_sent_at,
        token_valid: hist.token_valid,
        token_expires_at: hist.token_expires_at,
      });
    } catch (error) {
      results.push({ submission_id: id, name, status: "failed", error: error?.message || "Activation send error" });
    }
  }

  return { results };
}

// ── Public link, submission deletion, report re-roll, run creation ──────────

/**
 * Rotate a run's public share slug — the old link stops working. The format
 * matches run creation (unguessable). Legacy schemas may lack the column, so
 * add it idempotently and retry once. Returns { ok:true, run, public_slug } or
 * { ok:false, statusCode, error }.
 */
export async function regeneratePublicLink({ id }) {
  const slug = "r" + Array.from({ length: 10 }, () => Math.floor(Math.random() * 16).toString(16)).join("");

  try {
    await updatePublicSlugForRegeneratedLinkById(slug, id);
  } catch (_) {
    // Legacy schemas may lack the column — add it idempotently, then retry.
    try {
      await addPublicSlugColumnIfMissing();
      await updatePublicSlugRetryAfterAlterById(slug, id);
    } catch {
      return { ok: false, statusCode: 500, error: "Could not rotate the share link" };
    }
  }

  const fresh = await getRunAfterSlugRotationById(id);
  if (fresh.rows.length === 0) return { ok: false, statusCode: 404, error: "Run not found" };

  return { ok: true, run: fresh.rows[0], public_slug: slug };
}

/** Delete a submission and everything tied to it (reviews, timeline, evaluations). */
export async function deleteSubmission({ submission_id }) {
  await deleteReviewsBySubmissionId(submission_id);
  await deleteTimelineBySubmissionId(submission_id);
  await deleteEvaluationsBySubmissionId(submission_id);
  await deleteSubmissionById(submission_id);
  return { ok: true };
}

/**
 * Re-roll the composed report for a submission, then record it on the timeline.
 * Returns the built document (same shape as buildResultDocument) so the
 * controller can stream the PDF; a non-ok status is returned untouched.
 */
export async function regenerateRunReport({ submission_id }) {
  const document = await buildResultDocument({ submission_id, forceReport: true });
  if (document.status !== "ok") return document;
  logTimeline(parseInt(submission_id), "report_regenerated", "system", "System", {});
  return document;
}

/**
 * Create a run: resolve the form version, mint an unguessable public slug,
 * persist the run, create its initial assignments, then fire the creation
 * automation. Returns { ok:true, run } or { ok:false, statusCode, error }.
 */
export async function createRun({ form_id, name, description, opens_at, closes_at, assignments, settings, session }) {
  // Get current form version
  const form = await getFormVersionById(form_id);
  if (form.rows.length === 0) return { ok: false, statusCode: 404, error: "Form not found" };

  // Generate a random public slug (8-char hex, not guessable)
  const publicSlug = "r" + Array.from({ length: 10 }, () => Math.floor(Math.random() * 16).toString(16)).join("");

  const result = await createFormRun({
    form_id,
    form_version: form.rows[0].version,
    name,
    description,
    opens_at,
    closes_at,
    settings,
    owner_id: session.cid,
    created_by: session.cid,
    public_slug: publicSlug,
  });

  // Create assignments
  if (Array.isArray(assignments)) {
    for (const assignment of assignments) {
      await createRunAssignmentForRunCreation({
        runId: result.rows[0].id,
        targetType: assignment.target_type || "user",
        targetId: assignment.target_id,
        assignedBy: session.cid,
      });
    }
  }

  // Fire automation
  onRunCreated(result.rows[0], session);

  return { ok: true, run: result.rows[0] };
}

// ── Run metadata update and permanent archive (PUT / DELETE) ─────────────────

/**
 * Update a run's metadata.
 *
 * The Output Instruction is a prompt an administrator writes, so it is
 * validated here and not only in the form: it must be a string, it is bounded
 * and stored trimmed (blank means "no instruction, default report" — never a
 * whitespace prompt). Returns { ok:true, run } or { ok:false, statusCode, error }
 * where the error is the i18n key the caller shows.
 */
export async function updateRunMetadata({ id, name, description, status, opens_at, closes_at, settings }) {
  let safeSettings = settings;
  if (settings && typeof settings === "object" && settings.output_instruction !== undefined) {
    const raw = settings.output_instruction;
    if (raw !== null && typeof raw !== "string") {
      return { ok: false, statusCode: 400, error: "platformMisc.runs.outputInstructionInvalid" };
    }
    const trimmed = typeof raw === "string" ? raw.trim() : "";
    if (trimmed.length > MAX_OUTPUT_INSTRUCTION) {
      return { ok: false, statusCode: 400, error: "platformMisc.runs.outputInstructionTooLong" };
    }
    safeSettings = { ...settings, output_instruction: trimmed };
  }

  const result = await updateFormRunMetadataById({ id, name, description, status, opens_at, closes_at, settings: safeSettings });
  return { ok: true, run: result.rows[0] };
}

/**
 * Permanently delete a run and everything attached to it.
 *
 * Assignments and submissions cascade via FK, but the email/review/evaluation
 * logs reference submission_id without a FK cascade, so those are cleared first.
 * The report document's ROW cascades with the run; the stored OBJECT does not,
 * so it is taken down here or it would outlive its run forever.
 */
export async function archiveRun({ id }) {
  const runId = parseInt(id);

  await deleteEmailLogsByRunId(runId);
  await deleteReviewsByRunId(runId);
  await deleteEvaluationsByRunId(runId);
  const reportFilePath = await deleteRunReportFileByRunId(runId);
  if (reportFilePath) await removeRunReportFileObject(reportFilePath);
  await deleteFormRunById(runId);

  return { ok: true };
}
