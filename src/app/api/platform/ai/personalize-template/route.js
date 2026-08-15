import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { deepseekIntelligence } from "@/lib/deepseek";
import { getDefaultTemplate } from "@/lib/email";
import {
  placeholdersOf,
  normalizeToHtml,
  splitHtmlParts,
  splicePersonalizedSegments,
  countTextSegments,
  ensureSegmentPlaceholders,
  stripUnknownPlaceholders,
  validateStructure,
  validateSubject,
  finalizeSubject,
} from "@/lib/platform/ai/email-personalize";

/**
 * POST /api/platform/ai/personalize-template
 *
 * Body: {
 *   template_key: "acknowledgement" | "approval" | "activation" | "rejection",
 *   form_name?: string,
 *   organization?: string,
 *   language?: string,
 *   existing_subject?: string,
 *   existing_body?: string,
 * }
 *
 * STRUCTURE PRESERVATION CONTRACT
 *  - The admin owns the structure; the AI owns the wording.
 *  - The returned body must keep the exact tag skeleton of the draft
 *    (headings, paragraphs, <ol>/<ul>/<li>, <a href>, <strong>/<em>, <br>).
 *  - If the AI returns a structurally different document, a deterministic
 *    fallback personalizes only the text segments and splices them back into
 *    the original markup, so structure is preserved by construction.
 *  - {{placeholders}} are never renamed, removed, or invented.
 *  - Empty subject stays empty so the existing default-subject fallback
 *    (run → form → platform default) applies at send time.
 */

export const dynamic = "force-dynamic";

const TEMPLATE_SPECS = {
  acknowledgement: {
    label: "submission confirmation",
    placeholders: ["{{name}}", "{{form_name}}", "{{organization}}"],
  },
  approval: {
    label: "approval (acceptance) notification",
    placeholders: ["{{name}}", "{{form_name}}", "{{score}}", "{{group_name}}", "{{organization}}"],
  },
  activation: {
    label: "account activation email that includes a password setup link",
    placeholders: ["{{name}}", "{{organization}}", "{{activation_link}}"],
  },
  existing_user: {
    label: "access email for a person who already has an account (they must log in with their existing credentials)",
    placeholders: ["{{name}}", "{{organization}}", "{{login_url}}"],
  },
  rejection: {
    label: "polite rejection notification",
    placeholders: ["{{name}}", "{{form_name}}", "{{organization}}"],
  },
  manual: {
    label: "manual ad-hoc message to selected participants",
    placeholders: ["{{name}}", "{{group_name}}", "{{organization}}"],
  },
};

function parseJsonObject(raw) {
  const match = (raw || "").match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch (_) {
    return null;
  }
}

