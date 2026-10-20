import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuthorization } from "@/models/authorization/index";
import { getSession } from "@/server/auth/session";
import {
  getGlobalMatrix,
  setMatrixCell,
  VENTURE_PERMISSION_AREAS,
  VENTURE_PERMISSION_ACTIONS,
} from "@/services/ventures/permissions";

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
    const authError = await requireAuthorization("permissions", "view_matrix");
    if (authError) return authError;
    const responsibilityCode = new URL(req.url).searchParams.get("responsibility");
    if (!responsibilityCode) {
      return NextResponse.json({ success: false, error: "responsibility is required." }, { status: 400 });
    }
    const matrix = await getGlobalMatrix({ responsibilityCode });
    return NextResponse.json({ success: true, matrix });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    await initDb();
    const authError = await requireAuthorization("permissions", "assign_responsibilities");
    if (authError) return authError;
    const session = await getSession();
    const { responsibility, area, action, allowed } = await req.json();
    if (!validArea(area) || !validAction(action) || !responsibility) {
      return NextResponse.json({ success: false, error: "Invalid area, action or responsibility." }, { status: 400 });
    }
    await setMatrixCell({
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
