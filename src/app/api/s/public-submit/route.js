import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { after } from "next/server";
import { onSubmission } from "@/lib/platform/automation";
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
      } catch (e) {
        console.warn("[Public Submit] schema ensure failed:", e.message);
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
    
    // Get client IP
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
    
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
      const runBySlug = await getActiveRunIdByPublicSlug(slug);
      if (runBySlug.rows.length > 0) {
        run_id = runBySlug.rows[0].id;
      }
    } catch (e) {
      console.warn("[Public Submit] public_slug lookup failed:", e.message);
    }
    if (!run_id) {
      return NextResponse.json({ success: false, error: "Run not found or not active" }, { status: 404 });
    }

    // Verify run exists and is active
    const run = await getActiveRunById(run_id);
    if (run.rows.length === 0) {
      return NextResponse.json({ success: false, error: "Run not found or not active" }, { status: 404 });
    }

    // Check deadline
    if (run.rows[0].closes_at && new Date(run.rows[0].closes_at) < new Date()) {
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
      const rateCheck = await countRecentSubmissionsFromIp(run_id, ip);
      if (parseInt(rateCheck.rows[0]?.c) >= 5) {
        return NextResponse.json({ success: false, error: "Too many submissions. Please try again later." }, { status: 429 });
      }
    } catch (_) { /* table may not exist yet */ }

    // Find submitter identity by looking up form field labels
    let submitterName = "Anonymous";
    let submitterEmail = null;
    if (typeof data === "object" && run_id) {
      try {
        // Fetch form fields to map field IDs to labels
        const runInfo = await getFormIdByRunId(run_id);
        if (runInfo.rows.length > 0) {
          const fieldsRes = await getFormFieldsByFormId(runInfo.rows[0].form_id);
          const fieldMap = {};
          for (const f of fieldsRes.rows) {
            fieldMap[String(f.id)] = { label: f.label, type: f.field_type };
          }
          // Now find name/email by field label, not field ID.
          // Name resolution: an explicit "Full Name" field wins; otherwise
          // fall back to the first "Name" field.
          let fullNameVal = "";
          let plainNameVal = "";
          for (const [key, value] of Object.entries(data)) {
            const fieldInfo = fieldMap[String(key)];
            if (!fieldInfo) continue;
            const label = (fieldInfo.label || "").toLowerCase();
            const v = typeof value === "string" && !value.startsWith("{") ? value.trim() : String(value).trim();
            if (!v) continue;
            const isFull = /full\s*name|fullname|nom\s+complet|pr[eé]nom\s*et\s*nom/.test(label);
            if (isFull && !fullNameVal) fullNameVal = v.substring(0, 200);
            else if (!isFull && (label.includes("name") || label.includes("nom")) && !plainNameVal) plainNameVal = v.substring(0, 200);
            if (label.includes("email") && !submitterEmail && v.includes("@")) {
              submitterEmail = v.substring(0, 200);
            }
          }
          if (fullNameVal || plainNameVal) submitterName = fullNameVal || plainNameVal;
        }
      } catch (_) {
        // Fallback: try matching by key (legacy approach), full name first
        let kFullName = "";
        let kPlainName = "";
        for (const [key, value] of Object.entries(data)) {
          const k = String(key).toLowerCase();
          const v = typeof value === "string" && !value.startsWith("{") ? value.trim() : String(value).trim();
          if (!v) continue;
          const isFull = /full\s*name|fullname|nom\s+complet/.test(k);
          if (isFull && !kFullName) kFullName = v.substring(0, 200);
          else if (!isFull && k.includes("name") && !kPlainName) kPlainName = v.substring(0, 200);
          if (k.includes("email") && !submitterEmail && v.includes("@")) submitterEmail = v.substring(0, 200);
        }
        if (submitterName === "Anonymous" && (kFullName || kPlainName)) submitterName = kFullName || kPlainName;
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
      const draftCheck = await getDraftSubmissionBySubmitter(run_id, submitterEmail);
      if (draftCheck.rows.length > 0) {
        await upgradeDraftToSubmitted(data, submitterName, invitationId, draftCheck.rows[0].id);
        submissionId = draftCheck.rows[0].id;
      }
    }

    if (!submissionId) {
      const result = await insertSubmittedSubmission(run_id, submitterId, submitterName, data, invitationId);
      submissionId = result.rows[0].id;
    }

    // Fetch form settings for success message configuration
    let successConfig = null;
    try {
      const formQuery = await getFormSettingsByRunId(run_id);
      if (formQuery.rows.length > 0 && formQuery.rows[0].settings) {
        const settings = formQuery.rows[0].settings;
        const auto = settings.automation || {};
        successConfig = {
          message: auto.success_message || null,
          redirect_url: auto.redirect_after_submit || null,
        };
      }
    } catch (_) {}

    // Fire post-submission automation (CRM contact, confirmation email, owner
    // notification) in the background so it never blocks or breaks the response.
    // The submission is already saved — any automation failure is logged, not
    // surfaced to the participant.
    try {
      const runForAuto = run.rows[0];
      let formForAuto = null;
      const fRes = await getFormById(runForAuto?.form_id);
      formForAuto = fRes.rows[0] || null;
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
