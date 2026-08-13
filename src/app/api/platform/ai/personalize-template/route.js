import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { deepseekIntelligence } from "@/lib/deepseek";

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
 * Uses the existing DeepSeek AI layer to write (or improve) a personalized
 * email template that uses the same {{variable}} placeholders as the
 * platform's email system. Returns { subject, body } — the caller decides
 * when to save (nothing is written to the database here).
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
  rejection: {
    label: "polite rejection notification",
    placeholders: ["{{name}}", "{{form_name}}", "{{organization}}"],
  },
};

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
    const language = (body.language || "English").substring(0, 30);
    const existingSubject = (body.existing_subject || "").substring(0, 500);
    const existingBody = (body.existing_body || "").substring(0, 4000);
    const hasDraft = !!(existingSubject.trim() || existingBody.trim());

    const prompt = `You are an expert email copywriter for "${organization}", an entrepreneurship incubator platform.

Write a ${spec.label} email for the form "${formName}" (organization: ${organization}).

Tone: warm, professional, encouraging, and concise. Write in ${language}. If the form name appears to be in French, write in French instead.

You MUST use these placeholders where natural (never invent other placeholders):
${spec.placeholders.join(", ")}

${hasDraft
  ? `Improve and personalize this existing draft while keeping its meaning:

Existing subject: ${existingSubject}
Existing body: ${existingBody}`
  : "Write from scratch."}

Requirements:
- "subject": 4-9 words, friendly, no ALL CAPS
- "body": a valid HTML fragment using inline styles only (no <style>, <html> or <body> tags). Use simple <p> and <strong> tags, comfortable spacing, and a warm sign-off. Always address the applicant personally with {{name}}.

Return ONLY valid JSON with exactly two keys, like:
{"subject": "...", "body": "<p>...</p>"}`;

    console.log(`[AI Personalize] ${templateKey} for form "${formName}" (${language})`);
    const raw = await deepseekIntelligence.chat(prompt, undefined, 4096);

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("[AI Personalize] No JSON in response");
      return NextResponse.json(
        { success: false, error: "AI returned an unreadable response — try again" },
        { status: 500 }
      );
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const subject = typeof parsed.subject === "string" ? parsed.subject.trim() : "";
    const bodyHtml = typeof parsed.body === "string" ? parsed.body.trim() : "";
    if (!subject || !bodyHtml) {
      return NextResponse.json(
        { success: false, error: "AI response was missing the subject or body — try again" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, subject, body: bodyHtml });
  } catch (error) {
    console.error("[AI Personalize] Error:", error.message);
    return NextResponse.json(
      { success: false, error: `Personalization failed: ${error.message}` },
      { status: 500 }
    );
  }
}
