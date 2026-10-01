import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuthorization } from "@/lib/authorization";
import { resolvePersonName, resolveSubmissionEmail, recordEmailStatus, isGenericName, isPlaceholderEmail } from "@/lib/email";
import { onSubmission, onReview, onRunCreated, onRunLaunched, onAssignmentAdded, sendAcknowledgementForSubmission } from "@/lib/platform/automation";
import { maybeAutoApprove } from "@/models/platform/ai/autoApprove";
import {
  getSubmissionById,
  getRunById,
  getSubmissionReviewsBySubmissionId,
  getMySubmissionsBySubmitterId,
  getParticipantRunById,
  getParticipantSubmissionByRunAndSubmitter,
  getTimelineBySubmissionId,
  countActiveRuns,
  countTotalAssignments,
  countNonDraftSubmissions,
  countSubmittedSubmissions,
  countApprovedSubmissions,
  countOverdueSubmissions,
  countNonDraftSubmissionsByRunId,
  getRecentActivityTimeline,
  getAssignableContactsList,
  getScoringSubmissionById,
  getRunContextForScoringById,
  getFormScoringConfigById,
  getRunDetailWithGroupTargetById,
  getAssignmentsByRunId,
  getSubmissionsByRunId,
  listSubmissionsForOpenRuns,
  getReviewsByRunId,
  getLatestEvaluationsByRunId,
  getLatestEmailsByRunId,
  getActivationEmailLogsByRunId,
  getFormFieldsForRunById,
  getContactsByCids,
  getContactsByLowerEmails,
  getPasswordTokensByContactCids,
  getSubmissionsBySubmitterId,
  listFormRunsPage,
  updateRunStatusById,
  getRunSubmissionGateById,
  findExistingSubmissionIdForRunAndSubmitter,
  getRunFormIdForEvaluationById,
  getSubmissionCurrentStatusById,
  updateSubmissionContentAndStatusById,
  getFullRunForSubmissionAutomationById,
  getFormForSubmissionAutomationById,
  insertSubmissionForSubmitter,
  getFullRunForInsertSubmissionAutomationById,
  getFormForInsertSubmissionAutomationById,
  getRunForManualAddById,
  findContactByLowerEmailForManualAdd,
  updateContactNameById,
  getAssignedGroupForManualAddById,
  insertContactForManualAdd,
  getRunFormIdForManualEvaluationById,
  insertManualAddSubmission,
  getFormForManualAddAutomationById,
  getBulkReviewValidationsByIdsInRun,
  getRetryEmailValidationsByIdsInRun,
  getSubmissionForActivationRetryById,
  getRunDataForActivationRetryById,
  getFormForActivationRetryById,
  getCancelledBatchSubmissionIdsInRun,
  getRunPublicSlugById,
  updateRunPublicSlugById,
  launchRunById,
  insertRunAssignmentForAction,
  getAssignmentsAfterAssignByRunId,
  getFullRunAfterAssignById,
  getRunIdByAssignmentId,
  deleteAssignmentById,
  getAssignmentsAfterUnassignByRunId,
  deleteReviewsBySubmissionId,
  deleteTimelineBySubmissionId,
  deleteEvaluationsBySubmissionId,
  deleteSubmissionById,
  getManualMessageSubmissionsByIdsInRun,
  getManualMessageFieldLabelsByRunId,
  getManualMessageGroupNameByRunId,
  getActivationMessageSubmissionsByIdsInRun,
  getContactStatusForActivationById,
  getRunDataForActivationSendById,
  getFormForActivationSendById,
  updatePublicSlugForRegeneratedLinkById,
  addPublicSlugColumnIfMissing,
  updatePublicSlugRetryAfterAlterById,
  getRunAfterSlugRotationById,
  getFormVersionById,
  createFormRun,
  createRunAssignmentForRunCreation,
  updateFormRunMetadataById,
  deleteEmailLogsByRunId,
  deleteReviewsByRunId,
  deleteEvaluationsByRunId,
  deleteFormRunById,
} from "@/models/formRuns";

import { MAX_OUTPUT_INSTRUCTION } from "@/models/platform/ai/report";
import {
  getRunReportFileByRunId,
  runReportFileDescriptor,
  deleteRunReportFileByRunId,
} from "@/models/platform/reportFiles";
import { removeRunReportFileObject } from "@/lib/platform/runReportFiles";
import {
  logTimeline,
  enrichAssignments,
  deriveAccountStatus,
  calculateSubmissionScores,
  sendDecisionEmailForSubmission,
  buildResultDocument,
  sendResultEmailForSubmission,
  dispatchScheduledResultEmails,
  scheduleResultSweep,
  processReviewInternal,
} from "@/services/platform/formRuns";

