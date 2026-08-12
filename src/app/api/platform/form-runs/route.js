import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { sendDecisionEmail } from "@/lib/email";
import { v4 as uuidv4 } from "uuid";
import { onSubmission, onReview, onRunCreated, onRunLaunched, onAssignmentAdded } from "@/lib/platform/automation";

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
 *
 * PUT  /api/platform/form-runs                          — Update run metadata (including settings)
 * DELETE /api/platform/form-runs?id=X                    — Archive
 */

function logTimeline(submissionId, action, actorId, actorName, meta = {}) {
  db.execute({
    sql: `INSERT INTO platform_submission_timeline (submission_id, action, actor_id, actor_name, metadata) VALUES (?, ?, ?, ?, ?)`,
    args: [submissionId, action, actorId || null, actorName || null, JSON.stringify(meta)],
  }).catch(() => {});
}

/**
 * Calculate assessment scores for a submission.
 * Expects submissionData to contain rating field values keyed by field label.
 * Returns { sections, overall, ranking } or null if scoring is not configured.
 */
async function calculateSubmissionScores(runId, submissionData) {
  try {
    const run = await db.execute({
      sql: "SELECT form_id, settings FROM platform_form_runs WHERE id = ?",
      args: [parseInt(runId)],
    });
    if (run.rows.length === 0) return null;

    // Check run-level scoring config first, then fall back to form-level
    const runSettings = run.rows[0].settings || {};
    let scoring = runSettings.scoring;

    if (!scoring || !scoring.enabled) {
      const form = await db.execute({
        sql: "SELECT settings FROM platform_forms WHERE id = ?",
        args: [run.rows[0].form_id],
      });
      if (form.rows.length === 0) return null;
      const formSettings = form.rows[0].settings || {};
      scoring = formSettings.scoring;
    }

    if (!scoring || !scoring.enabled || !scoring.sections) return null;

    const { sections, rankings } = scoring;
    const maxPerQuestion = scoring.max_per_question || 5; // configurable scale (default 5 for Likert)
    const sectionResults = {};

    for (const [sectionName, sectionConfig] of Object.entries(sections)) {
      const { weight, field_labels, max_per_question: sectionMax } = sectionConfig;
      const effectiveMax = sectionMax || maxPerQuestion;
      let sectionTotal = 0;
      let sectionCount = 0;

      if (Array.isArray(field_labels)) {
        for (const label of field_labels) {
          const value = submissionData[label];
          if (value !== undefined && value !== null && value !== "") {
            const numVal = parseFloat(value);
            if (!isNaN(numVal)) {
              sectionTotal += numVal;
              sectionCount++;
            }
          }
        }
      }

      const maxPossible = sectionCount * effectiveMax;
      const sectionScore = sectionCount > 0 ? Math.round((sectionTotal / maxPossible) * 1000) / 10 : 0;

      sectionResults[sectionName] = {
        score: sectionScore,
        maxPossible,
        total: sectionTotal,
        count: sectionCount,
        weight: weight || 0,
      };
    }

    // Overall weighted score
    let overallScore = 0;
    for (const [, data] of Object.entries(sectionResults)) {
      overallScore += data.score * (data.weight / 100);
    }
    overallScore = Math.round(overallScore * 10) / 10;

    // Ranking
    let ranking = null;
    if (Array.isArray(rankings)) {
      for (const rank of rankings) {
        if (overallScore >= rank.min && overallScore <= rank.max) {
          ranking = rank.label;
          break;
        }
      }
    }

    return { sections: sectionResults, overall: overallScore, ranking };
  } catch (e) {
    console.error("[Scoring] Calculation failed:", e.message);
    return null;
  }
}

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

      const sub = await db.execute({
        sql: "SELECT * FROM platform_form_submissions WHERE id = ?",
        args: [parseInt(submissionId)],
      });
      if (sub.rows.length === 0) return NextResponse.json({ success: false, error: "Submission not found" }, { status: 404 });

      const run = await db.execute({
        sql: "SELECT * FROM platform_form_runs WHERE id = ?",
        args: [sub.rows[0].run_id],
      });

      const reviews = await db.execute({
        sql: "SELECT * FROM platform_submission_reviews WHERE submission_id = ? ORDER BY created_at DESC",
        args: [parseInt(submissionId)],
      });

      return NextResponse.json({
        success: true,
        submission: sub.rows[0],
        run: run.rows[0] || null,
        reviews: reviews.rows,
      });
    }

    // ─── MY SUBMISSIONS (any authenticated user) ───
    if (mySubmissions === "true") {
      const { getSession } = await import("@/lib/auth");
      const session = await getSession();
      if (!session) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
      const subs = await db.execute({
        sql: "SELECT ps.*, pfr.name as run_name, pfr.status as run_status FROM platform_form_submissions ps JOIN platform_form_runs pfr ON ps.run_id = pfr.id WHERE ps.submitter_id = ? ORDER BY ps.updated_at DESC",
        args: [session.cid],
      });
      return NextResponse.json({ success: true, submissions: subs.rows });
    }

    // ─── PARTICIPANT: Get single run (for filling forms, returns user's own submission) ───
    if (id && searchParams.get("participant") === "true") {
      const run = await db.execute({ sql: "SELECT * FROM platform_form_runs WHERE id = ?", args: [parseInt(id)] });
      if (run.rows.length === 0) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
      const { getSession } = await import("@/lib/auth");
      const session = await getSession();
      if (!session) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
      const mySub = await db.execute({
        sql: "SELECT * FROM platform_form_submissions WHERE run_id = ? AND submitter_id = ? LIMIT 1",
        args: [parseInt(id), session.cid],
      });
      return NextResponse.json({ success: true, run: run.rows[0], submission: mySub.rows[0] || null });
    }

    const authError = await requireAuth(["super_admin", "admin", "staff", "program_manager"]);
    if (authError) return authError;

    // ─── TIMELINE for a specific submission ───
    if (timeline) {
      const entries = await db.execute({
        sql: "SELECT * FROM platform_submission_timeline WHERE submission_id = ? ORDER BY created_at ASC",
        args: [parseInt(timeline)],
      });
      return NextResponse.json({ success: true, timeline: entries.rows });
    }

    // ─── DASHBOARD STATS ───
    if (searchParams.get("dashboard") === "true") {
      const [active, assigned, subs, pending, approved, overdue] = await Promise.all([
        db.execute({ sql: "SELECT COUNT(*) as c FROM platform_form_runs WHERE status = 'active'" }),
        db.execute({ sql: "SELECT COUNT(*) as c FROM platform_form_run_assignments" }),
        db.execute({ sql: "SELECT COUNT(*) as c FROM platform_form_submissions WHERE status != 'draft'" }),
        db.execute({ sql: "SELECT COUNT(*) as c FROM platform_form_submissions WHERE status = 'submitted'" }),
        db.execute({ sql: "SELECT COUNT(*) as c FROM platform_form_submissions WHERE status = 'approved'" }),
        db.execute({ sql: "SELECT COUNT(*) as c FROM platform_form_submissions ps JOIN platform_form_runs pfr ON ps.run_id = pfr.id WHERE ps.status = 'submitted' AND pfr.closes_at IS NOT NULL AND pfr.closes_at < NOW()" }),
      ]);
      const totalSubs = parseInt(subs.rows[0].c) || 0;
      const totalApproved = parseInt(approved.rows[0].c) || 0;

      return NextResponse.json({
        success: true,
        stats: {
          active_runs: parseInt(active.rows[0].c) || 0,
          total_assignments: parseInt(assigned.rows[0].c) || 0,
          total_submissions: totalSubs,
          pending_reviews: parseInt(pending.rows[0].c) || 0,
          approval_rate: totalSubs > 0 ? Math.round((totalApproved / totalSubs) * 100) : 0,
          overdue: parseInt(overdue.rows[0].c) || 0,
        },
      });
    }

    // ─── ACTIVITY FEED ───
    if (searchParams.get("activity") === "true") {
      const timeline = await db.execute({
        sql: `SELECT pst.action, pst.actor_name, pst.created_at,
              CASE pst.action
                WHEN 'submitted' THEN 'New submission received'
                WHEN 'approved' THEN 'Submission approved'
                WHEN 'rejected' THEN 'Submission rejected'
                WHEN 'revision_requested' THEN 'Revision requested'
                WHEN 'launched' THEN 'Form run launched'
                WHEN 'created' THEN 'Form run created'
                ELSE pst.action
              END as details
              FROM platform_submission_timeline pst
              ORDER BY pst.created_at DESC LIMIT 20`,
        args: [],
      });
      return NextResponse.json({ success: true, activity: timeline.rows });
    }

    // ─── ASSIGNABLE CONTACTS ───
    if (contacts === "true") {
      const users = await db.execute({ sql: "SELECT cid, name, email, role FROM contacts WHERE deleted = 0 ORDER BY name ASC LIMIT 200" });
      return NextResponse.json({ success: true, contacts: users.rows });
    }

    // ─── SCORING BREAKDOWN for a submission ───
    if (searchParams.has("scoring")) {
      const submissionId = parseInt(searchParams.get("scoring"));
      if (!submissionId) return NextResponse.json({ success: false, error: "Invalid submission id" }, { status: 400 });

      const sub = await db.execute({
        sql: "SELECT * FROM platform_form_submissions WHERE id = ?",
        args: [submissionId],
      });
      if (sub.rows.length === 0) return NextResponse.json({ success: false, error: "Submission not found" }, { status: 404 });

      const submission = sub.rows[0];
      const subData = submission.data || {};
      const scores = subData._scores || null;

      // Fetch run for context
      const run = await db.execute({
        sql: "SELECT id, name, form_id, settings FROM platform_form_runs WHERE id = ?",
        args: [submission.run_id],
      });

      // Fetch scoring config from run or form
      let scoringConfig = null;
      if (run.rows.length > 0) {
        const runSettings = run.rows[0].settings || {};
        if (runSettings.scoring?.enabled) {
          scoringConfig = runSettings.scoring;
        } else {
          const form = await db.execute({
            sql: "SELECT settings FROM platform_forms WHERE id = ?",
            args: [run.rows[0].form_id],
          });
          if (form.rows.length > 0) {
            const formSettings = form.rows[0].settings || {};
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

    // Single run with submissions
    if (id) {
      const run = await db.execute({ sql: "SELECT * FROM platform_form_runs WHERE id = ?", args: [parseInt(id)] });
      if (run.rows.length === 0) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });

      const assignments = await db.execute({ sql: "SELECT * FROM platform_form_run_assignments WHERE run_id = ?", args: [parseInt(id)] });
      const submissions = await db.execute({ sql: "SELECT * FROM platform_form_submissions WHERE run_id = ? ORDER BY updated_at DESC", args: [parseInt(id)] });
      const reviews = await db.execute({ sql: "SELECT pr.* FROM platform_submission_reviews pr JOIN platform_form_submissions ps ON pr.submission_id = ps.id WHERE ps.run_id = ? ORDER BY pr.created_at DESC", args: [parseInt(id)] });

      return NextResponse.json({ success: true, run: run.rows[0], assignments: assignments.rows, submissions: submissions.rows, reviews: reviews.rows });
    }

    // Submissions for a specific user
    if (submitterId) {
      const subs = await db.execute({ sql: "SELECT ps.*, pfr.name as run_name, pfr.status as run_status FROM platform_form_submissions ps JOIN platform_form_runs pfr ON ps.run_id = pfr.id WHERE ps.submitter_id = ? ORDER BY ps.updated_at DESC", args: [submitterId] });
      return NextResponse.json({ success: true, submissions: subs.rows });
    }

    // List all runs (optionally filtered by group_id)
    const groupId = searchParams.get("group_id");
    let sql = "SELECT r.*, f.name as form_name FROM platform_form_runs r JOIN platform_forms f ON r.form_id = f.id";
    const args = [];

    if (groupId) {
      sql += " JOIN platform_form_run_assignments a ON r.id = a.run_id AND a.target_type = 'group' AND a.target_id = ?";
      args.push(groupId);
    }

    sql += " WHERE 1=1";
    if (formId) { sql += " AND r.form_id = ?"; args.push(parseInt(formId)); }
    if (status && status !== "all") { sql += " AND r.status = ?"; args.push(status); }
    sql += " ORDER BY r.updated_at DESC";

    const result = await db.execute({ sql, args });
    return NextResponse.json({ success: true, runs: result.rows });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
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
      const authError = await requireAuth(["super_admin", "admin"]);
      if (authError) return authError;

      const { id, status: newStatus } = body;
      if (!id || !newStatus) return NextResponse.json({ success: false, error: "id and status required" }, { status: 400 });

      const valid = ["draft", "scheduled", "active", "closed", "cancelled", "archived"];
      if (!valid.includes(newStatus)) return NextResponse.json({ success: false, error: `Invalid status: ${newStatus}` }, { status: 400 });

      const result = await db.execute({
        sql: `UPDATE platform_form_runs SET status = ?, updated_at = NOW() WHERE id = ? RETURNING *`,
        args: [newStatus, parseInt(id)],
      });
      return NextResponse.json({ success: true, run: result.rows[0] });
    }

    // ─── SUBMIT ACTION ───
    if (action === "submit") {
      if (!session) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });

      const { run_id, data, status: subStatus } = body;
      if (!run_id) return NextResponse.json({ success: false, error: "run_id is required" }, { status: 400 });

      // Check run is active and not closed
      const run = await db.execute({ sql: "SELECT status, closes_at FROM platform_form_runs WHERE id = ?", args: [parseInt(run_id)] });
      if (run.rows.length === 0) return NextResponse.json({ success: false, error: "Run not found" }, { status: 404 });
      if (run.rows[0].status !== "active") return NextResponse.json({ success: false, error: "Run is not active" }, { status: 400 });
      if (run.rows[0].closes_at && new Date(run.rows[0].closes_at) < new Date()) {
        return NextResponse.json({ success: false, error: "Submission deadline has passed" }, { status: 400 });
      }

      // Check if already submitted
      const existing = await db.execute({
        sql: "SELECT id FROM platform_form_submissions WHERE run_id = ? AND submitter_id = ? LIMIT 1",
        args: [parseInt(run_id), session.cid],
      });

      const newStatus = subStatus || "submitted";

      // Build final data with optional scoring
      let finalData = { ...(data || {}) };
      let shouldEvaluate = false;
      if (newStatus === "submitted") {
        const scores = await calculateSubmissionScores(run_id, finalData);
        if (scores) finalData._scores = scores;
        // Check if AI evaluation should run
        try {
          const { hasEvaluation } = await import("@/lib/platform/ai/evaluate");
          const runInfo = await db.execute({ sql: "SELECT form_id FROM platform_form_runs WHERE id = ?", args: [parseInt(run_id)] });
          if (runInfo.rows.length > 0) shouldEvaluate = await hasEvaluation(runInfo.rows[0].form_id);
        } catch (_) {}
      }

      if (existing.rows.length > 0) {
        const cur = await db.execute({ sql: "SELECT status FROM platform_form_submissions WHERE id = ?", args: [existing.rows[0].id] });
        // Don't allow overwriting approved/rejected submissions
        if (cur.rows[0] && (cur.rows[0].status === "approved" || cur.rows[0].status === "rejected")) {
          return NextResponse.json({ success: false, error: "Cannot modify an already decided submission" }, { status: 400 });
        }
        const result = await db.execute({
          sql: `UPDATE platform_form_submissions SET data = ?, status = ?, submitted_at = COALESCE(submitted_at, CASE WHEN ? = 'submitted' THEN NOW() ELSE NULL END), updated_at = NOW() WHERE id = ? RETURNING *`,
          args: [JSON.stringify(finalData), newStatus, newStatus, existing.rows[0].id],
        });
        logTimeline(existing.rows[0].id, newStatus === "draft" ? "draft_saved" : "submitted", session.cid, null);
        // Fire automation
        if (newStatus !== "draft") {
          const fullRun = await db.execute({ sql: "SELECT * FROM platform_form_runs WHERE id = ?", args: [parseInt(run_id)] });
          const runRow = fullRun.rows[0];
          let formRow = null;
          if (runRow) {
            const f = await db.execute({ sql: "SELECT * FROM platform_forms WHERE id = ?", args: [runRow.form_id] });
            formRow = f.rows[0] || null;
          }
          onSubmission(result.rows[0], runRow || { id: parseInt(run_id) }, formRow, session);
          // Reliable AI evaluation (awaited)
          if (shouldEvaluate) {
            const subId = result.rows[0].id;
            try {
              const { evaluateSubmission } = await import("@/lib/platform/ai/evaluate");
              await evaluateSubmission(subId);
              logTimeline(subId, "ai_evaluated", "system", "System", {});
            } catch (e) {
              console.error("[form-runs] AI eval failed for submission", subId, ":", e.message);
              logTimeline(subId, "ai_eval_failed", "system", "System", { error: e.message });
            }
          }
        }
        return NextResponse.json({ success: true, submission: result.rows[0] });
      } else {
        const result = await db.execute({
          sql: `INSERT INTO platform_form_submissions (run_id, submitter_id, submitter_name, status, data, submitted_at) VALUES (?, ?, ?, ?, ?, CASE WHEN ? = 'submitted' THEN NOW() ELSE NULL END) RETURNING *`,
          args: [parseInt(run_id), session.cid, null, newStatus, JSON.stringify(finalData), newStatus],
        });
        logTimeline(result.rows[0].id, newStatus === "draft" ? "started" : "submitted", session.cid, null);
        // Fire automation
        if (newStatus !== "draft") {
          const fullRun = await db.execute({ sql: "SELECT * FROM platform_form_runs WHERE id = ?", args: [parseInt(run_id)] });
          const runRow = fullRun.rows[0];
          let formRow = null;
          if (runRow) {
            const f = await db.execute({ sql: "SELECT * FROM platform_forms WHERE id = ?", args: [runRow.form_id] });
            formRow = f.rows[0] || null;
          }
          onSubmission(result.rows[0], runRow || { id: parseInt(run_id) }, formRow, session);
          // Reliable AI evaluation (awaited)
          if (shouldEvaluate) {
            const subId = result.rows[0].id;
            try {
              const { evaluateSubmission } = await import("@/lib/platform/ai/evaluate");
              await evaluateSubmission(subId);
              logTimeline(subId, "ai_evaluated", "system", "System", {});
            } catch (e) {
              console.error("[form-runs] AI eval failed for submission", subId, ":", e.message);
              logTimeline(subId, "ai_eval_failed", "system", "System", { error: e.message });
            }
          }
        }
        return NextResponse.json({ success: true, submission: result.rows[0] });
      }
    }

    // ─── REVIEW ACTION ───
    if (action === "review") {
      if (!session) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
      const authError = await requireAuth(["super_admin", "admin", "program_manager", "teacher"]);
      if (authError) return authError;

      const { submission_id, decision, comment, internal_note, dimension_overrides } = body;
      if (!submission_id || !decision) return NextResponse.json({ success: false, error: "submission_id and decision required" }, { status: 400 });

      let reviewerName = session.cid;
      try {
        const r = await db.execute({ sql: "SELECT name FROM contacts WHERE cid = ?", args: [session.cid] });
        if (r.rows.length) reviewerName = r.rows[0].name;
      } catch (_) {}

      // Save review with dimension overrides if provided
      await db.execute({
        sql: `INSERT INTO platform_submission_reviews (submission_id, reviewer_id, reviewer_name, decision, comment, internal_note) VALUES (?, ?, ?, ?, ?, ?)`,
        args: [parseInt(submission_id), session.cid, reviewerName, decision, comment || null, internal_note || null],
      });

      // Store dimension overrides in separate evaluation update
      if (dimension_overrides && Array.isArray(dimension_overrides) && dimension_overrides.length > 0) {
        try {
          const evalRes = await db.execute({
            sql: "SELECT id, dimensions FROM platform_submission_evaluations WHERE submission_id = ? ORDER BY evaluated_at DESC LIMIT 1",
            args: [parseInt(submission_id)],
          });
          if (evalRes.rows.length > 0) {
            const existing = evalRes.rows[0];
            const dims = existing.dimensions || [];
            const updatedDims = dims.map(d => {
              const override = dimension_overrides.find(o => o.name === d.name);
              if (override) {
                return { ...d, human_score: override.human_score, human_comment: override.human_comment || "", final_score: override.final_score };
              }
              return d;
            });
            await db.execute({
              sql: "UPDATE platform_submission_evaluations SET dimensions = ? WHERE id = ?",
              args: [JSON.stringify(updatedDims), existing.id],
            });
          }
        } catch (_) {}
      }

      // Update submission status — map workflow decision to core platform state
      const CORE_STATES = ["approved", "rejected", "revision_requested", "submitted", "draft"];
      const newStatus = CORE_STATES.includes(decision) ? decision : "approved";
      const result = await db.execute({
        sql: `UPDATE platform_form_submissions SET status = ?, updated_at = NOW() WHERE id = ? RETURNING *`,
        args: [newStatus, parseInt(submission_id)],
      });

      logTimeline(parseInt(submission_id), decision, session.cid, reviewerName, { comment, internal_note });

      // Send decision email to applicant
      try {
        const subData = result.rows[0].data || {};
        const applicantEmail = Object.values(subData).find(v => typeof v === "string" && v.includes("@"));
        const applicantName = result.rows[0].submitter_name || "";

        if (applicantEmail) {
          // Send a simple decision notification for all outcomes.
          // The automation engine handles activation emails separately.
          let shouldSend = true;
          if (decision !== "approved") {
            try {
              const runInfo2 = await db.execute({ sql: "SELECT r.form_id, f.settings FROM platform_form_runs r JOIN platform_forms f ON r.form_id = f.id WHERE r.id = ?", args: [result.rows[0].run_id] });
              if (runInfo2.rows[0]) {
                const auto = (runInfo2.rows[0].settings || {}).automation;
                if (auto?.on_reject?.send_rejection_email === false) shouldSend = false;
              }
            } catch (_) {}
          }
          if (shouldSend) {
            let decisionTemplate = null;
            let templateVars = null;
            try {
              const runInfo2 = await db.execute({ sql: "SELECT f.name, f.settings FROM platform_form_runs r JOIN platform_forms f ON r.form_id = f.id WHERE r.id = ?", args: [result.rows[0].run_id] });
              if (runInfo2.rows[0]) {
                const tmpl = (runInfo2.rows[0].settings || {}).automation?.templates;
                const formName = runInfo2.rows[0].name || "";
                if (decision === "approved") decisionTemplate = tmpl?.approval;
                else if (decision === "rejected") decisionTemplate = tmpl?.rejection;
                templateVars = { form_name: formName };
              }
            } catch (_) {}
            await sendDecisionEmail({
              to: applicantEmail,
              applicantName,
              formName: templateVars?.form_name || "application",
              decision,
              comment: comment || "",
              template: decisionTemplate,
              templateVars,
            });
            logTimeline(parseInt(submission_id), "email_sent", "system", "System", { to: applicantEmail, decision });
          }
        }
      } catch (emailErr) {
        console.error("[form-runs] Decision email error:", emailErr);
      }

      // Fire automation — get run details + form config for context
      const sub = await db.execute({ sql: "SELECT run_id FROM platform_form_submissions WHERE id = ?", args: [parseInt(submission_id)] });
      if (sub.rows.length > 0) {
        const runData = await db.execute({ sql: "SELECT * FROM platform_form_runs WHERE id = ?", args: [sub.rows[0].run_id] });
        let formData = null;
        if (runData.rows[0]) {
          const f = await db.execute({ sql: "SELECT * FROM platform_forms WHERE id = ?", args: [runData.rows[0].form_id] });
          formData = f.rows[0] || null;
        }
        await onReview(
          { id: null, submission_id: parseInt(submission_id), decision, comment, reviewer_name: reviewerName },
          result.rows[0],
          runData.rows[0] || null,
          session,
          formData
        );

        // Auto group assignment: when approved, assign participant to all programs linked to families with matching form_id
        if (decision === "approved" && runData.rows[0]) {
          try {
            const runFormId = runData.rows[0].form_id;
            const submitterId = result.rows[0].submitter_id;
            if (submitterId) {
              const families = await db.execute({
                sql: "SELECT * FROM families WHERE form_id = ?",
                args: [runFormId],
              });
              for (const fam of families.rows) {
                if (fam.program_id) {
                  await db.execute({
                    sql: `INSERT INTO participant_programs (participant_id, program_id)
                          VALUES (?, ?)
                          ON CONFLICT (participant_id, program_id) DO NOTHING`,
                    args: [submitterId, fam.program_id],
                  });
                }
              }
            }
          } catch (groupErr) {
            console.error("[form-runs] Auto group assignment error:", groupErr.message);
          }
        }
      }

      return NextResponse.json({ success: true, submission: result.rows[0] });
    }

    // ─── LAUNCH ACTION ───
    if (action === "launch") {
      if (!session) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
      const authError = await requireAuth(["super_admin", "admin"]);
      if (authError) return authError;

      const { id } = body;
      if (!id) return NextResponse.json({ success: false, error: "id is required" }, { status: 400 });
      
      // Generate public slug if not present (for runs created before slug feature)
      const existing = await db.execute({ sql: "SELECT public_slug FROM platform_form_runs WHERE id = ?", args: [parseInt(id)] });
      let slug = existing.rows[0]?.public_slug;
      if (!slug) {
        slug = "r" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
        await db.execute({ sql: "UPDATE platform_form_runs SET public_slug = ? WHERE id = ?", args: [slug, parseInt(id)] });
      }
      
      const result = await db.execute({
        sql: `UPDATE platform_form_runs SET status = 'active', public_slug = COALESCE(public_slug, ?), updated_at = NOW() WHERE id = ? RETURNING *`,
        args: [slug, parseInt(id)],
      });
      // Fire automation
      onRunLaunched(result.rows[0], session);
      return NextResponse.json({ success: true, run: result.rows[0] });
    }

    // ─── ASSIGN ACTION ───
    if (action === "assign") {
      if (!session) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
      const authError = await requireAuth(["super_admin", "admin", "program_manager"]);
      if (authError) return authError;

      const { run_id, target_type, target_id } = body;
      if (!run_id || !target_id) return NextResponse.json({ success: false, error: "run_id and target_id required" }, { status: 400 });

      await db.execute({
        sql: "INSERT INTO platform_form_run_assignments (run_id, target_type, target_id, assigned_by) VALUES (?, ?, ?, ?) ON CONFLICT (run_id, target_type, target_id) DO NOTHING",
        args: [parseInt(run_id), target_type || "user", target_id, session.cid],
      });

      const assignments = await db.execute({ sql: "SELECT * FROM platform_form_run_assignments WHERE run_id = ?", args: [parseInt(run_id)] });
      // Fire automation
      const fullRun = await db.execute({ sql: "SELECT * FROM platform_form_runs WHERE id = ?", args: [parseInt(run_id)] });
      onAssignmentAdded({ target_type: target_type || "user", target_id }, fullRun.rows[0] || { id: parseInt(run_id) });
      return NextResponse.json({ success: true, assignments: assignments.rows });
    }

    // ─── UNASSIGN ACTION ───
    if (action === "unassign") {
      if (!session) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
      const authError = await requireAuth(["super_admin", "admin", "program_manager"]);
      if (authError) return authError;

      const { assignment_id } = body;
      if (!assignment_id) return NextResponse.json({ success: false, error: "assignment_id required" }, { status: 400 });

      const a = await db.execute({ sql: "SELECT run_id FROM platform_form_run_assignments WHERE id = ?", args: [parseInt(assignment_id)] });
      const runId = a.rows[0]?.run_id;

      await db.execute({ sql: "DELETE FROM platform_form_run_assignments WHERE id = ?", args: [parseInt(assignment_id)] });

      if (runId) {
        const assignments = await db.execute({ sql: "SELECT * FROM platform_form_run_assignments WHERE run_id = ?", args: [parseInt(runId)] });
        return NextResponse.json({ success: true, assignments: assignments.rows });
      }
      return NextResponse.json({ success: true, assignments: [] });
    }

    // ─── DELETE SUBMISSION ACTION (super admin only) ───
    if (action === "delete_submission") {
      if (!session) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
      const authError = await requireAuth(["super_admin"]);
      if (authError) return authError;

      const { submission_id } = body;
      if (!submission_id) return NextResponse.json({ success: false, error: "submission_id required" }, { status: 400 });

      // Delete associated data
      await db.execute({ sql: "DELETE FROM platform_submission_reviews WHERE submission_id = ?", args: [parseInt(submission_id)] });
      await db.execute({ sql: "DELETE FROM platform_submission_timeline WHERE submission_id = ?", args: [parseInt(submission_id)] });
      await db.execute({ sql: "DELETE FROM platform_submission_evaluations WHERE submission_id = ?", args: [parseInt(submission_id)] });
      await db.execute({ sql: "DELETE FROM platform_form_submissions WHERE id = ?", args: [parseInt(submission_id)] });

      return NextResponse.json({ success: true, message: "Submission deleted" });
    }

    // ─── MIGRATION ACTION (super admin only) ───
    if (action === "migrate") {
      if (!session) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
      const authError = await requireAuth(["super_admin"]);
      if (authError) return authError;
      const { sql } = body;
      if (!sql) return NextResponse.json({ success: false, error: "sql required" }, { status: 400 });
      await db.execute({ sql, args: [] });
      return NextResponse.json({ success: true, message: "Migration executed" });
    }

    // ─── CREATE ACTION ───
    if (!session) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
    const authError = await requireAuth(["super_admin", "admin"]);
    if (authError) return authError;

    const { form_id, name, description, opens_at, closes_at, assignments, settings } = body;
    if (!form_id || !name) return NextResponse.json({ success: false, error: "form_id and name required" }, { status: 400 });

    // Get current form version
    const form = await db.execute({ sql: "SELECT version FROM platform_forms WHERE id = ?", args: [parseInt(form_id)] });
    if (form.rows.length === 0) return NextResponse.json({ success: false, error: "Form not found" }, { status: 404 });

    // Generate a random public slug (8-char hex, not guessable)
    const publicSlug = "r" + Array.from({ length: 10 }, () => Math.floor(Math.random() * 16).toString(16)).join("");

    const result = await db.execute({
      sql: `INSERT INTO platform_form_runs (form_id, form_version, name, description, opens_at, closes_at, settings, owner_id, created_by, public_slug) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`,
      args: [parseInt(form_id), form.rows[0].version, name.trim(), description || null, opens_at || null, closes_at || null, JSON.stringify(settings || {}), session.cid || null, session.cid || null, publicSlug],
    });

    // Create assignments
    if (Array.isArray(assignments)) {
      for (const a of assignments) {
        await db.execute({
          sql: "INSERT INTO platform_form_run_assignments (run_id, target_type, target_id, assigned_by) VALUES (?, ?, ?, ?) ON CONFLICT (run_id, target_type, target_id) DO NOTHING",
          args: [result.rows[0].id, a.target_type || "user", a.target_id, session.cid],
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
    const authError = await requireAuth(["super_admin", "admin"]);
    if (authError) return authError;

    const { id, name, description, status, opens_at, closes_at, settings } = await req.json();
    if (!id) return NextResponse.json({ success: false, error: "id is required" }, { status: 400 });

    const fields = [];
    const args = [];
    const updatable = { name, description, status, opens_at, closes_at };
    for (const [k, v] of Object.entries(updatable)) {
      if (v !== undefined) { fields.push(`${k} = ?`); args.push(v); }
    }
    if (settings !== undefined) { fields.push("settings = ?"); args.push(JSON.stringify(settings)); }
    fields.push("updated_at = NOW()");
    args.push(parseInt(id));

    const result = await db.execute({
      sql: `UPDATE platform_form_runs SET ${fields.join(", ")} WHERE id = ? RETURNING *`,
      args,
    });
    return NextResponse.json({ success: true, run: result.rows[0] });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req) {
  try {
    await initDb();
    const authError = await requireAuth(["super_admin"]);
    if (authError) return authError;
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ success: false, error: "id is required" }, { status: 400 });
    await db.execute({ sql: "UPDATE platform_form_runs SET status = 'archived', updated_at = NOW() WHERE id = ?", args: [parseInt(id)] });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
