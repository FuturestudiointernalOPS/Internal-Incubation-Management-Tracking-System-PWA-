/**
 * PLATFORM INTEGRATION MANAGER
 *
 * Centralized service that wraps existing Impact OS infrastructure
 * (audit, email, AI, notifications) behind standardized Platform adapters.
 *
 * All Platform modules (Forms, Runs, Assessments) consume services through
 * this manager rather than directly importing from scattered lib files.
 */

import { logAuditEvent } from "@/lib/audit";
import { sendEmail } from "@/lib/mailer";
import { deepseekIntelligence } from "@/lib/deepseek";

// ─── AUDIT ────────────────────────────────────────────────────────────

/**
 * Log a platform audit event.
 * @param {Object} opts
 * @param {string} opts.entity_type - e.g. "form_run", "submission", "review"
 * @param {string|number} opts.entity_id
 * @param {string} opts.user_id - actor CID
 * @param {string} [opts.user_name]
 * @param {string} opts.action - e.g. "created", "launched", "submitted", "approved"
 * @param {string} [opts.details] - human-readable description
 * @param {Object} [opts.meta] - extra structured data
 */
export async function audit(opts) {
  return logAuditEvent({
    entity_type: opts.entity_type,
    entity_id: String(opts.entity_id),
    user_id: opts.user_id,
    user_name: opts.user_name || "",
    action: opts.action,
    details: opts.details || null,
    metadata: opts.meta || null,
  });
}

// ─── EMAIL ────────────────────────────────────────────────────────────

/**
 * Send a platform transactional email.
 * Falls back gracefully when Resend is not configured.
 */
export async function email({ to, subject, body, isHtml, fromName }) {
  try {
    return await sendEmail({ to, subject, body, isHtml, fromName });
  } catch (e) {
    console.error("[Platform Integration] Email failed:", e.message);
    return { success: false, error: e.message };
  }
}

/**
 * Send a submission confirmation email to a participant.
 */
export async function sendSubmissionConfirmation({ to, participantName, runName, submittedAt }) {
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; background: #020617; color: #f8fafc; padding: 40px;">
      <div style="max-width: 480px; margin: 0 auto; background: #0f172a; border-radius: 16px; border: 1px solid #334155; padding: 40px;">
        <h1 style="margin:0 0 8px; font-size:22px;"><span style="color:#ff6600;">Impact</span><span style="color:#f8fafc;">OS</span></h1>
        <p style="color:#64748b; font-size:13px; margin:0 0 24px;">Future Studio Platform</p>
        <h2 style="color:#f8fafc; font-size:18px; margin:0 0 8px;">Submission Received ✓</h2>
        <p style="color:#94a3b8; font-size:14px; line-height:1.6; margin:0 0 8px;">
          Hi <strong style="color:#f8fafc;">${participantName}</strong>,
        </p>
        <p style="color:#94a3b8; font-size:14px; line-height:1.6; margin:0 0 24px;">
          Your submission for <strong style="color:#ff6600;">${runName}</strong> has been received on ${submittedAt}. We will review it and get back to you.
        </p>
        <hr style="border:none; border-top:1px solid #1e293b; margin:24px 0;" />
        <p style="color:#475569; font-size:11px; margin:0;">This is an automated notification from ImpactOS.</p>
      </div>
    </div>`;

  return email({ to, subject: `Submission Received — ${runName}`, body: html, isHtml: true, fromName: "ImpactOS" });
}

/**
 * Send a review decision email to a participant.
 */
export async function sendReviewDecision({ to, participantName, runName, decision, comment, reviewerName }) {
  const decisionColor =
    decision === "approved" ? "#10b981" :
    decision === "rejected" ? "#f43f5e" :
    decision === "revision_requested" ? "#f59e0b" : "#64748b";

  const decisionLabel =
    decision === "approved" ? "Approved ✓" :
    decision === "rejected" ? "Not Accepted ✗" :
    decision === "revision_requested" ? "Revision Requested ↻" : decision;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; background: #020617; color: #f8fafc; padding: 40px;">
      <div style="max-width: 480px; margin: 0 auto; background: #0f172a; border-radius: 16px; border: 1px solid #334155; padding: 40px;">
        <h1 style="margin:0 0 8px; font-size:22px;"><span style="color:#ff6600;">Impact</span><span style="color:#f8fafc;">OS</span></h1>
        <p style="color:#64748b; font-size:13px; margin:0 0 24px;">Future Studio Platform</p>
        <h2 style="color:${decisionColor}; font-size:18px; margin:0 0 8px;">${decisionLabel}</h2>
        <p style="color:#94a3b8; font-size:14px; line-height:1.6; margin:0 0 8px;">
          Hi <strong style="color:#f8fafc;">${participantName}</strong>,
        </p>
        <p style="color:#94a3b8; font-size:14px; line-height:1.6; margin:0 0 16px;">
          Your submission for <strong style="color:#ff6600;">${runName}</strong> has been reviewed by ${reviewerName}.
        </p>
        ${comment ? `<div style="background:#1e293b; border-radius:12px; padding:16px; margin:0 0 24px;">
          <p style="color:#94a3b8; font-size:13px; line-height:1.5; margin:0;">${comment}</p>
        </div>` : ""}
        ${decision === "revision_requested" ? `<p style="color:#f59e0b; font-size:13px; line-height:1.6; margin:0 0 24px;">Please update your submission and resubmit at your earliest convenience.</p>` : ""}
        <hr style="border:none; border-top:1px solid #1e293b; margin:24px 0;" />
        <p style="color:#475569; font-size:11px; margin:0;">This is an automated notification from ImpactOS.</p>
      </div>
    </div>`;

  return email({
    to,
    subject: `Update on your submission — ${runName}`,
    body: html,
    isHtml: true,
    fromName: "ImpactOS Notifications",
  });
}

