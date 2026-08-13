import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { evaluateSubmission, hasEvaluation, getEvaluation } from "@/lib/platform/ai/evaluate";

/**
 * POST /api/platform/ai/evaluate-submission
 *
 * Body: { submission_id: number }                    — evaluate single submission
 * Body: { form_id: number, action: "batch" }         — evaluate next batch of unevaluated
 * Body: { form_id: number, action: "retry_failed" }  — retry only failed submissions
 * Body: { form_id: number, action: "progress" }      — return progress counts only
 *
 * PHASE 4 BATCH MODEL (client-driven):
 *  - Each batch request claims + evaluates up to batch_size submissions
 *  - Claims use an expiry table so two concurrent processes never double-evaluate
 *  - Successes are saved individually (platform_submission_evaluations)
 *  - Failures are recorded (platform_evaluation_failures) for targeted retry
 *  - Progress % reflects only successfully saved evaluations
 */

const DEFAULT_BATCH_SIZE = 10;
const MAX_BATCH_SIZE = 15;
const CLAIM_TTL_MINUTES = 15;
const AI_TIMEOUT_MS = 180000; // per-submission AI call timeout
const IN_FLIGHT = 4; // concurrent AI evaluations within one batch request

// Vercel: allow this route to run long enough for several AI evaluations
// (Fluid compute clamps to the plan limit; harmless on smaller plans).
export const maxDuration = 300;
export const dynamic = "force-dynamic";

async function ensureTables(db) {
  try {
    await db.execute(`CREATE TABLE IF NOT EXISTS platform_evaluation_claims (
      submission_id INTEGER PRIMARY KEY,
      claimed_at TIMESTAMP DEFAULT NOW()
    )`);
    await db.execute(`CREATE TABLE IF NOT EXISTS platform_evaluation_failures (
      submission_id INTEGER PRIMARY KEY,
      error TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )`);
  } catch (e) {
    console.warn("[Batch Eval] Could not ensure tables:", e.message);
  }
}

async function cleanupExpiredClaims(db) {
  try {
    await db.execute({
      sql: `DELETE FROM platform_evaluation_claims WHERE claimed_at < NOW() - INTERVAL '${CLAIM_TTL_MINUTES} minutes'`,
      args: [],
    });
  } catch (_) {}
}

async function getProgress(db, formId) {
  // NOTE: total counts ALL real submissions (submitted/approved/rejected), not
  // only 'submitted' — auto-approval flips status to 'approved' as evaluations
  // complete, and that must not shrink the denominator while the batch runs.
  const [totalRes, evaluatedRes, failedRes] = await Promise.all([
    db.execute({
      sql: `SELECT COUNT(*)::int AS cnt FROM platform_form_submissions ps
            JOIN platform_form_runs r ON ps.run_id = r.id
            WHERE r.form_id = ? AND ps.status IN ('submitted', 'approved', 'rejected', 'revision_requested')`,
      args: [parseInt(formId)],
    }),
    db.execute({
      sql: `SELECT COUNT(DISTINCT e.submission_id)::int AS cnt
            FROM platform_submission_evaluations e
            JOIN platform_form_submissions ps ON e.submission_id = ps.id
            JOIN platform_form_runs r ON ps.run_id = r.id
            WHERE r.form_id = ?`,
      args: [parseInt(formId)],
    }),
    db.execute({
      sql: `SELECT COUNT(*)::int AS cnt
            FROM platform_evaluation_failures f
            JOIN platform_form_submissions ps ON f.submission_id = ps.id
            JOIN platform_form_runs r ON ps.run_id = r.id
            WHERE r.form_id = ?
            AND f.submission_id NOT IN (SELECT submission_id FROM platform_submission_evaluations)`,
      args: [parseInt(formId)],
    }),
  ]);

  const total = totalRes.rows[0]?.cnt || 0;
  const evaluated = evaluatedRes.rows[0]?.cnt || 0;
  const failed = failedRes.rows[0]?.cnt || 0;
  const remaining = Math.max(0, total - evaluated - failed);

  return {
    total,
    evaluated,
    failed,
    remaining,
    percent: total > 0 ? Math.round((evaluated / total) * 100) : 0,
  };
}

/** Bound a promise so a hanging AI call cannot stall a whole batch forever. */
function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(label)), ms)),
  ]);
}

