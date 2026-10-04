import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
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

import { buildRunDetail } from "@/services/platform/formRuns";
import { scheduleResultSweep } from "./scheduleResultSweep";

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