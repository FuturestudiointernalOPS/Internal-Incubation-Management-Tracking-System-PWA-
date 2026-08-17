 import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { after } from "next/server";
import { requireAuth } from "@/lib/auth";
import { sendDecisionEmail, getTemplate, resolvePersonName, resolveSubmissionEmail, recordEmailStatus, isGenericName, isPlaceholderEmail, hasSentEmailToRecipientInRun } from "@/lib/email";
import { v4 as uuidv4 } from "uuid";
import { onSubmission, onReview, onRunCreated, onRunLaunched, onAssignmentAdded } from "@/lib/platform/automation";
import { syncApprovedSubmissionToProgramGroup } from "@/lib/contact-group-sync";

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
async function enrichAssignments(assignments) {
  const rows = Array.isArray(assignments) ? assignments : assignments?.rows || [];
  if (rows.length === 0) return rows;

  const byType = (t) => rows.filter((r) => r.target_type === t).map((r) => r.target_id).filter(Boolean);

  const userMap = new Map();
  const groupMap = new Map();
  const programMap = new Map();

  const userIds = byType('user');
  if (userIds.length > 0) {
    try {
      const emails = userIds.map((u) => String(u).toLowerCase());
      const res = await db.execute({
        sql: 'SELECT cid, name, email FROM contacts WHERE cid = ANY(?) OR LOWER(email) = ANY(?)',
        args: [userIds, emails],
      });
      for (const row of res.rows) {
        userMap.set(row.cid, row);
        if (row.email) userMap.set(String(row.email).toLowerCase(), row);
      }
    } catch (_) {}
  }

  const groupIds = byType('group');
  if (groupIds.length > 0) {
    try {
      const res = await db.execute({
        sql: 'SELECT id, registration_id, name FROM families WHERE registration_id = ANY(?) OR CAST(id AS TEXT) = ANY(?)',
        args: [groupIds, groupIds],
      });
      for (const row of res.rows) {
        if (row.registration_id) groupMap.set(row.registration_id, row);
        groupMap.set(String(row.id), row);
      }
    } catch (_) {}
  }

  const programIds = byType('program');
  if (programIds.length > 0) {
    try {
      const res = await db.execute({
        sql: 'SELECT id, name FROM v2_programs WHERE id = ANY(?)',
        args: [programIds],
      });
      for (const row of res.rows) programMap.set(String(row.id), row);
    } catch (_) {}
  }

  for (const a of rows) {
    if (a.target_type === 'user') {
      const c = userMap.get(a.target_id) || userMap.get(String(a.target_id).toLowerCase());
      if (c) {
        a.target_email = c.email || null;
        a.target_name = c.name && !isGenericName(c.name) ? c.name : c.email || null;
      } else {
        a.target_name = null;
        a.target_email = null;
      }
    } else if (a.target_type === 'group') {
      const g = groupMap.get(a.target_id) || groupMap.get(String(a.target_id).toLowerCase());
      a.target_name = g ? g.name || null : null;
    } else if (a.target_type === 'program') {
      const p = programMap.get(a.target_id) || programMap.get(String(a.target_id).toLowerCase());
      a.target_name = p ? p.name || null : null;
    }
  }
  return rows;
}