/**
 * PLATFORM FORM RUNS API — Run creation, submissions, reviews, timeline, assignments
 *
 * GET  /api/platform/form-runs                          — List all runs
 * GET  /api/platform/form-runs?id=X                     — Get run detail + submissions + assignments + reviews
 * GET  /api/platform/form-runs?submitter_id=X           — Get submissions for a user
 * GET  /api/platform/form-runs?timeline=X               — Get timeline for a submission
 * GET  /api/platform/form-runs?dashboard=true           — Get operational dashboard stats
 *
 * POST /api/platform/form-runs                          — Create run
 * POST /api/platform/form-runs?action=launch            — Launch (activate) a run
 * POST /api/platform/form-runs?action=status            — Change run status (close, cancel, archive, reactivate)
 * POST /api/platform/form-runs?action=submit            — Submit a response
 * POST /api/platform/form-runs?action=review            — Review a submission
 * POST /api/platform/form-runs?action=assign            — Add assignment
 * POST /api/platform/form-runs?action=unassign          — Remove assignment
 * POST /api/platform/form-runs?action=dispatch_scheduled_result_emails
 *                                                        — Send the result emails whose
 *                                                          scheduled time has passed (scheduler)
 *
 * PUT  /api/platform/form-runs                          — Update run metadata (including settings)
 * DELETE /api/platform/form-runs?id=X                    — Archive
 */