async function processSubmission(db, subId) {
  try {
    const result = await withTimeout(evaluateSubmission(subId), AI_TIMEOUT_MS, "AI evaluation timed out");
    if (result === null) {
      // evaluateSubmission returns null on failure — record it
      throw new Error("Evaluation failed (null result)");
    }
    // Success: clear any failure record
    try {
      await db.execute({
        sql: "DELETE FROM platform_evaluation_failures WHERE submission_id = ?",
        args: [subId],
      });
    } catch (_) {}

    // ── AUTO-APPROVE BY CUTOFF (optional, configurable per form) ──
    await maybeAutoApprove(db, subId, result);

    return { ok: true, score: result.overall_score };
  } catch (e) {
    const msg = e?.message || "Unknown error";
    try {
      await db.execute({
        sql: `INSERT INTO platform_evaluation_failures (submission_id, error)
              VALUES (?, ?)
              ON CONFLICT (submission_id) DO UPDATE SET error = EXCLUDED.error, created_at = NOW()`,
        args: [subId, msg.substring(0, 500)],
      });
    } catch (_) {}
    return { ok: false, error: msg };
  }
}

/**
 * Look up the group linked to a run (used for approval email templates).
 */
async function getRunGroupName(db, runId) {
  try {
    const res = await db.execute({
      sql: `SELECT f.name
            FROM platform_form_run_assignments a
            JOIN families f ON (a.target_id = f.registration_id OR a.target_id = CAST(f.id AS TEXT))
            WHERE a.run_id = ? AND a.target_type = 'group'
            LIMIT 1`,
      args: [runId],
    });
    return res.rows[0]?.name || null;
  } catch (_) {
    return null;
  }
}

/**
 * Auto-approve a submission when its score meets the form's configured
 * cutoff. Reuses the existing review automation (group assignment,
 * approval email, activation) — no parallel system.
 */
async function maybeAutoApprove(db, submissionId, evaluation) {
  try {
    const sub = await db.execute({
      sql: "SELECT * FROM platform_form_submissions WHERE id = ?",
      args: [submissionId],
    });
    if (sub.rows.length === 0) return;
    const submission = sub.rows[0];
    if (submission.status !== "submitted") return; // never override existing decision

    const run = await db.execute({
      sql: "SELECT * FROM platform_form_runs WHERE id = ?",
      args: [submission.run_id],
    });
    if (run.rows.length === 0) return;

    const form = await db.execute({
      sql: "SELECT * FROM platform_forms WHERE id = ?",
      args: [run.rows[0].form_id],
    });
    if (form.rows.length === 0) return;

    const auto = (form.rows[0].settings || {}).automation;
    const cutoff = auto?.auto_approve_cutoff;
    const autoApproveEnabled = auto?.auto_approve === true;
    if (!autoApproveEnabled || cutoff == null || isNaN(parseFloat(cutoff))) return;

    const score = parseFloat(evaluation?.overall_score);
    if (isNaN(score) || score < parseFloat(cutoff)) return;

    // Approve through the same path a human reviewer uses
    const { onReview } = await import("@/lib/platform/automation");
    const comment = `Auto-approved: AI score ${score} meets cutoff ${cutoff}`;

    // Record review row (system reviewer)
    await db.execute({
      sql: `INSERT INTO platform_submission_reviews (submission_id, reviewer_id, reviewer_name, decision, comment) VALUES (?, 'system', 'System Auto-Approval', 'approved', ?)`,
      args: [submissionId, comment],
    });

    // Update submission status
    const updated = await db.execute({
      sql: "UPDATE platform_form_submissions SET status = 'approved', updated_at = NOW() WHERE id = ? AND status = 'submitted' RETURNING *",
      args: [submissionId],
    });
    if (updated.rows.length === 0) return; // raced with another decision

    // Send the TRACKED approval email (Gmail transport) with template variables
    // so auto-approved applicants receive the personalized approval template.
    try {
      const subData = updated.rows[0].data || {};
      const applicantEmail = Object.values(subData).find((v) => typeof v === "string" && v.includes("@"));
      if (applicantEmail) {
        const { sendDecisionEmail, sendTrackedEmail, getTemplate, resolvePersonName, recordEmailStatus } = await import("@/lib/email");
        const decisionTemplate = getTemplate(form.rows[0].settings || {}, "approval", run.rows[0].settings || {});
        const formName = form.rows[0].name || "";
        const groupName = await getRunGroupName(db, run.rows[0].id);

        // Approval email requires a group. With no group, the person stays in
        // the platform/CRM but no approval email is sent.
        if (groupName) {
          // Best real name: CRM name → submitter name → form answers.
          let applicantName = updated.rows[0].submitter_name || "";
          try {
            const cRes = await db.execute({
              sql: "SELECT name FROM contacts WHERE cid = ?",
              args: [updated.rows[0].submitter_id],
            });
            applicantName = resolvePersonName({
              contactName: cRes.rows[0]?.name || "",
              submitterName: applicantName,
              submissionData: subData,
            }) || applicantName || "";
          } catch (_) {}

          await sendTrackedEmail({
            submission_id: submissionId,
            contact_cid: updated.rows[0].submitter_id || null,
            email_type: "approval",
            provider: "gmail",
            to: applicantEmail,
            sendFn: () =>
              sendDecisionEmail({
                to: applicantEmail,
                applicantName,
                formName,
                decision: "approved",
                comment,
                template: decisionTemplate,
                templateVars: {
                  form_name: formName,
                  score: String(score),
                  group_name: groupName || "",
                  name: applicantName,
                },
              }),
          });
        } else {
          await recordEmailStatus({
            submission_id: submissionId,
            contact_cid: updated.rows[0].submitter_id || null,
            email_type: "approval",
            status: "skipped",
            error: "Skipped — No group assigned; approval email not sent",
            to: applicantEmail,
          });
        }
      }
    } catch (e) {
      console.error("[Auto-Approve] Approval email error:", e.message);
    }

    // Fire the same REVIEW_COMPLETED automation (group + emails)
    try {
      await onReview(
        { id: null, submission_id: submissionId, decision: "approved", comment, reviewer_name: "System Auto-Approval" },
        updated.rows[0],
        run.rows[0],
        { cid: "system", role: "system" },
        form.rows[0]
      );
    } catch (e) {
      console.error("[Auto-Approve] Automation error:", e.message);
    }
  } catch (e) {
    console.error("[Auto-Approve] Error:", e.message);
  }
}

