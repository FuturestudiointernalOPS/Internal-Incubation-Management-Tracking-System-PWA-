import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { initDb } from "@/lib/db";
import {
  getDraftRunIdByPublicSlug,
  getRunIdByPublicSlug,
  getDraftBySubmitter,
  getLatestDraftData,
  updateDraftData,
  insertDraftSubmission,
} from "@/models/publicFormRuns";

/**
 * PUBLIC FORM DRAFT — POST saves, GET reads back.
 *
 * POST /api/s/public-draft   { slug, data, email?, token? }
 * GET  /api/s/public-draft?slug=X&email=Y&token=Z
 *
 * PUB-2 — a draft used to be keyed by slug + email, both knowable, so anyone
 * who knew a respondent's address could READ or OVERWRITE their answers. A
 * draft now carries a random token, stored inside its own data and NEVER
 * returned by a read; it must be presented to update or read the draft. The
 * token is minted on the first save and handed to the caller, who keeps it
 * (the public form stores it alongside its local copy).
 */

/** 32 hex chars — unguessable, and never derived from the email/slug. */
function mintDraftToken() {
  return randomBytes(16).toString("hex");
}

/** The stored answers WITHOUT the token (the token is a secret, not a field). */
function stripToken(data) {
  if (!data || typeof data !== "object") return {};
  const { _draft_token, ...rest } = data;
  return rest;
}

export async function POST(req) {
  try {
    await initDb();
    const body = await req.json();
    const { slug, data, email, token } = body || {};

    if (!slug || !data) {
      return NextResponse.json({ success: false, error: "slug and data required" }, { status: 400 });
    }

    // Resolve slug to run_id
    let run_id = null;
    try {
      const runResult = await getDraftRunIdByPublicSlug(slug);
      if (runResult.rows.length > 0) run_id = runResult.rows[0].id;
    } catch (_) {}

    if (!run_id) {
      return NextResponse.json({ success: false, error: "Run not found" }, { status: 404 });
    }

    const submitterId = email || `public-${slug}`;
    const existing = await getDraftBySubmitter(run_id, submitterId);

    if (existing.rows.length > 0) {
      // UPDATE — the stored token must be presented, and it is carried over
      // untouched so the same caller keeps access on the next save.
      const stored = await getLatestDraftData(run_id, submitterId);
      const storedToken = stored.rows?.[0]?.data?._draft_token || null;
      if (!storedToken || String(token || "") !== String(storedToken)) {
        return NextResponse.json(
          { success: false, error: "errors.insufficientPermissions" },
          { status: 403 },
        );
      }
      const payload = { ...data, _draft_token: storedToken };
      await updateDraftData(payload, existing.rows[0].id);
      return NextResponse.json({
        success: true,
        id: existing.rows[0].id,
        action: "updated",
        token: storedToken,
      });
    }

    // CREATE — mint the token, store it WITH the draft, hand it to the caller.
    const minted = mintDraftToken();
    const payload = { ...data, _draft_token: minted };
    const result = await insertDraftSubmission(run_id, submitterId, payload);
    return NextResponse.json({
      success: true,
      id: result.rows[0].id,
      action: "created",
      token: minted,
    });
  } catch (error) {
    console.error("[Public Draft] Error:", error.message);
    return NextResponse.json({ success: false, error: "Failed to save draft" }, { status: 500 });
  }
}

export async function GET(req) {
  try {
    await initDb();
    const { searchParams } = new URL(req.url);
    const slug = searchParams.get("slug");
    const email = searchParams.get("email");
    const token = searchParams.get("token");

    if (!slug || !email) {
      return NextResponse.json({ success: false, error: "slug and email required" }, { status: 400 });
    }

    let run_id = null;
    try {
      const runResult = await getRunIdByPublicSlug(slug);
      if (runResult.rows.length > 0) run_id = runResult.rows[0].id;
    } catch (_) {}

    if (!run_id) {
      return NextResponse.json({ success: true, draft: null });
    }

    const draft = await getLatestDraftData(run_id, email);

    if (draft.rows.length === 0) {
      return NextResponse.json({ success: true, draft: null });
    }

    // The token is required, and it is never echoed back.
    const storedToken = draft.rows[0].data?._draft_token || null;
    if (!storedToken || String(token || "") !== String(storedToken)) {
      return NextResponse.json(
        { success: false, error: "errors.insufficientPermissions" },
        { status: 403 },
      );
    }

    return NextResponse.json({ success: true, draft: stripToken(draft.rows[0].data) });
  } catch (error) {
    console.error("[Public Draft GET] Error:", error.message);
    return NextResponse.json({ success: false, error: "Failed to retrieve draft" }, { status: 500 });
  }
}