export async function GET(req) {
  try {
    await initDb();

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const formId = searchParams.get("form_id");
    const status = searchParams.get("status");
    const submitterId = searchParams.get("submitter_id");
    const timeline = searchParams.get("timeline");
    const contacts = searchParams.get("contacts");
    const mySubmissions = searchParams.get("my_submissions");
    const submissionId = searchParams.get("submission_id");

    // ─── SINGLE SUBMISSION WITH RUN CONTEXT ───
    if (submissionId) {
      const { getSession } = await import("@/lib/auth");
      const session = await getSession();
      if (!session) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });

      const submissionResult = await getSubmissionById(submissionId);
      if (submissionResult.rows.length === 0) return NextResponse.json({ success: false, error: "Submission not found" }, { status: 404 });

      const run = await getRunById(submissionResult.rows[0].run_id);

      const reviews = await getSubmissionReviewsBySubmissionId(submissionId);

      // "Anonymous Submissions": the reviewer reads the answers and the outcome,
      // never WHO answered — the same rule the run list applies.
      const anonymousReview = run.rows[0]?.settings?.anonymous === true;
      const submissionRow = anonymousReview
        ? { ...submissionResult.rows[0], submitter_name: null, submitter_id: null }
        : submissionResult.rows[0];

      return NextResponse.json({
        success: true,
        submission: submissionRow,
        run: run.rows[0] || null,
        reviews: reviews.rows,
      });
    }

    // ─── MY SUBMISSIONS (any authenticated user) ───
    if (mySubmissions === "true") {
      const { getSession } = await import("@/lib/auth");
      const session = await getSession();
      if (!session) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
      const submissionsResult = await getMySubmissionsBySubmitterId(session.cid);
      return NextResponse.json({ success: true, submissions: submissionsResult.rows });
    }

    // ─── PARTICIPANT: Get single run (for filling forms, returns user's own submission) ───
    if (id && searchParams.get("participant") === "true") {
      const run = await getParticipantRunById(id);
      if (run.rows.length === 0) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });
      const { getSession } = await import("@/lib/auth");
      const session = await getSession();
      if (!session) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
      const mySubmissionResult = await getParticipantSubmissionByRunAndSubmitter(id, session.cid);
      return NextResponse.json({ success: true, run: run.rows[0], submission: mySubmissionResult.rows[0] || null });
    }

    const authError = await requireAuthorization("runs", "view");
    if (authError) return authError;

    // ─── TIMELINE for a specific submission ───
    if (timeline) {
      const entries = await getTimelineBySubmissionId(timeline);
      return NextResponse.json({ success: true, timeline: entries.rows });
    }

    // ─── DASHBOARD STATS ───
    if (searchParams.get("dashboard") === "true") {
      const [active, assigned, nonDraftSubmissions, pending, approved, overdue] = await Promise.all([
        countActiveRuns(),
        countTotalAssignments(),
        countNonDraftSubmissions(),
        countSubmittedSubmissions(),
        countApprovedSubmissions(),
        countOverdueSubmissions(),
      ]);
      const totalNonDraftSubmissions = parseInt(nonDraftSubmissions.rows[0].c) || 0;
      const totalApproved = parseInt(approved.rows[0].c) || 0;

      return NextResponse.json({
        success: true,
        stats: {
          active_runs: parseInt(active.rows[0].c) || 0,
          total_assignments: parseInt(assigned.rows[0].c) || 0,
          total_submissions: totalNonDraftSubmissions,
          pending_reviews: parseInt(pending.rows[0].c) || 0,
          approval_rate: totalNonDraftSubmissions > 0 ? Math.round((totalApproved / totalNonDraftSubmissions) * 100) : 0,
          overdue: parseInt(overdue.rows[0].c) || 0,
        },
      });
    }

    // ─── ACTIVITY FEED ───
    if (searchParams.get("activity") === "true") {
      const timeline = await getRecentActivityTimeline();
      return NextResponse.json({ success: true, activity: timeline.rows });
    }

    // ─── ASSIGNABLE CONTACTS ───
    if (contacts === "true") {
      const users = await getAssignableContactsList();
      return NextResponse.json({ success: true, contacts: users.rows });
    }

    // ─── SCORING BREAKDOWN for a submission ───
    if (searchParams.has("scoring")) {
      const submissionId = parseInt(searchParams.get("scoring"));
      if (!submissionId) return NextResponse.json({ success: false, error: "Invalid submission id" }, { status: 400 });

      const submissionResult = await getScoringSubmissionById(submissionId);
      if (submissionResult.rows.length === 0) return NextResponse.json({ success: false, error: "Submission not found" }, { status: 404 });

      const submission = submissionResult.rows[0];
      const subData = submission.data || {};
      const scores = subData._scores || null;

      // Fetch run for context
      const run = await getRunContextForScoringById(submission.run_id);

      // Fetch scoring config from run or form
      let scoringConfig = null;
      if (run.rows.length > 0) {
        const runSettings = run.rows[0].settings || {};
        if (runSettings.scoring?.enabled) {
          scoringConfig = runSettings.scoring;
        } else {
          const formResult = await getFormScoringConfigById(run.rows[0].form_id);
          if (formResult.rows.length > 0) {
            const formSettings = formResult.rows[0].settings || {};
            if (formSettings.scoring?.enabled) scoringConfig = formSettings.scoring;
          }
        }
      }

      return NextResponse.json({
        success: true,
        submission_id: submission.id,
        run_name: run.rows[0]?.name || null,
        scores,
        scoring_config: scoringConfig,
        submission_data: subData,
      });
    }

    // ─── SUBMISSIONS ACROSS THE OPEN RUNS (Responses table) ───
    //
    // The table needs every submission of every open run. Asking for each run's
    // full detail in turn meant one heavy round trip per run - each of them
    // fetching assignments, reviews, evaluations, email logs and the form's
    // fields - with the table waiting for the last one before it stopped loading.
    // This answers it in one query.
    if (searchParams.get("responses") === "true") {
      const submissionsResult = await listSubmissionsForOpenRuns();
      return NextResponse.json({ success: true, submissions: submissionsResult.rows });
    }

    // Single run with submissions
    if (id) {
      const run = await getRunDetailWithGroupTargetById(id);
      if (run.rows.length === 0) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });

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
      let fieldLabels = {};
      let filterableFields = [];
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

      // Opening a run also delivers any result email whose scheduled time has
      // passed, so a timer is a convenience, never the only way a scheduled
      // result ever leaves. Deferred — it runs after this response is written.
      scheduleResultSweep(id);

      return NextResponse.json({ success: true, run: run.rows[0], report_file: reportFile, assignments: await enrichedAssignmentsPromise, submissions: enrichedSubmissions, reviews: reviews.rows, evaluations, emails, field_labels: fieldLabels, filterable_fields: filterableFields });
    }

    // Submissions for a specific user
    if (submitterId) {
      const { getSession } = await import("@/lib/auth");
      const session = await getSession();
      if (!session)
        return NextResponse.json(
          { success: false, error: "Authentication required." },
          { status: 401 },
        );
      // SECURITY: this branch used to hand ANY user's submissions to any
      // `runs.view` holder, because `submitter_id` came straight from the
      // query string. The target is now bound to the session; only a Super
      // Admin may name someone else. The self-service path is `my_submissions`.
      const targetSubmitter = session.role === "super_admin" ? submitterId : session.cid;
      const submissionsResult = await getSubmissionsBySubmitterId(targetSubmitter);
      return NextResponse.json({ success: true, submissions: submissionsResult.rows });
    }

    // List all runs (optionally filtered by group_id or program_id), paginated server-side.
    const groupId = searchParams.get("group_id");
    const programId = searchParams.get("program_id");
    const page = Math.max(1, parseInt(searchParams.get("page")) || 1);
    const perPage = Math.max(1, parseInt(searchParams.get("per_page")) || 50);
    const offset = (page - 1) * perPage;

    // One round trip: the page carries the matching total as a window column
    // (see listFormRunsPage). This used to be a count query followed by a page
    // query over the same filtered set, awaited one after the other.
    const result = await listFormRunsPage({ groupId, programId, formId, status, perPage, offset });

    return NextResponse.json({ success: true, runs: result.rows, total: result.total, page, per_page: perPage });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
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

