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
  isGenericName,
  isPlaceholderEmail,
  resolvePersonName,
  resolveSubmissionEmail,
} from "@/lib/email";
import {
  getActivationEmailLogsByRunId,
  getAssignmentsByRunId,
  getContactsByCids,
  getContactsByLowerEmails,
  getContactsForAssignmentEnrichment,
  getFamiliesForAssignmentEnrichment,
  getFormFieldsForRunById,
  getLatestEmailsByRunId,
  getLatestEvaluationsByRunId,
  getPasswordTokensByContactCids,
  getProgramsForAssignmentEnrichment,
  getReviewsByRunId,
  getRunDetailWithGroupTargetById,
  getSubmissionsByRunId,
  updateRunStatusById,
} from "@/models/formRuns";
import { getRunReportFileByRunId, runReportFileDescriptor } from "@/models/platform/reportFiles";

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
