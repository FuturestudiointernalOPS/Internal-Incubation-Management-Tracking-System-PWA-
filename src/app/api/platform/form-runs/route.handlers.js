import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { after } from "next/server";
import { requireAuthorization } from "@/models/authorization/index";
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
  getRecentActivityTimeline,
  getAssignableContactsList,
  getScoringSubmissionById,
  getRunContextForScoringById,
  getFormScoringConfigById,
  listSubmissionsForOpenRuns,
  getSubmissionsBySubmitterId,
  listFormRunsPage,
  getBulkReviewValidationsByIdsInRun,
} from "@/models/formRuns";

import {
  archiveRun,
  assignRunTargets,
  buildResultDocument,
  buildRunDetail,
  changeRunStatus,
  createRun,
  deleteSubmission,
  dispatchScheduledResultEmails,
  isValidRunStatus,
  launchRun,
  manualAddRespondent,
  markEmailsCancelled,
  processReviewInternal,
  regeneratePublicLink,
  regenerateRunReport,
  retryFailedEmails,
  sendActivationMessages,
  sendManualMessages,
  sendResultEmails,
  submitResponse,
  unassignRun,
  updateRespondentEmail,
  updateRunMetadata,
} from "@/services/platform/formRuns";

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
      const result = await buildRunDetail(id);
      if (result.status === 200) scheduleResultSweep(id);
      return NextResponse.json(result.body, { status: result.status });
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

// A run screen re-reads often (navigation, refresh). The sweep is cheap when
// nothing is due, but building a report is not — so each run is swept at most
// once per window. The window is per server instance; a second instance simply
// sweeps its own turn, and the sentinel still prevents a double send.
const RESULT_SWEEP_COOLDOWN_MS = 2 * 60 * 1000;
const lastResultSweepAt = new Map();

/**
 * Ask for a sweep AFTER the current response has been written. Used on reads
 * (opening a run) and right after an approval, so a scheduled result never
 * waits on an external timer to exist — the timer only makes it punctual.
 */