export async function POST(req) {
  try {
    await initDb();
    const { getSession } = await import("@/lib/auth");
    const session = await getSession();

    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action");
    const body = await req.json();

    // ─── STATUS CHANGE ACTION ───
    if (action === "status") {
      if (!session) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
      const authError = await requireAuthorization("runs", "create");
      if (authError) return authError;

      const { id, status: newStatus } = body;
      if (!id || !newStatus) return NextResponse.json({ success: false, error: "id and status required" }, { status: 400 });

      const valid = ["draft", "scheduled", "active", "closed", "cancelled", "archived"];
      if (!valid.includes(newStatus)) return NextResponse.json({ success: false, error: `Invalid status: ${newStatus}` }, { status: 400 });

      const result = await updateRunStatusById(id, newStatus);
      return NextResponse.json({ success: true, run: result.rows[0] });
    }

    // ─── SUBMIT ACTION ───
    if (action === "submit") {
      if (!session) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });

      const { run_id, data, status: subStatus } = body;
      if (!run_id) return NextResponse.json({ success: false, error: "run_id is required" }, { status: 400 });

      // Check run is active and not closed
      const run = await getRunSubmissionGateById(run_id);
      if (run.rows.length === 0) return NextResponse.json({ success: false, error: "Run not found" }, { status: 404 });
      if (run.rows[0].status !== "active") return NextResponse.json({ success: false, error: "Run is not active" }, { status: 400 });
      const gateSettings = run.rows[0].settings || {};
      if (run.rows[0].closes_at && new Date(run.rows[0].closes_at) < new Date()) {
        // "Auto-Close" makes the run close ITSELF at its deadline instead of only
        // refusing late answers — the status the operator would set by hand.
        if (gateSettings.auto_close) {
          try { await updateRunStatusById(run_id, "closed"); } catch (_) {}
        }
        return NextResponse.json({ success: false, error: "Submission deadline has passed" }, { status: 400 });
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
            return NextResponse.json({ success: false, error: "platformMisc.runs.submissionLimitReached" }, { status: 400 });
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
          return NextResponse.json({ success: false, error: "Cannot modify an already decided submission" }, { status: 400 });
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
          if (formAiEnabled) {
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
        return NextResponse.json({ success: true, submission: result.rows[0] });
      } else {
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
          if (formAiEnabled) {
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
        return NextResponse.json({ success: true, submission: result.rows[0] });
      }
    }

    // ─── MANUAL ADD ACTION (super admin injects a respondent) ───
    // Lets an admin add a person directly into a run. The submission is created
    // as "approved" by default so the person is immediately eligible for an
    // activation/join email. Pass status:'submitted' (or 'draft') explicitly to
    // exercise the full scoring/review flow when testing.
    if (action === "manual_add") {
      if (!session) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
      const authError = await requireAuthorization("runs", "edit");
      if (authError) return authError;

      const { run_id, name, email, data, status: subStatus } = body;
      if (!run_id) return NextResponse.json({ success: false, error: "run_id is required" }, { status: 400 });

      const run = await getRunForManualAddById(run_id);
      if (run.rows.length === 0) return NextResponse.json({ success: false, error: "Run not found" }, { status: 404 });

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
        if (formAiEnabled) {
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

      return NextResponse.json({ success: true, submission: result.rows[0] });
    }

    // ─── REVIEW ACTION ───
    if (action === "review") {
      if (!session) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
      // Deciding an applicant (approve/reject + automation + emails) is its OWN
      // capability, so holding runs.edit — which is what lets someone send run
      // messages, assign people and retry emails — never implies the authority
      // to admit or reject a person. Granted to nobody by default: only Super
      // Admin (eligibility bypass) can decide until runs.review is granted.
      const authError = await requireAuthorization("runs", "review");
      if (authError) return authError;

      const { submission_id, decision, comment, internal_note, dimension_overrides, force, include_result_pdf } = body;
      if (!submission_id || !decision) return NextResponse.json({ success: false, error: "submission_id and decision required" }, { status: 400 });

      const reviewResult = await processReviewInternal({
        submission_id: parseInt(submission_id),
        decision,
        comment,
        internal_note,
        dimension_overrides,
        force,
        session,
        includeResultPdf: include_result_pdf === true,
      });
      if (!reviewResult.ok) {
        return NextResponse.json({ success: false, error: reviewResult.error, error_code: reviewResult.errorCode || null }, { status: reviewResult.statusCode || 500 });
      }
      if (reviewResult.already_approved) {
        return NextResponse.json({
          success: true,
          already_approved: true,
          submission: reviewResult.submission,
          message: "Submission already approved — no duplicate actions performed",
        });
      }
      return NextResponse.json({ success: true, submission: reviewResult.submission, result_pdf: reviewResult.result_pdf || null });
    }

    // ─── BULK REVIEW ACTION ───
    // A controlled extension of the individual review workflow: each selected
    // respondent goes through processReviewInternal (status, approval email,
    // activation/access automation, idempotency) — no parallel logic.
    if (action === "bulk_review") {
      if (!session) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
      // Same separation as the single review: an admission decision is never a
      // side effect of holding runs.edit.
      const authError = await requireAuthorization("runs", "review");
      if (authError) return authError;

      const { run_id, submission_ids, decision, comment, include_result_pdf } = body;
      if (!run_id || !Array.isArray(submission_ids) || submission_ids.length === 0) {
        return NextResponse.json({ success: false, error: "run_id and submission_ids are required" }, { status: 400 });
      }
      if (submission_ids.length > 25) {
        return NextResponse.json({ success: false, error: "A bulk batch can process at most 25 submissions" }, { status: 400 });
      }
      if (decision !== "approved") {
        return NextResponse.json({ success: false, error: "Only 'approved' is supported as a bulk action right now" }, { status: 400 });
      }

      const idList = [...new Set(submission_ids.map((id) => parseInt(id)).filter((numericId) => Number.isFinite(numericId)))];
      if (idList.length === 0) {
        return NextResponse.json({ success: false, error: "No valid submission ids provided" }, { status: 400 });
      }

      // Backend validation: every id must belong to THIS run — the frontend
      // selection state is never trusted alone.
      const validationsResult = await getBulkReviewValidationsByIdsInRun(idList, run_id);
      const validMap = new Map(validationsResult.rows.map((row) => [row.id, row]));

      const results = [];
      for (const id of idList) {
        const row = validMap.get(id);
        if (!row) {
          results.push({ submission_id: id, status: "failed", name: "", error: "Submission is not in this run" });
          continue;
        }
        if (row.status === "approved") {
          results.push({ submission_id: id, status: "already_approved", name: row.submitter_name || "" });
          continue;
        }
        try {
          const reviewResult = await processReviewInternal({
            submission_id: id,
            decision: "approved",
            comment: comment || "Bulk approved",
            session,
            includeResultPdf: include_result_pdf === true,
          });
          results.push({
            submission_id: id,
            status: reviewResult.ok ? (reviewResult.already_approved ? "already_approved" : "approved") : "failed",
            name: row.submitter_name || "",
            error: reviewResult.ok ? undefined : reviewResult.error,
            result_pdf: reviewResult.result_pdf ? reviewResult.result_pdf.status : undefined,
            result_pdf_error: reviewResult.result_pdf ? reviewResult.result_pdf.error : undefined,
          });
        } catch (error) {
          results.push({
            submission_id: id,
            status: "failed",
            name: row.submitter_name || "",
            error: error?.message || "Unknown error",
          });
        }
      }

      return NextResponse.json({ success: true, results });
    }

    // ─── RETRY FAILED EMAILS ACTION ───
    // Manual retry only — no automatic retries. Each selected (submission,
    // email_type) pair must have a FAILED send; succeeded sends are never
    // resent. Approval/rejection re-sends through the same tracked decision
    // email helper; activation re-fires the REVIEW_COMPLETED automation so
    // contact, token, template and idempotency logic stay identical.
    if (action === "retry_emails") {
      if (!session) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
      const authError = await requireAuthorization("runs", "edit");
      if (authError) return authError;

      const { run_id, retries } = body;
      if (!run_id || !Array.isArray(retries) || retries.length === 0) {
        return NextResponse.json({ success: false, error: "run_id and retries are required" }, { status: 400 });
      }

      if (!retries.every((retry) => retry && Number.isFinite(parseInt(retry.submission_id)) && typeof retry.email_type === "string")) {
        return NextResponse.json({ success: false, error: "Each retry needs submission_id and email_type" }, { status: 400 });
      }

      // Backend validation: every submission must belong to THIS run.
      const idList = [...new Set(retries.map((retry) => parseInt(retry.submission_id)))];
      const validationsResult = await getRetryEmailValidationsByIdsInRun(idList, run_id);
      const validMap = new Map(validationsResult.rows.map((row) => [row.id, row]));

      const { getEmailLogRow } = await import("@/lib/email");
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

      return NextResponse.json({ success: true, results });
    }

    // ─── MARK EMAILS CANCELLED (admin stopped a batch before sending) ───
    // Appends a 'cancelled' row for pairs that were NOT attempted. History is
    // preserved and already-sent pairs are never touched.
    if (action === "mark_email_cancelled") {
      if (!session) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
      const authError = await requireAuthorization("runs", "edit");
      if (authError) return authError;

      const { run_id, items } = body;
      if (!run_id || !Array.isArray(items) || items.length === 0) {
        return NextResponse.json({ success: false, error: "run_id and items are required" }, { status: 400 });
      }
      if (items.length > 100) {
        return NextResponse.json({ success: false, error: "A cancel batch can process at most 100 items" }, { status: 400 });
      }

      const idList = [...new Set(items.map((item) => parseInt(item?.submission_id)).filter((numericId) => Number.isFinite(numericId)))];
      const validationsResult = await getCancelledBatchSubmissionIdsInRun(idList, run_id);
      const validSet = new Set(validationsResult.rows.map((row) => row.id));

      const { getEmailLogRow } = await import("@/lib/email");
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
      return NextResponse.json({ success: true, marked });
    }

    // ─── LAUNCH ACTION ───
    if (action === "launch") {
      if (!session) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
      const authError = await requireAuthorization("runs", "create");
      if (authError) return authError;

      const { id } = body;
      if (!id) return NextResponse.json({ success: false, error: "id is required" }, { status: 400 });
      
      // Generate public slug if not present (for runs created before slug feature)
      const existing = await getRunPublicSlugById(id);
      let slug = existing.rows[0]?.public_slug;
      if (!slug) {
        slug = "r" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
        await updateRunPublicSlugById(slug, id);
      }
      
      const result = await launchRunById(id, slug);
      // Fire automation
      onRunLaunched(result.rows[0], session);
      return NextResponse.json({ success: true, run: result.rows[0] });
    }

    // ─── ASSIGN ACTION ───
    if (action === "assign") {
      if (!session) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
      const authError = await requireAuthorization("runs", "edit");
      if (authError) return authError;

      // Accept either the legacy single target (target_type + target_id) or a
      // list of targets so one action can assign a run to multiple audiences
      // (e.g. Program AND Group) in a single request.
      const { run_id, target_type, target_id, targets } = body;
      const ALLOWED_TARGET_TYPES = ["user", "group", "program", "cohort", "team", "organization", "all"];
      const targetList = Array.isArray(targets)
        ? targets
        : [{ target_type: target_type || "user", target_id }];
      const valid = targetList.filter(
        (target) => target && ALLOWED_TARGET_TYPES.includes(target.target_type) && target.target_id,
      );
      if (!run_id || valid.length === 0) {
        return NextResponse.json({ success: false, error: "run_id and target required" }, { status: 400 });
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
      // Fire automation for each newly created assignment
      const fullRun = await getFullRunAfterAssignById(runId);
      for (const target of createdTargets) {
        onAssignmentAdded(target, fullRun.rows[0] || { id: runId });
      }
      return NextResponse.json({ success: true, added, skipped, assignments: await enrichAssignments(assignments.rows) });
    }

    // ─── UNASSIGN ACTION ───
    if (action === "unassign") {
      if (!session) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
      const authError = await requireAuthorization("runs", "edit");
      if (authError) return authError;

      const { assignment_id } = body;
      if (!assignment_id) return NextResponse.json({ success: false, error: "assignment_id required" }, { status: 400 });

      const assignmentResult = await getRunIdByAssignmentId(assignment_id);
      const runId = assignmentResult.rows[0]?.run_id;

      await deleteAssignmentById(assignment_id);

      if (runId) {
        const assignments = await getAssignmentsAfterUnassignByRunId(runId);
        return NextResponse.json({ success: true, assignments: await enrichAssignments(assignments.rows) });
      }
      return NextResponse.json({ success: true, assignments: [] });
    }

    // ─── PREVIEW RESULT ACTION (read-only PDF before sending) ───
    // Renders the exact document the applicant would receive — built by the
    // same helper the sender uses — and returns it inline so it can be reviewed
    // in place. Nothing is sent and no email log row is written, so previewing
    // is always safe to repeat.
    if (action === "preview_result") {
      if (!session) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
      const authError = await requireAuthorization("runs", "edit");
      if (authError) return authError;

      const { submission_id } = body;
      if (!submission_id) return NextResponse.json({ success: false, error: "submission_id required" }, { status: 400 });

      const resultDocument = await buildResultDocument({ submission_id });
      if (resultDocument.status !== "ok") {
        return NextResponse.json(
          { success: false, error: resultDocument.error || "Result document unavailable" },
          { status: resultDocument.status === "not_found" ? 404 : 400 },
        );
      }
      return new NextResponse(resultDocument.pdfBytes, {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="result-${parseInt(submission_id)}.pdf"`,
          "Cache-Control": "no-store",
        },
      });
    }

    // ─── REGENERATE REPORT ACTION (re-roll the composed report) ───
    // The composer reuses a stored document while the state and instruction are
    // unchanged. This action explicitly discards that and composes again, for
    // when a reviewer wants different wording from the same instruction, and
    // returns the fresh document the same way preview does.
    if (action === "regenerate_report") {
      if (!session) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
      const authError = await requireAuthorization("runs", "edit");
      if (authError) return authError;

      const { submission_id } = body;
      if (!submission_id) return NextResponse.json({ success: false, error: "submission_id required" }, { status: 400 });

      const resultDocument = await buildResultDocument({ submission_id, forceReport: true });
      if (resultDocument.status !== "ok") {
        return NextResponse.json(
          { success: false, error: resultDocument.error || "Result document unavailable" },
          { status: resultDocument.status === "not_found" ? 404 : 400 },
        );
      }
      logTimeline(parseInt(submission_id), "report_regenerated", "system", "System", {});
      return new NextResponse(resultDocument.pdfBytes, {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="result-${parseInt(submission_id)}.pdf"`,
          "Cache-Control": "no-store",
        },
      });
    }

    // ─── SEND RESULT EMAILS ACTION (Actions menu → response PDF per submission) ───
    // Emails each selected applicant a PDF with their answers, the evaluation
    // feedback and their final score. Runs through the same per-submission
    // helper as retries (tracked once per submission, draft/no-evaluation
    // submissions are reported as skipped/failed). The PDF/copy never mention
    // AI or the form/run names.
    if (action === "send_result_emails") {
      if (!session) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
      // Bulk result emails are governed by the runs.edit capability.
      const authError = await requireAuthorization("runs", "edit");
      if (authError) return authError;

      const { run_id, submission_ids } = body;
      if (!run_id || !Array.isArray(submission_ids) || submission_ids.length === 0) {
        return NextResponse.json({ success: false, error: "run_id and submission_ids are required" }, { status: 400 });
      }
      if (submission_ids.length > 500) {
        return NextResponse.json({ success: false, error: "Result emails can be sent to at most 500 submissions at once" }, { status: 400 });
      }

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

      return NextResponse.json({ success: true, results });
    }

    // ─── SCHEDULED RESULT DISPATCH ACTION ───
    // Delivers the result emails whose run-level delay has elapsed. Meant for a
    // scheduler: a caller presenting the shared secret is accepted without a
    // user session, and an authenticated operator (runs.edit) may also trigger
    // it by hand. The secret is verified HERE, not by the gateway, so no
    // unauthenticated traffic reaches the work itself.
    if (action === "dispatch_scheduled_result_emails") {
      const providedSecret = req.headers.get("x-cron-secret");
      const cronAuthorized = !!process.env.CRON_SECRET && providedSecret === process.env.CRON_SECRET;
      if (!cronAuthorized) {
        if (!session) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
        const authError = await requireAuthorization("runs", "edit");
        if (authError) return authError;
      }

      const summary = await dispatchScheduledResultEmails({ run_id: body?.run_id ?? null });
      return NextResponse.json({ success: !summary.error, ...summary }, { status: summary.error ? 500 : 200 });
    }

    // ─── DELETE SUBMISSION ACTION (super admin only) ───
    if (action === "delete_submission") {
      if (!session) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
      const authError = await requireAuthorization("runs", "delete");
      if (authError) return authError;

      const { submission_id } = body;
      if (!submission_id) return NextResponse.json({ success: false, error: "submission_id required" }, { status: 400 });

      // Delete associated data
      await deleteReviewsBySubmissionId(submission_id);
      await deleteTimelineBySubmissionId(submission_id);
      await deleteEvaluationsBySubmissionId(submission_id);
      await deleteSubmissionById(submission_id);

      return NextResponse.json({ success: true, message: "Submission deleted" });
    }

    // NOTE: the former `migrate` action ran an arbitrary SQL string supplied in
    // the request body. It was removed: raw SQL must never travel from a request
    // into db.execute. Schema changes ship as reviewed migrations (src/migrations)
    // or the dedicated /api/migrate/phaseN routes.

    // ─── SEND MANUAL MESSAGE ACTION (Room Overview → selected participants) ───
    if (action === "send_manual_message") {
      if (!session) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
      const authError = await requireAuthorization("runs", "edit");
      if (authError) return authError;

      const { run_id, submission_ids, subject, body: messageBody } = body;
      if (!run_id || !Array.isArray(submission_ids) || submission_ids.length === 0) {
        return NextResponse.json({ success: false, error: "run_id and submission_ids are required" }, { status: 400 });
      }
      if (!subject || !messageBody) {
        return NextResponse.json({ success: false, error: "subject and body are required" }, { status: 400 });
      }
      if (submission_ids.length > 500) {
        return NextResponse.json({ success: false, error: "A manual message can send to at most 500 recipients" }, { status: 400 });
      }

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

      const { sendManualMessage, resolveSubmissionEmail, resolvePersonName, isPlaceholderEmail } = await import("@/lib/email");

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

      return NextResponse.json({
        success: true,
        batch_id: batchId,
        recipients: idList.length,
        sent,
        failed,
        results,
      });
    }

    // ─── SEND ACTIVATION MESSAGES (Run Overview → selected approved) ───
    if (action === "send_activation_messages") {
      if (!session) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
      const authError = await requireAuthorization("runs", "edit");
      if (authError) return authError;

      const { run_id, submission_ids, force } = body;
      if (!run_id || !Array.isArray(submission_ids) || submission_ids.length === 0) {
        return NextResponse.json({ success: false, error: "run_id and submission_ids are required" }, { status: 400 });
      }
      const forceResend = force === true || force === 1 || force === "true" || force === "1";


      // Backend validation: every submission must belong to THIS run.
      const idList = [...new Set(submission_ids.map((id) => parseInt(id)))];
      const validationsResult = await getActivationMessageSubmissionsByIdsInRun(idList, run_id);
      const validMap = new Map(validationsResult.rows.map((row) => [row.id, row]));

      const { getEmailLogRow, getActivationHistory } = await import("@/lib/email");
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

      return NextResponse.json({ success: true, results });
    }

    // ─── REGENERATE PUBLIC LINK (rotates public_slug — old link stops working) ───
    if (action === "regenerate_link") {
      if (!session) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
      const authError = await requireAuthorization("runs", "edit");
      if (authError) return authError;

      const { id } = body;
      if (!id) return NextResponse.json({ success: false, error: "id is required" }, { status: 400 });

      // Same unguessable slug format as run creation.
      const slug = "r" + Array.from({ length: 10 }, () => Math.floor(Math.random() * 16).toString(16)).join("");

      try {
        await updatePublicSlugForRegeneratedLinkById(slug, id);
      } catch (_) {
        // Legacy schemas may lack the column — add it idempotently, then retry.
        try {
          await addPublicSlugColumnIfMissing();
          await updatePublicSlugRetryAfterAlterById(slug, id);
        } catch {
          return NextResponse.json({ success: false, error: "Could not rotate the share link" }, { status: 500 });
        }
      }

      const fresh = await getRunAfterSlugRotationById(id);
      if (fresh.rows.length === 0) return NextResponse.json({ success: false, error: "Run not found" }, { status: 404 });

      return NextResponse.json({ success: true, run: fresh.rows[0], public_slug: slug });
    }

    // ─── CREATE ACTION ───
    if (!session) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
    const authError = await requireAuthorization("runs", "create");
    if (authError) return authError;

    const { form_id, name, description, opens_at, closes_at, assignments, settings } = body;
    if (!form_id || !name) return NextResponse.json({ success: false, error: "form_id and name required" }, { status: 400 });

    // Get current form version
    const form = await getFormVersionById(form_id);
    if (form.rows.length === 0) return NextResponse.json({ success: false, error: "Form not found" }, { status: 404 });

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

    return NextResponse.json({ success: true, run: result.rows[0] });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(req) {
  try {
    await initDb();
    const authError = await requireAuthorization("runs", "edit");
    if (authError) return authError;

    const { id, name, description, status, opens_at, closes_at, settings } = await req.json();
    if (!id) return NextResponse.json({ success: false, error: "id is required" }, { status: 400 });

    // The Output Instruction is a prompt an administrator writes, so it is
    // validated here and not only in the form: bound its length, keep it a
    // string, and store it trimmed (blank means "no instruction, default
    // report" — never a whitespace prompt).
    let safeSettings = settings;
    if (settings && typeof settings === "object" && settings.output_instruction !== undefined) {
      const raw = settings.output_instruction;
      if (raw !== null && typeof raw !== "string") {
        return NextResponse.json({ success: false, error: "platformMisc.runs.outputInstructionInvalid" }, { status: 400 });
      }
      const trimmed = typeof raw === "string" ? raw.trim() : "";
      if (trimmed.length > MAX_OUTPUT_INSTRUCTION) {
        return NextResponse.json(
          { success: false, error: "platformMisc.runs.outputInstructionTooLong" },
          { status: 400 },
        );
      }
      safeSettings = { ...settings, output_instruction: trimmed };
    }

    const result = await updateFormRunMetadataById({ id, name, description, status, opens_at, closes_at, settings: safeSettings });
    return NextResponse.json({ success: true, run: result.rows[0] });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req) {
  try {
    await initDb();
    const authError = await requireAuthorization("runs", "delete");
    if (authError) return authError;
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ success: false, error: "id is required" }, { status: 400 });

    const runId = parseInt(id);

    // Permanently delete the run and everything attached to it. Assignments
    // and submissions cascade via FK, but email/review/evaluation logs
    // reference submission_id without a FK cascade, so clean those up first.
    await deleteEmailLogsByRunId(runId);
    await deleteReviewsByRunId(runId);
    await deleteEvaluationsByRunId(runId);
    // The report document's ROW cascades with the run; the stored object does
    // not, so it has to be taken down here or it would outlive its run forever.
    const reportFilePath = await deleteRunReportFileByRunId(runId);
    if (reportFilePath) await removeRunReportFileObject(reportFilePath);
    await deleteFormRunById(runId);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
