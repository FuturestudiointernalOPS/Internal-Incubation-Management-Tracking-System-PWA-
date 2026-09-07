import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { after } from "next/server";
import { requireAuth } from "@/lib/auth";
import { sendDecisionEmail, getTemplate, resolvePersonName, resolveSubmissionEmail, recordEmailStatus, isGenericName, isPlaceholderEmail, hasSentEmailToRecipientInRun, detectLanguage, getEmailLogRow } from "@/lib/email";
import { onSubmission, onReview, onRunCreated, onRunLaunched, onAssignmentAdded } from "@/lib/platform/automation";
import { syncApprovedSubmissionToProgramGroup } from "@/lib/contact-group-sync";
import {
  insertTimelineEntry,
  getContactsForAssignmentEnrichment,
  getFamiliesForAssignmentEnrichment,
  getProgramsForAssignmentEnrichment,
  getRunScoringSettingsById,
  getFormScoringSettingsById,
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
  getRunDetailWithGroupTargetById,
  getAssignmentsByRunId,
  getSubmissionsByRunId,
  getReviewsByRunId,
  getLatestEvaluationsByRunId,
  getLatestEmailsByRunId,
  getActivationEmailLogsByRunId,
  getFormFieldsForRunById,
  getContactsByCids,
  getContactsByLowerEmails,
  getPasswordTokensByContactCids,
  getSubmissionsBySubmitterId,
  countFormRuns,
  listFormRuns,
  getDecisionEmailSubmissionById,
  getFieldLabelsByRunId,
  getContactNameEmailByCid,
  getGroupAssignedToRunById,
  getRunFormSettingsForDecisionById,
  getRunTemplateSettingsForDecisionById,
  getGroupNameForDecisionEmailByRunId,
  getLatestScoreBySubmissionId,
  getRunFormContextBySubmissionId,
  getLatestEvaluationBySubmissionId,
  getSubmissionReviewStateById,
  getReviewerNameByCid,
  createSubmissionReview,
  getLatestEvaluationForOverridesBySubmissionId,
  updateEvaluationDimensionsById,
  updateSubmissionStatusById,
  getSubmissionRunIdById,
  getRunDataForReviewAutomationById,
  getFormById,
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
  executeRawMigrationSql,
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

import { getPlatformFormSections, getPlatformFormFields } from "@/models/forms";

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
  insertTimelineEntry(submissionId, action, actorId, actorName, meta).catch(() => {});
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
      const res = await getContactsForAssignmentEnrichment(userIds, emails);
      for (const row of res.rows) {
        userMap.set(row.cid, row);
        if (row.email) userMap.set(String(row.email).toLowerCase(), row);
      }
    } catch (_) {}
  }

  const groupIds = byType('group');
  if (groupIds.length > 0) {
    try {
      const res = await getFamiliesForAssignmentEnrichment(groupIds);
      for (const row of res.rows) {
        if (row.registration_id) groupMap.set(row.registration_id, row);
        groupMap.set(String(row.id), row);
      }
    } catch (_) {}
  }

  const programIds = byType('program');
  if (programIds.length > 0) {
    try {
      const res = await getProgramsForAssignmentEnrichment(programIds);
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
    const run = await getRunScoringSettingsById(runId);
    if (run.rows.length === 0) return null;

    // Check run-level scoring config first, then fall back to form-level
    const runSettings = run.rows[0].settings || {};
    let scoring = runSettings.scoring;

    if (!scoring || !scoring.enabled) {
      const form = await getFormScoringSettingsById(run.rows[0].form_id);
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

      const sub = await getSubmissionById(submissionId);
      if (sub.rows.length === 0) return NextResponse.json({ success: false, error: "Submission not found" }, { status: 404 });

      const run = await getRunById(sub.rows[0].run_id);

      const reviews = await getSubmissionReviewsBySubmissionId(submissionId);

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
      const subs = await getMySubmissionsBySubmitterId(session.cid);
      return NextResponse.json({ success: true, submissions: subs.rows });
    }

    // ─── PARTICIPANT: Get single run (for filling forms, returns user's own submission) ───
    if (id && searchParams.get("participant") === "true") {
      const run = await getParticipantRunById(id);
      if (run.rows.length === 0) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });
      const { getSession } = await import("@/lib/auth");
      const session = await getSession();
      if (!session) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
      const mySub = await getParticipantSubmissionByRunAndSubmitter(id, session.cid);
      return NextResponse.json({ success: true, run: run.rows[0], submission: mySub.rows[0] || null });
    }

    const authError = await requireAuth(["super_admin", "admin", "staff", "program_manager"]);
    if (authError) return authError;

    // ─── TIMELINE for a specific submission ───
    if (timeline) {
      const entries = await getTimelineBySubmissionId(timeline);
      return NextResponse.json({ success: true, timeline: entries.rows });
    }

    // ─── DASHBOARD STATS ───
    if (searchParams.get("dashboard") === "true") {
      const [active, assigned, subs, pending, approved, overdue] = await Promise.all([
        countActiveRuns(),
        countTotalAssignments(),
        countNonDraftSubmissions(),
        countSubmittedSubmissions(),
        countApprovedSubmissions(),
        countOverdueSubmissions(),
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

      const sub = await getScoringSubmissionById(submissionId);
      if (sub.rows.length === 0) return NextResponse.json({ success: false, error: "Submission not found" }, { status: 404 });

      const submission = sub.rows[0];
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
          const form = await getFormScoringConfigById(run.rows[0].form_id);
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
      const run = await getRunDetailWithGroupTargetById(id);
      if (run.rows.length === 0) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });

      const assignments = await getAssignmentsByRunId(id);
      const submissions = await getSubmissionsByRunId(id);
      const reviews = await getReviewsByRunId(id);

      // AI evaluation rows (latest per submission) so the Responses table can
      // show stored scores/rankings without loading each submission individually.
      let evaluations = [];
      try {
        const evalRes = await getLatestEvaluationsByRunId(id);
        evaluations = evalRes.rows;
      } catch (_) {}

      // Email delivery log so the Responses table can show activation-email state.
      let emails = [];
      try {
        const emailRes = await getLatestEmailsByRunId(id);
        emails = emailRes.rows;
      } catch (_) {}

      // Full activation email history for the run (ALL rows, not just latest)
      // so first/last sent timestamps can be surfaced per submission.
      let activationLogs = [];
      try {
        const actRes = await getActivationEmailLogsByRunId(id);
        activationLogs = actRes.rows;
      } catch (_) {}

      // ── Run-scoped respondent enrichment: emails + dynamic filter fields ──
      const formIdOfRun = run.rows[0].form_id;

      let fieldLabels = {};
      let filterableFields = [];
      try {
        const fRes = await getFormFieldsForRunById(formIdOfRun);
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
          const cres = await getContactsByCids(cids);
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
          const cres = await getContactsByLowerEmails(emailKeys);
          for (const row of cres.rows) {
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
        const contactCids = [...new Set([...accountMap.values()].map((c) => c.cid).filter(Boolean))];
        if (contactCids.length > 0) {
          const tokRes = await getPasswordTokensByContactCids(contactCids);
          for (const t of tokRes.rows) {
            if (!tokenByCid.has(t.contact_cid)) tokenByCid.set(t.contact_cid, t);
          }
        }
      } catch (_) {}

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

        // Activation history from the REAL email log + token state (first/last
        // sent, link validity) — the source of truth for Send vs Resend.
        const actRows = activationLogs.filter((l) => l.submission_id === s.id);
        const sentAct = actRows.filter((r) => r.status === "sent");
        const token = contactRow ? tokenByCid.get(contactRow.cid) : null;
        const token_valid = !!(token && Number(token.used) === 0 && new Date(token.expires_at) > new Date());
        return {
          ...s,
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

      return NextResponse.json({ success: true, run: run.rows[0], assignments: await enrichAssignments(assignments.rows), submissions: enrichedSubmissions, reviews: reviews.rows, evaluations, emails, field_labels: fieldLabels, filterable_fields: filterableFields });
    }

    // Submissions for a specific user
    if (submitterId) {
      const subs = await getSubmissionsBySubmitterId(submitterId);
      return NextResponse.json({ success: true, submissions: subs.rows });
    }

    // List all runs (optionally filtered by group_id or program_id), paginated server-side.
    const groupId = searchParams.get("group_id");
    const programId = searchParams.get("program_id");
    const page = Math.max(1, parseInt(searchParams.get("page")) || 1);
    const perPage = Math.max(1, parseInt(searchParams.get("per_page")) || 50);
    const offset = (page - 1) * perPage;

    const countRes = await countFormRuns({ groupId, programId, formId, status });
    const total = parseInt(countRes.rows[0]?.total) || 0;

    const result = await listFormRuns({ groupId, programId, formId, status, perPage, offset });

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
  const subRes = await getDecisionEmailSubmissionById(submission_id);
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
      const fieldRes = await getFieldLabelsByRunId(row.run_id);
      for (const frow of fieldRes.rows) labels[String(frow.id)] = frow.label;
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

    let shouldSend = true;
    // Approval email requires a group (organizational context). With no
    // group, the person stays in the platform/CRM but no email is sent.
    if (decision === "approved") {
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
      try {
        const runInfo2 = await getRunFormSettingsForDecisionById(row.run_id);
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
      const runInfo2 = await getRunTemplateSettingsForDecisionById(row.run_id);
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
      const evalRes = await getLatestScoreBySubmissionId(submission_id);
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

/** Render one submission answer value for the result PDF (phone JSON → text). */
function formatResultAnswer(value) {
  if (value === undefined || value === null || value === "") return "";
  if (typeof value === "string") {
    const t = value.trim();
    if (t.startsWith("{") && t.includes('"code"')) {
      try {
        const p = JSON.parse(t);
        if (p.code && p.number) return `${p.code} ${p.number}`;
      } catch (_) {}
    }
    return t;
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
 * Send the participant-facing RESULT email (PDF attachment) for a submission.
 * The PDF contains the applicant's answers, the evaluation feedback and the
 * final score. The copy and the document never reference how the evaluation
 * was produced — the applicant must not learn an automated evaluation ran.
 *
 * Recipient/name resolution follows the SAME chain as the decision email so
 * the UI and the sender can never disagree; the send is tracked exactly once
 * per submission (email_type "result") and respects the per-run
 * duplicate-recipient guard used by the other workflow emails.
 *
 * Returns { status: "sent"|"already_sent"|"skipped"|"failed"|"not_found", error?, to? }.
 */
async function sendResultEmailForSubmission({ submission_id }) {
  const subRes = await getDecisionEmailSubmissionById(submission_id);
  if (subRes.rows.length === 0) return { status: "not_found", error: "Submission not found" };
  const row = subRes.rows[0];

  if (String(row.status || "") === "draft") {
    return { status: "failed", error: "Cannot send a result for a draft submission" };
  }

  let ctx = null;
  try {
    const ctxRes = await getRunFormContextBySubmissionId(submission_id);
    ctx = ctxRes.rows[0] || null;
  } catch (_) {}

  // A result document requires an evaluation (dimensions + overall score).
  const evalRes = await getLatestEvaluationBySubmissionId(submission_id);
  if (evalRes.rows.length === 0) {
    return { status: "failed", error: "This submission has not been evaluated yet — run the evaluation first" };
  }
  const evalRow = evalRes.rows[0];
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
      const fieldRes = await getFieldLabelsByRunId(row.run_id);
      for (const frow of fieldRes.rows) labels[String(frow.id)] = frow.label;
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

    // Best real name — resolved deterministically with the form's actual
    // question labels (submission data is keyed by field id).
    const applicantName = resolvePersonName({
      contactName: crmName,
      submitterName: row.submitter_name || "",
      submissionData: subData,
      fieldLabels: labels,
    });

    // Workflow language from the form's question labels (FR forms get a
    // French document + email, EN forms an English one).
    const lang = detectLanguage(labels);
    const formName = ctx?.form_name || "";
    const runName = ctx?.run_name || "";

    // ── Answers: rebuild the form Q&A in section order ──
    let sectionsRows = [];
    let fieldRows = [];
    if (ctx?.form_id) {
      try {
        const secRes = await getPlatformFormSections(ctx.form_id);
        sectionsRows = secRes.rows || [];
        const fldRes = await getPlatformFormFields(ctx.form_id);
        fieldRows = fldRes.rows || [];
      } catch (_) {}
    }
    const isHidden = (f) => String(f.field_type || "") === "hidden";
    const getVal = (f) => subData[f.label] ?? subData[String(f.id)] ?? subData[f.id];

    const sections = [];
    const matchedKeys = new Set();
    for (const sec of sectionsRows) {
      const items = [];
      for (const f of fieldRows) {
        if (String(f.section_id) !== String(sec.id)) continue;
        if (isHidden(f)) continue;
        const value = formatResultAnswer(getVal(f));
        if (value === "") continue;
        matchedKeys.add(String(f.id));
        if (f.label) matchedKeys.add(f.label);
        items.push({ label: f.label || String(f.id), value });
      }
      if (items.length > 0) sections.push({ title: sec.title, items });
    }

    // Fields without any section (older forms) → one flat group.
    const looseItems = [];
    for (const f of fieldRows) {
      if (sectionsRows.some((s) => String(s.id) === String(f.section_id))) continue;
      if (isHidden(f)) continue;
      const value = formatResultAnswer(getVal(f));
      if (value === "") continue;
      matchedKeys.add(String(f.id));
      if (f.label) matchedKeys.add(f.label);
      looseItems.push({ label: f.label || String(f.id), value });
    }
    if (looseItems.length > 0) sections.push({ title: null, items: looseItems });

    // Unmatched data keys (imported submissions may store answers under keys
    // that no longer map to a form field) — still part of the response.
    const unmatchedItems = Object.entries(subData)
      .filter(([k]) => !String(k).startsWith("_"))
      .filter(([k, v]) => !matchedKeys.has(String(k)) && formatResultAnswer(v) !== "")
      .map(([k, v]) => ({ label: k, value: formatResultAnswer(v) }));
    if (unmatchedItems.length > 0) sections.push({ title: null, items: unmatchedItems });

    // ── Evaluation: final dimension scores + feedback for the PDF ──
    // Weighted recompute mirrors the review page: human overrides (final_score)
    // are the source of truth when present.
    const totalWeight = rawDims.reduce((s, d) => s + (d.weight ?? 1), 0);
    const weighted = rawDims.reduce((s, d) => s + ((d.final_score ?? d.score ?? 0) * (d.weight ?? 1)), 0);
    const finalScore = rawDims.length > 0 && totalWeight > 0
      ? Math.round((weighted / totalWeight) * 10)
      : evalRow.overall_score;
    const dimensions = rawDims
      .map((d) => {
        const humanComment = typeof d.human_comment === "string" ? d.human_comment.trim() : "";
        const reasoning = typeof d.reasoning === "string" ? d.reasoning.trim() : "";
        return {
          name: d.name,
          score: d.final_score ?? d.score ?? null,
          feedback: humanComment || reasoning,
          strengths: Array.isArray(d.strengths) ? d.strengths.map((s) => String(s)) : [],
          improvements: Array.isArray(d.weaknesses) ? d.weaknesses.map((s) => String(s)) : [],
        };
      })
      .filter((d) => d.name);

    // ── Outcome: only when a real decision exists (approved/rejected/revision) ──
    let outcome = null;
    if (["approved", "rejected", "revision_requested"].includes(row.status)) {
      let comment = "";
      try {
        const revRes = await getSubmissionReviewsBySubmissionId(submission_id);
        const latest = revRes.rows[0];
        if (latest && typeof latest.comment === "string") comment = latest.comment;
      } catch (_) {}
      outcome = { decision: row.status, comment };
    }

    // ── Build the PDF + send it (tracked, once per submission) ──
    const { buildSubmissionResultPdf } = await import("@/models/platform/resultPdf");
    const pdfBytes = buildSubmissionResultPdf({
      lang,
      formName,
      runName,
      applicantName: applicantName || "",
      submittedAt: row.submitted_at || row.updated_at || null,
      finalScore: finalScore != null ? Number(finalScore) : 0,
      ranking: evalRow.ranking || "",
      outcome,
      dimensions,
      sections,
    });

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
          formName,
          runName,
          pdfBuffer: pdfBytes,
          lang,
          runId: row.run_id,
          submissionId: parseInt(submission_id),
        }),
    });
    if (tracked.success) {
      logTimeline(parseInt(submission_id), "email_sent", "system", "System", { to: applicantEmail, email_type: "result" });
      return { status: "sent", to: applicantEmail };
    }
    if (tracked.skipped) return { status: "already_sent", to: applicantEmail };
    logTimeline(parseInt(submission_id), "email_failed", "system", "System", { to: applicantEmail, email_type: "result" });
    return { status: "failed", error: tracked.error || "Email send failed", to: applicantEmail };
  } catch (e) {
    console.error("[form-runs] Result email error:", e);
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
  const existingSub = await getSubmissionReviewStateById(submission_id);
  if (existingSub.rows.length === 0) {
    return { ok: false, statusCode: 404, error: "Submission not found" };
  }
  const prevStatus = existingSub.rows[0].status;
  if (prevStatus === "approved" && decision === "approved" && !force) {
    return { ok: true, already_approved: true, submission: existingSub.rows[0] };
  }

  let reviewerName = session.cid;
  try {
    const r = await getReviewerNameByCid(session.cid);
    if (r.rows.length) reviewerName = r.rows[0].name;
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
      const evalRes = await getLatestEvaluationForOverridesBySubmissionId(submission_id);
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

  // Fire automation — get run details + form config for context
  const sub = await getSubmissionRunIdById(submission_id);
  if (sub.rows.length > 0) {
    const runData = await getRunDataForReviewAutomationById(sub.rows[0].run_id);
    let formData = null;
    if (runData.rows[0]) {
      const f = await getFormById(runData.rows[0].form_id);
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
      if (run.rows[0].closes_at && new Date(run.rows[0].closes_at) < new Date()) {
        return NextResponse.json({ success: false, error: "Submission deadline has passed" }, { status: 400 });
      }

      // Check if already submitted
      const existing = await findExistingSubmissionIdForRunAndSubmitter(run_id, session.cid);

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
          const runInfo = await getRunFormIdForEvaluationById(run_id);
          if (runInfo.rows.length > 0) shouldEvaluate = await hasEvaluation(runInfo.rows[0].form_id);
        } catch (_) {}
      }

      if (existing.rows.length > 0) {
        const cur = await getSubmissionCurrentStatusById(existing.rows[0].id);
        // Don't allow overwriting approved/rejected submissions
        if (cur.rows[0] && (cur.rows[0].status === "approved" || cur.rows[0].status === "rejected")) {
          return NextResponse.json({ success: false, error: "Cannot modify an already decided submission" }, { status: 400 });
        }
        const result = await updateSubmissionContentAndStatusById({
          submissionId: existing.rows[0].id,
          data: finalData,
          status: newStatus,
        });
        logTimeline(existing.rows[0].id, newStatus === "draft" ? "draft_saved" : "submitted", session.cid, null);
        // Fire automation
        if (newStatus !== "draft") {
          const fullRun = await getFullRunForSubmissionAutomationById(run_id);
          const runRow = fullRun.rows[0];
          let formRow = null;
          if (runRow) {
            const f = await getFormForSubmissionAutomationById(runRow.form_id);
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
            const f = await getFormForInsertSubmissionAutomationById(runRow.form_id);
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

    // ─── MANUAL ADD ACTION (super admin injects a respondent) ───
    // Lets an admin add a person directly into a run. The submission is created
    // as "approved" by default so the person is immediately eligible for an
    // activation/join email. Pass status:'submitted' (or 'draft') explicitly to
    // exercise the full scoring/review flow when testing.
    if (action === "manual_add") {
      if (!session) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
      const authError = await requireAuth(["super_admin", "admin"]);
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
      let shouldEvaluate = false;
      if (newStatus === "submitted") {
        const scores = await calculateSubmissionScores(run_id, finalData);
        if (scores) finalData._scores = scores;
        try {
          const { hasEvaluation } = await import("@/lib/platform/ai/evaluate");
          const runInfo = await getRunFormIdForManualEvaluationById(run_id);
          if (runInfo.rows.length > 0) shouldEvaluate = await hasEvaluation(runInfo.rows[0].form_id);
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
          const f = await getFormForManualAddAutomationById(runRow.form_id);
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
      const valRes = await getBulkReviewValidationsByIdsInRun(idList, run_id);
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
      const valRes = await getRetryEmailValidationsByIdsInRun(idList, run_id);
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
        } else if (type === "result") {
          const r = await sendResultEmailForSubmission({ submission_id: id });
          results.push({ submission_id: id, email_type: type, name, status: r.status, error: r.error, to: r.to });
        } else if (type === "activation") {
          try {
            const sub = await getSubmissionForActivationRetryById(id);
            const runData = await getRunDataForActivationRetryById(sub.rows[0]?.run_id);
            let formData = null;
            if (runData.rows[0]) {
              const f = await getFormForActivationRetryById(runData.rows[0].form_id);
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
      const valRes = await getCancelledBatchSubmissionIdsInRun(idList, run_id);
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
        const insertRes = await insertRunAssignmentForAction({
          runId,
          targetType: t.target_type,
          targetId: t.target_id,
          assignedBy: session.cid,
        });
        if (insertRes.rowsAffected > 0) {
          added++;
          createdTargets.push({ target_type: t.target_type, target_id: t.target_id });
        } else {
          skipped++;
        }
      }

      const assignments = await getAssignmentsAfterAssignByRunId(runId);
      // Fire automation for each newly created assignment
      const fullRun = await getFullRunAfterAssignById(runId);
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

      const a = await getRunIdByAssignmentId(assignment_id);
      const runId = a.rows[0]?.run_id;

      await deleteAssignmentById(assignment_id);

      if (runId) {
        const assignments = await getAssignmentsAfterUnassignByRunId(runId);
        return NextResponse.json({ success: true, assignments: await enrichAssignments(assignments.rows) });
      }
      return NextResponse.json({ success: true, assignments: [] });
    }

    // ─── SEND RESULT EMAIL ACTION (per submission → PDF response) ───
    // Emails the applicant a PDF with their answers, the evaluation feedback
    // and their final score. Tracked once per submission; the per-row button
    // also re-attempts failed sends. The PDF/copy never mention AI.
    if (action === "send_result_email") {
      if (!session) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
      const authError = await requireAuth(["super_admin", "admin", "program_manager", "teacher"]);
      if (authError) return authError;

      const { submission_id } = body;
      if (!submission_id) return NextResponse.json({ success: false, error: "submission_id required" }, { status: 400 });

      const r = await sendResultEmailForSubmission({ submission_id });
      if (r.status === "sent") {
        return NextResponse.json({ success: true, status: "sent", message: "Result email sent", to: r.to });
      }
      if (r.status === "already_sent") {
        return NextResponse.json({ success: true, status: "already_sent", message: "Result email already sent", to: r.to });
      }
      return NextResponse.json({ success: false, status: r.status || "failed", error: r.error || "Could not send the result email", to: r.to || null }, { status: r.status === "not_found" ? 404 : 200 });
    }

    // ─── DELETE SUBMISSION ACTION (super admin only) ───
    if (action === "delete_submission") {
      if (!session) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
      const authError = await requireAuth(["super_admin"]);
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

    // ─── MIGRATION ACTION (super admin only) ───
    if (action === "migrate") {
      if (!session) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
      const authError = await requireAuth(["super_admin"]);
      if (authError) return authError;
      const { sql } = body;
      if (!sql) return NextResponse.json({ success: false, error: "sql required" }, { status: 400 });
      await executeRawMigrationSql(sql);
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
      const valRes = await getManualMessageSubmissionsByIdsInRun(idList, run_id);
      const validMap = new Map(valRes.rows.map((r) => [r.id, r]));

      // Fetch the form's field labels once for identity resolution.
      let fieldLabels = {};
      try {
        const flRes = await getManualMessageFieldLabelsByRunId(run_id);
        for (const frow of flRes.rows) fieldLabels[String(frow.id)] = frow.label;
      } catch (_) {}

      let groupName = null;
      try {
        const grpRes = await getManualMessageGroupNameByRunId(run_id);
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
      const valRes = await getActivationMessageSubmissionsByIdsInRun(idList, run_id);
      const validMap = new Map(valRes.rows.map((r) => [r.id, r]));

      const { getEmailLogRow, getActivationHistory } = await import("@/lib/email");
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

        // Account already activated → no activation email needed. This avoids
        // the misleading "Send failed" when the person already completed setup.
        try {
          const actCheck = await getContactStatusForActivationById(sub.submitter_id);
          if (actCheck.rows[0] && String(actCheck.rows[0].status || "").toLowerCase() === "active") {
            results.push({ submission_id: id, name, status: "skipped", error: "Account already activated — no activation email needed" });
            continue;
          }
        } catch (_) {}

        try {
          const runData = await getRunDataForActivationSendById(sub.run_id);
          let formData = null;
          if (runData.rows[0]) {
            const f = await getFormForActivationSendById(runData.rows[0].form_id);
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
          const hist = await getActivationHistory({ submission_id: id, contact_cid: sub.submitter_id || null });
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
        } catch (e) {
          results.push({ submission_id: id, name, status: "failed", error: e?.message || "Activation send error" });
        }
      }

      return NextResponse.json({ success: true, results });
    }

    // ─── REGENERATE PUBLIC LINK (rotates public_slug — old link stops working) ───
    if (action === "regenerate_link") {
      if (!session) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
      const authError = await requireAuth(["super_admin", "admin"]);
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
        } catch (e) {
          return NextResponse.json({ success: false, error: "Could not rotate the share link" }, { status: 500 });
        }
      }

      const fresh = await getRunAfterSlugRotationById(id);
      if (fresh.rows.length === 0) return NextResponse.json({ success: false, error: "Run not found" }, { status: 404 });

      return NextResponse.json({ success: true, run: fresh.rows[0], public_slug: slug });
    }

    // ─── CREATE ACTION ───
    if (!session) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
    const authError = await requireAuth(["super_admin", "admin"]);
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
      for (const a of assignments) {
        await createRunAssignmentForRunCreation({
          runId: result.rows[0].id,
          targetType: a.target_type || "user",
          targetId: a.target_id,
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
    const authError = await requireAuth(["super_admin", "admin"]);
    if (authError) return authError;

    const { id, name, description, status, opens_at, closes_at, settings } = await req.json();
    if (!id) return NextResponse.json({ success: false, error: "id is required" }, { status: 400 });

    const result = await updateFormRunMetadataById({ id, name, description, status, opens_at, closes_at, settings });
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

    const runId = parseInt(id);

    // Permanently delete the run and everything attached to it. Assignments
    // and submissions cascade via FK, but email/review/evaluation logs
    // reference submission_id without a FK cascade, so clean those up first.
    await deleteEmailLogsByRunId(runId);
    await deleteReviewsByRunId(runId);
    await deleteEvaluationsByRunId(runId);
    await deleteFormRunById(runId);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
