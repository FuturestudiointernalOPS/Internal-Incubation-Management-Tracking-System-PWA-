import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { after } from "next/server";
import { onSubmission } from "@/lib/platform/automation";
import { getClientIp } from "@/lib/rate-limit";
import {
  ensurePublicSubmitInvitationColumn,
  ensurePublicSubmitInvitationIndex,
  ensurePublicSubmitRateTable,
  getActiveRunIdByPublicSlug,
  getActiveRunById,
  countRecentSubmissionsFromIp,
  getFormIdByRunId,
  getFormFieldsByFormId,
  getSubmittedSubmissionBySubmitter,
  insertRateEntryForSubmission,
  getDraftSubmissionBySubmitter,
  upgradeDraftToSubmitted,
  insertSubmittedSubmission,
  getFormSettingsByRunId,
  getFormById,
} from "@/models/publicFormRuns";

// The pipeline adds platform_form_submissions.invitation_id lazily via
// ensureVentureSchema() (seed/approval paths). Public submit inserts that
// column too, so this route self-heals its own schema — cached once per
// process, idempotent, never destructive.
let submitSchemaPromise = null;
async function ensurePublicSubmitSchema() {
  if (!submitSchemaPromise) {
    submitSchemaPromise = (async () => {
      try {
        await ensurePublicSubmitInvitationColumn();
        await ensurePublicSubmitInvitationIndex();
      } catch (error) {
        console.warn("[Public Submit] schema ensure failed:", error.message);
      }
      try {
        await ensurePublicSubmitRateTable();
      } catch (_) {}
      return true;
    })();
  }
  return submitSchemaPromise;
}

/**
 * POST /api/s/public-submit
 * Public endpoint — accepts form submissions without auth.
 * 
 * Security:
 * - Only active runs accepted
 * - Deadline enforced
 * - Max 100KB payload
 * - Duplicate detection by email
 * - IP-based rate limiting: max 5 submissions per IP per run per hour
 */