function scheduleResultSweep(runId = null) {
  const key = runId == null ? "*" : String(runId);
  const now = Date.now();
  if (now - (lastResultSweepAt.get(key) || 0) < RESULT_SWEEP_COOLDOWN_MS) return;
  lastResultSweepAt.set(key, now);
  after(() => dispatchScheduledResultEmails({ run_id: runId }).catch(() => {}));
}

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
      if (!isValidRunStatus(newStatus)) return NextResponse.json({ success: false, error: `Invalid status: ${newStatus}` }, { status: 400 });

      const run = await changeRunStatus(id, newStatus);
      return NextResponse.json({ success: true, run });
    }

    // ─── SUBMIT ACTION ───
    if (action === "submit") {
      if (!session) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });

      const { run_id, data, status: subStatus } = body;
      if (!run_id) return NextResponse.json({ success: false, error: "run_id is required" }, { status: 400 });

      // The active/deadline/multiple/limit rules, the scoring, the AI evaluation
      // and the submission automation live in the service (submitResponse).
      const result = await submitResponse({ run_id, data, status: subStatus, session });
      if (!result.ok) return NextResponse.json({ success: false, error: result.error }, { status: result.statusCode || 500 });
      return NextResponse.json({ success: true, submission: result.submission });
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

      // Contact resolution (existing-by-email or created), the default "approved"
      // status, the scoring and the AI evaluation live in the service.
      const result = await manualAddRespondent({ run_id, name, email, data, status: subStatus, session });
      if (!result.ok) return NextResponse.json({ success: false, error: result.error }, { status: result.statusCode || 500 });
      return NextResponse.json({ success: true, submission: result.submission });
    }

    // ─── UPDATE RESPONDENT EMAIL ACTION ───
    // Corrects the address a respondent is contacted at — the fix for an email
    // typed wrong on the form (or in a manual add). Governed by runs.edit, the
    // same capability that lets someone send run emails and add respondents.
    if (action === "update_respondent_email") {
      if (!session) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
      const authError = await requireAuthorization("runs", "edit");
      if (authError) return authError;

      const { run_id, submission_id, email } = body;
      if (!run_id || !submission_id || !email) {
        return NextResponse.json({ success: false, error: "run_id, submission_id and email are required" }, { status: 400 });
      }

      const result = await updateRespondentEmail({ run_id, submission_id, email, session });
      if (!result.ok) return NextResponse.json({ success: false, error: result.error }, { status: result.statusCode || 500 });
      return NextResponse.json({
        success: true,
        email: result.email,
        contact_updated: result.contact_updated,
        contact_conflict: result.contact_conflict,
      });
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
        after,
        scheduleResultSweep,
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
            after,
            scheduleResultSweep,
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

      const { results } = await retryFailedEmails({ run_id, retries, session });
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

      const { marked } = await markEmailsCancelled({ run_id, items });
      return NextResponse.json({ success: true, marked });
    }

    // ─── LAUNCH ACTION ───
    if (action === "launch") {
      if (!session) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
      const authError = await requireAuthorization("runs", "create");
      if (authError) return authError;

      const { id } = body;
      if (!id) return NextResponse.json({ success: false, error: "id is required" }, { status: 400 });

      const run = await launchRun({ id, session });
      return NextResponse.json({ success: true, run });
    }

    // ─── ASSIGN ACTION ───
    if (action === "assign") {
      if (!session) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
      const authError = await requireAuthorization("runs", "edit");
      if (authError) return authError;

      // Accept either the legacy single target (target_type + target_id) or a
      // list of targets so one action can assign a run to multiple audiences
      // (e.g. Program AND Group) in a single request — the service owns the
      // allowed target types and the insert/skip decision.
      const { run_id, target_type, target_id, targets } = body;
      if (!run_id) return NextResponse.json({ success: false, error: "run_id and target required" }, { status: 400 });

      const result = await assignRunTargets({ run_id, target_type, target_id, targets, session });
      if (!result.ok) return NextResponse.json({ success: false, error: result.error }, { status: 400 });
      return NextResponse.json({ success: true, added: result.added, skipped: result.skipped, assignments: result.assignments });
    }

    // ─── UNASSIGN ACTION ───
    if (action === "unassign") {
      if (!session) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
      const authError = await requireAuthorization("runs", "edit");
      if (authError) return authError;

      const { assignment_id } = body;
      if (!assignment_id) return NextResponse.json({ success: false, error: "assignment_id required" }, { status: 400 });

      const { assignments } = await unassignRun({ assignment_id });
      return NextResponse.json({ success: true, assignments });
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

      // The service re-rolls the document and records the regeneration on the
      // timeline; the controller only streams the bytes.
      const resultDocument = await regenerateRunReport({ submission_id });
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

      const { results } = await sendResultEmails({ run_id, submission_ids });
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

      await deleteSubmission({ submission_id });

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

      const result = await sendManualMessages({ run_id, submission_ids, subject, body: messageBody });
      return NextResponse.json({ success: true, ...result });
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

      const { results } = await sendActivationMessages({ run_id, submission_ids, force, session });
      return NextResponse.json({ success: true, results });
    }

    // ─── REGENERATE PUBLIC LINK (rotates public_slug — old link stops working) ───
    if (action === "regenerate_link") {
      if (!session) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
      const authError = await requireAuthorization("runs", "edit");
      if (authError) return authError;

      const { id } = body;
      if (!id) return NextResponse.json({ success: false, error: "id is required" }, { status: 400 });

      const result = await regeneratePublicLink({ id });
      if (!result.ok) return NextResponse.json({ success: false, error: result.error }, { status: result.statusCode || 500 });
      return NextResponse.json({ success: true, run: result.run, public_slug: result.public_slug });
    }

    // ─── CREATE ACTION ───
    if (!session) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
    const authError = await requireAuthorization("runs", "create");
    if (authError) return authError;

    const { form_id, name, description, opens_at, closes_at, assignments, settings } = body;
    if (!form_id || !name) return NextResponse.json({ success: false, error: "form_id and name required" }, { status: 400 });

    // The form-version resolution, the slug, the persist, the initial
    // assignments and the creation automation live in the service (createRun).
    const result = await createRun({ form_id, name, description, opens_at, closes_at, assignments, settings, session });
    if (!result.ok) return NextResponse.json({ success: false, error: result.error }, { status: result.statusCode || 500 });
    return NextResponse.json({ success: true, run: result.run });
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

    // The Output Instruction validation (a string, bounded, stored trimmed —
    // blank means "no instruction, default report") lives in the service.
    const result = await updateRunMetadata({ id, name, description, status, opens_at, closes_at, settings });
    if (!result.ok) return NextResponse.json({ success: false, error: result.error }, { status: result.statusCode || 500 });
    return NextResponse.json({ success: true, run: result.run });
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

    // The cascade order (logs first, then the report object, then the run)
    // lives in the service.
    await archiveRun({ id });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