/**
 * Calculate assessment scores for a submission.
 * Expects submissionData to contain rating field values keyed by field label.
 * Returns { sections, overall, ranking } or null if scoring is not configured.
 */
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
      if (run.rows.length === 0) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });
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
      const users = await db.execute({ sql: "SELECT cid, name, email, role FROM contacts WHERE deleted = 0 ORDER BY name ASC LIMIT 1000" });
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
      const run = await db.execute({ sql: "SELECT r.*, (SELECT a.target_id FROM platform_form_run_assignments a WHERE a.run_id = r.id AND a.target_type = 'group' LIMIT 1) as group_target_id FROM platform_form_runs r WHERE r.id = ?", args: [parseInt(id)] });
      if (run.rows.length === 0) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });

      const assignments = await db.execute({ sql: "SELECT * FROM platform_form_run_assignments WHERE run_id = ?", args: [parseInt(id)] });
      const submissions = await db.execute({ sql: "SELECT * FROM platform_form_submissions WHERE run_id = ? ORDER BY updated_at DESC", args: [parseInt(id)] });
      const reviews = await db.execute({ sql: "SELECT pr.* FROM platform_submission_reviews pr JOIN platform_form_submissions ps ON pr.submission_id = ps.id WHERE ps.run_id = ? ORDER BY pr.created_at DESC", args: [parseInt(id)] });

      // AI evaluation rows (latest per submission) so the Responses table can
      // show stored scores/rankings without loading each submission individually.
      let evaluations = [];
      try {
        const evalRes = await db.execute({
          sql: `SELECT DISTINCT ON (submission_id) *
                FROM platform_submission_evaluations
                WHERE submission_id IN (SELECT id FROM platform_form_submissions WHERE run_id = ?)
                ORDER BY submission_id, evaluated_at DESC`,
          args: [parseInt(id)],
        });
        evaluations = evalRes.rows;
      } catch (_) {}

      // Email delivery log so the Responses table can show activation-email state.
      let emails = [];
      try {
        const emailRes = await db.execute({
          sql: `SELECT DISTINCT ON (submission_id, email_type) *
                FROM platform_email_log
                WHERE submission_id IN (SELECT id FROM platform_form_submissions WHERE run_id = ?)
                ORDER BY submission_id, email_type, id DESC`,
          args: [parseInt(id)],
        });
        emails = emailRes.rows;
      } catch (_) {}

      // ── Run-scoped respondent enrichment: emails + dynamic filter fields ──
      const formIdOfRun = run.rows[0].form_id;

      let fieldLabels = {};
      let filterableFields = [];
      try {
        const fRes = await db.execute({
          sql: "SELECT id, label, options FROM platform_form_fields WHERE form_id::text = ? ORDER BY sort_order, id",
          args: [String(formIdOfRun)],
        });
        for (const f of fRes.rows) {
          fieldLabels[String(f.id)] = f.label;
          let parsedOpts = null;
          if (f.options) {
            try {
              parsedOpts = typeof f.options === "string" ? JSON.parse(f.options) : f.options;
            } catch (_) {
              parsedOpts = null;
            }
          }
          const opts = Array.isArray(parsedOpts)
            ? parsedOpts
                .map((o) => (typeof o === "string" ? o : o?.label || o?.value || String(o)))
                .filter((s) => s != null && String(s).trim() !== "")
            : [];
          if (opts.length > 0) filterableFields.push({ label: f.label, options: opts });
        }
      } catch (_) {}

      // Emails: batch contact lookup, falling back to the submission data
      const rawSubs = submissions.rows;
      const cids = [...new Set(rawSubs.map((s) => s.submitter_id).filter(Boolean))];

      // Pre-resolve each applicant's real email so we can look up contacts by
      // BOTH submitter_id AND email — anonymous/imported submissions often
      // have a null/mismatched submitter_id while the contact exists by email.
      const resolvedEmails = rawSubs.map((s) =>
        resolveSubmissionEmail({
          submissionData: s.data || {},
          fieldLabels,
          contactEmail: "",
        }),
      );
      const emailKeys = [...new Set(resolvedEmails.map((e) => (e ? String(e).toLowerCase() : "")).filter(Boolean))];

      const emailMap = new Map();
      const nameMap = new Map();
      const accountMap = new Map(); // keyed by BOTH cid and lower(email)
      if (cids.length > 0) {
        try {
          const cres = await db.execute({
            sql: "SELECT cid, email, name, password, status, archived_at, deleted, deleted_at FROM contacts WHERE cid = ANY(?)",
            args: [cids],
          });
          for (const row of cres.rows) {
            emailMap.set(row.cid, row.email || "");
            nameMap.set(row.cid, row.name || "");
            accountMap.set(row.cid, row);
            if (row.email) accountMap.set(String(row.email).toLowerCase(), row);
          }
        } catch (_) {}
      }
      if (emailKeys.length > 0) {
        try {
          const cres = await db.execute({
            sql: "SELECT cid, email, name, password, status, archived_at, deleted, deleted_at FROM contacts WHERE LOWER(email) = ANY(?)",
            args: [emailKeys],
          });
          for (const row of cres.rows) {
            accountMap.set(row.cid, row);
            if (row.email) accountMap.set(String(row.email).toLowerCase(), row);
            if (!emailMap.has(row.cid)) emailMap.set(row.cid, row.email || "");
            if (!nameMap.has(row.cid)) nameMap.set(row.cid, row.name || "");
          }
        } catch (_) {}
      }

      const enrichedSubmissions = rawSubs.map((s) => {
        // Real applicant email: the form's actual email answer first, then any
        // real email in the submission, then the CRM email — placeholder
        // import addresses are NEVER shown.
        const email = resolveSubmissionEmail({
          submissionData: s.data || {},
          fieldLabels,
          contactEmail: emailMap.get(s.submitter_id) || "",
        });
        const displayName =
          resolvePersonName({
            contactName: nameMap.get(s.submitter_id) || "",
            submitterName: s.submitter_name || "",
            submissionData: s.data || {},
            fieldLabels,
          }) ||
          // Fallbacks must never surface placeholder names when a real one
          // is missing — prefer the submitter id over "Unknown"/"Anonymous".
          (!isGenericName(s.submitter_name) ? s.submitter_name : "") ||
          s.submitter_id;
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
        const contactByCid = accountMap.get(s.submitter_id) || null;
        const contactByEmail = email ? accountMap.get(String(email).toLowerCase()) : null;
        const contactRow =
          (contactByCid && !isPlaceholderEmail(contactByCid.email) ? contactByCid : null) ||
          contactByEmail ||
          contactByCid;
        const account_created = !!contactRow;
        const account_activated = account_created && String(contactRow.status || "").toLowerCase() === "active";
        const account_status = deriveAccountStatus(contactRow);
        return { ...s, email, display_name: displayName, account_created, account_activated, account_status };
      });

      return NextResponse.json({ success: true, run: run.rows[0], assignments: await enrichAssignments(assignments.rows), submissions: enrichedSubmissions, reviews: reviews.rows, evaluations, emails, field_labels: fieldLabels, filterable_fields: filterableFields });
    }

    // Submissions for a specific user
    if (submitterId) {
      const subs = await db.execute({ sql: "SELECT ps.*, pfr.name as run_name, pfr.status as run_status FROM platform_form_submissions ps JOIN platform_form_runs pfr ON ps.run_id = pfr.id WHERE ps.submitter_id = ? ORDER BY ps.updated_at DESC", args: [submitterId] });
      return NextResponse.json({ success: true, submissions: subs.rows });
    }

    // List all runs (optionally filtered by group_id), paginated server-side.
    const groupId = searchParams.get("group_id");
    const page = Math.max(1, parseInt(searchParams.get("page")) || 1);
    const perPage = Math.max(1, parseInt(searchParams.get("per_page")) || 50);
    const offset = (page - 1) * perPage;

    const baseFrom = `FROM platform_form_runs r
      JOIN platform_forms f ON r.form_id = f.id
      LEFT JOIN LATERAL (
        SELECT a.target_id
        FROM platform_form_run_assignments a
        WHERE a.run_id = r.id AND a.target_type = 'group'
        LIMIT 1
      ) ga ON true`;
    const conditions = [];
    const args = [];

    if (groupId) {
      conditions.push("EXISTS (SELECT 1 FROM platform_form_run_assignments ga2 WHERE ga2.run_id = r.id AND ga2.target_type = 'group' AND ga2.target_id = ?)");
      args.push(groupId);
    }
    if (formId) { conditions.push("r.form_id = ?"); args.push(parseInt(formId)); }
    if (status && status !== "all") {
      conditions.push("r.status = ?");
      args.push(status);
    } else {
      conditions.push("r.status IS DISTINCT FROM 'archived'");
    }

    const whereClause = conditions.length ? " WHERE " + conditions.join(" AND ") : "";

    const countRes = await db.execute({ sql: `SELECT COUNT(*) AS total ${baseFrom}${whereClause}`, args });
    const total = parseInt(countRes.rows[0]?.total) || 0;

    const result = await db.execute({
      sql: `SELECT r.*, f.name as form_name, ga.target_id as group_target_id ${baseFrom}${whereClause} ORDER BY r.updated_at DESC LIMIT ? OFFSET ?`,
      args: [...args, perPage, offset],
    });

    return NextResponse.json({ success: true, runs: result.rows, total, page, per_page: perPage });
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
async function sendDecisionEmailForSubmission({ submission_id, decision, comment }) {
  const subRes = await db.execute({
    sql: "SELECT * FROM platform_form_submissions WHERE id = ?",
    args: [parseInt(submission_id)],
  });
  if (subRes.rows.length === 0) return { status: "not_found", error: "Submission not found" };
  const row = subRes.rows[0];

  try {
    const subData = row.data || {};

    // Fetch the form's real field labels + CRM contact once, then resolve
    // BOTH the name and the real applicant email from the same sources so
    // the UI and the sender can never disagree about the recipient.
    let labels = {};
    let crmName = "";
    let crmEmail = "";
    try {
      const fieldRes = await db.execute({
        sql: `SELECT f2.id, f2.label
              FROM platform_form_fields f2
              JOIN platform_form_runs r2 ON f2.form_id = r2.form_id
              WHERE r2.id = ?`,
        args: [row.run_id],
      });
      for (const frow of fieldRes.rows) labels[String(frow.id)] = frow.label;
      const cNameRes = await db.execute({
        sql: "SELECT name, email FROM contacts WHERE cid = ?",
        args: [row.submitter_id],
      });
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

    let shouldSend = true;
    // Approval email requires a group (organizational context). With no
    // group, the person stays in the platform/CRM but no email is sent.
    if (decision === "approved") {
      try {
        const grpCheck = await db.execute({
          sql: `SELECT 1
                FROM platform_form_run_assignments a
                JOIN families f ON (a.target_id = f.registration_id OR a.target_id = CAST(f.id AS TEXT))
                WHERE a.run_id = ? AND a.target_type = 'group'
                LIMIT 1`,
          args: [row.run_id],
        });
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
      try {
        const runInfo2 = await db.execute({ sql: "SELECT r.form_id, f.settings FROM platform_form_runs r JOIN platform_forms f ON r.form_id = f.id WHERE r.id = ?", args: [row.run_id] });
        if (runInfo2.rows[0]) {
          const auto = (runInfo2.rows[0].settings || {}).automation;
          if (auto?.on_reject?.send_rejection_email === false) shouldSend = false;
        }
      } catch (_) {}
    }
    if (!shouldSend) return { status: "skipped", error: "Email disabled by form workflow settings", to: applicantEmail };

    // Gather template + score for variables
    let decisionTemplate = null;
    let templateVars = null;
    let score = null;
    try {
      const runInfo2 = await db.execute({ sql: "SELECT f.name, f.settings, r.settings AS run_settings FROM platform_form_runs r JOIN platform_forms f ON r.form_id = f.id WHERE r.id = ?", args: [row.run_id] });
      if (runInfo2.rows[0]) {
        const formName = runInfo2.rows[0].name || "";
        decisionTemplate = getTemplate(
          runInfo2.rows[0].settings || {},
          decision === "approved" ? "approval" : "rejection",
          runInfo2.rows[0].run_settings || {}
        );
        templateVars = { form_name: formName };
        try {
          const groupRes = await db.execute({
            sql: `SELECT f.name AS group_name
                  FROM platform_form_run_assignments a
                  JOIN families f ON (a.target_id = f.registration_id OR a.target_id = CAST(f.id AS TEXT))
                  WHERE a.run_id = ? AND a.target_type = 'group'
                  LIMIT 1`,
            args: [row.run_id],
          });
          if (groupRes.rows.length > 0) templateVars.group_name = groupRes.rows[0].group_name;
        } catch (_) {}
      }
      const evalRes = await db.execute({
        sql: "SELECT overall_score FROM platform_submission_evaluations WHERE submission_id = ? ORDER BY evaluated_at DESC LIMIT 1",
        args: [parseInt(submission_id)],
      });
      if (evalRes.rows.length > 0) score = evalRes.rows[0].overall_score;
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
  } catch (e) {
    console.error("[form-runs] Decision email error:", e);
    return { status: "failed", error: e?.message || "Email error" };
  }
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
 * Returns { ok: true, submission, already_approved? } or
 *         { ok: false, statusCode, error }.
 */
async function processReviewInternal({ submission_id, decision, comment, internal_note, dimension_overrides, force, session }) {
  // ── IDEMPOTENCY GUARD: never re-approve an already-approved submission ──
  // Manual override requires explicit force: true
  const existingSub = await db.execute({
    sql: "SELECT id, status FROM platform_form_submissions WHERE id = ?",
    args: [parseInt(submission_id)],
  });
  if (existingSub.rows.length === 0) {
    return { ok: false, statusCode: 404, error: "Submission not found" };
  }
  const prevStatus = existingSub.rows[0].status;
  if (prevStatus === "approved" && decision === "approved" && !force) {
    return { ok: true, already_approved: true, submission: existingSub.rows[0] };
  }

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

  // Send decision email to applicant — TRACKED (never sent twice)
  await sendDecisionEmailForSubmission({ submission_id, decision, comment: comment || "" });

  // Fire automation — get run details + form config for context
  const sub = await db.execute({ sql: "SELECT run_id FROM platform_form_submissions WHERE id = ?", args: [parseInt(submission_id)] });
  if (sub.rows.length > 0) {
    const runData = await db.execute({ sql: "SELECT * FROM platform_form_runs WHERE id = ?", args: [sub.rows[0].run_id] });
    let formData = null;
    if (runData.rows[0]) {
      const f = await db.execute({ sql: "SELECT * FROM platform_forms WHERE id = ?", args: [runData.rows[0].form_id] });
      formData = f.rows[0] || null;
    }

    // Record a PENDING activation email BEFORE firing the background task.
    // If the serverless function is terminated before `after()` completes,
    // this pending row remains visible in the Emails tab as retryable.
    if (decision === "approved") {
      try {
        const { recordEmailStatus } = await import("@/lib/email");
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
  }

  return { ok: true, submission: result.rows[0] };
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

    // ─── MANUAL ADD ACTION (super admin injects a test respondent) ───
    // Lets an admin add a person directly into a run so they can test the
    // full response flow (scoring, AI evaluation, review, activation email)
    // without waiting for a real applicant.
    if (action === "manual_add") {
      if (!session) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
      const authError = await requireAuth(["super_admin", "admin"]);
      if (authError) return authError;

      const { run_id, name, email, data, status: subStatus } = body;
      if (!run_id) return NextResponse.json({ success: false, error: "run_id is required" }, { status: 400 });

      const run = await db.execute({ sql: "SELECT * FROM platform_form_runs WHERE id = ?", args: [parseInt(run_id)] });
      if (run.rows.length === 0) return NextResponse.json({ success: false, error: "Run not found" }, { status: 404 });

      const cleanName = (name || "").trim();
      const cleanEmail = (email || "").trim().toLowerCase();

      // Resolve/ensure a real contact so the respondent's name + email flow
      // through scoring, review, and the approval/activation email pipeline.
      let submitterId = null;
      if (cleanEmail) {
        const existing = await db.execute({
          sql: "SELECT cid, name FROM contacts WHERE LOWER(email) = LOWER(?) AND deleted = 0 LIMIT 1",
          args: [cleanEmail],
        });
        if (existing.rows.length > 0) {
          submitterId = existing.rows[0].cid;
          if (cleanName && !existing.rows[0].name) {
            await db.execute({ sql: "UPDATE contacts SET name = ? WHERE cid = ?", args: [cleanName, submitterId] });
          }
        } else {
          submitterId = "USR_" + Math.random().toString(36).substring(2, 14).toUpperCase();
          await db.execute({
            sql: "INSERT INTO contacts (cid, name, email, role, status) VALUES (?, ?, ?, 'participant', 'approved')",
            args: [submitterId, cleanName || cleanEmail, cleanEmail],
          });
        }
      } else {
        submitterId = "manual_" + Math.random().toString(36).substring(2, 12);
      }

      const newStatus = subStatus || "submitted";

      let finalData = { ...(data || {}) };
      let shouldEvaluate = false;
      if (newStatus === "submitted") {
        const scores = await calculateSubmissionScores(run_id, finalData);
        if (scores) finalData._scores = scores;
        try {
          const { hasEvaluation } = await import("@/lib/platform/ai/evaluate");
          const runInfo = await db.execute({ sql: "SELECT form_id FROM platform_form_runs WHERE id = ?", args: [parseInt(run_id)] });
          if (runInfo.rows.length > 0) shouldEvaluate = await hasEvaluation(runInfo.rows[0].form_id);
        } catch (_) {}
      }

      const result = await db.execute({
        sql: `INSERT INTO platform_form_submissions (run_id, submitter_id, submitter_name, status, data, submitted_at)
              VALUES (?, ?, ?, ?, ?, CASE WHEN ? = 'submitted' THEN NOW() ELSE NULL END) RETURNING *`,
        args: [parseInt(run_id), submitterId, cleanName || null, newStatus, JSON.stringify(finalData), newStatus],
      });
      logTimeline(result.rows[0].id, newStatus === "draft" ? "started" : "submitted", session.cid, cleanName || null);

      if (newStatus !== "draft") {
        const runRow = run.rows[0];
        let formRow = null;
        if (runRow) {
          const f = await db.execute({ sql: "SELECT * FROM platform_forms WHERE id = ?", args: [runRow.form_id] });
          formRow = f.rows[0] || null;
        }
        onSubmission(result.rows[0], runRow || { id: parseInt(run_id) }, formRow, session);
        if (shouldEvaluate) {
          const subId = result.rows[0].id;
          try {
            const { evaluateSubmission } = await import("@/lib/platform/ai/evaluate");
            await evaluateSubmission(subId);
            logTimeline(subId, "ai_evaluated", "system", "System", {});
          } catch (e) {
            console.error("[form-runs] AI eval failed for manual submission", subId, ":", e.message);
            logTimeline(subId, "ai_eval_failed", "system", "System", { error: e.message });
          }
        }
      }

      return NextResponse.json({ success: true, submission: result.rows[0] });
    }

    // ─── REVIEW ACTION ───
    if (action === "review") {
      if (!session) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
      const authError = await requireAuth(["super_admin", "admin", "program_manager", "teacher"]);
      if (authError) return authError;

      const { submission_id, decision, comment, internal_note, dimension_overrides, force } = body;
      if (!submission_id || !decision) return NextResponse.json({ success: false, error: "submission_id and decision required" }, { status: 400 });

      const res = await processReviewInternal({
        submission_id: parseInt(submission_id),
        decision,
        comment,
        internal_note,
        dimension_overrides,
        force,
        session,
      });
      if (!res.ok) {
        return NextResponse.json({ success: false, error: res.error }, { status: res.statusCode || 500 });
      }
      if (res.already_approved) {
        return NextResponse.json({
          success: true,
          already_approved: true,
          submission: res.submission,
          message: "Submission already approved — no duplicate actions performed",
        });
      }
      return NextResponse.json({ success: true, submission: res.submission });
    }

    // ─── BULK REVIEW ACTION ───
    // A controlled extension of the individual review workflow: each selected
    // respondent goes through processReviewInternal (status, approval email,
    // activation/access automation, idempotency) — no parallel logic.
    if (action === "bulk_review") {
      if (!session) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
      const authError = await requireAuth(["super_admin", "admin"]);
      if (authError) return authError;

      const { run_id, submission_ids, decision, comment } = body;
      if (!run_id || !Array.isArray(submission_ids) || submission_ids.length === 0) {
        return NextResponse.json({ success: false, error: "run_id and submission_ids are required" }, { status: 400 });
      }
      if (submission_ids.length > 25) {
        return NextResponse.json({ success: false, error: "A bulk batch can process at most 25 submissions" }, { status: 400 });
      }
      if (decision !== "approved") {
        return NextResponse.json({ success: false, error: "Only 'approved' is supported as a bulk action right now" }, { status: 400 });
      }

      const idList = [...new Set(submission_ids.map((id) => parseInt(id)).filter((n) => Number.isFinite(n)))];
      if (idList.length === 0) {
        return NextResponse.json({ success: false, error: "No valid submission ids provided" }, { status: 400 });
      }

      // Backend validation: every id must belong to THIS run — the frontend
      // selection state is never trusted alone.
      const valRes = await db.execute({
        sql: `SELECT id, status, submitter_name FROM platform_form_submissions WHERE id = ANY(?) AND run_id = ?`,
        args: [idList, parseInt(run_id)],
      });
      const validMap = new Map(valRes.rows.map((r) => [r.id, r]));

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
          const res = await processReviewInternal({
            submission_id: id,
            decision: "approved",
            comment: comment || "Bulk approved",
            session,
          });
          results.push({
            submission_id: id,
            status: res.ok ? (res.already_approved ? "already_approved" : "approved") : "failed",
            name: row.submitter_name || "",
            error: res.ok ? undefined : res.error,
          });
        } catch (e) {
          results.push({
            submission_id: id,
            status: "failed",
            name: row.submitter_name || "",
            error: e?.message || "Unknown error",
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
      const authError = await requireAuth(["super_admin", "admin"]);
      if (authError) return authError;

      const { run_id, retries } = body;
      if (!run_id || !Array.isArray(retries) || retries.length === 0) {
        return NextResponse.json({ success: false, error: "run_id and retries are required" }, { status: 400 });
      }

      if (!retries.every((r) => r && Number.isFinite(parseInt(r.submission_id)) && typeof r.email_type === "string")) {
        return NextResponse.json({ success: false, error: "Each retry needs submission_id and email_type" }, { status: 400 });
      }

      // Backend validation: every submission must belong to THIS run.
      const idList = [...new Set(retries.map((r) => parseInt(r.submission_id)))];
      const valRes = await db.execute({
        sql: `SELECT id, submitter_name FROM platform_form_submissions WHERE id = ANY(?) AND run_id = ?`,
        args: [idList, parseInt(run_id)],
      });
      const validMap = new Map(valRes.rows.map((r) => [r.id, r]));

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
          const r = await sendDecisionEmailForSubmission({
            submission_id: id,
            decision: type === "approval" ? "approved" : "rejected",
            comment: "",
          });
          results.push({ submission_id: id, email_type: type, name, status: r.status, error: r.error, to: r.to });
        } else if (type === "activation") {
          try {
            const sub = await db.execute({ sql: "SELECT * FROM platform_form_submissions WHERE id = ?", args: [id] });
            const runData = await db.execute({ sql: "SELECT * FROM platform_form_runs WHERE id = ?", args: [sub.rows[0]?.run_id] });
            let formData = null;
            if (runData.rows[0]) {
              const f = await db.execute({ sql: "SELECT * FROM platform_forms WHERE id = ?", args: [runData.rows[0].form_id] });
              formData = f.rows[0] || null;
            }
            await onReview(
              { id: null, submission_id: id, decision: "approved", comment: "Manual email retry", reviewer_name: session.cid },
              sub.rows[0],
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
          } catch (e) {
            results.push({ submission_id: id, email_type: "activation", name, status: "failed", error: e?.message || "Retry error" });
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
      const authError = await requireAuth(["super_admin", "admin"]);
      if (authError) return authError;

      const { run_id, items } = body;
      if (!run_id || !Array.isArray(items) || items.length === 0) {
        return NextResponse.json({ success: false, error: "run_id and items are required" }, { status: 400 });
      }
      if (items.length > 100) {
        return NextResponse.json({ success: false, error: "A cancel batch can process at most 100 items" }, { status: 400 });
      }

      const idList = [...new Set(items.map((r) => parseInt(r?.submission_id)).filter((n) => Number.isFinite(n)))];
      const valRes = await db.execute({
        sql: `SELECT id FROM platform_form_submissions WHERE id = ANY(?) AND run_id = ?`,
        args: [idList, parseInt(run_id)],
      });
      const validSet = new Set(valRes.rows.map((r) => r.id));

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

      // Accept either the legacy single target (target_type + target_id) or a
      // list of targets so one action can assign a run to multiple audiences
      // (e.g. Program AND Group) in a single request.
      const { run_id, target_type, target_id, targets } = body;
      const ALLOWED_TARGET_TYPES = ["user", "group", "program", "cohort", "team", "organization", "all"];
      const list = Array.isArray(targets)
        ? targets
        : [{ target_type: target_type || "user", target_id }];
      const valid = list.filter(
        (t) => t && ALLOWED_TARGET_TYPES.includes(t.target_type) && t.target_id,
      );
      if (!run_id || valid.length === 0) {
        return NextResponse.json({ success: false, error: "run_id and target required" }, { status: 400 });
      }

      const runId = parseInt(run_id);
      let added = 0;
      let skipped = 0;
      const createdTargets = [];
      for (const t of valid) {
        const insertRes = await db.execute({
          sql: "INSERT INTO platform_form_run_assignments (run_id, target_type, target_id, assigned_by) VALUES (?, ?, ?, ?) ON CONFLICT (run_id, target_type, target_id) DO NOTHING",
          args: [runId, t.target_type, t.target_id, session.cid],
        });
        if (insertRes.rowsAffected > 0) {
          added++;
          createdTargets.push({ target_type: t.target_type, target_id: t.target_id });
        } else {
          skipped++;
        }
      }

      const assignments = await db.execute({ sql: "SELECT * FROM platform_form_run_assignments WHERE run_id = ?", args: [runId] });
      // Fire automation for each newly created assignment
      const fullRun = await db.execute({ sql: "SELECT * FROM platform_form_runs WHERE id = ?", args: [runId] });
      for (const t of createdTargets) {
        onAssignmentAdded(t, fullRun.rows[0] || { id: runId });
      }
      return NextResponse.json({ success: true, added, skipped, assignments: await enrichAssignments(assignments.rows) });
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
        return NextResponse.json({ success: true, assignments: await enrichAssignments(assignments.rows) });
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

    // ─── SEND MANUAL MESSAGE ACTION (Room Overview → selected participants) ───
    if (action === "send_manual_message") {
      if (!session) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
      const authError = await requireAuth(["super_admin", "admin", "program_manager"]);
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
      const idList = [...new Set(submission_ids.map((id) => parseInt(id)).filter((n) => Number.isFinite(n)))];
      const valRes = await db.execute({
        sql: `SELECT * FROM platform_form_submissions WHERE id = ANY(?) AND run_id = ?`,
        args: [idList, parseInt(run_id)],
      });
      const validMap = new Map(valRes.rows.map((r) => [r.id, r]));

      // Fetch the form's field labels once for identity resolution.
      let fieldLabels = {};
      try {
        const flRes = await db.execute({
          sql: `SELECT f2.id, f2.label FROM platform_form_fields f2 JOIN platform_form_runs r2 ON f2.form_id = r2.form_id WHERE r2.id = ?`,
          args: [parseInt(run_id)],
        });
        for (const frow of flRes.rows) fieldLabels[String(frow.id)] = frow.label;
      } catch (_) {}

      let groupName = null;
      try {
        const grpRes = await db.execute({
          sql: `SELECT f.name FROM platform_form_run_assignments a JOIN families f ON (a.target_id = f.registration_id OR a.target_id = CAST(f.id AS TEXT)) WHERE a.run_id = ? AND a.target_type = 'group' LIMIT 1`,
          args: [parseInt(run_id)],
        });
        if (grpRes.rows.length > 0) groupName = grpRes.rows[0].name;
      } catch (_) {}

      const { sendManualMessage, resolveSubmissionEmail, resolvePersonName, isPlaceholderEmail } = await import("@/lib/email");

      const results = [];
      let sent = 0;
      let failed = 0;

      for (const id of idList) {
        const sub = validMap.get(id);
        if (!sub) {
          results.push({ submission_id: id, status: "failed", error: "Submission is not in this run" });
          failed++;
          continue;
        }

        const subData = sub.data || {};
        const contactEmail = resolveSubmissionEmail({ submissionData: subData, fieldLabels, contactEmail: "" });
        if (!contactEmail || isPlaceholderEmail(contactEmail)) {
          results.push({ submission_id: id, name: sub.submitter_name || "", status: "failed", error: "No usable recipient email" });
          failed++;
          continue;
        }

        const name = resolvePersonName({
          contactName: "",
          submitterName: sub.submitter_name || "",
          submissionData: subData,
          fieldLabels,
        }) || sub.submitter_name || "Participant";

        const res = await sendManualMessage({
          to: contactEmail,
          name,
          subject,
          body: messageBody,
          submission_id: id,
          contact_cid: sub.submitter_id || null,
          batch_id: batchId,
          templateVars: {
            form_name: "",
            group_name: groupName || "",
          },
        });

        if (res.success) {
          sent++;
          results.push({ submission_id: id, name, status: "sent", to: contactEmail });
        } else {
          failed++;
          results.push({ submission_id: id, name, status: "failed", error: res.error || "Send failed", to: contactEmail });
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
      const authError = await requireAuth(["super_admin", "admin", "program_manager"]);
      if (authError) return authError;

      const { run_id, submission_ids, force } = body;
      if (!run_id || !Array.isArray(submission_ids) || submission_ids.length === 0) {
        return NextResponse.json({ success: false, error: "run_id and submission_ids are required" }, { status: 400 });
      }
      const forceResend = force === true || force === 1 || force === "true" || force === "1";


      // Backend validation: every submission must belong to THIS run.
      const idList = [...new Set(submission_ids.map((id) => parseInt(id)))];
      const valRes = await db.execute({
        sql: `SELECT * FROM platform_form_submissions WHERE id = ANY(?) AND run_id = ?`,
        args: [idList, parseInt(run_id)],
      });
      const validMap = new Map(valRes.rows.map((r) => [r.id, r]));

      const { getEmailLogRow } = await import("@/lib/email");
      const results = [];
      for (const id of idList) {
        const sub = validMap.get(id);
        if (!sub) {
          results.push({ submission_id: id, name: "", status: "failed", error: "Submission is not in this run" });
          continue;
        }
        const name = sub.submitter_name || "";
        if (String(sub.status || "").toLowerCase() !== "approved") {
          results.push({ submission_id: id, name, status: "skipped", error: "Submission is not approved" });
          continue;
        }

        const logRow = await getEmailLogRow(id, "activation");
        if (!forceResend && logRow && logRow.status === "sent") {
          results.push({ submission_id: id, name, status: "already_sent", error: "Activation email already sent" });
          continue;
        }

        try {
          const runData = await db.execute({ sql: "SELECT * FROM platform_form_runs WHERE id = ?", args: [sub.run_id] });
          let formData = null;
          if (runData.rows[0]) {
            const f = await db.execute({ sql: "SELECT * FROM platform_forms WHERE id = ?", args: [runData.rows[0].form_id] });
            formData = f.rows[0] || null;
          }
          // Force resend bypasses the once-per-submission dedup so an admin can
          // issue a fresh activation link after the previous 48h link expired.
          const reviewSubmission = forceResend ? { ...sub, _forceActivationResend: true } : sub;
          await onReview(
            { id: null, submission_id: id, decision: "approved", comment: forceResend ? "Manual activation resend" : "Manual activation send", reviewer_name: session.cid },
            reviewSubmission,
            runData.rows[0] || null,
            session,
            formData
          );
          const after = await getEmailLogRow(id, "activation");
          results.push({
            submission_id: id,
            name,
            status: after?.status === "sent" ? "sent" : after?.status === "failed" ? "failed" : "skipped",
            error: after?.status === "failed" ? (after.error || "Activation email failed") : undefined,
            to: after?.recipient,
          });
        } catch (e) {
          results.push({ submission_id: id, name, status: "failed", error: e?.message || "Activation send error" });
        }
      }

      return NextResponse.json({ success: true, results });
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