export async function POST(req) {
  try {
    const authError = await requireAuth(["super_admin", "admin"]);
    if (authError) return authError;

    const body = await req.json().catch(() => ({}));
    const templateKey = body.template_key;
    const spec = TEMPLATE_SPECS[templateKey];
    if (!spec) {
      return NextResponse.json(
        { success: false, error: "Invalid template_key" },
        { status: 400 }
      );
    }

    const formName = (body.form_name || "application").substring(0, 200);
    const organization = (body.organization || "Future Studio").substring(0, 100);
    const requestedLanguage = (body.language || "English").substring(0, 30);

    // ── Draft resolution ──
    // Empty body → use the platform's existing default template as the base
    // structure (never a new hardcoded document).
    const draftSubject = (body.existing_subject || "").trim().substring(0, 500);
    const existingBody = (body.existing_body || "").trim().substring(0, 8000);
    const draftBody = normalizeToHtml(existingBody || getDefaultTemplate(templateKey).body);

    // Every placeholder that already exists in the draft (plus the official
    // set for this template type) is allowed to survive personalization.
    const allowedNames = new Set([
      ...placeholdersOf(draftSubject),
      ...placeholdersOf(draftBody),
      ...spec.placeholders.map((p) => p.replace(/[{}]/g, "").toLowerCase()),
    ]);

    // LANGUAGE LOCK: personalization must NEVER translate the template.
    // When content already exists, the AI keeps its language exactly; only
    // empty drafts may use the requested language (platform defaults).
    const hasExistingContent = !!(draftSubject || existingBody);
    const languageRule = hasExistingContent
      ? "Write in the SAME language as the template content. Never translate the content into another language."
      : `Write in ${requestedLanguage}.`;

    const tone = `Tone: warm, professional, encouraging, concise. ${languageRule}`;

    // ── TIER 1 — full-body personalization with structural validation ──
    let tier1Body = null;
    let tier1Subject = null;
    try {
      const prompt = `You personalize email copy. You must NOT redesign the document.

EMAIL BODY (HTML template):
${draftBody}

${draftSubject ? `CURRENT SUBJECT: ${draftSubject}` : ""}

Personalize ONLY the wording of the text content. Preserve the structure exactly:
- identical HTML tags in identical order — do not add, remove, reorder, or rename any tag
- keep every <a> link and its href unchanged
- keep list markers and their numbering unchanged (1. 2. 3. or bullets)
- keep bold (<strong>/<b>) and italic (<em>/<i>) exactly where they are
- keep paragraph breaks and line breaks
- keep every {{placeholder}} exactly as written — never rename, remove, or add variables
- keep the language of the template — never translate the content into another language

${tone}
${draftSubject ? "Personalize the subject wording (keep its placeholders)." : 'Return an EMPTY string for "subject".'}

Return ONLY valid JSON with exactly two keys:
{"subject": "...", "body": "<the personalized HTML with identical structure>"}`;

      const raw = await deepseekIntelligence.chat(prompt, undefined, 4096);
      const parsed = parseJsonObject(raw);
      if (parsed) {
        const candidateBody =
          typeof parsed.body === "string" ? parsed.body.trim() : "";
        const check = validateStructure(draftBody, candidateBody, allowedNames);
        if (check.ok && candidateBody) {
          tier1Body = candidateBody;
        } else {
          console.warn(
            `[AI Personalize] Tier 1 rejected (${check.reason}) — falling back to segment splice`
          );
        }
        if (draftSubject) {
          const candidateSubject =
            typeof parsed.subject === "string" ? parsed.subject.trim() : "";
          const subjectCheck = validateSubject(draftSubject, candidateSubject, allowedNames);
          tier1Subject = subjectCheck.ok ? candidateSubject : draftSubject;
        }
      }
    } catch (e) {
      console.warn("[AI Personalize] Tier 1 failed:", e.message);
    }

    // ── TIER 2 — deterministic segment splice (structure guaranteed) ──
    let finalBody = tier1Body;
    if (!finalBody) {
      try {
        const parts = splitHtmlParts(draftBody);
        const segments = parts
          .filter((p) => p.type === "text" && p.value.trim().length > 0)
          .map((p) => p.value);

        if (segments.length > 0) {
          const segmentPrompt = `Personalize each text segment of an email individually.
Return ONLY valid JSON: {"segments": ["segment 1", "segment 2", ...]} with EXACTLY the same number of segments, in the same order.

Rules for every segment:
- keep {{placeholders}} exactly as written (never rename, remove, or add variables)
- keep list markers and their numbers (1. 2. 3., bullets, dashes)
- keep trailing spaces and line breaks within the segment
- only reword the human-readable text; keep it short and natural
- keep the language of the segment — never translate it into another language
- ${tone}

Segments (${segments.length}):
${segments.map((s, i) => `[${i + 1}] ${s}`).join("\n")}`;

          const raw = await deepseekIntelligence.chat(segmentPrompt, undefined, 4096);
          const parsed = parseJsonObject(raw);
          const candidates = parsed && Array.isArray(parsed.segments) ? parsed.segments : null;
          if (candidates && candidates.length === segments.length) {
            const cleaned = segments.map((original, i) => {
              let out = stripUnknownPlaceholders(
                ensureSegmentPlaceholders(original, candidates[i]),
                allowedNames
              );
              return out == null ? original : String(out);
            });
            finalBody = splicePersonalizedSegments(parts, cleaned);
          }
        }
      } catch (e) {
        console.warn("[AI Personalize] Tier 2 failed:", e.message);
      }
    }

    // ── Final guarantee ──
    if (!finalBody || countTextSegments(splitHtmlParts(finalBody)) === 0) {
      finalBody = draftBody; // keep the admin's structure untouched
    }
    // Ensure the result is well-formed HTML with paragraph structure even if
    // the AI returned plain text.
    finalBody = normalizeToHtml(finalBody);

    // Empty subject stays empty → the existing default-subject fallback
    // (run → form → platform default) applies when the email is sent.
    const finalSubject = finalizeSubject(draftSubject, tier1Subject);

    return NextResponse.json({ success: true, subject: finalSubject, body: finalBody });
  } catch (error) {
    console.error("[AI Personalize] Error:", error.message);
    return NextResponse.json(
      { success: false, error: `Personalization failed: ${error.message}` },
      { status: 500 }
    );
  }
}
