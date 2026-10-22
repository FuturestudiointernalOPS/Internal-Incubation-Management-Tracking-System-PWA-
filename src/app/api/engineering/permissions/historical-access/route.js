import { NextResponse } from "next/server";
import { getSession } from "@/server/auth/session";
import { requireAuthorization } from "@/models/authorization/index";
import { requireSameOrigin } from "@/lib/requestOrigin";
import {
  listRevocations,
  revokeHistoricalAccess,
  restoreHistoricalAccess,
  isRevocableContext,
} from "@/services/authorization/historicalAccessAdmin";

export const dynamic = "force-dynamic";

/**
 * HISTORICAL ACCESS REVOCATION API (Phase 7, decision D3 2/2).
 *
 *   GET ?cid=X   requires permissions.view_matrix
 *        → the person's current revocations (the retirement screen reads them).
 *        State-changing GET (it self-heals its table) — same-origin only.
 *
 *   POST  requires permissions.revoke
 *        body: { cid, context, reason? } → REVOKE the residual read (withdraw it).
 *
 *   DELETE ?cid=X&context=Y   requires permissions.revoke
 *        → RESTORE a previously revoked residual.
 *
 * The residual read is the derived read-only consultation an ex-manager keeps;
 * this never touches the relationship history, and the history reconcile consults
 * the record so a revocation sticks against later sweeps.
 */
export async function GET(req) {
  try {
    const originError = requireSameOrigin(req);
    if (originError) return originError;

    const capError = await requireAuthorization("permissions", "view_matrix");
    if (capError) return capError;

    const { searchParams } = new URL(req.url);
    const cid = searchParams.get("cid");
    if (!cid) {
      return NextResponse.json(
        { success: false, error: "cid is required" },
        { status: 400 },
      );
    }

    const res = await listRevocations(cid);
    return NextResponse.json({
      success: true,
      cid: String(cid),
      revocations: res.revocations || [],
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

export async function POST(req) {
  try {
    const capError = await requireAuthorization("permissions", "revoke");
    if (capError) return capError;

    const session = await getSession();
    const body = await req.json();
    const { cid, context, reason } = body || {};
    if (!cid || !isRevocableContext(context)) {
      return NextResponse.json(
        { success: false, error: "cid and a revocable context are required" },
        { status: 400 },
      );
    }

    const res = await revokeHistoricalAccess(String(cid), context, {
      actorCid: session?.cid,
      actorName: session?.name,
      reason,
    });
    if (!res.success) {
      return NextResponse.json(
        { success: false, error: res.error },
        { status: 400 },
      );
    }
    return NextResponse.json({ success: true, revoked: res.revoked });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

export async function DELETE(req) {
  try {
    const capError = await requireAuthorization("permissions", "revoke");
    if (capError) return capError;

    const session = await getSession();
    const { searchParams } = new URL(req.url);
    const cid = searchParams.get("cid");
    const context = searchParams.get("context");
    if (!cid || !isRevocableContext(context)) {
      return NextResponse.json(
        { success: false, error: "cid and a revocable context are required" },
        { status: 400 },
      );
    }

    const res = await restoreHistoricalAccess(String(cid), context, {
      actorCid: session?.cid,
      actorName: session?.name,
    });
    if (!res.success) {
      return NextResponse.json(
        { success: false, error: res.error },
        { status: 400 },
      );
    }
    return NextResponse.json({ success: true, applied: res.applied });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