async function runBatch(db, formId, onlyFailed, batchSize) {
  const where = onlyFailed
    ? `AND ps.id IN (SELECT submission_id FROM platform_evaluation_failures)`
    : `AND ps.id NOT IN (SELECT submission_id FROM platform_evaluation_failures)`;

  // Candidates: submitted, not evaluated, no active claim
  const candidates = await db.execute({
    sql: `SELECT ps.id FROM platform_form_submissions ps
          JOIN platform_form_runs r ON ps.run_id = r.id
          WHERE r.form_id = ? AND ps.status = 'submitted'
          ${where}
          AND ps.id NOT IN (SELECT submission_id FROM platform_submission_evaluations)
          AND NOT EXISTS (
            SELECT 1 FROM platform_evaluation_claims c
            WHERE c.submission_id = ps.id AND c.claimed_at > NOW() - INTERVAL '${CLAIM_TTL_MINUTES} minutes'
          )
          ORDER BY ps.id
          LIMIT ?`,
    args: [parseInt(formId), batchSize],
  });

  if (candidates.rows.length === 0) {
    return { evaluated: 0, failed: 0, processed: 0 };
  }

  // Claim each candidate (ON CONFLICT DO NOTHING — losers were claimed concurrently)
  const claimed = [];
  for (const row of candidates.rows) {
    try {
      const claimRes = await db.execute({
        sql: `INSERT INTO platform_evaluation_claims (submission_id)
              VALUES (?) ON CONFLICT (submission_id) DO NOTHING RETURNING submission_id`,
        args: [row.id],
      });
      if (claimRes.rows.length > 0) claimed.push(row.id);
    } catch (_) {}
  }

  let ok = 0;
  let fail = 0;
  // Evaluate claimed submissions with limited concurrency so a 10-submission
  // batch finishes well within the serverless function duration instead of
  // stacking 10 sequential AI calls in one request.
  const results = new Array(claimed.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(IN_FLIGHT, claimed.length) }, async () => {
    while (cursor < claimed.length) {
      const i = cursor++;
      const subId = claimed[i];
      const res = await processSubmission(db, subId);
      results[i] = res;
      // Release claim regardless of outcome
      try {
        await db.execute({
          sql: "DELETE FROM platform_evaluation_claims WHERE submission_id = ?",
          args: [subId],
        });
      } catch (_) {}
    }
  });
  await Promise.all(workers);

  for (const res of results) {
    if (res && res.ok) ok++;
    else fail++;
  }

  return { evaluated: ok, failed: fail, processed: claimed.length };
}

