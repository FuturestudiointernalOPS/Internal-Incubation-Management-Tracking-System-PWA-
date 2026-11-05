import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { getSession } from "@/server/auth/session";

import { ensureInvestorExpansionSchema } from "@/models/investor/expansionSchema";
import { requireAuthorization } from "@/models/authorization/index";
import {
  decideIntroduction,
  listIntroductionsForStudio,
  startReview,
} from "@/services/investor/introductions";

/** GET /api/admin/investors/introductions?status= — the studio review queue. */
export async function GET(req) {
  try {
    await initDb();
    await ensureInvestorExpansionSchema();

    const authError = await requireAuthorization("investor", "view");
    if (authError) return authError;

    const status = new URL(req.url).searchParams.get("status") || undefined;
    const result = await listIntroductionsForStudio({ status });
    return NextResponse.json({ success: true, requests: result.requests });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/** PUT — { id, action: "start_review" | "approve" | "decline", reason? } */
export async function PUT(req) {
  try {
    await initDb();
    await ensureInvestorExpansionSchema();

    const authError = await requireAuthorization("investor", "edit");
    if (authError) return authError;

    const { id, action, reason, relationship_manager_id } = await req.json();
    if (!id || !action) {
      return NextResponse.json({ success: false, error: "id and action required" }, { status: 400 });
    }

    const session = await getSession();

    if (action === "start_review") {
      const result = await startReview({ id, session });
      if (!result.ok) {
        return NextResponse.json({ success: false, error: result.error }, { status: result.status });
      }
      return NextResponse.json({ success: true, request: result.request });
    }

    if (action === "approve" || action === "decline") {
      const result = await decideIntroduction({
        id,
        decision: action === "approve" ? "approved" : "declined",
        reason: reason ?? null,
        relationshipManagerId: relationship_manager_id ?? null,
        session,
      });
      if (!result.ok) {
        return NextResponse.json({ success: false, error: result.error }, { status: result.status });
      }
      return NextResponse.json({ success: true, request: result.request, workspace: result.workspace ?? null });
    }

    return NextResponse.json({ success: false, error: "Unknown action" }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
