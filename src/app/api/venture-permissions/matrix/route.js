import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth, getSession } from "@/lib/auth";
import {
  getGlobalMatrix,
  setMatrixCell,
  VENTURE_PERMISSION_AREAS,
  VENTURE_PERMISSION_ACTIONS,
} from "@/lib/venturePermissions";

const READ_ROLES = ["super_admin"];
const WRITE_ROLES = ["super_admin"];

const validArea = (area) => VENTURE_PERMISSION_AREAS.includes(area);
const validAction = (action) => VENTURE_PERMISSION_ACTIONS.includes(action);

/**
 * GLOBAL Venture permission matrix — configured ONCE, applies to every
 * Venture through the responsibility profile. There is no per-Venture
 * matrix (assignments + scope are the only Venture-specific dimension).
 *
 * GET  /api/venture-permissions/matrix?responsibility=coach
 * POST { responsibility, area, action, allowed }  → global cell update
 */
export async function GET(req) {
  try {
    await initDb();
    const authError = await requireAuth(READ_ROLES);
    if (authError) return authError;
    const responsibilityCode = new URL(req.url).searchParams.get("responsibility");
    if (!responsibilityCode) {
      return NextResponse.json({ success: false, error: "responsibility is required." }, { status: 400 });
    }
    const matrix = await getGlobalMatrix(db, { responsibilityCode });
    return NextResponse.json({ success: true, matrix });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    await initDb();
    const authError = await requireAuth(WRITE_ROLES);
    if (authError) return authError;
    const session = await getSession();
    const { responsibility, area, action, allowed } = await req.json();
    if (!validArea(area) || !validAction(action) || !responsibility) {
      return NextResponse.json({ success: false, error: "Invalid area, action or responsibility." }, { status: 400 });
    }
    await setMatrixCell(db, {
      responsibilityCode: responsibility,
      area,
      action,
      allowed: !!allowed,
      actorCid: session?.cid || null,
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
