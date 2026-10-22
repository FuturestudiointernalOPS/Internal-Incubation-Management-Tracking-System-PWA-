import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { requireVentureScopedAccess } from "@/lib/ventureScopedAccess";
import {
  MAX_TEXTS_PER_REQUEST,
  isTranslationLanguage,
  translateContent,
} from "@/services/translations/contentTranslation";

export const dynamic = "force-dynamic";

/**
 * POST /api/translations — the content translation memory.
 *
 * One call per screen, carrying the DISTINCT texts a payload contains. The
 * service answers from its memory and only reaches the provider for what it has
 * never seen, so this controller stays about the gate, the shape and the limits:
 *
 *   - a session is required (a signed-in reader, never the public form — that
 *     screen keeps its own anonymous path);
 *   - both language codes must be ones the interface can display;
 *   - the batch is bounded, so the endpoint cannot be turned into a bulk
 *     translation service by a script.
 *
 * The texts themselves are content, and content is the caller's business: this
 * route does not decide what may be translated, only how much at once.
 *
 * The gate is the Venture the text belongs to, checked through the SCOPE-aware
 * helper: translating a Venture's work is reading that Venture's work, so a
 * Lead Manager may translate their own and nobody else's. That is also what
 * keeps this from becoming a general-purpose translation proxy.
 */
export const POST = createHandler(async (req) => {
  let body = null;
  try {
    body = await req.json();
  } catch {
    body = null;
  }

  const texts = Array.isArray(body?.texts) ? body.texts : null;
  const sourceLang = String(body?.sourceLang || "");
  const targetLang = String(body?.targetLang || "");
  const ventureId = typeof body?.ventureId === "string" ? body.ventureId.trim() : "";

  if (
    !texts ||
    texts.length === 0 ||
    texts.length > MAX_TEXTS_PER_REQUEST ||
    !ventureId ||
    !isTranslationLanguage(sourceLang) ||
    !isTranslationLanguage(targetLang)
  ) {
    return NextResponse.json(
      { success: false, error: "errors.invalidRequest" },
      { status: 400 },
    );
  }

  const access = await requireVentureScopedAccess({ ventureId, module: "ventures", capability: "view" });
  if (access.error) return access.error;

  const result = await translateContent({ texts, sourceLang, targetLang });
  return NextResponse.json({ success: true, ...result });
});