export async function POST(req) {
  try {
    const authError = await requireAuth(["super_admin", "admin", "program_manager", "teacher"]);
    if (authError) return authError;

    const body = await req.json();
    const { default: db, initDb } = await import("@/lib/db");
    await initDb();
    await ensureTables(db);

    // ── PROGRESS ONLY ──
    if (body.action === "progress" && body.form_id) {
      const progress = await getProgress(db, body.form_id);
      // Approval + email stats for the dashboard panel
      let approvals = { approved: 0, rejected: 0 };
      let emailStats = { sent: 0, failed: 0, pending: 0, activation_sent: 0, approval_sent: 0 };
      try {
        const appRes = await db.execute({
          sql: `SELECT ps.status, COUNT(*)::int AS cnt
                FROM platform_form_submissions ps
                JOIN platform_form_runs r ON ps.run_id = r.id
                WHERE r.form_id = ? AND ps.status IN ('approved','rejected')
                GROUP BY ps.status`,
          args: [parseInt(body.form_id)],
        });
        for (const row of appRes.rows) {
          if (row.status === "approved") approvals.approved = row.cnt;
          if (row.status === "rejected") approvals.rejected = row.cnt;
        }
      } catch (_) {}
      try {
        const { getEmailStatsForForm } = await import("@/lib/email");
        emailStats = await getEmailStatsForForm(body.form_id);
      } catch (_) {}
      return NextResponse.json({ success: true, progress, approvals, emails: emailStats });
    }

    // ── BATCH / RETRY ──
    if ((body.action === "batch" || body.action === "retry_failed") && body.form_id) {
      await cleanupExpiredClaims(db);
      const batchSize = Math.min(
        parseInt(body.batch_size) || DEFAULT_BATCH_SIZE,
        MAX_BATCH_SIZE
      );
      const onlyFailed = body.action === "retry_failed";

      const res = await runBatch(db, body.form_id, onlyFailed, batchSize);
      const progress = await getProgress(db, body.form_id);

      return NextResponse.json({
        success: true,
        action: body.action,
        evaluated: res.evaluated,
        failed: res.failed,
        processed: res.processed,
        progress,
      });
    }

    // ── SINGLE EVALUATION ──
    const { submission_id, force } = body;
    if (!submission_id) {
      return NextResponse.json({ success: false, error: "submission_id required" }, { status: 400 });
    }

    // Manual Re-evaluate: delete prior evaluations so exactly one current row remains
    if (force) {
      try {
        await db.execute({
          sql: "DELETE FROM platform_submission_evaluations WHERE submission_id = ?",
          args: [parseInt(submission_id)],
        });
        await db.execute({
          sql: "DELETE FROM platform_evaluation_failures WHERE submission_id = ?",
          args: [parseInt(submission_id)],
        });
      } catch (_) {}
    }

    const evaluation = await evaluateSubmission(submission_id);
    if (!evaluation) {
      return NextResponse.json({ success: false, error: "Evaluation failed or no framework configured" }, { status: 400 });
    }

    // Auto-approve by cutoff applies to manual single evaluation too
    await maybeAutoApprove(db, parseInt(submission_id), evaluation);

    return NextResponse.json({ success: true, evaluation, re_evaluated: !!force });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const subId = searchParams.get("submission_id");
    if (subId) {
      const evalRow = await getEvaluation(parseInt(subId));
      return NextResponse.json({ success: true, evaluation: evalRow });
    }

    const formId = searchParams.get("form_id");
    if (!formId) {
      return NextResponse.json({ success: false, error: "form_id or submission_id required" }, { status: 400 });
    }

    const exists = await hasEvaluation(parseInt(formId));
    return NextResponse.json({ success: true, has_evaluation: exists });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