// ─── AI ───────────────────────────────────────────────────────────────

/**
 * Summarize a submission using AI.
 * @param {Object} submission - { data, submitter_name, status }
 * @param {Object} form - { name, description }
 * @returns {Promise<string>} AI-generated summary
 */
export async function summarizeSubmission(submission, form) {
  try {
    const fields = Object.entries(submission.data || {})
      .map(([k, v]) => `- ${k}: ${typeof v === "string" ? v.substring(0, 200) : String(v)}`)
      .join("\n");

    const prompt = `You are an application reviewer assistant for an incubation program called ImpactOS by Future Studio.
Summarize the following application submission in 3-5 bullet points. Focus on key strengths, gaps, and anything that needs attention.
Be concise and professional. Do NOT make a final decision — this is assistance only.

Form: ${form?.name || "Unknown"}
Submission by: ${submission.submitter_name || "Anonymous"}
Status: ${submission.status || "submitted"}

Submission data:
${fields || "No data provided"}`;

    const summary = await deepseekIntelligence.chat(prompt);
    return summary;
  } catch (e) {
    console.error("[Platform AI] Summarization failed:", e.message);
    return null;
  }
}

/**
 * Analyze a submission and flag potential issues.
 * @returns {Promise<{summary: string, flags: string[], score: number|null}|null>}
 */
export async function analyzeSubmission(submission, form) {
  try {
    const fields = Object.entries(submission.data || {})
      .map(([k, v]) => `- ${k}: ${typeof v === "string" ? v.substring(0, 200) : String(v)}`)
      .join("\n");

    const prompt = `You are a reviewer assistant. Analyze this application submission and return a JSON object with:
- "summary": a 2-3 sentence summary of the application
- "flags": an array of potential issues or missing information (e.g. "No business model described", "Missing contact details")
- "score": a score from 1-10 based on completeness and quality, or null if you cannot determine

Form: ${form?.name || "Unknown"}
Fields:
${fields || "No data"}

Return ONLY valid JSON, no markdown, no extra text. Format: {"summary":"...","flags":["..."],"score":5}`;

    const raw = await deepseekIntelligence.chat(prompt);
    // Extract JSON from potential markdown
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return null;
  } catch (e) {
    console.error("[Platform AI] Analysis failed:", e.message);
    return null;
  }
}

// ─── NOTIFICATIONS (in-app) ─────────────────────────────────────────

/**
 * Create an in-app notification for a user.
 * Stored in a simple notifications table.
 */
export async function notifyUser({ userId, title, body, actionUrl, type }) {
  try {
    const { default: db, initDb } = await import("@/lib/db");
    await initDb();
    await db.execute({
      sql: `INSERT INTO platform_notifications (user_id, title, body, action_url, type, read)
            VALUES (?, ?, ?, ?, ?, FALSE)`,
      args: [userId, title, body || null, actionUrl || null, type || "info"],
    });
  } catch (e) {
    console.error("[Platform Notification] Failed:", e.message);
  }
}

// ─── HEALTH CHECK ───────────────────────────────────────────────────

/**
 * Check the health of all integrated services.
 * Returns status for each service.
 */
export async function healthCheck() {
  const results = {};

  // Email
  try {
    results.email = process.env.RESEND_API_KEY ? "configured" : "unconfigured";
  } catch { results.email = "error"; }

  // AI
  try {
    results.ai = process.env.DEEPSEEK_API_KEY ? "configured" : "unconfigured";
  } catch { results.ai = "error"; }

  // DB
  try {
    const { default: db, initDb } = await import("@/lib/db");
    await initDb();
    await db.execute({ sql: "SELECT 1" });
    results.database = "healthy";
  } catch { results.database = "error"; }

  return results;
}

export default {
  audit,
  email,
  sendSubmissionConfirmation,
  sendReviewDecision,
  summarizeSubmission,
  analyzeSubmission,
  notifyUser,
  healthCheck,
};
