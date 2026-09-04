import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth, getSession } from "@/lib/auth";
import {
  getMergedMatrix,
  setMatrixCell,
  clearOverride,
  VENTURE_PERMISSION_AREAS,
  VENTURE_PERMISSION_ACTIONS,
} from "@/lib/venturePermissions";

const READ_ROLES = ["super_admin", "developer", "admin"];
const WRITE_ROLES = ["super_admin", "developer", "admin"];

const validArea = (a) => VENTURE_PERMISSION_AREAS.includes(a);
const validAction = (a) => VENTURE_PERMISSION_ACTIONS.includes(a);

/**
 * GET /api/venture-permissions/matrix?responsibility=coach[&venture=VNT-XXXX]
 * Returns the merged matrix (platform defaults + per-venture overrides).
 */
export async function GET(req) {
  try {
    await initDb();
    const authError = await requireAuth(READ_ROLES);
    if (authError) return authError;
    const p = new URL(req.url).searchParams;
    const responsibilityCode = p.get("responsibility");
    const ventureId = p.get("venture");
    if (!responsibilityCode) {
      return NextResponse.json({ success: false, error: "responsibility is required." }, { status: 400 });
    }
    const matrix = await getMergedMatrix(db, { responsibilityCode, ventureId });
    return NextResponse.json({ success: true, matrix });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

/**
 * POST /api/venture-permissions/matrix
 * Body: { responsibility, area, action, allowed }
 *   with venture → per-Venture override (source of truth for THIS venture)
 *   without venture → platform default for the responsibility
 */
export async function POST(req) {
  try {
    await initDb();
    const authError = await requireAuth(WRITE_ROLES);
    if (authError) return authError;
    const session = await getSession();
    const { responsibility, area, action, allowed, venture } = await req.json();
    if (!validArea(area) || !validAction(action) || !responsibility) {
      return NextResponse.json({ success: false, error: "Invalid area, action or responsibility." }, { status: 400 });
    }
    await setMatrixCell(db, {
      responsibilityCode: responsibility,
      area,
      action,
      allowed: !!allowed,
      actorCid: session?.cid || null,
      ventureId: venture || null,
    });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

/**
 * DELETE /api/venture-permissions/matrix
 * Body: { responsibility, area, action, venture }
 * Removes the per-Venture override → inherits the platform default again.
 */
export async function DELETE(req) {
  try {
    await initDb();
    const authError = await requireAuth(WRITE_ROLES);
    if (authError) return authError;
    const { responsibility, area, action, venture } = await req.json();
    if (!responsibility || !validArea(area) || !validAction(action) || !venture) {
      return NextResponse.json({ success: false, error: "venture, responsibility, area and action are required." }, { status: 400 });
    }
    await clearOverride(db, { ventureId: venture, responsibilityCode: responsibility, area, action });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
