import { NextResponse } from "next/server";
import { deepseekIntelligence } from "@/lib/deepseek";
import { requireAuthorization } from "@/lib/authorization";
import { getDefaultTemplate } from "@/lib/email";
import { TEMPLATE_SPECS, variableGuide, specVariableNames } from "@/models/platform/ai/templateSpecs";
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
 *  - {{variables}} that are already present are never renamed or removed. The
 *    model MAY put one back where the text carries the concrete value it stands
 *    for — a pasted name, score or company must not become everyone's — but it
 *    may never invent a variable outside the message's list.
 *  - Empty subject stays empty so the existing default-subject fallback
 *    (run → form → platform default) applies at send time.
 */

export const dynamic = "force-dynamic";

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
    // This used to gate on a hardcoded role list (super_admin / admin), so no
    // grant, profile or template change could ever satisfy it and
    // the AI button answered 403 for every Program Manager and staff member.
    // Personalizing a template is an edit of that template, so it is now
    // governed by the capability of whichever surface the caller is in: Runs
    // (the message composer and the run-level templates) or Forms (the
    // form-level templates). Both are visible and grantable in the Permission
    // Center, under Communication → Runs / Forms.
    const runsError = await requireAuthorization("runs", "edit");
    if (runsError) {
      const formsError = await requireAuthorization("forms", "edit");
      if (formsError) return runsError;
    }

    const body = await req.json().catch(() => ({}));
    const templateKey = body.template_key;
    const spec = TEMPLATE_SPECS[templateKey];
    if (!spec) {
      return NextResponse.json(
        { success: false, error: "Invalid template_key" },
        { status: 400 }
      );
    }

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
      ...specVariableNames(spec),
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
- keep every {{variable}} that is ALREADY in the text exactly as written — never rename or remove one
- this message is reused for EVERY recipient, so no value belonging to one person may stay in it: when the text names the recipient, gives a score, names their project or company, or spells out the organisation, replace that value with the variable that stands for it
- use ONLY the variables listed below, and only where they replace a value they really stand for. Never turn an unrelated proper noun (a city, a partner, a product) into a variable, and never invent one
- keep the language of the template — never translate the content into another language

VARIABLES FOR THIS MESSAGE:
${variableGuide(spec)}

${tone}
${draftSubject ? "Personalize the subject wording (keep its variables, and put one back if the subject names a specific person or value)." : 'Return an EMPTY string for "subject".'}

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
    } catch (error) {
      console.warn("[AI Personalize] Tier 1 failed:", error.message);
    }

    // ── TIER 2 — deterministic segment splice (structure guaranteed) ──
    let finalBody = tier1Body;
    if (!finalBody) {
      try {
        const parts = splitHtmlParts(draftBody);
        const segments = parts
          .filter((part) => part.type === "text" && part.value.trim().length > 0)
          .map((part) => part.value);

        if (segments.length > 0) {
          const segmentPrompt = `Personalize each text segment of an email individually.
Return ONLY valid JSON: {"segments": ["segment 1", "segment 2", ...]} with EXACTLY the same number of segments, in the same order.

Rules for every segment:
- keep the {{variables}} that are already there exactly as written
- replace a concrete value that one of the variables below stands for with the variable itself — the message is reused for every recipient:
${variableGuide(spec)}
- never invent a variable that is not in that list, and never turn an unrelated proper noun into one
- keep list markers and their numbers (1. 2. 3., bullets, dashes)
- keep trailing spaces and line breaks within the segment
- only reword the human-readable text; keep it short and natural
- keep the language of the segment — never translate it into another language
- ${tone}

Segments (${segments.length}):
${segments.map((segment, index) => `[${index + 1}] ${segment}`).join("\n")}`;

          const raw = await deepseekIntelligence.chat(segmentPrompt, undefined, 4096);
          const parsed = parseJsonObject(raw);
          const candidates = parsed && Array.isArray(parsed.segments) ? parsed.segments : null;
          if (candidates && candidates.length === segments.length) {
            const cleaned = segments.map((original, index) => {
              const personalized = stripUnknownPlaceholders(
                ensureSegmentPlaceholders(original, candidates[index]),
                allowedNames
              );
              return personalized == null ? original : String(personalized);
            });
            finalBody = splicePersonalizedSegments(parts, cleaned);
          }
        }
      } catch (error) {
        console.warn("[AI Personalize] Tier 2 failed:", error.message);
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