export async function POST(req) {
  let body = null;
  try {
    await initDb();
    await ensurePublicSubmitSchema();
    
    // Get client IP (trusted hop — see getClientIp; the per-run submission limit
    // below is only as good as the key it is counted under, RATE-2).
    const ip = getClientIp(req);
    
    // Rate limit: check content-length
    const contentLength = parseInt(req.headers.get("content-length") || "0");
    if (contentLength > 100000) {
      return NextResponse.json({ success: false, error: "Payload too large" }, { status: 413 });
    }

    body = await req.json();
    const { data, slug, invitation_token } = body;

    if (!slug || !data || typeof data !== "object") {
      return NextResponse.json({ success: false, error: "slug and data required" }, { status: 400 });
    }

    // Resolve the run from its public slug — numeric run IDs are never
    // accepted on the public endpoint (prevents sequential-ID probing).
    let run_id = null;
    try {
      const runBySlugResult = await getActiveRunIdByPublicSlug(slug);
      if (runBySlugResult.rows.length > 0) {
        run_id = runBySlugResult.rows[0].id;
      }
    } catch (error) {
      console.warn("[Public Submit] public_slug lookup failed:", error.message);
    }
    if (!run_id) {
      return NextResponse.json({ success: false, error: "Run not found or not active" }, { status: 404 });
    }

    // Verify run exists and is active
    const runResult = await getActiveRunById(run_id);
    if (runResult.rows.length === 0) {
      return NextResponse.json({ success: false, error: "Run not found or not active" }, { status: 404 });
    }

    // Check deadline
    if (runResult.rows[0].closes_at && new Date(runResult.rows[0].closes_at) < new Date()) {
      return NextResponse.json({ success: false, error: "Submission deadline has passed" }, { status: 400 });
    }

    // Optional Venture Run invitation: link the submission to the invitation
    // so provenance (invitation → submission → Venture) is preserved.
    let invitationId = null;
    if (invitation_token) {
      try {
        const { getVentureInvitationByToken, markVentureInvitationStatus } = await import("@/lib/ventureInvitations");
        const { invitation } = await getVentureInvitationByToken(invitation_token);
        if (invitation && Number(invitation.run_id) === Number(run_id)) {
          invitationId = invitation.id;
          markVentureInvitationStatus(invitation.id, "submitted").catch(() => {});
        }
      } catch (_) {}
    }

    // IP-based rate limiting: max 5 submissions per IP per run per hour
    // Gracefully skip if rate table doesn't exist yet
    try {
      const rateCheckResult = await countRecentSubmissionsFromIp(run_id, ip);
      if (parseInt(rateCheckResult.rows[0]?.c) >= 5) {
        return NextResponse.json({ success: false, error: "Too many submissions. Please try again later." }, { status: 429 });
      }
    } catch (_) { /* table may not exist yet */ }

    // Find submitter identity by looking up form field labels
    let submitterName = "Anonymous";
    let submitterEmail = null;
    if (typeof data === "object" && run_id) {
      try {
        // Fetch form fields to map field IDs to labels
        const formIdResult = await getFormIdByRunId(run_id);
        if (formIdResult.rows.length > 0) {
          const fieldsResult = await getFormFieldsByFormId(formIdResult.rows[0].form_id);
          const fieldMap = {};
          for (const field of fieldsResult.rows) {
            fieldMap[String(field.id)] = { label: field.label, type: field.field_type };
          }
          // Now find name/email by field label, not field ID.
          // Name resolution: an explicit "Full Name" field wins; otherwise
          // fall back to the first "Name" field.
          let fullNameValue = "";
          let plainNameValue = "";
          for (const [key, value] of Object.entries(data)) {
            const fieldInfo = fieldMap[String(key)];
            if (!fieldInfo) continue;
            const label = (fieldInfo.label || "").toLowerCase();
            const fieldValue = typeof value === "string" && !value.startsWith("{") ? value.trim() : String(value).trim();
            if (!fieldValue) continue;
            const isFull = /full\s*name|fullname|nom\s+complet|pr[eé]nom\s*et\s*nom/.test(label);
            if (isFull && !fullNameValue) fullNameValue = fieldValue.substring(0, 200);
            else if (!isFull && (label.includes("name") || label.includes("nom")) && !plainNameValue) plainNameValue = fieldValue.substring(0, 200);
            if (label.includes("email") && !submitterEmail && fieldValue.includes("@")) {
              submitterEmail = fieldValue.substring(0, 200);
            }
          }
          if (fullNameValue || plainNameValue) submitterName = fullNameValue || plainNameValue;
        }
      } catch (_) {
        // Fallback: try matching by key (legacy approach), full name first
        let keyFullName = "";
        let keyPlainName = "";
        for (const [key, value] of Object.entries(data)) {
          const lowerKey = String(key).toLowerCase();
          const fieldValue = typeof value === "string" && !value.startsWith("{") ? value.trim() : String(value).trim();
          if (!fieldValue) continue;
          const isFull = /full\s*name|fullname|nom\s+complet/.test(lowerKey);
          if (isFull && !keyFullName) keyFullName = fieldValue.substring(0, 200);
          else if (!isFull && lowerKey.includes("name") && !keyPlainName) keyPlainName = fieldValue.substring(0, 200);
          if (lowerKey.includes("email") && !submitterEmail && fieldValue.includes("@")) submitterEmail = fieldValue.substring(0, 200);
        }
        if (submitterName === "Anonymous" && (keyFullName || keyPlainName)) submitterName = keyFullName || keyPlainName;
      }
    }
    const submitterId = submitterEmail || "public-" + Date.now();

    // Prevent duplicate SUBMITTED entries by same email — idempotent:
    // a repeat submission returns success (not an error) so a participant who
    // resubmits after a misleading error is NOT told their application failed.
    if (submitterEmail) {
      const existing = await getSubmittedSubmissionBySubmitter(run_id, submitterEmail);
      if (existing.rows.length > 0) {
        return NextResponse.json({
          success: true,
          id: existing.rows[0].id,
          already_submitted: true,
          success_message: null,
          redirect_url: null,
        });
      }
    }

    // Record rate limit entry (skip if table doesn't exist)
    try {
      await insertRateEntryForSubmission(run_id, ip);
    } catch (_) {}

    // Insert submission — or upgrade existing draft
    let submissionId;
    if (submitterEmail) {
      const draftResult = await getDraftSubmissionBySubmitter(run_id, submitterEmail);
      if (draftResult.rows.length > 0) {
        await upgradeDraftToSubmitted(data, submitterName, invitationId, draftResult.rows[0].id);
        submissionId = draftResult.rows[0].id;
      }
    }

    if (!submissionId) {
      const result = await insertSubmittedSubmission(run_id, submitterId, submitterName, data, invitationId);
      submissionId = result.rows[0].id;
    }

    // Fetch form settings for success message configuration
    let successConfig = null;
    try {
      const formSettingsResult = await getFormSettingsByRunId(run_id);
      if (formSettingsResult.rows.length > 0 && formSettingsResult.rows[0].settings) {
        const settings = formSettingsResult.rows[0].settings;
        const automationSettings = settings.automation || {};
        successConfig = {
          message: automationSettings.success_message || null,
          redirect_url: automationSettings.redirect_after_submit || null,
        };
      }
    } catch (_) {}

    // Fire post-submission automation (CRM contact, confirmation email, owner
    // notification) in the background so it never blocks or breaks the response.
    // The submission is already saved — any automation failure is logged, not
    // surfaced to the participant.
    try {
      const runForAuto = runResult.rows[0];
      let formForAuto = null;
      const formResult = await getFormById(runForAuto?.form_id);
      formForAuto = formResult.rows[0] || null;
      after(() => {
        onSubmission(
          {
            id: submissionId,
            run_id: parseInt(run_id),
            submitter_id: submitterId,
            submitter_name: submitterName,
            status: "submitted",
            data,
            submitted_at: new Date(),
          },
          runForAuto || { id: parseInt(run_id) },
          formForAuto,
          null,
        );
      });
    } catch (_) {}

    return NextResponse.json({ 
      success: true, 
      id: submissionId,
      success_message: successConfig?.message || null,
      redirect_url: successConfig?.redirect_url || null,
    });
  } catch (error) {
    console.error("[Public Submit] Error:", error.message, error.stack);
    console.error("[Public Submit] Request body snippet:", JSON.stringify(body || {}).substring(0, 200));
    return NextResponse.json({ success: false, error: "An error occurred — our team has been notified" }, { status: 500 });
  }
}
